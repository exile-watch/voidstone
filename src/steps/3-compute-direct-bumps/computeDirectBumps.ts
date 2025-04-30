import type { PackageUpdate } from "../../types.js";
import { computePackageBump } from "../../utils/computePackageBump/computePackageBump.js";

async function computeDirectBumps(
  rootDir: string,
  pkgPaths: string[],
): Promise<PackageUpdate[]> {
  const results = await Promise.all(
    pkgPaths.map(async (pkgPath) => {
      const bump = await computePackageBump(rootDir, pkgPath);
      if (!bump) return null;
      return { ...bump, dependencyUpdates: new Map<string, string>() };
    }),
  );
  return results.filter((b): b is PackageUpdate => b !== null);
}

export { computeDirectBumps };
