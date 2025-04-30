import fs from "node:fs";
import path from "node:path";
import type { PackageUpdate } from "../../types.js";
import { computePackageBump } from "../../utils/computePackageBump/computePackageBump.js";

async function computeTriggeredBumps(
  rootDir: string,
  pkgPaths: string[],
  updates: PackageUpdate[],
  dependencyBumps: Map<string, Map<string, string>>,
): Promise<void> {
  const normalizedPaths = pkgPaths
    .filter(Boolean)
    .map((p) => path.normalize(p).split(path.sep).join("/"));

  for (const [pkgName, deps] of dependencyBumps) {
    // Skip if this package is already in updates
    if (updates.find((u) => u.name === pkgName)) {
      continue;
    }

    // Find the matching package path
    const pkgPath = normalizedPaths.find((p) => {
      try {
        const content = fs.readFileSync(p, "utf-8");
        const json = JSON.parse(content.replace(/^\uFEFF/, ""));
        return json.name === pkgName;
      } catch {
        return false;
      }
    });

    // Skip if no package path found
    if (!pkgPath) {
      continue;
    }

    try {
      const result = await computePackageBump(rootDir, pkgPath);
      if (result) {
        updates.push({
          ...result,
          dependencyUpdates: deps,
        });
      }
    } catch {
      // Handle errors gracefully
    }
  }
}

export { computeTriggeredBumps };
