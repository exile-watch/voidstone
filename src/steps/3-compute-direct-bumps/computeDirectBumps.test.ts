import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the computePackageBump module
vi.mock("../../utils/computePackageBump/computePackageBump", () => ({
  computePackageBump: vi.fn(),
}));

import { computePackageBump } from "../../utils/computePackageBump/computePackageBump.js";
import { computeDirectBumps } from "./computeDirectBumps.js";

const mockedComputePackageBump = computePackageBump as unknown as Mock;

describe("computeDirectBumps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array when computePackageBump returns null for all packages", async () => {
    mockedComputePackageBump.mockResolvedValue(null);

    const result = await computeDirectBumps("/root", ["pkgA", "pkgB"]);

    expect(result).toEqual([]);
    expect(mockedComputePackageBump).toHaveBeenCalledTimes(2);
    expect(mockedComputePackageBump).toHaveBeenCalledWith("/root", "pkgA");
    expect(mockedComputePackageBump).toHaveBeenCalledWith("/root", "pkgB");
  });

  it("returns package updates with an empty dependencyUpdates map", async () => {
    const bump = {
      name: "pkgA",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "pkgA",
    };
    mockedComputePackageBump.mockResolvedValue(bump);

    const [update] = await computeDirectBumps("/root", ["pkgA"]);

    expect(update).toEqual({
      ...bump,
      dependencyUpdates: new Map(),
    });
    expect(update.dependencyUpdates.size).toBe(0);
  });

  it("filters out null bumps and includes only valid ones in the correct order", async () => {
    const bumpA = {
      name: "pkgA",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "pkgA",
    };
    const bumpB = {
      name: "pkgB",
      current: "2.0.0",
      next: "2.1.0",
      pkgDir: "pkgB",
    };

    mockedComputePackageBump
      .mockResolvedValueOnce(bumpA)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(bumpB);

    const pkgPaths = ["pkgA", "pkgNull", "pkgB"];
    const result = await computeDirectBumps("/root", pkgPaths);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["pkgA", "pkgB"]);
  });

  it("handles empty pkgPaths array", async () => {
    const result = await computeDirectBumps("/root", []);

    expect(result).toEqual([]);
    expect(mockedComputePackageBump).not.toHaveBeenCalled();
  });

  it("handles rejection from computePackageBump", async () => {
    mockedComputePackageBump.mockRejectedValueOnce(
      new Error("Failed to compute bump"),
    );

    await expect(computeDirectBumps("/root", ["pkgA"])).rejects.toThrow(
      "Failed to compute bump",
    );
    expect(mockedComputePackageBump).toHaveBeenCalledTimes(1);
  });

  it("handles multiple rejections correctly", async () => {
    const error = new Error("Network error");
    mockedComputePackageBump.mockRejectedValueOnce(error);

    await expect(computeDirectBumps("/root", ["pkgA", "pkgB"])).rejects.toThrow(
      "Network error",
    );
  });

  it("processes packages regardless of rootDir value", async () => {
    const bump = {
      name: "pkgA",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "pkgA",
    };
    mockedComputePackageBump.mockResolvedValueOnce(bump);

    const result = await computeDirectBumps("", ["pkgA"]);

    expect(mockedComputePackageBump).toHaveBeenCalledWith("", "pkgA");
    expect(result).toEqual([{ ...bump, dependencyUpdates: new Map() }]);
  });

  it("preserves order of non-null results", async () => {
    const bumps = [
      { name: "pkgA", current: "1.0.0", next: "1.1.0", pkgDir: "pkgA" },
      { name: "pkgB", current: "2.0.0", next: "2.1.0", pkgDir: "pkgB" },
      { name: "pkgC", current: "3.0.0", next: "3.1.0", pkgDir: "pkgC" },
    ];

    mockedComputePackageBump
      .mockResolvedValueOnce(bumps[0])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(bumps[1])
      .mockResolvedValueOnce(bumps[2]);

    const result = await computeDirectBumps("/root", [
      "pkgA",
      "pkgNull",
      "pkgB",
      "pkgC",
    ]);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(["pkgA", "pkgB", "pkgC"]);
    expect(mockedComputePackageBump).toHaveBeenCalledTimes(4);
  });

  it("handles malformed bump data", async () => {
    const malformedBump = { name: "pkgA" }; // Missing required fields
    mockedComputePackageBump.mockResolvedValueOnce(malformedBump);

    const result = await computeDirectBumps("/root", ["pkgA"]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "pkgA",
      dependencyUpdates: new Map(),
    });
  });

  it("handles extremely large number of packages", async () => {
    const pkgPaths = Array.from({ length: 100 }, (_, i) => `pkg${i}`);
    mockedComputePackageBump.mockResolvedValue(null);

    const result = await computeDirectBumps("/root", pkgPaths);

    expect(result).toEqual([]);
    expect(mockedComputePackageBump).toHaveBeenCalledTimes(100);
  });

  it("handles packages with similar names correctly", async () => {
    const pkgPaths = ["pkg", "pkg-utils", "pkg-core"];
    const bumps = pkgPaths.map((name) => ({
      name,
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: name,
    }));

    mockedComputePackageBump
      .mockResolvedValueOnce(bumps[0])
      .mockResolvedValueOnce(bumps[1])
      .mockResolvedValueOnce(bumps[2]);

    const result = await computeDirectBumps("/root", pkgPaths);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(["pkg", "pkg-utils", "pkg-core"]);
  });

  it("handles paths with special characters", async () => {
    const pkgPaths = ["/root/@scope/pkg-name", "/root/pkg@2.0"];
    const bumps = pkgPaths.map((path) => ({
      name: path.split("/").at(-1),
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: path,
      dependencyUpdates: new Map(),
    }));

    mockedComputePackageBump
      .mockResolvedValueOnce(bumps[0])
      .mockResolvedValueOnce(bumps[1]);

    const result = await computeDirectBumps("/root", pkgPaths);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["pkg-name", "pkg@2.0"]);
  });
});
