#!/usr/bin/env node

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import changelog from "conventional-changelog";
import { Bumper } from "conventional-recommended-bump";
import fg from "fast-glob";
import getStream from "get-stream";
import semver from "semver";

interface ReleaseInfo {
  name: string;
  current: string;
  next: string;
  pkgDir: string;
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
 * Read workspaces from root package.json
 */
function getWorkspacePackagePaths(rootDir: string): string[] {
  const rootPkg = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"),
  );
  const patterns: string[] = Array.isArray(rootPkg.workspaces)
    ? rootPkg.workspaces
    : [];
  return fg.sync(
    patterns.map((p) => path.join(rootDir, p, "package.json")),
    { dot: true },
  );
}

async function computePackageBump(
  pkgPath: string,
): Promise<ReleaseInfo | null> {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const name = pkg.name as string;
  const current = pkg.version as string;

  const bumper = new Bumper(path.dirname(pkgPath));
  bumper.loadPreset("angular");
  const { releaseType } = await bumper.bump();
  const bumpType = releaseType as "major" | "minor" | "patch";
  const next = semver.inc(current, bumpType);
  if (!next || next === current) return null;
  return { name, current, next, pkgDir: path.dirname(pkgPath) };
}

function rollback() {
  console.warn("Rolling back releases...");
  releases.forEach((info) => {
    const tag = `${info.name}@v${info.next}`;
    try {
      execSync(`git tag -d ${tag}`);
      execSync(`git push origin :refs/tags/${tag}`);
    } catch {}
    try {
      execSync("git reset --hard HEAD~1");
    } catch {}
    try {
      const unpubCmd = `npm unpublish ${info.name}@${info.next} --registry ${REGISTRY}`;
      execSync(unpubCmd, { stdio: "ignore", cwd: info.pkgDir });
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

async function main() {
  // Ensure required token is present
  if (!process.env.GH_TOKEN) {
    console.error("❌ GH_TOKEN environment variable is required for releasing");
    process.exit(1);
  }

  // Determine repo root and workspace package.json paths
  let rootDir: string;
  try {
    rootDir = findRepoRoot();
  } catch (e: any) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
  const pkgPaths = getWorkspacePackagePaths(rootDir);
  const bumps = await Promise.all(pkgPaths.map((p) => computePackageBump(p)));
  const toRelease = bumps.filter((b): b is ReleaseInfo => Boolean(b));

  if (toRelease.length === 0) {
    console.log("📦 No package changes detected. Nothing to release.");
    return;
  }

  // Preflight dry-run for each package
  toRelease.forEach(({ pkgDir }) => {
    const cmd = `npm publish --dry-run --registry ${REGISTRY}`;
    execSync(cmd, { cwd: pkgDir, stdio: "ignore" });
  });

  // Configure Git for actions
  execSync('git config user.name "github-actions[bot]"');
  execSync(
    'git config user.email "github-actions[bot]@users.noreply.github.com"',
  );

  for (const info of toRelease) {
    const { name, current, next, pkgDir } = info;
    console.log(`🔢 Releasing ${name}: ${current} → ${next}`);

    // Update version
    const pkgJsonPath = path.join(pkgDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as {
      [key: string]: any;
    };
    pkg.version = next;
    fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

    // Update inter-package deps
    const otherPkgPaths = toRelease.map((r) =>
      path.join(r.pkgDir, "package.json"),
    );
    otherPkgPaths
      .filter((p) => p !== pkgJsonPath)
      .forEach((otherPath) => {
        const otherPkg = JSON.parse(fs.readFileSync(otherPath, "utf-8")) as {
          [key: string]: any;
        };
        let updated = false;
        (
          [
            "dependencies",
            "devDependencies",
            "peerDependencies",
            "optionalDependencies",
          ] as const
        ).forEach((field) => {
          if (otherPkg[field]?.[name]) {
            otherPkg[field][name] = `^${next}`;
            updated = true;
          }
        });
        if (updated)
          fs.writeFileSync(otherPath, `${JSON.stringify(otherPkg, null, 2)}\n`);
      });

    // Generate changelog
    const logStream = changelog({
      preset: "angular",
      tagPrefix: `${name}@`,
      releaseCount: 0,
    });
    const log = await getStream(logStream);
    const changelogPath = path.join(pkgDir, "CHANGELOG.md");
    fs.writeFileSync(changelogPath, log);

    // Commit & tag
    const filesToAdd = [
      path.relative(rootDir, pkgJsonPath),
      path.relative(rootDir, changelogPath),
      ...otherPkgPaths.map((p) => path.relative(rootDir, p)),
    ].join(" ");
    execSync(`git add ${filesToAdd}`);
    execSync(
      `git commit -m \"chore(${name}): release v${next} and update deps\"`,
    );
    const tagName = `${name}@v${next}`;
    execSync(`git tag -a ${tagName} -m \"${name} v${next}\"`);
    execSync("git push --follow-tags", { stdio: "inherit" });

    // Publish to GitHub Packages
    const pubCmd = `npm publish --registry ${REGISTRY}`;
    execSync(pubCmd, { cwd: pkgDir, stdio: "inherit" });

    // Create GitHub release
    const [owner = "", repo = ""] =
      process.env.GITHUB_REPOSITORY?.split("/") ?? [];
    const octokit = new Octokit({ auth: process.env.GH_TOKEN });
    const release = await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      name: `${name}@v${next}`,
      body: log,
    });
    releaseIds[name] = release.data.id;
    releases.push(info);
  }

  console.log("🎉 All packages released successfully!");
}

main().catch((err) => {
  console.error(`Unexpected error: ${err}`);
  rollback();
  process.exit(1);
});
