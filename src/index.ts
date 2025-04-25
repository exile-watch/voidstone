#!/usr/bin/env node

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import changelog from "conventional-changelog";
import { Bumper } from "conventional-recommended-bump";
import fg from "fast-glob";
import getStream from "get-stream";
import semver from "semver";

interface ReleaseInfo {
  name: string;
  current: string;
  next: string;
  pkgDir: string;
}
const releases: ReleaseInfo[] = [];
let registryUrl: string | undefined;
const releaseIds: Record<string, number> = {};

function setupNpmrc(registry: string, tokenKey: string) {
  const token = process.env[tokenKey];
  if (!token)
    throw new Error(`${tokenKey} is required for registry ${registry}`);
  const host = registry.replace(/^https?:\/\//, "");
  const content = `//${host}/:_authToken=${token}\nregistry=${registry}\n`;
  fs.writeFileSync(path.join(process.cwd(), ".npmrc"), content);
  registryUrl = registry;
}

function getWorkspacePackagePaths(): string[] {
  const rootPkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  const patterns = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
  return fg.sync(
    patterns.map((p: string) => path.posix.join(p, "package.json")),
    { dot: true },
  );
}

async function computePackageBump(
  pkgPath: string,
): Promise<ReleaseInfo | null> {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const name = pkg.name as string;
  const current = pkg.version as string;

  const bumper = new Bumper(path.dirname(pkgPath));
  bumper.loadPreset("angular");
  const { releaseType } = await bumper.bump();
  const bumpType = releaseType as "major" | "minor" | "patch";
  const next = semver.inc(current, bumpType);
  if (!next || next === current) return null;
  return { name, current, next, pkgDir: path.dirname(pkgPath) };
}

function rollback() {
  console.warn("Rolling back releases...");
  releases.forEach((info) => {
    const tag = `${info.name}@v${info.next}`;
    try {
      execSync(`git tag -d ${tag}`);
      execSync(`git push origin :refs/tags/${tag}`);
    } catch {}
    try {
      execSync("git reset --hard HEAD~1");
    } catch {}
    try {
      const unpubCmd = registryUrl
        ? `npm unpublish ${info.name}@${info.next} --registry ${registryUrl}`
        : `npm unpublish ${info.name}@${info.next}`;
      execSync(unpubCmd, { stdio: "ignore", cwd: info.pkgDir });
    } catch {}
    try {
      const id = releaseIds[info.name];
      if (id) {
        const [owner = "", repo = ""] =
          process.env.GITHUB_REPOSITORY?.split("/") ?? [];
        new Octokit({
          auth: process.env.GITHUB_TOKEN ?? "",
        }).repos.deleteRelease({
          owner,
          repo,
          release_id: id,
        });
      }
    } catch {}
  });
  console.warn("Rollback complete.");
}

async function main() {
  try {
    const customReg = process.env.CUSTOM_REGISTRY;
    const customTokenKey = process.env.CUSTOM_REGISTRY_TOKEN;
    if (customReg && customTokenKey) setupNpmrc(customReg, customTokenKey);

    const pkgPaths = getWorkspacePackagePaths();
    const bumps = await Promise.all(pkgPaths.map((p) => computePackageBump(p)));
    const toRelease = bumps.filter((b): b is ReleaseInfo => Boolean(b));

    if (toRelease.length === 0) {
      console.log("📦 No package changes detected. Nothing to release.");
      return;
    }

    // Preflight dry-run
    toRelease.forEach(({ pkgDir }) => {
      const cmd = registryUrl
        ? `npm publish --dry-run --registry ${registryUrl}`
        : "npm publish --dry-run";
      execSync(cmd, { cwd: pkgDir, stdio: "ignore" });
    });

    // Configure git for Actions bot
    execSync('git config user.name "github-actions[bot]"');
    execSync(
      'git config user.email "github-actions[bot]@users.noreply.github.com"',
    );

    for (const info of toRelease) {
      const { name, current, next, pkgDir } = info;
      console.log(`🔢 Releasing ${name}: ${current} → ${next}`);

      // Update version
      const pkgJsonPath = path.join(pkgDir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as {
        [key: string]: any;
      };
      pkg.version = next;
      fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

      // Update inter-package deps
      const otherPkgPaths = pkgPaths.filter((p) => path.dirname(p) !== pkgDir);
      otherPkgPaths.forEach((otherPath) => {
        const otherPkg = JSON.parse(fs.readFileSync(otherPath, "utf-8")) as {
          [key: string]: any;
        };
        let updated = false;
        (
          [
            "dependencies",
            "devDependencies",
            "peerDependencies",
            "optionalDependencies",
          ] as const
        ).forEach((field) => {
          if (otherPkg[field]?.[name]) {
            otherPkg[field][name] = `^${next}`;
            updated = true;
          }
        });
        if (updated)
          fs.writeFileSync(otherPath, `${JSON.stringify(otherPkg, null, 2)}\n`);
      });

      // Generate changelog
      const logStream = changelog({
        preset: "angular",
        tagPrefix: `${name}@`,
        releaseCount: 0,
      });
      const log = await getStream(logStream);
      const changelogPath = path.join(pkgDir, "CHANGELOG.md");
      fs.writeFileSync(changelogPath, log);

      // Commit & tag
      const filesToAdd = [pkgJsonPath, changelogPath, ...otherPkgPaths].join(
        " ",
      );
      execSync(`git add ${filesToAdd}`);
      execSync(
        `git commit -m \"chore(${name}): release v${next} and update deps\"`,
      );
      const tagName = `${name}@v${next}`;
      execSync(`git tag -a ${tagName} -m \"${name} v${next}\"`);
      execSync("git push --follow-tags", { stdio: "inherit" });

      // Publish to npm/GPR
      const pubCmd = registryUrl
        ? `npm publish --registry ${registryUrl}`
        : "npm publish";
      execSync(pubCmd, { cwd: pkgDir, stdio: "inherit" });

      // GitHub release
      const [owner = "", repo = ""] =
        process.env.GITHUB_REPOSITORY?.split("/") ?? [];
      const release = await new Octokit({
        auth: process.env.GITHUB_TOKEN ?? "",
      }).repos.createRelease({
        owner,
        repo,
        tag_name: tagName,
        name: `${name}@v${next}`,
        body: log,
      });
      releaseIds[name] = release.data.id;
      releases.push(info);
    }

    console.log("🎉 All packages released successfully!");
  } catch (err) {
    console.error(`❌ Release process failed: ${err}`);
    rollback();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err}`);
  rollback();
  process.exit(1);
});
