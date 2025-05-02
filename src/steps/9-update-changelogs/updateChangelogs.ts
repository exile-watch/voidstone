import fs from "node:fs";
import path from "node:path";
import conventionalChangelog from "conventional-changelog";
import getStream from "get-stream";
import type { PackageUpdate } from "../../types.js";

export async function updateChangelogs(
  rootDir: string,
  updates: PackageUpdate[],
): Promise<void> {
  // remember original working directory
  const originalCwd = process.cwd();

  try {
    for (const { name, current, next, pkgDir } of updates) {
      if (current === next) continue;

      const relativePath =
        path.relative(rootDir, pkgDir).split(path.sep).join("/") || ".";

      const options = {
        preset: "angular",
        tagPrefix: `${name}@`,
        releaseCount: 0,
        lernaPackage: name,
      };

      const context = {};

      const gitRawCommitsOpts = {
        path: relativePath,
        from: `${name}@${current}`,
        to: `${name}@${next}`,
      };

      // switch into repo root so git commands run correctly
      process.chdir(rootDir);

      const stream = conventionalChangelog(options, context, gitRawCommitsOpts);
      const changelogContent = await getStream(stream);

      if (
        !changelogContent.trim() ||
        /^# Changelog$/.test(changelogContent.trim())
      ) {
        throw new Error(`Empty changelog generated for package: ${name}`);
      }

      // normalize to forward slashes for cross-platform consistency
      let filePath = path.join(pkgDir, "CHANGELOG.md");
      filePath = filePath.split(path.sep).join("/");

      fs.writeFileSync(filePath, changelogContent);
    }
  } finally {
    // restore original working directory
    process.chdir(originalCwd);
  }
}
