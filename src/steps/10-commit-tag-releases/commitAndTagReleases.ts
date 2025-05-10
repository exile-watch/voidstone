import path from "node:path";
import type { PackageUpdate } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";
import { syncLockfile } from "../11-sync-lockfile/syncLockfile.js";

function commitAndTagReleases(updates: PackageUpdate[]): void {
  if (updates.length === 0) {
    console.log("📦 No package changes detected.");
    return;
  }

  const rootDir = process.cwd();
  console.log(`ℹ️ Preparing updates for ${updates.length} packages...`);
  const files = updates
    .flatMap((u) => [
      path.relative(rootDir, path.join(u.pkgDir, "package.json")),
      path.relative(rootDir, path.join(u.pkgDir, "CHANGELOG.md")),
    ])
    .map((p) => p.split(path.sep).join("/")); // Normalize path separators to forward slashes
  console.log(`✅ Updated ${files.length} files.`);

  execWithLog(`git add ${files.join(" ")}`);

  syncLockfile(rootDir);

  execWithLog('git commit -m "chore: release [skip ci]"');

  for (const u of updates) {
    const tag = `${u.name}@${u.next}`;
    try {
      execWithLog(`git tag -a ${tag} -m "${tag}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`❌ Failed to tag ${u.name}: ${message}`);
    }
  }
  execWithLog("git push --follow-tags", { stdio: "inherit" });
}

export { commitAndTagReleases };
