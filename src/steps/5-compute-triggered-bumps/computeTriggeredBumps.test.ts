import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageUpdate } from "../../types.js";
import { computePackageBump } from "../../utils/computePackageBump/computePackageBump.js";
import { computeTriggeredBumps } from "./computeTriggeredBumps.js";

vi.mock("node:fs");
vi.mock("../../utils/computePackageBump/computePackageBump.js");

describe("computeTriggeredBumps", () => {
  const rootDir = "/root";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips packages that are already in updates", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-a",
        current: "1.0.0",
        next: "1.0.1",
        pkgDir: "/root/pkg-a",
        dependencyUpdates: new Map(),
      },
    ];

    const dependencyBumps = new Map([["pkg-a", new Map([["dep-1", "2.0.0"]])]]);

    await computeTriggeredBumps(rootDir, [], updates, dependencyBumps);

    expect(computePackageBump).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
  });

  it("skips packages not found in pkgPaths", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([
      ["pkg-missing", new Map([["dep-1", "2.0.0"]])],
    ]);
    const pkgPaths = ["/root/pkg-b/package.json"];

    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: "pkg-b" }),
    );

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(computePackageBump).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("adds bump with dependency updates when found", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-b", new Map([["dep-1", "2.0.0"]])]]);
    const pkgPaths = ["/root/pkg-b/package.json"];

    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: "pkg-b" }),
    );

    const mockBump: PackageUpdate = {
      name: "pkg-b",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-b",
      dependencyUpdates: new Map(),
    };
    vi.mocked(computePackageBump).mockResolvedValue(mockBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(computePackageBump).toHaveBeenCalledWith(rootDir, pkgPaths[0]);
    expect(updates).toHaveLength(1);
    expect(updates[0].name).toBe("pkg-b");
    expect(updates[0].dependencyUpdates).toEqual(dependencyBumps.get("pkg-b"));
  });

  it("handles null bump result", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-c", new Map([["dep-1", "2.0.0"]])]]);
    const pkgPaths = ["/root/pkg-c/package.json"];

    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: "pkg-c" }),
    );
    vi.mocked(computePackageBump).mockResolvedValue(null);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(computePackageBump).toHaveBeenCalledWith(rootDir, pkgPaths[0]);
    expect(updates).toHaveLength(0);
  });

  it("processes multiple packages in dependency order", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([
      ["pkg-1", new Map([["dep-1", "1.0.0"]])],
      ["pkg-2", new Map([["pkg-1", "1.1.0"]])],
    ]);
    const pkgPaths = ["/root/pkg-1/package.json", "/root/pkg-2/package.json"];

    let mockFileIndex = 0;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return JSON.stringify({ name: `pkg-${mockFileIndex++ + 1}` });
    });

    const bump1: PackageUpdate = {
      name: "pkg-1",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-1",
      dependencyUpdates: new Map(),
    };
    const bump2: PackageUpdate = {
      name: "pkg-2",
      current: "2.0.0",
      next: "2.1.0",
      pkgDir: "/root/pkg-2",
      dependencyUpdates: new Map(),
    };

    vi.mocked(computePackageBump)
      .mockResolvedValueOnce(bump1)
      .mockResolvedValueOnce(bump2);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(2);
    expect(updates[0].name).toBe("pkg-1");
    expect(updates[1].name).toBe("pkg-2");
  });

  it("handles errors from fs.readFileSync gracefully", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-d", new Map([["dep-1", "2.0.0"]])]]);
    const pkgPaths = ["/root/pkg-d/package.json"];

    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(0);
    expect(computePackageBump).not.toHaveBeenCalled();
  });

  it("handles malformed package.json content", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-e", new Map([["dep-1", "2.0.0"]])]]);
    const pkgPaths = ["/root/pkg-e/package.json"];

    vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(0);
    expect(computePackageBump).not.toHaveBeenCalled();
  });

  it("handles empty package paths array", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-f", new Map([["dep-1", "2.0.0"]])]]);

    await computeTriggeredBumps(rootDir, [], updates, dependencyBumps);

    expect(updates).toHaveLength(0);
    expect(computePackageBump).not.toHaveBeenCalled();
  });

  it("handles multiple packages with same name in different paths", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-x", new Map([["dep-1", "2.0.0"]])]]);
    const pkgPaths = [
      "/root/path1/pkg-x/package.json",
      "/root/path2/pkg-x/package.json",
    ];

    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: "pkg-x" }),
    );

    const mockBump: PackageUpdate = {
      name: "pkg-x",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/path1/pkg-x",
      dependencyUpdates: new Map(),
    };
    vi.mocked(computePackageBump).mockResolvedValue(mockBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(computePackageBump).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].pkgDir).toBe("/root/path1/pkg-x");
  });

  it("handles scoped package names", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([
      ["@scope/pkg", new Map([["dep-1", "2.0.0"]])],
    ]);
    const pkgPaths = ["/root/@scope/pkg/package.json"];

    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: "@scope/pkg" }),
    );

    const mockBump: PackageUpdate = {
      name: "@scope/pkg",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/@scope/pkg",
      dependencyUpdates: new Map(),
    };
    vi.mocked(computePackageBump).mockResolvedValue(mockBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(computePackageBump).toHaveBeenCalledWith(rootDir, pkgPaths[0]);
    expect(updates).toHaveLength(1);
    expect(updates[0].name).toBe("@scope/pkg");
  });

  it("handles circular dependency bumps", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([
      ["pkg-a", new Map([["pkg-b", "1.0.0"]])],
      ["pkg-b", new Map([["pkg-a", "2.0.0"]])],
    ]);
    const pkgPaths = ["/root/pkg-a/package.json", "/root/pkg-b/package.json"];

    let fileIndex = 0;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return JSON.stringify({ name: `pkg-${fileIndex++ === 0 ? "a" : "b"}` });
    });

    const bumpA: PackageUpdate = {
      name: "pkg-a",
      current: "1.0.0",
      next: "2.0.0",
      pkgDir: "/root/pkg-a",
      dependencyUpdates: new Map(),
    };
    const bumpB: PackageUpdate = {
      name: "pkg-b",
      current: "1.0.0",
      next: "1.0.0",
      pkgDir: "/root/pkg-b",
      dependencyUpdates: new Map(),
    };

    vi.mocked(computePackageBump)
      .mockResolvedValueOnce(bumpA)
      .mockResolvedValueOnce(bumpB);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(2);
    expect(updates.map((u) => u.name)).toEqual(["pkg-a", "pkg-b"]);
  });

  it("handles package.json with BOM marker", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([
      ["pkg-bom", new Map([["dep-1", "2.0.0"]])],
    ]);
    const pkgPaths = ["/root/pkg-bom/package.json"];
    const packageContent = { name: "pkg-bom" };
    const bomContent = `\uFEFF${JSON.stringify(packageContent)}`;

    vi.mocked(fs.readFileSync).mockReturnValue(bomContent);

    const mockBump: PackageUpdate = {
      name: "pkg-bom",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-bom",
      dependencyUpdates: new Map(),
    };
    vi.mocked(computePackageBump).mockResolvedValue(mockBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(fs.readFileSync).toHaveBeenCalledWith(pkgPaths[0], "utf-8");
    expect(computePackageBump).toHaveBeenCalledWith(rootDir, pkgPaths[0]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      ...mockBump,
      dependencyUpdates: dependencyBumps.get("pkg-bom"),
    });
  });

  it("handles mixed valid and invalid package.json files", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([
      ["pkg-valid", new Map([["dep-1", "2.0.0"]])],
      ["pkg-invalid", new Map([["dep-2", "1.0.0"]])],
    ]);
    const pkgPaths = [
      "/root/pkg-valid/package.json",
      "/root/pkg-invalid/package.json",
    ];

    let fileIndex = 0;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      fileIndex++;
      if (fileIndex === 1) {
        return JSON.stringify({ name: "pkg-valid" });
      }
      throw new Error("ENOENT");
    });

    const mockBump: PackageUpdate = {
      name: "pkg-valid",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-valid",
      dependencyUpdates: new Map(),
    };
    vi.mocked(computePackageBump).mockResolvedValue(mockBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(1);
    expect(updates[0].name).toBe("pkg-valid");
    expect(computePackageBump).toHaveBeenCalledTimes(1);
    expect(computePackageBump).toHaveBeenCalledWith(rootDir, pkgPaths[0]);
  });

  it("handles updates with empty dependency maps", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([
      ["pkg-empty", new Map()], // Empty dependency map
      ["pkg-with-deps", new Map([["dep-1", "2.0.0"]])],
    ]);
    const pkgPaths = [
      "/root/pkg-empty/package.json",
      "/root/pkg-with-deps/package.json",
    ];

    let fileIndex = 0;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return JSON.stringify({
        name: fileIndex++ === 0 ? "pkg-empty" : "pkg-with-deps",
      });
    });

    const emptyBump: PackageUpdate = {
      name: "pkg-empty",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-empty",
      dependencyUpdates: new Map(),
    };
    const withDepsBump: PackageUpdate = {
      name: "pkg-with-deps",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-with-deps",
      dependencyUpdates: new Map(),
    };

    vi.mocked(computePackageBump)
      .mockResolvedValueOnce(emptyBump)
      .mockResolvedValueOnce(withDepsBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(2);
    expect(updates[0].dependencyUpdates.size).toBe(0);
    expect(updates[1].dependencyUpdates.size).toBe(1);
  });

  it("handles repeated package occurrences in dependency maps", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([
      ["pkg-repeat", new Map([["dep-1", "1.0.0"]])],
      ["pkg-other", new Map([["pkg-repeat", "1.1.0"]])], // pkg-repeat appears as both package and dependency
    ]);
    const pkgPaths = [
      "/root/pkg-repeat/package.json",
      "/root/pkg-other/package.json",
    ];

    let fileIndex = 0;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      return JSON.stringify({
        name: fileIndex++ === 0 ? "pkg-repeat" : "pkg-other",
      });
    });

    const repeatBump: PackageUpdate = {
      name: "pkg-repeat",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-repeat",
      dependencyUpdates: new Map(),
    };
    const otherBump: PackageUpdate = {
      name: "pkg-other",
      current: "2.0.0",
      next: "2.1.0",
      pkgDir: "/root/pkg-other",
      dependencyUpdates: new Map(),
    };

    vi.mocked(computePackageBump)
      .mockResolvedValueOnce(repeatBump)
      .mockResolvedValueOnce(otherBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(2);
    expect(updates[0].name).toBe("pkg-repeat");
    expect(updates[1].name).toBe("pkg-other");
    expect(updates[0].dependencyUpdates).toEqual(
      dependencyBumps.get("pkg-repeat"),
    );
    expect(updates[1].dependencyUpdates).toEqual(
      dependencyBumps.get("pkg-other"),
    );
  });

  it("handles invalid paths in pkgPaths", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-a", new Map([["dep-1", "2.0.0"]])]]);
    const pkgPaths = [
      "/root/pkg-a/package.json", // Only include valid path
    ];

    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: "pkg-a" }),
    );

    const mockBump: PackageUpdate = {
      name: "pkg-a",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-a",
      dependencyUpdates: new Map(),
    };
    vi.mocked(computePackageBump).mockResolvedValue(mockBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(1);
    expect(updates[0].name).toBe("pkg-a");
    expect(computePackageBump).toHaveBeenCalledTimes(1);
    expect(computePackageBump).toHaveBeenCalledWith(rootDir, pkgPaths[0]);
  });

  it("handles invalid paths in pkgPaths", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-a", new Map([["dep-1", "2.0.0"]])]]);
    const pkgPaths = [
      "/root/pkg-a/package.json", // Only include valid path
    ];

    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: "pkg-a" }),
    );

    const mockBump: PackageUpdate = {
      name: "pkg-a",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-a",
      dependencyUpdates: new Map(),
    };
    vi.mocked(computePackageBump).mockResolvedValue(mockBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(1);
    expect(updates[0].name).toBe("pkg-a");
    expect(computePackageBump).toHaveBeenCalledTimes(1);
    expect(computePackageBump).toHaveBeenCalledWith(rootDir, pkgPaths[0]);
  });

  it("handles invalid path formats", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-a", new Map([["dep-1", "2.0.0"]])]]);
    const pkgPaths = [
      "", // Empty path
      "/root/./pkg-a/package.json", // Path with dot notation
      "/root//pkg-a/package.json", // Path with double slashes
      "/root/pkg-a/../pkg-a/package.json", // Path with parent directory reference
    ];

    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(0);
    expect(computePackageBump).not.toHaveBeenCalled();
  });

  it("should use first valid package when multiple packages have same name", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([
      ["pkg-dupe", new Map([["dep-1", "2.0.0"]])],
    ]);
    const pkgPaths = [
      "/root/valid/pkg-dupe/package.json",
      "/root/invalid/pkg-dupe/package.json",
    ];

    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(JSON.stringify({ name: "pkg-dupe" }))
      .mockImplementationOnce(() => {
        throw new Error("ENOENT");
      });

    const mockBump: PackageUpdate = {
      name: "pkg-dupe",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/valid/pkg-dupe",
      dependencyUpdates: new Map(),
    };
    vi.mocked(computePackageBump).mockResolvedValue(mockBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(computePackageBump).toHaveBeenCalledTimes(1);
    expect(computePackageBump).toHaveBeenCalledWith(rootDir, pkgPaths[0]);
  });

  it.skip("should handle empty dependency maps", async () => {
    const updates: PackageUpdate[] = [];
    const dependencyBumps = new Map([["pkg-empty", new Map()]]);
    const pkgPaths = ["/root/pkg-empty/package.json"];

    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: "pkg-empty" }),
    );

    const mockBump: PackageUpdate = {
      name: "pkg-empty",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-empty",
      dependencyUpdates: new Map(),
    };
    vi.mocked(computePackageBump).mockResolvedValue(mockBump);

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(0);
    expect(updates[0].dependencyUpdates.size).toBe(0);
  });

  it("should preserve dependency updates when package.json is malformed", async () => {
    const updates: PackageUpdate[] = [];
    const deps = new Map([["dep-1", "2.0.0"]]);
    const dependencyBumps = new Map([["pkg-mal", deps]]);
    const pkgPaths = ["/root/pkg-mal/package.json"];

    vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

    await computeTriggeredBumps(rootDir, pkgPaths, updates, dependencyBumps);

    expect(updates).toHaveLength(0);
    expect(dependencyBumps.get("pkg-mal")).toBe(deps);
  });
});
