import path from "node:path";
import { Octokit } from "@octokit/rest";
import changelog from "conventional-changelog";
import getStream from "get-stream";
import { REGISTRY } from "../../constants.js";
import type { PackageUpdate, ReleaseIds } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";

async function publishAndRelease(
  rootDir: string,
  updates: PackageUpdate[],
  releaseIds: ReleaseIds,
): Promise<void> {
  const [owner = "", repo = ""] =
    process.env.GITHUB_REPOSITORY?.split("/") ?? [];
  const oct = new Octokit({ auth: process.env.GH_TOKEN });
  for (const u of updates) {
    execWithLog(`npm publish --registry ${REGISTRY}`, {
      cwd: u.pkgDir,
      stdio: "inherit",
    });
    const pkgRel = path.relative(rootDir, u.pkgDir);
    const latest = await getStream(
      changelog({
        preset: "angular",
        tagPrefix: `${u.name}@`,
        releaseCount: 1,
        config: { gitRawCommitsOpts: { path: pkgRel } },
      }),
    );
    const release = await oct.repos.createRelease({
      owner,
      repo,
      tag_name: `${u.name}@${u.next}`,
      name: `${u.name}@${u.next}`,
      body: latest,
    });
    // track ids
    if (u) {
      releaseIds[u.name] = release.data.id;
    }
  }
}

export { publishAndRelease };
