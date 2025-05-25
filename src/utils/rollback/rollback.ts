import { Octokit } from "@octokit/rest";
import { REGISTRY } from "../../constants.js";
import type { ReleaseIds, ReleaseInfo } from "../../types.js";
import { execWithLog } from "../execWithLog/execWithLog.js";
import { findPRNumberFromCommitMessage } from "../findPRNumberFromCommitMessage/findPRNumberFromCommitMessage.js";

/**
 * Rollback any partial release actions
 */
async function rollback(
  releases: ReleaseInfo[],
  releaseIds: ReleaseIds,
): Promise<void> {
  console.warn("Rolling back releases...");
  const failedPackages = releases.map((r) => `${r.name}@${r.next}`).join(", ");
  const workflowUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

  // Store the commit hash before any release actions
  const originalCommit = execWithLog("git rev-parse HEAD").toString().trim();

  try {
    // 1. Remove all tags first
    for (const info of releases) {
      const tag = `${info.name}@${info.next}`;
      try {
        execWithLog(`git tag -d ${tag}`);
        execWithLog(`git push origin :refs/tags/${tag}`);
      } catch (e) {
        console.warn(`Failed to remove tag ${tag}:`, e);
      }
    }

    // 2. Reset to original commit and force push
    execWithLog(`git reset --hard ${originalCommit}`);
    execWithLog("git push origin main --force");

    // 3. Try to unpublish packages (if they were published)
    for (const info of releases) {
      try {
        execWithLog(
          `npm unpublish ${info.name}@${info.next} --registry ${REGISTRY}`,
          { stdio: "ignore", cwd: info.pkgDir },
        );
      } catch (e) {
        console.warn(`Failed to unpublish ${info.name}@${info.next}. This is likely intended as ${info.name}@${info.next} was not published. If it's not intended, here is what went wrong:`, e);
      }
    }

    // 4. Delete GitHub releases
    const [owner = "", repo = ""] =
      process.env.GITHUB_REPOSITORY?.split("/") ?? [];
    const octokit = new Octokit({ auth: process.env.GH_TOKEN });

    await Promise.all(
      Object.entries(releaseIds).map(([name, id]) =>
        octokit.repos
          .deleteRelease({ owner, repo, release_id: id })
          .catch((e) =>
            console.warn(`Failed to delete GitHub release for ${name}:`, e),
          ),
      ),
    );

    // 5. Re-open PR if found
    const prNumber = findPRNumberFromCommitMessage(originalCommit);
    if (prNumber) {
      await Promise.all([
        octokit.pulls.update({
          owner,
          repo,
          pull_number: prNumber,
          state: "open",
        }),
        octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: `⚠️ Release failed for: ${failedPackages}\n\nSee workflow details: ${workflowUrl}\n\nThis PR has been automatically reopened.`,
        }),
      ]);
    }
  } catch (error) {
    console.error("Failed to complete rollback:", error);
    throw error; // Re-throw to ensure process exits with error
  }

  console.warn("Rollback complete.");
}

export { rollback };
