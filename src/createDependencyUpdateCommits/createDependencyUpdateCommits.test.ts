import { beforeEach, describe, expect, it, vi } from "vitest";
import { execWithLog } from "../execWithLog/execWithLog.js";
import { createDependencyUpdateCommits } from "./createDependencyUpdateCommits.js";

vi.mock("../execWithLog/execWithLog", () => ({
  execWithLog: vi.fn(),
}));

describe("createDependencyUpdateCommits", () => {
  const rootDir = "/root";
  const pkgDir = "/root/packages/my-pkg";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(execWithLog).mockImplementation(() => "");
  });

  it("should create a commit for single dependency update", async () => {
    const updates = new Map([["dep-a", "1.0.0"]]);

    await createDependencyUpdateCommits(rootDir, updates, pkgDir);

    expect(execWithLog).toHaveBeenCalledTimes(2);
    expect(execWithLog).toHaveBeenCalledWith("git add package.json", {
      cwd: pkgDir,
      stdio: "pipe",
    });
    expect(execWithLog).toHaveBeenCalledWith(
      'git commit -m "chore(deps): bump dep-a to v1.0.0 in packages/my-pkg"',
      {
        cwd: pkgDir,
        stdio: "pipe",
      },
    );
  });

  it("should create multiple commits for multiple dependency updates", async () => {
    const updates = new Map([
      ["dep-a", "1.0.0"],
      ["dep-b", "2.0.0"],
    ]);

    await createDependencyUpdateCommits(rootDir, updates, pkgDir);

    expect(execWithLog).toHaveBeenCalledTimes(4);
    expect(execWithLog).toHaveBeenNthCalledWith(1, "git add package.json", {
      cwd: pkgDir,
      stdio: "pipe",
    });
    expect(execWithLog).toHaveBeenNthCalledWith(
      2,
      'git commit -m "chore(deps): bump dep-a to v1.0.0 in packages/my-pkg"',
      {
        cwd: pkgDir,
        stdio: "pipe",
      },
    );
    expect(execWithLog).toHaveBeenNthCalledWith(3, "git add package.json", {
      cwd: pkgDir,
      stdio: "pipe",
    });
    expect(execWithLog).toHaveBeenNthCalledWith(
      4,
      'git commit -m "chore(deps): bump dep-b to v2.0.0 in packages/my-pkg"',
      {
        cwd: pkgDir,
        stdio: "pipe",
      },
    );
  });

  it("should handle empty updates map", async () => {
    const updates = new Map();

    await createDependencyUpdateCommits(rootDir, updates, pkgDir);

    expect(execWithLog).not.toHaveBeenCalled();
  });

  it("should throw and log error details on git command failure", async () => {
    const updates = new Map([["dep-a", "1.0.0"]]);
    const error = new Error("git error");
    Object.assign(error, {
      stdout: Buffer.from("stdout content"),
      stderr: Buffer.from("stderr content"),
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(execWithLog).mockImplementation(() => {
      throw error;
    });

    await expect(() =>
      createDependencyUpdateCommits(rootDir, updates, pkgDir),
    ).rejects.toThrow(error);

    expect(consoleSpy).toHaveBeenCalledWith("Git command failed:");
    expect(consoleSpy).toHaveBeenCalledWith("Command:", error.message);
    expect(consoleSpy).toHaveBeenCalledWith("Working directory:", pkgDir);
    expect(consoleSpy).toHaveBeenCalledWith("stdout:", "stdout content");
    expect(consoleSpy).toHaveBeenCalledWith("stderr:", "stderr content");

    consoleSpy.mockRestore();
    // Reset the mock implementation after the test
    vi.mocked(execWithLog).mockImplementation(() => "");
  });

  it("should handle paths with special characters", async () => {
    const rootDir = "/root space";
    const pkgDir = "/root space/packages/my-pkg@2";
    const updates = new Map([["@scope/pkg", "1.0.0"]]);

    await createDependencyUpdateCommits(rootDir, updates, pkgDir);

    expect(execWithLog).toHaveBeenCalledWith("git add package.json", {
      cwd: pkgDir,
      stdio: "pipe",
    });
    expect(execWithLog).toHaveBeenCalledWith(
      'git commit -m "chore(deps): bump @scope/pkg to v1.0.0 in packages/my-pkg@2"',
      {
        cwd: pkgDir,
        stdio: "pipe",
      },
    );
  });

  it("should handle nested package paths correctly", async () => {
    const rootDir = "/root";
    const pkgDir = "/root/packages/group/nested/my-pkg";
    const updates = new Map([["dep-a", "1.0.0"]]);

    await createDependencyUpdateCommits(rootDir, updates, pkgDir);

    expect(execWithLog).toHaveBeenCalledWith(
      'git commit -m "chore(deps): bump dep-a to v1.0.0 in packages/group/nested/my-pkg"',
      {
        cwd: pkgDir,
        stdio: "pipe",
      },
    );
  });

  it("should handle version with pre-release tags", async () => {
    const updates = new Map([["dep-a", "1.0.0-beta.1"]]);

    await createDependencyUpdateCommits(rootDir, updates, pkgDir);

    expect(execWithLog).toHaveBeenCalledWith(
      'git commit -m "chore(deps): bump dep-a to v1.0.0-beta.1 in packages/my-pkg"',
      {
        cwd: pkgDir,
        stdio: "pipe",
      },
    );
  });
});
