import fs from "node:fs";
import path from "node:path";
import changelog from "conventional-changelog";
import getStream from "get-stream";
import type { PackageUpdate } from "../../types.js";

async function updateChangelogs(
  rootDir: string,
  updates: PackageUpdate[],
): Promise<void> {
  for (const u of updates) {
    const pkgRel = path.relative(rootDir, u.pkgDir);
    const fullLog = await getStream(
      changelog({
        preset: "angular",
        tagPrefix: `${u.name}@`,
        releaseCount: 0,
        config: { gitRawCommitsOpts: { path: pkgRel } },
      }),
    );
    fs.writeFileSync(path.join(u.pkgDir, "CHANGELOG.md"), fullLog);
  }
}

export { updateChangelogs };
