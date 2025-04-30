import type { PackageUpdate } from "../../types.js";
import { createDependencyUpdateCommits } from "../../utils/createDependencyUpdateCommits/createDependencyUpdateCommits.js";

async function commitDependencyUpdates(
  rootDir: string,
  updates: PackageUpdate[],
): Promise<void> {
  for (const u of updates) {
    if (u.dependencyUpdates.size) {
      await createDependencyUpdateCommits(
        rootDir,
        u.dependencyUpdates,
        u.pkgDir,
      );
    }
  }
}

export { commitDependencyUpdates };
