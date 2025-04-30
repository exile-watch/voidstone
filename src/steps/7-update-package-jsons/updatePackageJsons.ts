import fs from "node:fs";
import path from "node:path";
import type { PackageUpdate } from "../../types.js";

function updatePackageJsons(updates: PackageUpdate[]): void {
  for (const u of updates) {
    const pkgPath = path.join(u.pkgDir, "package.json");
    const content = fs.readFileSync(pkgPath, "utf-8").replace(/^\uFEFF/, "");
    const pkg = JSON.parse(content);
    pkg.version = u.next;

    for (const [dep, v] of u.dependencyUpdates) {
      for (const depType of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ]) {
        if (pkg[depType] !== undefined) {
          const currentVersion = pkg[depType][dep];
          if (typeof currentVersion === "string") {
            // Handle git dependencies
            if (
              currentVersion.includes("git+") ||
              currentVersion.startsWith("github:")
            ) {
              continue;
            }
            // Handle workspace dependencies
            if (currentVersion.startsWith("workspace:")) {
              pkg[depType][dep] = `workspace:^${v}`;
              continue;
            }
            // Handle file and link protocol dependencies
            if (
              currentVersion.startsWith("file:") ||
              currentVersion.startsWith("link:")
            ) {
              continue;
            }
            // Handle URL-style dependencies
            if (
              currentVersion.startsWith("http:") ||
              currentVersion.startsWith("https:")
            ) {
              continue;
            }
            // Handle npm aliases
            if (currentVersion.startsWith("npm:")) {
              const withoutPrefix = currentVersion.slice(4);
              const lastAt = withoutPrefix.lastIndexOf("@");
              if (lastAt === -1) {
                // Invalid alias format - update as regular semver
                pkg[depType][dep] = `^${v}`;
              } else {
                const packageName = withoutPrefix.slice(0, lastAt);
                pkg[depType][dep] = `npm:${packageName}@^${v}`;
              }
              continue;
            }
          }
          // For non-string values or regular semver values, update the version
          pkg[depType][dep] = `^${v}`;
        }
      }
    }
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

export { updatePackageJsons };
