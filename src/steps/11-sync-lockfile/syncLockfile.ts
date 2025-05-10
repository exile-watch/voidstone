import { execWithLog } from "../../utils/execWithLog/execWithLog.js";

function syncLockfile(rootDir: string): void {
  execWithLog("npm install", { cwd: rootDir, stdio: "inherit" });
  execWithLog("git add package-lock.json", { cwd: rootDir });

  try {
    execWithLog(
      "git diff --staged --quiet package-lock.json || echo 'has-changes'",
      {
        cwd: rootDir,
      },
    ).includes("has-changes") &&
      execWithLog('git commit -m "chore(deps): sync package-lock.json"', {
        cwd: rootDir,
      });
  } catch (error) {
    console.log("📝 No changes to package-lock.json, skipping commit");
  }
}

export { syncLockfile };
