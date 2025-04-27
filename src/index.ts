#!/usr/bin/env node

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import changelog from "conventional-changelog";
import type { Commit } from "conventional-commits-parser";
import {
  Bumper,
  type BumperRecommendation,
} from "conventional-recommended-bump";
import fg from "fast-glob";
import getStream from "get-stream";
import semver from "semver";

const defaultWhatBump = async (
  commits: Commit[],
): Promise<BumperRecommendation | null | undefined> => {
  if (!commits.length) return null;

  // Level meanings:
  // 0 = major version bump - breaking changes
  // 1 = minor version bump - new features
  // 2 = patch version bump - fixes and small changes
  let level: 0 | 1 | 2 = 2;
  let breakings = 0;
  let features = 0;

  for (const commit of commits) {
    switch (commit.type) {
      case "feat":
        features += 1;
        if (Number(level) === 2) {
          level = 1;
        }
        break;
      case "fix":
      case "perf":
      case "refactor":
      case "chore":
      case "docs":
      case "style":
      case "test":
        // These types only contribute to patch version
        break;
      default:
        break;
    }

    // Check for BREAKING CHANGES in any commit type
    if (commit.notes.length > 0) {
      breakings += commit.notes.length;
      level = 0;
    }
  }
  return {
    level,
    reason: breakings
      ? `There are ${breakings} BREAKING CHANGES`
      : features
        ? `There are ${features} new features`
        : "There are only patch changes in this release",
    releaseType:
      Number(level) === 0 ? "major" : Number(level) === 1 ? "minor" : "patch",
  };
};

interface ReleaseInfo {
  name: string;
  current: string;
  next: string;
  pkgDir: string;
}
interface PackageUpdate extends ReleaseInfo {
  dependencyUpdates: Map<string, string>;
}
const releases: ReleaseInfo[] = [];
const releaseIds: Record<string, number> = {};
const REGISTRY = "https://npm.pkg.github.com/";

/**
 * Ascend from cwd to locate repository root (contains package.json)
 */
function findRepoRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find package.json in any parent directory");
}

/**
 * Read workspaces from root package.json, or default to root package
 */
function getWorkspacePackagePaths(rootDir: string): string[] {
  const rootPkgPath = path.join(rootDir, "package.json");
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
  const patterns: string[] =
    Array.isArray(rootPkg.workspaces) && rootPkg.workspaces.length > 0
      ? rootPkg.workspaces
      : [];
  const pkgPaths = fg.sync(
    patterns.map((p) => path.join(rootDir, p, "package.json")),
    { dot: true },
  );
  return pkgPaths.length > 0 ? pkgPaths : [rootPkgPath];
}

/**
 * Compute next version bump for a package via conventional commits
 */
async function computePackageBump(
  rootDir: string,
  pkgPath: string,
): Promise<ReleaseInfo | null> {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const name = pkg.name as string;
  const current = pkg.version as string;
  const pkgDir = path.dirname(pkgPath);

  // Construct Bumper at repository root
  const bumper = new Bumper(rootDir);
  // Load conventional-changelog preset
  bumper.loadPreset("angular");
  // Configure tag prefix for this package's tags
  bumper.tag({ prefix: `${name}@` });

  // Determine bump based on commits since last tag
  const { releaseType } = await bumper.bump(defaultWhatBump);
  const next = semver.inc(current, releaseType as "major" | "minor" | "patch");
  if (!next || next === current) return null;
  return { name, current, next, pkgDir };
}

/**
 * Rollback any partial release actions
 */
function rollback(): void {
  console.warn("Rolling back releases...");
  releases.forEach((info) => {
    const tag = `${info.name}@${info.next}`;
    try {
      execSync(`git tag -d ${tag}`);
      execSync(`git push origin :refs/tags/${tag}`);
    } catch {}
    try {
      execSync("git reset --hard HEAD~1");
    } catch {}
    try {
      execSync(
        `npm unpublish ${info.name}@${info.next} --registry ${REGISTRY}`,
        { stdio: "ignore", cwd: info.pkgDir },
      );
    } catch {}
    try {
      const id = releaseIds[info.name];
      if (id) {
        const [owner = "", repo = ""] =
          process.env.GITHUB_REPOSITORY?.split("/") ?? [];
        new Octokit({ auth: process.env.GH_TOKEN }).repos.deleteRelease({
          owner,
          repo,
          release_id: id,
        });
      }
    } catch {}
  });
  console.warn("Rollback complete.");
}

