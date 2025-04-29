import fs from "node:fs";
import { Bumper } from "conventional-recommended-bump";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDependencyUpdateCommits } from "../createDependencyUpdateCommits/createDependencyUpdateCommits.js";
import { computePackageBump } from "./computePackageBump.js";

vi.mock("node:fs");
vi.mock("conventional-recommended-bump");
vi.mock("../createDependencyUpdateCommits/createDependencyUpdateCommits");

describe("computePackageBump", () => {
  const mockPackageJson = {
    name: "test-package",
    version: "1.0.0",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));

    vi.mocked(Bumper.prototype.loadPreset).mockReturnThis();
    vi.mocked(Bumper.prototype.tag).mockReturnThis();
    vi.mocked(Bumper.prototype.commits).mockReturnThis();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return null when no version bump is needed", async () => {
    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "patch",
      reason: "",
      level: 2,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toBeNull();
  });

  it("should compute patch bump correctly", async () => {
    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "patch",
      reason: "patch changes",
      level: 2,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "test-package",
      current: "1.0.0",
      next: "1.0.1",
      pkgDir: "/root",
    });
  });

  it("should compute minor bump correctly", async () => {
    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "minor",
      reason: "new features",
      level: 1,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "test-package",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root",
    });
  });

  it("should compute major bump correctly", async () => {
    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "major",
      reason: "breaking changes",
      level: 0,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "test-package",
      current: "1.0.0",
      next: "2.0.0",
      pkgDir: "/root",
    });
  });

  it("should handle dependency updates", async () => {
    const updatedDeps = new Map([["dep-a", "1.0.1"]]);
    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "patch",
      reason: "dependency updates",
      level: 2,
    });

    await computePackageBump("/root", "/root/package.json", updatedDeps);

    expect(createDependencyUpdateCommits).toHaveBeenCalledWith(
      "/root",
      updatedDeps,
      "/root",
    );
  });

  it("should configure bumper correctly", async () => {
    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "patch",
      reason: "",
      level: 2,
    });

    await computePackageBump("/root", "/root/packages/my-pkg/package.json");

    expect(Bumper.prototype.loadPreset).toHaveBeenCalledWith("angular");
    expect(Bumper.prototype.tag).toHaveBeenCalledWith({
      prefix: "test-package@",
    });
    expect(Bumper.prototype.commits).toHaveBeenCalledWith({
      path: "packages/my-pkg",
    });
  });

  it("should handle invalid package.json", async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("File not found");
    });

    await expect(
      computePackageBump("/root", "/root/package.json"),
    ).rejects.toThrow();
  });

  it("should handle multiple packages independently", async () => {
    // First package
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-a",
        version: "1.0.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "minor",
      reason: "new features",
      level: 1,
    });

    const resultA = await computePackageBump(
      "/root",
      "/root/packages/package-a/package.json",
    );

    // Second package
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-b",
        version: "2.0.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "patch",
      reason: "bug fixes",
      level: 2,
    });

    const resultB = await computePackageBump(
      "/root",
      "/root/packages/package-b/package.json",
    );

    // Verify independent versioning
    expect(resultA).toEqual({
      name: "package-a",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/packages/package-a",
    });

    expect(resultB).toEqual({
      name: "package-b",
      current: "2.0.0",
      next: "2.0.1",
      pkgDir: "/root/packages/package-b",
    });

    // Verify each package got its own configuration
    expect(Bumper.prototype.tag).toHaveBeenCalledWith({
      prefix: "package-a@",
    });
    expect(Bumper.prototype.tag).toHaveBeenCalledWith({
      prefix: "package-b@",
    });

    expect(Bumper.prototype.commits).toHaveBeenCalledWith({
      path: "packages/package-a",
    });
    expect(Bumper.prototype.commits).toHaveBeenCalledWith({
      path: "packages/package-b",
    });
  });

  it("should allow one package to bump while another doesn't", async () => {
    // First package - needs bump
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-a",
        version: "1.0.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "minor",
      reason: "new features",
      level: 1,
    });

    const resultA = await computePackageBump(
      "/root",
      "/root/packages/package-a/package.json",
    );

    // Second package - no changes
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-b",
        version: "2.0.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: undefined,
      reason: "",
      level: undefined, // Change from null to undefined
    });

    const resultB = await computePackageBump(
      "/root",
      "/root/packages/package-b/package.json",
    );

    expect(resultA).toEqual({
      name: "package-a",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/packages/package-a",
    });

    expect(resultB).toBeNull();
  });

  it("should not bump root package when workspaces are defined", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "root-package",
        version: "1.0.0",
        workspaces: ["packages/*"],
      }),
    );

    // Mock with valid BumperRecommendation object
    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: undefined,
      reason: "",
      level: undefined,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toBeNull();
  });

  it("should handle nested workspaces paths correctly", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "nested-package",
        version: "1.0.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "patch",
      reason: "bug fixes",
      level: 2,
    });

    await computePackageBump(
      "/root",
      "/root/packages/scope/nested-package/package.json",
    );

    expect(Bumper.prototype.commits).toHaveBeenCalledWith({
      path: "packages/scope/nested-package",
    });
  });

  it("should handle packages with scoped names", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "@scope/package",
        version: "1.0.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "minor",
      reason: "new features",
      level: 1,
    });

    const result = await computePackageBump(
      "/root",
      "/root/packages/scoped/package.json",
    );

    expect(Bumper.prototype.tag).toHaveBeenCalledWith({
      prefix: "@scope/package@",
    });
    expect(result?.name).toBe("@scope/package");
  });

  it("should handle packages with private field", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "private-package",
        version: "1.0.0",
        private: true,
      }),
    );

    const result = await computePackageBump(
      "/root",
      "/root/packages/private/package.json",
    );

    expect(result).toBeNull();
  });

  it("should handle package without version field", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "no-version-package",
      }),
    );

    await expect(
      computePackageBump("/root", "/root/package.json"),
    ).rejects.toThrow();
  });

  it("should handle package without name field", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        version: "1.0.0",
      }),
    );

    await expect(
      computePackageBump("/root", "/root/package.json"),
    ).rejects.toThrow();
  });

  it("should handle invalid version string", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "test-package",
        version: "invalid",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "patch",
      reason: "patch changes",
      level: 2,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toBeNull();
  });

  it("should handle workspace package with workspace field", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "workspace-package",
        version: "1.0.0",
        workspace: true,
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "patch",
      reason: "patch changes",
      level: 2,
    });

    const result = await computePackageBump(
      "/root",
      "/root/packages/workspace/package.json",
    );

    expect(result).toEqual({
      name: "workspace-package",
      current: "1.0.0",
      next: "1.0.1",
      pkgDir: "/root/packages/workspace",
    });
  });

  it("should handle prerelease versions", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "prerelease-package",
        version: "1.0.0-beta.1",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "patch",
      reason: "patch changes",
      level: 2,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "prerelease-package",
      current: "1.0.0-beta.1",
      next: "1.0.0-beta.2",
      pkgDir: "/root",
    });
  });

  it("should handle package.json with BOM", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      `\uFEFF${JSON.stringify({
        name: "bom-package",
        version: "1.0.0",
      })}`,
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "patch",
      reason: "patch changes",
      level: 2,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "bom-package",
      current: "1.0.0",
      next: "1.0.1",
      pkgDir: "/root",
    });
  });

  it("should handle prerelease versions with different identifiers", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "alpha-package",
        version: "2.0.0-alpha.5",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "prerelease",
      reason: "prerelease changes",
      level: 2,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "alpha-package",
      current: "2.0.0-alpha.5",
      next: "2.0.0-alpha.6",
      pkgDir: "/root",
    });
  });

  it("should handle zero version", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "zero-package",
        version: "0.0.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "minor",
      reason: "initial release",
      level: 1,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "zero-package",
      current: "0.0.0",
      next: "0.1.0",
      pkgDir: "/root",
    });
  });

  it("should handle mixed package versions and bump types", async () => {
    // Regular package with bump
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "regular-package",
        version: "1.0.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "minor",
      reason: "new features",
      level: 1,
    });

    const resultA = await computePackageBump(
      "/root",
      "/root/packages/regular/package.json",
    );

    // Prerelease package with bump
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "beta-package",
        version: "2.0.0-beta.1",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "patch",
      reason: "fixes",
      level: 2,
    });

    const resultB = await computePackageBump(
      "/root",
      "/root/packages/beta/package.json",
    );

    // Package without changes
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "unchanged-package",
        version: "3.0.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: undefined,
      reason: "",
      level: undefined,
    });

    const resultC = await computePackageBump(
      "/root",
      "/root/packages/unchanged/package.json",
    );

    expect(resultA).toEqual({
      name: "regular-package",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/packages/regular",
    });

    expect(resultB).toEqual({
      name: "beta-package",
      current: "2.0.0-beta.1",
      next: "2.0.0-beta.2",
      pkgDir: "/root/packages/beta",
    });

    expect(resultC).toBeNull();

    // Verify each package got its own configuration
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(1, {
      prefix: "regular-package@",
    });
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(2, {
      prefix: "beta-package@",
    });
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(3, {
      prefix: "unchanged-package@",
    });
  });

  it("should handle release candidates with different bump types", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "rc-package",
        version: "2.0.0-rc.3",
      }),
    );

    // Testing major bump for a release candidate
    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "major",
      reason: "breaking changes",
      level: 0,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "rc-package",
      current: "2.0.0-rc.3",
      next: "2.0.0-rc.4", // Should still increment RC even with major changes
      pkgDir: "/root",
    });
  });

  it("should handle packages with initial development versions (0.x.x)", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "dev-package",
        version: "0.5.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "major",
      reason: "first stable release",
      level: 0,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "dev-package",
      current: "0.5.0",
      next: "1.0.0", // Moving from development to stable
      pkgDir: "/root",
    });
  });

  it("should handle release candidate to stable transition", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "rc-stable-package",
        version: "2.0.0-rc.5",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValue({
      releaseType: "release",
      reason: "stable release",
      level: 0,
    });

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toEqual({
      name: "rc-stable-package",
      current: "2.0.0-rc.5",
      next: "2.0.0", // Should drop prerelease identifier for stable release
      pkgDir: "/root",
    });
  });

  it("should handle private scoped packages", async () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        name: "@private/package",
        version: "1.0.0",
        private: true,
      }),
    );

    const result = await computePackageBump("/root", "/root/package.json");
    expect(result).toBeNull();

    // Verify tag prefix was never set since package is private
    expect(Bumper.prototype.tag).not.toHaveBeenCalled();
  });

  it("should handle multiple packages with different release candidate states", async () => {
    // Package A: RC to stable
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-a",
        version: "1.0.0-rc.3",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "release",
      reason: "stable release",
      level: 0,
    });

    const resultA = await computePackageBump(
      "/root",
      "/root/packages/package-a/package.json",
    );

    // Package B: Beta to RC
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-b",
        version: "2.0.0-beta.5",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "prerelease",
      reason: "moving to RC",
      level: 1,
    });

    const resultB = await computePackageBump(
      "/root",
      "/root/packages/package-b/package.json",
    );

    // Package C: Already stable with RC dependency
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-c",
        version: "3.0.0",
        dependencies: {
          "package-a": "1.0.0-rc.3",
        },
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "patch",
      reason: "dependency updates",
      level: 2,
    });

    const resultC = await computePackageBump(
      "/root",
      "/root/packages/package-c/package.json",
    );

    expect(resultA).toEqual({
      name: "package-a",
      current: "1.0.0-rc.3",
      next: "1.0.0", // RC to stable
      pkgDir: "/root/packages/package-a",
    });

    expect(resultB).toEqual({
      name: "package-b",
      current: "2.0.0-beta.5",
      next: "2.0.0-rc.0", // Beta to RC
      pkgDir: "/root/packages/package-b",
    });

    expect(resultC).toEqual({
      name: "package-c",
      current: "3.0.0",
      next: "3.0.1", // Patch bump due to dependency update
      pkgDir: "/root/packages/package-c",
    });

    // Verify each package got its own configuration
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(1, {
      prefix: "package-a@",
    });
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(2, {
      prefix: "package-b@",
    });
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(3, {
      prefix: "package-c@",
    });
  });

  it("should handle complex mix of version transitions across packages including no updates", async () => {
    // Package A: Alpha to Beta
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-a",
        version: "1.0.0-alpha.5",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "prerelease",
      reason: "moving to beta",
      level: 1,
    });

    const resultA = await computePackageBump(
      "/root",
      "/root/packages/package-a/package.json",
    );

    // Package B: Beta to RC with major changes
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-b",
        version: "1.0.0-beta.3",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "major",
      reason: "breaking changes moving to rc",
      level: 0,
    });

    const resultB = await computePackageBump(
      "/root",
      "/root/packages/package-b/package.json",
    );

    // Package C: No updates needed
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-c",
        version: "2.0.0-rc.1",
        dependencies: {
          "package-a": "1.0.0-alpha.5",
        },
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: undefined,
      reason: "",
      level: undefined,
    });

    const resultC = await computePackageBump(
      "/root",
      "/root/packages/package-c/package.json",
    );

    // Package D: Development to Stable
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-d",
        version: "0.9.0",
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "major",
      reason: "first stable release",
      level: 0,
    });

    const resultD = await computePackageBump(
      "/root",
      "/root/packages/package-d/package.json",
    );

    // Package E: Stable with mixed prerelease dependencies
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({
        name: "package-e",
        version: "3.0.0",
        dependencies: {
          "package-a": "1.0.0-alpha.5",
          "package-b": "1.0.0-beta.3",
          "package-c": "2.0.0-rc.1",
        },
      }),
    );

    vi.mocked(Bumper.prototype.bump).mockResolvedValueOnce({
      releaseType: "patch",
      reason: "dependency updates",
      level: 2,
    });

    const resultE = await computePackageBump(
      "/root",
      "/root/packages/package-e/package.json",
    );

    expect(resultA).toEqual({
      name: "package-a",
      current: "1.0.0-alpha.5",
      next: "1.0.0-beta.0", // Alpha to Beta
      pkgDir: "/root/packages/package-a",
    });

    expect(resultB).toEqual({
      name: "package-b",
      current: "1.0.0-beta.3",
      next: "1.0.0-beta.4", // Beta increment despite major changes
      pkgDir: "/root/packages/package-b",
    });

    expect(resultC).toBeNull(); // No updates needed

    expect(resultD).toEqual({
      name: "package-d",
      current: "0.9.0",
      next: "1.0.0", // Development to stable
      pkgDir: "/root/packages/package-d",
    });

    expect(resultE).toEqual({
      name: "package-e",
      current: "3.0.0",
      next: "3.0.1", // Patch bump due to dependency updates
      pkgDir: "/root/packages/package-e",
    });

    // Verify each package got its own configuration
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(1, {
      prefix: "package-a@",
    });
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(2, {
      prefix: "package-b@",
    });
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(3, {
      prefix: "package-c@",
    });
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(4, {
      prefix: "package-d@",
    });
    expect(Bumper.prototype.tag).toHaveBeenNthCalledWith(5, {
      prefix: "package-e@",
    });
  });
});
