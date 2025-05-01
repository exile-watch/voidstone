import fs from "node:fs";
import path from "node:path";
import changelog from "conventional-changelog";
import getStream from "get-stream";
import type { PackageUpdate } from "../../types.js";

export async function updateChangelogs(
  rootDir: string,
  updates: PackageUpdate[],
): Promise<void> {
  for (const update of updates) {
    if (update.current === update.next) {
      continue;
    }

    const relativePath =
      path.relative(rootDir, update.pkgDir).split(path.sep).join("/") || ".";
    const gitRawCommitsOpts = {
      path: relativePath,
      from: `${update.name}@${update.current}`,
      to: `${update.name}@${update.next}`,
    };
    const options = {
      preset: "angular",
      tagPrefix: `${update.name}@`,
      releaseCount: 1,
    };

    const changelogStream = changelog(options, {}, gitRawCommitsOpts);
    const changelogContent = await getStream(changelogStream);

    // Throw an error if the changelog is empty or malformed
    if (!changelogContent.trim() || changelogContent.trim() === "# Changelog") {
      throw new Error(`Empty changelog generated for package: ${update.name}`);
    }

    const filePath = path
      .join(update.pkgDir, "CHANGELOG.md")
      .split(path.sep)
      .join("/");
    fs.writeFileSync(filePath, changelogContent);
  }
}
