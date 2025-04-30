import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspacePackagePaths } from "./getWorkspacePackagePaths.js";

// Define a test root directory and the expected root package.json path.
const rootDir = "/test/project";
const rootPkgPath = path.join(rootDir, "package.json");

describe("getWorkspacePackagePaths", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw error when package.json is malformed", () => {
    // Arrange: return an invalid JSON string.
    vi.spyOn(fs, "readFileSync").mockReturnValue("This is not JSON");

    // Act & Assert
    expect(() => getWorkspacePackagePaths(rootDir)).toThrowError(
      `Malformed package.json in ${rootPkgPath}`,
    );
  });

  it("should throw error when workspaces field is not an array", () => {
    // Arrange: simulate a package.json where workspaces is not an array.
    const packageJson = { workspaces: { pattern: "packages/*" } };
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(packageJson));

    // Act & Assert
    expect(() => getWorkspacePackagePaths(rootDir)).toThrowError(
      `Invalid workspaces field in ${rootPkgPath}: must be an array`,
    );
  });

  it("should throw error when workspaces array contains non-string values", () => {
    // Arrange: simulate a package.json where workspaces array has a non\-string.
    const packageJson = { workspaces: ["packages/*", 123] };
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(packageJson));

    // Act & Assert
    expect(() => getWorkspacePackagePaths(rootDir)).toThrowError(
      `Invalid workspaces field in ${rootPkgPath}: every workspace must be a string`,
    );
  });

  it("should return workspace package paths when workspaces are defined", () => {
    // Arrange: simulate root package.json with a workspaces field.
    const packageJson = { workspaces: ["packages/*"] };
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(packageJson));

    // Simulate fast-glob returning two package.json paths.
    const fakePkgPaths = [
      path.join(rootDir, "packages/pkg1/package.json"),
      path.join(rootDir, "packages/pkg2/package.json"),
    ];
    vi.spyOn(fg, "sync").mockReturnValue(fakePkgPaths);

    // Act: call the function.
    const result = getWorkspacePackagePaths(rootDir);

    // Assert the result matches the simulated paths.
    expect(result).toEqual(fakePkgPaths);
    expect(fs.readFileSync).toHaveBeenCalledWith(rootPkgPath, "utf-8");

    const expectedPatterns = packageJson.workspaces.map((p) =>
      path.join(rootDir, p, "package.json"),
    );
    expect(fg.sync).toHaveBeenCalledWith(expectedPatterns, { dot: true });
  });

  it("should return the root package.json path when workspaces are not defined", () => {
    // Arrange: simulate a package.json without a workspaces field.
    const packageJson = { name: "root", version: "1.0.0" };
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(packageJson));

    // Simulate fast-glob returning an empty array.
    vi.spyOn(fg, "sync").mockReturnValue([]);

    // Act: call the function.
    const result = getWorkspacePackagePaths(rootDir);

    // Assert that the function falls back to returning the root package.json.
    expect(result).toEqual([rootPkgPath]);
    expect(fs.readFileSync).toHaveBeenCalledWith(rootPkgPath, "utf-8");
    expect(fg.sync).toHaveBeenCalledWith([], { dot: true });
  });
});
