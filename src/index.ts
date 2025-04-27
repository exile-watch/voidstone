#!/usr/bin/env node

import { execSync } from "node:child_process";
import type { ExecSyncOptions } from "node:child_process";

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

function execWithLog(command: string, options: ExecSyncOptions = {}): string {
  const workingDir = options.cwd ? ` (in ${options.cwd})` : "";
  console.log(`📝 Executing: ${command}${workingDir}`);
  try {
    const output = execSync(command, {
      ...options,
      encoding: "utf8",
      stdio: "pipe",
    });
    if (output && output.length > 0) {
      console.log(`✅ Output:\n${output.trim()}`);
    }
    return output;
  } catch (error) {
    console.error(`❌ Failed: ${command}${workingDir}`);
    throw error;
  }
}

async function createDependencyUpdateCommits(
  rootDir: string,
  updates: Map<string, string>,
  pkgDir: string,
): Promise<void> {
  const relativeDir = path.relative(rootDir, pkgDir);
  const commitMessages = [...updates].map(
    ([dep, version]) =>
      `chore(deps): bump ${dep} to v${version} in ${relativeDir}`,
  );

  for (const message of commitMessages) {
    try {
      execWithLog("git add package.json", {
        cwd: pkgDir,
        stdio: "pipe",
      });

      execWithLog(`git commit -m "${message}"`, {
        cwd: pkgDir,
        stdio: "pipe",
      });
    } catch (error) {
      if (error instanceof Error) {
        const execError = error as { stdout?: Buffer; stderr?: Buffer };
        console.error("Git command failed:");
        console.error("Command:", error.message);
        console.error("Working directory:", pkgDir);
        if (execError.stdout)
          console.error("stdout:", execError.stdout.toString());
        if (execError.stderr)
          console.error("stderr:", execError.stderr.toString());
      }
      throw error; // Re-throw to trigger rollback
    }
  }
}
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
  updatedDeps?: Map<string, string>,
): Promise<ReleaseInfo | null> {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const name = pkg.name as string;
  const current = pkg.version as string;
  const pkgDir = path.dirname(pkgPath);

  // If we have dependency updates, create commits for them
  if (updatedDeps && updatedDeps.size > 0) {
    await createDependencyUpdateCommits(rootDir, updatedDeps, pkgDir);
  }

  // Construct Bumper at repository root
  const bumper = new Bumper(rootDir);
  // Load conventional-changelog preset
  bumper.loadPreset("angular");
  // Configure tag prefix for this package's tags
  bumper.tag({ prefix: `${name}@` });
  // Add path filter to only consider commits affecting this package
  bumper.commits({
    path: path.relative(rootDir, pkgDir),
  });

  // Determine bump based on commits since last tag
  const { releaseType } = await bumper.bump(defaultWhatBump);
  const next = semver.inc(current, releaseType as "major" | "minor" | "patch");
  if (!next || next === current) return null;
  return { name, current, next, pkgDir };
}

/**
 * Revert and reopen PR if it was closed
 */
