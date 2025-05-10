import path from "node:path";
import { Octokit } from "@octokit/rest";
import conventionalChangelog from "conventional-changelog";
import getStream from "get-stream";
import { REGISTRY } from "../../constants.js";
import type { PackageUpdate, ReleaseIds } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";

async function publishAndRelease(
  rootDir: string,
  updates: PackageUpdate[],
  releaseIds: ReleaseIds,
): Promise<ReleaseIds> {
  const [owner = "", repo = ""] =
    process.env.GITHUB_REPOSITORY?.split("/") ?? [];

  if (!owner || !repo) {
    throw new Error(
      "Missing GITHUB_REPOSITORY environment variable or invalid format. Expected 'owner/repo'",
    );
  }

  execWithLog("git fetch --tags --prune", { cwd: rootDir });

  const oct = new Octokit({ auth: process.env.GH_TOKEN });

  for (const u of updates) {
    // 1) npm publish as before
    execWithLog(`npm publish --registry ${REGISTRY}`, {
      cwd: u.pkgDir,
      stdio: "inherit",
    });

    // 2) build changelog for *this* release
    const relPath =
      path.relative(rootDir, u.pkgDir).split(path.sep).join("/") || ".";

    const options = {
      preset: "angular",
      tagPrefix: `${u.name}@`,
      releaseCount: 1,
      lernaPackage: u.name, // scope to this package
    };

    const context = {};

    const gitRawCommitsOpts = {
      path: relPath,
      from: `${u.name}@${u.current}`,
      to: `${u.name}@${u.next}`,
    };

    console.log(`ℹ️ Generating changelog for ${u.name}...`);
    const changelogStream =
      conventionalChangelog(options, context, gitRawCommitsOpts) ?? {};

    const latest = await getStream(changelogStream);
    console.log(`✅ Changelog for ${u.name} has been generated.`);
    // 3) push it into GitHub releases
    console.log(`ℹ️ Creating GitHub release for ${u.name}...`);
    const release = await oct.repos.createRelease({
      owner,
      repo,
      tag_name: `${u.name}@${u.next}`,
      name: `${u.name}@${u.next}`,
      body: latest,
    });
    console.log(`✅ Release for ${u.name} has been created.`);

    if (release?.data?.id) {
      releaseIds[u.name] = release.data.id;
    }
  }

  return releaseIds;
}

export { publishAndRelease };
