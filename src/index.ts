#!/usr/bin/env node

import { validateEnvs } from "./steps/1-validate-envs/validateEnvs.js";
import { getRootDir } from "./steps/2-discover-root-dir/getRootDir.js";
import { computeDirectBumps } from "./steps/3-compute-direct-bumps/computeDirectBumps.js";
import { computeDependencyUpdates } from "./steps/4-compute-dependency-updates/computeDependencyUpdates.js";
import { computeTriggeredBumps } from "./steps/5-compute-triggered-bumps/computeTriggeredBumps.js";
import { runDryRun } from "./steps/6-run-dry-run/runDryRun.js";
import { updatePackageJsons } from "./steps/7-update-package-jsons/updatePackageJsons.js";
import { commitDependencyUpdates } from "./steps/8-commit-dependency-updates/commitDependencyUpdates.js";
import { updateChangelogs } from "./steps/9-update-changelogs/updateChangelogs.js";
import { commitAndTagReleases } from "./steps/10-commit-tag-releases/commitAndTagReleases.js";
import { publishAndRelease } from "./steps/11-publish-and-release/publishAndRelease.js";
import type { PackageUpdate, ReleaseInfo } from "./types.js";
import { getWorkspacePackagePaths } from "./utils/getWorkspacePackagePaths/getWorkspacePackagePaths.js";
import { rollback } from "./utils/rollback/rollback.js";

const releases: ReleaseInfo[] = [];
const releaseIds: Record<string, number> = {};

/**
 * Main release flow
 */
async function main(): Promise<void> {
  // 1. Validate environment variables
  validateEnvs();

  // 2. Discover root directory
  const rootDir = getRootDir();
  const pkgPaths = getWorkspacePackagePaths(rootDir);

  // 3. Compute direct bumps
  const updates = await computeDirectBumps(rootDir, pkgPaths);
  if (!updates.length) {
    console.log("📦 No package changes detected. Nothing to release.");
    return;
  }

  // 4. Compute dependency updates
  const dependencyBumps = computeDependencyUpdates(pkgPaths, updates);

  // 5. Compute triggered bumps
  await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

  try {
    // 6. Run dry-run publish checks
    runDryRun(updates);

    // 7. Apply version and dependency updates to package.json
    updatePackageJsons(updates);

    // 8. Commit dependency updates
    await commitDependencyUpdates(rootDir, updates);

    // 9. Update changelogs and track releases
    await updateChangelogs(rootDir, updates);

    // 10. Commit and tag releases
    commitAndTagReleases(updates);

    // 11. Publish packages and create GitHub releases
    await publishAndRelease(rootDir, updates, releaseIds);
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
