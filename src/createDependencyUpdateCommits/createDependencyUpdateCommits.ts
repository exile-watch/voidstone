import path from "node:path";
import { execWithLog } from "../execWithLog/execWithLog.js";

async function createDependencyUpdateCommits(
  rootDir: string,
  updates: Map<string, string>,
  pkgDir: string,
): Promise<void> {
  const relativeDir = path.relative(rootDir, pkgDir).split(path.sep).join("/");
  const commitMessages = [...updates].map(
    ([dep, version]) =>
      `chore(deps): bump ${dep} to v${version} in ${relativeDir}`,
  );

  for (const message of commitMessages) {
    try {
      execWithLog("git add package.json", {
        cwd: pkgDir,
        stdio: "pipe",
      });

      execWithLog(`git commit -m "${message}"`, {
        cwd: pkgDir,
        stdio: "pipe",
      });
    } catch (error) {
      if (error instanceof Error) {
        const execError = error as { stdout?: Buffer; stderr?: Buffer };
        console.error("Git command failed:");
        console.error("Command:", error.message);
        console.error("Working directory:", pkgDir);
        if (execError.stdout)
          console.error("stdout:", execError.stdout.toString());
        if (execError.stderr)
          console.error("stderr:", execError.stderr.toString());
      }
      throw error; // Re-throw to trigger rollback
    }
  }
}

export { createDependencyUpdateCommits };
