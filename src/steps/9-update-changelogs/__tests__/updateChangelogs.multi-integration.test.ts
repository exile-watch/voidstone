import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tmpNameSync } from "tmp";
import { beforeEach, describe, expect, it } from "vitest";
import { updateChangelogs } from "../updateChangelogs.js";

describe("updateChangelogs integration (multi-package)", () => {
  let repoDir: string;

  beforeEach(() => {
    // 1) set up a clean repo
    repoDir = tmpNameSync();
    fs.mkdirSync(repoDir, { recursive: true });
    execSync("git init", { cwd: repoDir });
    execSync(`git config user.name "Tester"`, { cwd: repoDir });
    execSync(`git config user.email "test@example.com"`, { cwd: repoDir });

    // 2) scaffold three packages
    const pkgs = ["pkg-a", "pkg-b", "pkg-c"];
    for (const name of pkgs) {
      const pkgDir = path.join(repoDir, "packages", name);
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, "package.json"),
        JSON.stringify({ name: `@scope/${name}`, version: "1.0.0" }, null, 2),
      );
      fs.writeFileSync(path.join(pkgDir, "file1.txt"), "initial\n");
    }
    // initial commit + tags at 1.0.0
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "chore: initial commit"`, { cwd: repoDir });
    for (const name of pkgs) {
      execSync(`git tag @scope/${name}@1.0.0`, { cwd: repoDir });
    }

    // 3) Shared commit touches all three
    for (const name of pkgs) {
      fs.appendFileSync(
        path.join(repoDir, "packages", name, "file1.txt"),
        "shared\n",
      );
    }
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "feat: global improvement"`, { cwd: repoDir });

    // 4) Commit for pkg-a + pkg-b
    for (const name of ["pkg-a", "pkg-b"]) {
      fs.appendFileSync(
        path.join(repoDir, "packages", name, "file1.txt"),
        "ab-only\n",
      );
    }
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "feat: improvement for a and b"`, { cwd: repoDir });

    // 5) Commit for pkg-c only
    fs.appendFileSync(
      path.join(repoDir, "packages", "pkg-c", "file1.txt"),
      "c-only\n",
    );
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "fix: c specific fix"`, { cwd: repoDir });

    // 6) Commit for pkg-a only
    fs.appendFileSync(
      path.join(repoDir, "packages", "pkg-a", "file1.txt"),
      "a-only\n",
    );
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "feat: a only feature"`, { cwd: repoDir });

    // 7) Final tags at 1.1.0
    for (const name of pkgs) {
      execSync(`git tag @scope/${name}@1.1.0`, { cwd: repoDir });
    }
  });

  it("scopes commits correctly across three packages", async () => {
    const updates = ["pkg-a", "pkg-b", "pkg-c"].map((name) => ({
      name: `@scope/${name}`,
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: path.join(repoDir, "packages", name),
      dependencyUpdates: new Map(),
    }));

    await updateChangelogs(repoDir, updates);

    // pkg-a
    const changelogA = fs.readFileSync(
      path.join(repoDir, "packages", "pkg-a", "CHANGELOG.md"),
      "utf-8",
    );
    expect(changelogA).toContain("global improvement");
    expect(changelogA).toContain("improvement for a and b");
    expect(changelogA).toContain("a only feature");
    expect(changelogA).not.toContain("c specific fix");

    // pkg-b
    const changelogB = fs.readFileSync(
      path.join(repoDir, "packages", "pkg-b", "CHANGELOG.md"),
      "utf-8",
    );
    expect(changelogB).toContain("global improvement");
    expect(changelogB).toContain("improvement for a and b");
    expect(changelogB).not.toContain("a only feature");
    expect(changelogB).not.toContain("c specific fix");

    // pkg-c
    const changelogC = fs.readFileSync(
      path.join(repoDir, "packages", "pkg-c", "CHANGELOG.md"),
      "utf-8",
    );
    expect(changelogC).toContain("global improvement");
    expect(changelogC).toContain("c specific fix");
    expect(changelogC).not.toContain("improvement for a and b");
    expect(changelogC).not.toContain("a only feature");
  });
});