/**
 * Main release flow
 */
async function main(): Promise<void> {
  if (!process.env.GH_TOKEN) {
    console.error("❌ GH_TOKEN environment variable is required for releasing");
    process.exit(1);
  }

  let rootDir: string;
  try {
    rootDir = findRepoRoot();
  } catch (e: any) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }

  const pkgPaths = getWorkspacePackagePaths(rootDir);

  // 1. First pass: compute direct version bumps
  const directBumps = await Promise.all(
    pkgPaths.map(async (pkgPath) => {
      const bump = await computePackageBump(rootDir, pkgPath);
      if (!bump) return null;
      return {
        ...bump,
        dependencyUpdates: new Map<string, string>(),
      } as PackageUpdate;
    }),
  );

  const updates: PackageUpdate[] = directBumps.filter(
    (bump): bump is PackageUpdate => bump !== null,
  );

  if (updates.length === 0) {
    console.log("📦 No package changes detected. Nothing to release.");
    return;
  }

  // 2. Second pass: compute dependency updates
  const bumpMap = new Map(updates.map((u) => [u.name, u.next]));

  for (const pkgPath of pkgPaths) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const update = updates.find((u) => u.name === pkg.name);
    if (!update) continue;

    for (const depType of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      const deps = pkg[depType];
      if (!deps) continue;

      Object.keys(deps).forEach((dep) => {
        const newVersion = bumpMap.get(dep);
        if (newVersion) {
          update.dependencyUpdates.set(dep, newVersion);
        }
      });
    }
  }

  // Dry-run publish
  updates.forEach((update) => {
    execSync(`npm publish --dry-run --registry ${REGISTRY}`, {
      cwd: update.pkgDir,
      stdio: "ignore",
    });
  });

  // Git setup
  execSync('git config user.name "github-actions[bot]"');
  execSync(
    'git config user.email "github-actions[bot]@users.noreply.github.com"',
  );

  // Single pass for all updates
  for (const update of updates) {
    // Update package.json version
    const pkgJsonPath = path.join(update.pkgDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    pkg.version = update.next;

    // Update dependencies
    for (const [dep, version] of update.dependencyUpdates) {
      for (const depType of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ]) {
        if (pkg[depType]?.[dep]) {
          pkg[depType][dep] = `^${version}`;
        }
      }
    }

    fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

    // Generate changelog
    const log = await getStream(
      // releaseCount: 1 means only the last release
      changelog({
        preset: "angular",
        tagPrefix: `${update.name}@`,
        releaseCount: 1,
      }),
    );
    fs.writeFileSync(path.join(update.pkgDir, "CHANGELOG.md"), log);

    releases.push(update);
  }

  // Single commit for all changes
  const filesToCommit = updates.flatMap((update) => [
    path.relative(rootDir, path.join(update.pkgDir, "package.json")),
    path.relative(rootDir, path.join(update.pkgDir, "CHANGELOG.md")),
  ]);

  execSync(`git add ${filesToCommit.join(" ")}`);
  execSync('git commit -m "chore: release [skip-ci]"');

  // Create all tags
  for (const update of updates) {
    const tagName = `${update.name}@${update.next}`;
    execSync(`git tag -a ${tagName} -m "${tagName}"`);
  }

  // Single push with all tags
  execSync("git push --follow-tags", { stdio: "inherit" });

  // Publish packages
  for (const update of updates) {
    execSync(`npm publish --registry ${REGISTRY}`, {
      cwd: update.pkgDir,
      stdio: "inherit",
    });

    // Create GitHub release
    const [owner = "", repo = ""] =
      process.env.GITHUB_REPOSITORY?.split("/") ?? [];
    const octokit = new Octokit({ auth: process.env.GH_TOKEN });
    const tagName = `${update.name}@${update.next}`;
    const log = await getStream(
      changelog({
        preset: "angular",
        tagPrefix: `${update.name}@`,
        releaseCount: 0,
      }),
    );

    const release = await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      name: tagName,
      body: log,
    });

    releaseIds[update.name] = release.data.id;
  }

  console.log("🎉 All packages released successfully!");
}

main().catch((err) => {
  console.error(`Unexpected error: ${err}`);
  rollback();
  process.exit(1);
});
