import { validateEnvs } from "../steps/1-validate-envs/validateEnvs.js";
import { getRootDir } from "../steps/2-discover-root-dir/getRootDir.js";
import { computeDirectBumps } from "../steps/3-compute-direct-bumps/computeDirectBumps.js";
import { computeDependencyUpdates } from "../steps/4-compute-dependency-updates/computeDependencyUpdates.js";
import { computeTriggeredBumps } from "../steps/5-compute-triggered-bumps/computeTriggeredBumps.js";
import { runDryRun } from "../steps/6-run-dry-run/runDryRun.js";
import { updatePackageJsons } from "../steps/7-update-package-jsons/updatePackageJsons.js";
import { commitDependencyUpdates } from "../steps/8-commit-dependency-updates/commitDependencyUpdates.js";
import { updateChangelogs } from "../steps/9-update-changelogs/updateChangelogs.js";
import { commitAndTagReleases } from "../steps/10-commit-tag-releases/commitAndTagReleases.js";
import { publishAndRelease } from "../steps/11-publish-and-release/publishAndRelease.js";
import type { PackageUpdate, ReleaseIds } from "../types.js";
import { getWorkspacePackagePaths } from "../utils/getWorkspacePackagePaths/getWorkspacePackagePaths.js";
import { rollback } from "../utils/rollback/rollback.js";

async function main(): Promise<void> {
  let updates: PackageUpdate[] = [];
  let releaseIds: ReleaseIds = {};

  // 1. Validate environment variables
  validateEnvs();

  // 2. Discover root directory
  const rootDir = getRootDir();
  const pkgPaths = getWorkspacePackagePaths(rootDir);

  // 3. Compute direct bumps
  updates = await computeDirectBumps(rootDir, pkgPaths);
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
    try {
      const ids = await publishAndRelease(rootDir, updates, releaseIds);
      releaseIds = ids;
      console.log("🎉 All packages released successfully!");
    } catch (publishError: any) {
      if (publishError.releaseIds) {
        releaseIds = publishError.releaseIds as ReleaseIds;
      }
      // Re-throw so outer catch can rollback
      throw publishError;
    }
  } catch (error) {
    // If anything fails after step 5, roll back using whatever
    // releaseIds we managed to collect above
    await rollback(updates, releaseIds);
    throw error;
  }
}

export { main };
