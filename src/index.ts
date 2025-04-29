#!/usr/bin/env node

import * as fs from "node:fs";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import changelog from "conventional-changelog";

import getStream from "get-stream";

import { computePackageBump } from "./computePackageBump/computePackageBump.js";
import { createDependencyUpdateCommits } from "./createDependencyUpdateCommits/createDependencyUpdateCommits.js";
import { execWithLog } from "./execWithLog/execWithLog.js";
import { findRepoRoot } from "./findRepoRoot/findRepoRoot.js";
import { getWorkspacePackagePaths } from "./getWorkspacePackagePaths/getWorkspacePackagePaths.js";
import { rollback } from "./rollback/rollback.js";
import type { PackageUpdate, ReleaseInfo } from "./types.js";

const releases: ReleaseInfo[] = [];
const releaseIds: Record<string, number> = {};
const REGISTRY = "https://npm.pkg.github.com/";

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

  try {
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
      const packagePath = path.relative(rootDir, update.pkgDir);
      const fullLog = await getStream(
        changelog({
          preset: "angular",
          tagPrefix: `${update.name}@`,
          releaseCount: 0,
          config: {
            gitRawCommitsOpts: {
              path: packagePath,
            },
          },
        }),
      );
      fs.writeFileSync(path.join(update.pkgDir, "CHANGELOG.md"), fullLog);
    }

    // 8. Create release commit
    const filesToCommit = updates.flatMap((update) => [
      path.relative(rootDir, path.join(update.pkgDir, "package.json")),
      path.relative(rootDir, path.join(update.pkgDir, "CHANGELOG.md")),
    ]);

    execWithLog(`git add ${filesToCommit.join(" ")}`);
    execWithLog('git commit -m "chore: release [skip ci]"');

    // Track releases only after successful commit
    updates.forEach((update) => releases.push(update));

    // 9. Create tags
    for (const update of updates) {
      const tagName = `${update.name}@${update.next}`;
      execWithLog(`git tag -a ${tagName} -m "${tagName}"`);
    }

    execWithLog("git push --follow-tags", { stdio: "inherit" });

    // 10. Publish packages and create GitHub releases
    for (const update of updates) {
      const packagePath = path.relative(rootDir, update.pkgDir);
      try {
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
            config: {
              gitRawCommitsOpts: {
                path: packagePath,
              },
            },
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
      } catch (error) {
        // biome-ignore lint/complexity/noUselessCatch: Re-throw to trigger rollback
        throw error;
      }
    }

    console.log("🎉 All packages released successfully!");
  } catch (error) {
    // biome-ignore lint/complexity/noUselessCatch: If anything fails after step 4, throw to trigger rollback
    throw error;
  }
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

  await rollback(releases, releaseIds);
  process.exit(1);
});
