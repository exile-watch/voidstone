import { execWithLog } from "../../utils/execWithLog/execWithLog.js";

function syncLockfile(rootDir: string): void {
  execWithLog("npm install", { cwd: rootDir, stdio: "inherit" });
  execWithLog("git add package-lock.json", { cwd: rootDir });

  try {
    const hasChanges = execWithLog(
      "git diff --staged --quiet package-lock.json || echo 'has-changes'",
      { cwd: rootDir },
    ).includes("has-changes");

    if (hasChanges) {
      execWithLog('git commit -m "chore(deps): sync package-lock.json"', {
        cwd: rootDir,
      });
      execWithLog("git push", { cwd: rootDir });
    } else {
      console.log("📝 No changes to package-lock.json, skipping commit");
    }
  } catch (error) {
    console.log("📝 Error syncing package-lock.json, skipping commit");
  }
}

export { syncLockfile };
