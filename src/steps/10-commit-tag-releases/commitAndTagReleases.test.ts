import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageUpdate } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";
import * as syncLockfileModule from "../11-sync-lockfile/syncLockfile.js";
import { commitAndTagReleases } from "./commitAndTagReleases.js";

vi.mock("../../utils/execWithLog/execWithLog.js");
vi.mock("../11-sync-lockfile/syncLockfile.js");

describe("commitAndTagReleases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "cwd").mockReturnValue("/root");
  });

  it("should commit and tag single package release", () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    commitAndTagReleases(updates);

    expect(syncLockfileModule.syncLockfile).toHaveBeenCalledWith("/root");
    expect(execWithLog).toHaveBeenCalledTimes(4);
    expect(execWithLog).toHaveBeenNthCalledWith(
      1,
      "git add packages/pkg-1/package.json packages/pkg-1/CHANGELOG.md",
    );
    expect(execWithLog).toHaveBeenNthCalledWith(
      2,
      'git commit -m "chore: release [skip ci]"',
    );
    expect(execWithLog).toHaveBeenNthCalledWith(
      3,
      'git tag -a pkg-1@1.1.0 -m "pkg-1@1.1.0"',
    );
    expect(execWithLog).toHaveBeenNthCalledWith(4, "git push --follow-tags", {
      stdio: "inherit",
    });
  });

  it("should handle multiple package releases", () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-2",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "/root/packages/pkg-2",
        dependencyUpdates: new Map(),
      },
    ];

    commitAndTagReleases(updates);

    expect(syncLockfileModule.syncLockfile).toHaveBeenCalledWith("/root");
    expect(execWithLog).toHaveBeenCalledWith(
      "git add packages/pkg-1/package.json packages/pkg-1/CHANGELOG.md packages/pkg-2/package.json packages/pkg-2/CHANGELOG.md",
    );
    expect(execWithLog).toHaveBeenCalledWith(
      'git commit -m "chore: release [skip ci]"',
    );
    expect(execWithLog).toHaveBeenCalledWith(
      'git tag -a pkg-1@1.1.0 -m "pkg-1@1.1.0"',
    );
    expect(execWithLog).toHaveBeenCalledWith(
      'git tag -a pkg-2@2.1.0 -m "pkg-2@2.1.0"',
    );
  });

  it("should handle scoped package names", () => {
    const updates: PackageUpdate[] = [
      {
        name: "@scope/pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/scope/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    commitAndTagReleases(updates);

    expect(syncLockfileModule.syncLockfile).toHaveBeenCalledWith("/root");
    expect(execWithLog).toHaveBeenCalledWith(
      'git tag -a @scope/pkg-1@1.1.0 -m "@scope/pkg-1@1.1.0"',
    );
  });

  it("should handle empty updates array", () => {
    commitAndTagReleases([]);

    expect(syncLockfileModule.syncLockfile).not.toHaveBeenCalled();
    expect(execWithLog).not.toHaveBeenCalled();
  });

  it("should throw if git commands fail", () => {
    vi.mocked(execWithLog).mockImplementationOnce(() => {
      throw new Error("Git error");
    });

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    expect(() => commitAndTagReleases(updates)).toThrow("Git error");
    expect(syncLockfileModule.syncLockfile).not.toHaveBeenCalled();
  });

  it("should continue tagging remaining packages if one fails", () => {
    vi.mocked(execWithLog)
      .mockImplementationOnce(() => "") // git add
      .mockImplementationOnce(() => "") // git commit
      .mockImplementationOnce(() => {
        throw new Error("Failed to tag pkg-1");
      }) // first tag fails
      .mockImplementationOnce(() => "") // second tag succeeds
      .mockImplementationOnce(() => ""); // git push

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-2",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "/root/packages/pkg-2",
        dependencyUpdates: new Map(),
      },
    ];

    expect(() => commitAndTagReleases(updates)).toThrow("Failed to tag pkg-1");
    expect(syncLockfileModule.syncLockfile).toHaveBeenCalledWith("/root");

    expect(execWithLog).toHaveBeenCalledTimes(3);
    expect(execWithLog).toHaveBeenNthCalledWith(
      1,
      "git add packages/pkg-1/package.json packages/pkg-1/CHANGELOG.md packages/pkg-2/package.json packages/pkg-2/CHANGELOG.md",
    );
    expect(execWithLog).toHaveBeenNthCalledWith(
      2,
      'git commit -m "chore: release [skip ci]"',
    );
    expect(execWithLog).toHaveBeenNthCalledWith(
      3,
      'git tag -a pkg-1@1.1.0 -m "pkg-1@1.1.0"',
    );
  });
});
