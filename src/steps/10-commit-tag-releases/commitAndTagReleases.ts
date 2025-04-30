import path from "node:path";
import type { PackageUpdate } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";

function commitAndTagReleases(updates: PackageUpdate[]): void {
  const rootDir = process.cwd();
  const files = updates.flatMap((u) => [
    path.relative(rootDir, path.join(u.pkgDir, "package.json")),
    path.relative(rootDir, path.join(u.pkgDir, "CHANGELOG.md")),
  ]);
  execWithLog(`git add ${files.join(" ")}`);
  execWithLog('git commit -m "chore: release [skip ci]"');

  for (const u of updates) {
    const tag = `${u.name}@${u.next}`;
    execWithLog(`git tag -a ${tag} -m "${tag}"`);
  }
  execWithLog("git push --follow-tags", { stdio: "inherit" });
}

export { commitAndTagReleases };
