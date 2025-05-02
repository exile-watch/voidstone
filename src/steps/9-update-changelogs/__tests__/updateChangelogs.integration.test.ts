import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tmpNameSync } from "tmp";
import { beforeEach, describe, expect, it } from "vitest";
import { updateChangelogs } from "../updateChangelogs.js";

describe("updateChangelogs integration", () => {
  let repoDir: string;

  beforeEach(() => {
    // 1) Create a temp repo
    repoDir = tmpNameSync();
    fs.mkdirSync(repoDir, { recursive: true });
    execSync("git init", { cwd: repoDir });
    // set a user so commits aren’t refused
    execSync(`git config user.name "Tester"`, { cwd: repoDir });
    execSync(`git config user.email "test@example.com"`, { cwd: repoDir });

    // 2) Scaffold packages/seo
    const pkgDir = path.join(repoDir, "packages", "seo");
    fs.mkdirSync(pkgDir, { recursive: true });
    // minimal package.json so tagPrefix + lernaPackage line up:
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({ name: "@exile-watch/seo", version: "1.0.0" }, null, 2),
    );
    // initial file & commit
    fs.writeFileSync(path.join(pkgDir, "file.txt"), "initial");
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "chore: initial commit"`, { cwd: repoDir });
    // tag v1.0.0
    execSync("git tag @exile-watch/seo@1.0.0", { cwd: repoDir });

    // 3) A new change under packages/seo
    fs.writeFileSync(path.join(pkgDir, "file.txt"), "feature!");
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "feat: add a new SEO feature"`, { cwd: repoDir });

    // 4) Another change under packages/seo
    fs.writeFileSync(path.join(pkgDir, "README.md"), "fix typo");
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "fix: correct typo in README"`, { cwd: repoDir });

    // tag v1.1.0
    execSync("git tag @exile-watch/seo@1.1.0", { cwd: repoDir });
  });

  it("emits a real CHANGELOG with multiple commits", async () => {
    // call your updater
    await updateChangelogs(repoDir, [
      {
        name: "@exile-watch/seo",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: path.join(repoDir, "packages", "seo"),
        dependencyUpdates: new Map(),
      },
    ]);

    const changelog = fs.readFileSync(
      path.join(repoDir, "packages", "seo", "CHANGELOG.md"),
      "utf-8",
    );

    // should include both commit descriptions
    expect(changelog).toContain("add a new SEO feature");
    expect(changelog).toContain("correct typo in README");

    // and should have the right release header
    expect(changelog).toMatch(/# \[1\.1\.0\].*\(\d{4}-\d{2}-\d{2}\)/);
  });
});
