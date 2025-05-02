import { execWithLog } from "../../utils/execWithLog/execWithLog.js";

async function syncLockfile(rootDir: string): Promise<void> {
  execWithLog("npm install", { cwd: rootDir, stdio: "inherit" });
  execWithLog("git add package-lock.json", { cwd: rootDir });
  execWithLog('git commit -m "chore(deps): sync package-lock.json"', {
    cwd: rootDir,
  });
}

export { syncLockfile };