function findPRNumberFromCommitMessage(commitHash: string): number | null {
  try {
    const message = execWithLog(
      `git log -1 --format=%B ${commitHash}`,
    ).toString();
    const match = message.match(/\(#(\d+)\)/);
    return match ? Number.parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * Rollback any partial release actions
 */
async function rollback(): Promise<void> {
  console.warn("Rolling back releases...");
  const failedPackages = releases.map((r) => `${r.name}@${r.next}`).join(", ");
  const workflowUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

  // Store the commit hash before any release actions
  const originalCommit = execWithLog("git rev-parse HEAD").toString().trim();

  releases.forEach((info) => {
    const tag = `${info.name}@${info.next}`;
    try {
      // Remove tag locally and remotely
      execWithLog(`git tag -d ${tag}`);
      execWithLog(`git push origin :refs/tags/${tag}`);
    } catch {}

    try {
      // Count commits to revert (1 release commit + N dependency commits)
      const dependencyCommits =
        (info as PackageUpdate).dependencyUpdates?.size ?? 0;
      const commitsToRevert = 1 + dependencyCommits;

      // Reset HEAD by the number of commits
      execWithLog(`git reset --hard HEAD~${commitsToRevert}`);
    } catch {}

    try {
      // Unpublish package
      execWithLog(
        `npm unpublish ${info.name}@${info.next} --registry ${REGISTRY}`,
        { stdio: "ignore", cwd: info.pkgDir },
      );
    } catch {}

    try {
      // Delete GitHub release
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

  try {
    // Revert to the commit before any release actions
    execWithLog(`git reset --hard ${originalCommit}`);

    // Force push to revert main branch
    execWithLog("git push origin main --force");

    // Re-open the PR if we can find it
    const prNumber = findPRNumberFromCommitMessage(originalCommit);
    if (prNumber) {
      const [owner = "", repo = ""] =
        process.env.GITHUB_REPOSITORY?.split("/") ?? [];
      const octokit = new Octokit({ auth: process.env.GH_TOKEN });

      // Use await with Promise.all to handle both operations concurrently
      await Promise.all([
        octokit.pulls.update({
          owner,
          repo,
          pull_number: prNumber,
          state: "open",
        }),
        octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `⚠️ Release failed for: ${failedPackages}\n\nSee workflow details: ${workflowUrl}\n\nThis PR has been automatically reopened.`,
        }),
      ]);
    }
  } catch (error) {
    console.error("Failed to revert main branch:", error);
  }

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

  // 1. Calculate direct version bumps based on commits
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

  // 2. Calculate dependency updates
  const bumpMap = new Map(updates.map((u) => [u.name, u.next]));
  const dependencyBumps = new Map<string, Map<string, string>>();

  for (const pkgPath of pkgPaths) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = new Map<string, string>();

    for (const depType of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      const depsObject = pkg[depType];
      if (!depsObject) continue;

      Object.keys(depsObject).forEach((dep) => {
        const newVersion = bumpMap.get(dep);
        if (newVersion) {
          deps.set(dep, newVersion);
        }
      });
    }

    if (deps.size > 0) {
      dependencyBumps.set(pkg.name, deps);
    }
  }

  // 3. Calculate dependency-triggered bumps
  for (const [pkgName, deps] of dependencyBumps) {
    if (!updates.some((u) => u.name === pkgName)) {
      const pkgPath = pkgPaths.find((p) => {
        const pkg = JSON.parse(fs.readFileSync(p, "utf-8"));
        return pkg.name === pkgName;
      });
      if (!pkgPath) continue;

      const bump = await computePackageBump(rootDir, pkgPath);
      if (bump) {
        updates.push({
          ...bump,
          dependencyUpdates: deps,
        });
      }
    }
  }

  // 4. Run dry-run publish checks
  for (const update of updates) {
    execWithLog(`npm publish --dry-run --registry ${REGISTRY}`, {
      cwd: update.pkgDir,
      stdio: "ignore",
    });
  }

  // 5. Update all package.json files
  for (const update of updates) {
    const pkgJsonPath = path.join(update.pkgDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    pkg.version = update.next;

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
  }

  // 6. Create dependency commits
  for (const update of updates) {
    if (update.dependencyUpdates.size > 0) {
      await createDependencyUpdateCommits(
        rootDir,
        update.dependencyUpdates,
        update.pkgDir,
      );
    }
  }

  // 7. Update changelogs and track releases
  for (const update of updates) {
    const fullLog = await getStream(
      changelog({
        preset: "angular",
        tagPrefix: `${update.name}@`,
        releaseCount: 0,
      }),
    );
    fs.writeFileSync(path.join(update.pkgDir, "CHANGELOG.md"), fullLog);

    // Track this update for rollback operations and GitHub release creation.
    // If any step fails after this point, rollback() will:
    // 1. Remove git tags
    // 2. Revert commits
    // 3. Unpublish from npm
    // 4. Delete GitHub releases
    releases.push(update);
  }

  // 7. Final release commit
  const filesToCommit = updates.flatMap((update) => [
    path.relative(rootDir, path.join(update.pkgDir, "package.json")),
    path.relative(rootDir, path.join(update.pkgDir, "CHANGELOG.md")),
  ]);

  execWithLog(`git add ${filesToCommit.join(" ")}`);
  execWithLog('git commit -m "chore: release [skip ci]"');

  // 9. Create tags
  for (const update of updates) {
    const tagName = `${update.name}@${update.next}`;
    execWithLog(`git tag -a ${tagName} -m "${tagName}"`);
  }

  execWithLog("git push --follow-tags", { stdio: "inherit" });

  // 10. Publish packages and create GitHub releases
  for (const update of updates) {
    execWithLog(`npm publish --registry ${REGISTRY}`, {
      cwd: update.pkgDir,
      stdio: "inherit",
    });

    const [owner = "", repo = ""] =
      process.env.GITHUB_REPOSITORY?.split("/") ?? [];
    const octokit = new Octokit({ auth: process.env.GH_TOKEN });
    const tagName = `${update.name}@${update.next}`;
    const latestLog = await getStream(
      changelog({
        preset: "angular",
        tagPrefix: `${update.name}@`,
        releaseCount: 1,
      }),
    );

    const release = await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      name: tagName,
      body: latestLog,
    });

    releaseIds[update.name] = release.data.id;
  }

  console.log("🎉 All packages released successfully!");
}

main().catch(async (err) => {
  console.error("Release failed with error:");
  if (err instanceof Error) {
    console.error("Name:", err.name);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);

    // Check for child_process error details
    const execError = err as { stdout?: Buffer; stderr?: Buffer };
    if (execError.stdout) console.error("stdout:", execError.stdout.toString());
    if (execError.stderr) console.error("stderr:", execError.stderr.toString());
  } else {
    console.error(err);
  }

  await rollback();
  process.exit(1);
});
