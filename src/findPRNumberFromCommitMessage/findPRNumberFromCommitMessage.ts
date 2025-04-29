import { execWithLog } from "../execWithLog/execWithLog.js";

/**
 * Revert and reopen PR if it was closed
 */
function findPRNumberFromCommitMessage(commitHash: string): number | null {
  try {
    const message = execWithLog(
      `git log -1 --format=%B ${commitHash}`,
    ).toString();
    const prPattern = /\(\s*#(\d+)(?:\s+#\d+)*\s*\)/;
    const match = message.match(prPattern);
    return match ? Number.parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

export { findPRNumberFromCommitMessage };
