import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";

/**
 * Read workspaces from root package.json, or default to root package
 */
function getWorkspacePackagePaths(rootDir: string): string[] {
  const rootPkgPath = path.join(rootDir, "package.json");
  let rootPkg: Record<string, any>;

  try {
    rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
  } catch (error) {
    throw new Error(`Malformed package.json in ${rootPkgPath}`);
  }

  if (rootPkg.workspaces !== undefined) {
    if (!Array.isArray(rootPkg.workspaces)) {
      throw new Error(
        `Invalid workspaces field in ${rootPkgPath}: must be an array`,
      );
    }
    // Validate that every item in the workspaces array is a string.
    if (!rootPkg.workspaces.every((item: any) => typeof item === "string")) {
      throw new Error(
        `Invalid workspaces field in ${rootPkgPath}: every workspace must be a string`,
      );
    }
  }

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

export { getWorkspacePackagePaths };
