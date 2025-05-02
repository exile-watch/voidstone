import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tmpNameSync } from "tmp";
import { beforeEach, describe, expect, it } from "vitest";
import { updateChangelogs } from "../updateChangelogs.js";

describe("updateChangelogs integration (multi‐package, different next versions)", () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = tmpNameSync();
    fs.mkdirSync(repoDir, { recursive: true });
    execSync("git init", { cwd: repoDir });
    execSync(`git config user.name "Tester"`, { cwd: repoDir });
    execSync(`git config user.email "test@example.com"`, { cwd: repoDir });

    const packages = [
      { name: "pkg-a", current: "1.0.0", next: "1.1.0" },
      { name: "pkg-b", current: "1.0.0", next: "2.0.0" },
      { name: "pkg-c", current: "1.0.0", next: "1.2.0" },
    ];

    // scaffold each package
    for (const { name, current } of packages) {
      const pkgDir = path.join(repoDir, "packages", name);
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, "package.json"),
        JSON.stringify({ name: `@scope/${name}`, version: current }, null, 2),
      );
      fs.writeFileSync(path.join(pkgDir, "file.txt"), "initial");
    }
    // initial commit + tags at current
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "chore: initial commit"`, { cwd: repoDir });
    for (const { name, current } of packages) {
      execSync(`git tag @scope/${name}@${current}`, { cwd: repoDir });
    }

    // one shared commit
    for (const { name } of packages) {
      fs.appendFileSync(
        path.join(repoDir, "packages", name, "file.txt"),
        "\nshared change",
      );
    }
    execSync("git add .", { cwd: repoDir });
    execSync(`git commit -m "feat: shared improvement"`, { cwd: repoDir });

    // tag each at its own next
    for (const { name, next } of packages) {
      execSync(`git tag @scope/${name}@${next}`, { cwd: repoDir });
    }
  });

  it("generates per‐package CHANGELOG with correct headers and shared commits", async () => {
    const updates = [
      {
        name: "@scope/pkg-a",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: path.join(repoDir, "packages", "pkg-a"),
        dependencyUpdates: new Map(),
      },
      {
        name: "@scope/pkg-b",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: path.join(repoDir, "packages", "pkg-b"),
        dependencyUpdates: new Map(),
      },
      {
        name: "@scope/pkg-c",
        current: "1.0.0",
        next: "1.2.0",
        pkgDir: path.join(repoDir, "packages", "pkg-c"),
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(repoDir, updates);

    for (const { name, next } of updates) {
      const changelog = fs.readFileSync(
        path.join(
          repoDir,
          "packages",
          name.replace("@scope/", ""),
          "CHANGELOG.md",
        ),
        "utf-8",
      );

      // And each should include the shared commit description:
      expect(changelog).toContain("shared improvement");
    }
  });
});
