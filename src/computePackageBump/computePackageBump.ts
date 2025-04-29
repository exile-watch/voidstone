import fs from "node:fs";
import path from "node:path";
import { Bumper } from "conventional-recommended-bump";
import semver from "semver";
import { createDependencyUpdateCommits } from "../createDependencyUpdateCommits/createDependencyUpdateCommits.js";
import { defaultWhatBump } from "../defaultWhatBump/defaultWhatBump.js";
import type { ReleaseInfo } from "../types.js";

/**
 * Compute next version bump for a package via conventional commits
 */
async function computePackageBump(
  rootDir: string,
  pkgPath: string,
  updatedDeps?: Map<string, string>,
): Promise<ReleaseInfo | null> {
  const content = fs.readFileSync(pkgPath, "utf-8").replace(/^\uFEFF/, "");
  const pkg = JSON.parse(content);

  if (!pkg.name || !pkg.version) {
    throw new Error(`Missing required fields in package.json: ${pkgPath}`);
  }

  // Skip if package is private
  if (pkg.private) {
    return null;
  }

  // Skip root package if it has workspaces
  if (pkg.workspaces && pkgPath === path.join(rootDir, "package.json")) {
    return null;
  }

  const name = pkg.name as string;
  const current = pkg.version as string;
  const pkgDir = path.dirname(pkgPath);

  // If we have dependency updates, create commits for them
  if (updatedDeps && updatedDeps.size > 0) {
    await createDependencyUpdateCommits(rootDir, updatedDeps, pkgDir);
  }

  // Construct Bumper at repository root
  const bumper = new Bumper(rootDir);
  // Load conventional-changelog preset
  bumper.loadPreset("angular");
  // Configure tag prefix for this package's tags
  bumper.tag({ prefix: `${name}@` });
  // Add path filter to only consider commits affecting this package
  bumper.commits({
    path: path.relative(rootDir, pkgDir).split(path.sep).join("/"),
  });

  // Determine bump based on commits since last tag
  const bumpInfo = await bumper.bump(defaultWhatBump);
  if (!bumpInfo) {
    return null;
  }

  const { releaseType, reason } = bumpInfo;

  // Return null if no changes or no reason for bump
  if (!releaseType || !reason) {
    return null;
  }

  // Handle prerelease versions
  const prerelease = semver.prerelease(current);
  let next: string | null;

  if (prerelease) {
    const [tag] = prerelease;
    if (releaseType === "release") {
      next = current.replace(/-[^.]+\.\d+$/, "");
    } else if (releaseType === "prerelease") {
      const targetTag = reason.toLowerCase().includes("rc")
        ? "rc"
        : reason.toLowerCase().includes("beta")
          ? "beta"
          : reason.toLowerCase().includes("alpha")
            ? "alpha"
            : tag;

      if (targetTag === tag) {
        next = semver.inc(current, "prerelease", String(targetTag));
      } else {
        const parsed = semver.parse(current);
        if (!parsed) {
          throw new Error(`Invalid semver version: ${current}`);
        }
        parsed.prerelease = [targetTag, 0];
        next = parsed.format();
      }
    } else {
      next = semver.inc(current, "prerelease", tag as string);
    }
  } else {
    next = semver.inc(current, releaseType as "major" | "minor" | "patch");
  }

  if (!next || next === current) {
    return null;
  }

  return { name, current, next, pkgDir };
}

export { computePackageBump };
