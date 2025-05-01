import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageUpdate } from "../../types.js";
import { createDependencyUpdateCommits } from "../../utils/createDependencyUpdateCommits/createDependencyUpdateCommits.js";
import { commitDependencyUpdates } from "./commitDependencyUpdates.js";

vi.mock(
  "../../utils/createDependencyUpdateCommits/createDependencyUpdateCommits",
  () => ({
    createDependencyUpdateCommits: vi.fn(),
  }),
);

describe("commitDependencyUpdates", () => {
  const rootDir = "/root";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call createDependencyUpdateCommits for each update with dependencies", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/pkg-1",
        dependencyUpdates: new Map([["dep-a", "1.0.0"]]),
      },
      {
        name: "pkg-2",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/pkg-2",
        dependencyUpdates: new Map([["dep-b", "2.0.0"]]),
      },
    ];

    await commitDependencyUpdates(rootDir, updates);

    expect(createDependencyUpdateCommits).toHaveBeenCalledTimes(2);
    expect(createDependencyUpdateCommits).toHaveBeenNthCalledWith(
      1,
      rootDir,
      updates[0].dependencyUpdates,
      updates[0].pkgDir,
    );
    expect(createDependencyUpdateCommits).toHaveBeenNthCalledWith(
      2,
      rootDir,
      updates[1].dependencyUpdates,
      updates[1].pkgDir,
    );
  });

  it("should skip updates without dependencies", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await commitDependencyUpdates(rootDir, updates);

    expect(createDependencyUpdateCommits).not.toHaveBeenCalled();
  });

  it("should handle empty updates array", async () => {
    await commitDependencyUpdates(rootDir, []);

    expect(createDependencyUpdateCommits).not.toHaveBeenCalled();
  });

  it("should process updates sequentially", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/pkg-1",
        dependencyUpdates: new Map([["dep-a", "1.0.0"]]),
      },
      {
        name: "pkg-2",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/pkg-2",
        dependencyUpdates: new Map([["dep-b", "2.0.0"]]),
      },
    ];

    const calls: number[] = [];
    vi.mocked(createDependencyUpdateCommits).mockImplementation(async () => {
      calls.push(calls.length);
    });

    await commitDependencyUpdates(rootDir, updates);

    expect(calls).toEqual([0, 1]);
  });

  it("should continue processing remaining updates if one fails", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/pkg-1",
        dependencyUpdates: new Map([["dep-a", "1.0.0"]]),
      },
      {
        name: "pkg-2",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/pkg-2",
        dependencyUpdates: new Map([["dep-b", "2.0.0"]]),
      },
    ];

    vi.mocked(createDependencyUpdateCommits)
      .mockRejectedValueOnce(new Error("Failed to commit"))
      .mockResolvedValueOnce(undefined);

    await expect(commitDependencyUpdates(rootDir, updates)).rejects.toThrow(
      "Failed to commit",
    );
    expect(createDependencyUpdateCommits).toHaveBeenCalledTimes(1);
  });

  it("should handle updates with multiple dependencies in correct order", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/pkg-1",
        dependencyUpdates: new Map([
          ["dep-a", "1.0.0"],
          ["dep-b", "2.0.0"],
          ["dep-c", "3.0.0"],
        ]),
      },
    ];

    await commitDependencyUpdates(rootDir, updates);

    expect(createDependencyUpdateCommits).toHaveBeenCalledWith(
      rootDir,
      updates[0].dependencyUpdates,
      updates[0].pkgDir,
    );
  });

  it("should handle updates with special characters in paths", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "@scope/pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/@scope/pkg-1",
        dependencyUpdates: new Map([["@scope/dep-a", "1.0.0"]]),
      },
    ];

    await commitDependencyUpdates(rootDir, updates);

    expect(createDependencyUpdateCommits).toHaveBeenCalledWith(
      rootDir,
      updates[0].dependencyUpdates,
      updates[0].pkgDir,
    );
  });

  it("should handle monorepo workspace dependency updates", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "@scope/pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/@scope/pkg-1",
        dependencyUpdates: new Map([
          ["@scope/dep-a", "1.0.0"],
          ["workspace-pkg", "workspace:^2.0.0"],
          ["@scope/workspace-pkg", "workspace:*"],
        ]),
      },
    ];

    await commitDependencyUpdates(rootDir, updates);

    expect(createDependencyUpdateCommits).toHaveBeenCalledWith(
      rootDir,
      updates[0].dependencyUpdates,
      updates[0].pkgDir,
    );
  });

  it("should handle updates with pre-release version transitions", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "package-a",
        current: "1.0.0-alpha.5",
        next: "1.0.0-beta.0",
        pkgDir: "/root/packages/package-a",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0-beta.1"],
          ["dep-b", "3.0.0-rc.0"],
        ]),
      },
      {
        name: "package-b",
        current: "2.0.0-beta.5",
        next: "2.0.0-rc.0",
        pkgDir: "/root/packages/package-b",
        dependencyUpdates: new Map([
          ["dep-c", "1.0.0"],
          ["dep-d", "2.0.0-alpha.1"],
        ]),
      },
    ];

    await commitDependencyUpdates(rootDir, updates);

    expect(createDependencyUpdateCommits).toHaveBeenCalledTimes(2);
    expect(createDependencyUpdateCommits).toHaveBeenNthCalledWith(
      1,
      rootDir,
      updates[0].dependencyUpdates,
      updates[0].pkgDir,
    );
    expect(createDependencyUpdateCommits).toHaveBeenNthCalledWith(
      2,
      rootDir,
      updates[1].dependencyUpdates,
      updates[1].pkgDir,
    );
  });
});
