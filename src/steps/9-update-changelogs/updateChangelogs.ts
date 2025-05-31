import fs from "node:fs";
import path from "node:path";
import conventionalChangelog from "conventional-changelog";
import getStream from "get-stream";
import type { PackageUpdate } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";

export async function updateChangelogs(
  rootDir: string,
  updates: PackageUpdate[],
): Promise<void> {
  // Remember original working directory so we can restore it later
  const originalCwd = process.cwd();
  execWithLog("git fetch --tags --prune", { cwd: rootDir });

  try {
    for (const { name, current, next, pkgDir } of updates) {
      // If version didn’t actually change, skip
      if (current === next) continue;

      // Determine the path relative to the repo root
      const relativePath =
        path.relative(rootDir, pkgDir).split(path.sep).join("/") || ".";

      const options = {
        preset: "angular",
        tagPrefix: `${name}@`, // e.g. “@my-pkg@1.2.3”
        releaseCount: 0, // 0 means “all releases” for this package
        lernaPackage: name, // scope to that one monorepo package
      };

      const context = {};

      // Change into the repo root so that git commands see every tag
      process.chdir(rootDir);

      // Generate the ENTIRE Changelog for this package
      const changelogStream = conventionalChangelog(options, context, {
        path: relativePath,
      });

      const fullChangelog = await getStream(changelogStream);

      if (!fullChangelog.trim() || /^# Changelog$/.test(fullChangelog.trim())) {
        throw new Error(`Empty changelog generated for package: ${name}`);
      }

      // Write (overwrite) the file at `<pkgDir>/CHANGELOG.md`
      let filePath = path.join(pkgDir, "CHANGELOG.md");
      filePath = filePath.split(path.sep).join("/"); // normalize slashes
      fs.writeFileSync(filePath, fullChangelog);
    }
  } finally {
    // No matter what happens, restore cwd
    process.chdir(originalCwd);
  }
}
