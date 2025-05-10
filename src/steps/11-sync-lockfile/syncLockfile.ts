import { execWithLog } from "../../utils/execWithLog/execWithLog.js";

function syncLockfile(rootDir: string): void {
  execWithLog("npm install --ignore-scripts", {
    cwd: rootDir,
    stdio: "inherit",
  });

  execWithLog("git add package-lock.json", { cwd: rootDir });

  try {
    console.log("ℹ️ Checking for changes in package-lock.json...");
    const hasChanges = execWithLog(
      "git diff --staged --quiet package-lock.json || echo 'has-changes'",
      { cwd: rootDir },
    ).includes("has-changes");

    if (hasChanges) {
      console.log("ℹ️ Changes detected in package-lock.json. Committing...");
      execWithLog(
        'git commit -m "chore(deps): sync package-lock.json [skip ci]"',
        { cwd: rootDir },
      );
    } else {
      console.log("ℹ️ No changes to package-lock.json, skipping commit.");
    }
  } catch (error) {
    console.error("❌ Error during lockfile synchronization:", error);
    throw error;
  }
}

export { syncLockfile };
