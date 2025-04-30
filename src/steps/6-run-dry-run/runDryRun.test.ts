import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGISTRY } from "../../constants.js";
import type { PackageUpdate } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";
import { runDryRun } from "./runDryRun.js";

vi.mock("../../utils/execWithLog/execWithLog.js");

describe("runDryRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute dry run for basic package", () => {
    const updates: PackageUpdate[] = [
      {
        name: "basic-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/basic-pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/basic-pkg", stdio: "ignore" },
    );
  });

  it("should handle private packages", () => {
    const updates: PackageUpdate[] = [
      {
        name: "@org/private-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/@org/private-pkg",
        dependencyUpdates: new Map([["dep", "2.0.0"]]),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/@org/private-pkg", stdio: "ignore" },
    );
  });

  it("should handle packages with non-ascii characters", () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-üñíçødé",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/pkg-üñíçødé",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/pkg-üñíçødé", stdio: "ignore" },
    );
  });

  it("should handle empty updates array", () => {
    const updates: PackageUpdate[] = [];

    runDryRun(updates);

    expect(execWithLog).not.toHaveBeenCalled();
  });

  it("should handle Windows-style paths", () => {
    const updates: PackageUpdate[] = [
      {
        name: "win-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "C:\\root\\win-pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "C:\\root\\win-pkg", stdio: "ignore" },
    );
  });

  it("should handle error during first package publish", () => {
    const error = new Error("First package failed");
    vi.mocked(execWithLog).mockImplementationOnce(() => {
      throw error;
    });

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/pkg-1",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-2",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/pkg-2",
        dependencyUpdates: new Map(),
      },
    ];

    expect(() => runDryRun(updates)).toThrow("First package failed");
    expect(execWithLog).toHaveBeenCalledTimes(1);
  });

  it("should handle relative paths", () => {
    const updates: PackageUpdate[] = [
      {
        name: "rel-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "./packages/rel-pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "./packages/rel-pkg", stdio: "ignore" },
    );
  });

  it("should handle packages with multiple dependency updates", () => {
    const updates: PackageUpdate[] = [
      {
        name: "multi-dep-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/multi-dep-pkg",
        dependencyUpdates: new Map([
          ["dep-1", "1.0.0"],
          ["dep-2", "2.0.0"],
          ["@scoped/dep", "3.0.0"],
        ]),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/multi-dep-pkg", stdio: "ignore" },
    );
  });

  it("should stop execution on first error", () => {
    const error = new Error("Package publish failed");
    vi.mocked(execWithLog).mockImplementationOnce(() => {
      throw error;
    });

    const updates: PackageUpdate[] = [
      {
        name: "error-pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/error-pkg-1",
        dependencyUpdates: new Map(),
      },
      {
        name: "error-pkg-2",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/error-pkg-2",
        dependencyUpdates: new Map(),
      },
    ];

    expect(() => runDryRun(updates)).toThrow("Package publish failed");
    expect(execWithLog).toHaveBeenCalledTimes(1);
    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/error-pkg-1", stdio: "ignore" },
    );
  });

  it("should handle symbolic link paths", () => {
    const updates: PackageUpdate[] = [
      {
        name: "symlink-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/symlink",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/packages/symlink", stdio: "ignore" },
    );
  });

  it("should handle file URLs in paths", () => {
    const updates: PackageUpdate[] = [
      {
        name: "url-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "file:///root/packages/url-pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "file:///root/packages/url-pkg", stdio: "ignore" },
    );
  });

  it("should handle paths with environment variables", () => {
    const updates: PackageUpdate[] = [
      {
        name: "env-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "$HOME/packages/env-pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "$HOME/packages/env-pkg", stdio: "ignore" },
    );
  });

  it("should handle paths with trailing slashes", () => {
    const updates: PackageUpdate[] = [
      {
        name: "trailing-slash-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg/",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/packages/pkg/", stdio: "ignore" },
    );
  });

  it("should handle network drive paths on Windows", () => {
    const updates: PackageUpdate[] = [
      {
        name: "network-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "\\\\server\\share\\pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "\\\\server\\share\\pkg", stdio: "ignore" },
    );
  });

  it("should handle packages with zero version", () => {
    const updates: PackageUpdate[] = [
      {
        name: "zero-version-pkg",
        current: "0.0.0",
        next: "0.0.1",
        pkgDir: "/root/zero-version-pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/zero-version-pkg", stdio: "ignore" },
    );
  });

  it("should handle very long package names and paths", () => {
    const longName = "a".repeat(214); // npm has a 214 character limit for package names
    const updates: PackageUpdate[] = [
      {
        name: longName,
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: `/root/packages/${longName}`,
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: `/root/packages/${longName}`, stdio: "ignore" },
    );
  });

  it("should handle deep nested package paths", () => {
    const updates: PackageUpdate[] = [
      {
        name: "deep-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/very/deep/nested/path/to/package",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/very/deep/nested/path/to/package", stdio: "ignore" },
    );
  });

  it("should handle packages with path-like names", () => {
    const updates: PackageUpdate[] = [
      {
        name: "@scope/path/like/name",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/actual-path",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/packages/actual-path", stdio: "ignore" },
    );
  });

  it("should handle packages with version-like directory names", () => {
    const updates: PackageUpdate[] = [
      {
        name: "versioned-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/v1.0.0/package",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/v1.0.0/package", stdio: "ignore" },
    );
  });

  it("should handle packages with space in path", () => {
    const updates: PackageUpdate[] = [
      {
        name: "space-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/path with spaces/package",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/path with spaces/package", stdio: "ignore" },
    );
  });

  it("should handle packages with special characters in name", () => {
    const updates: PackageUpdate[] = [
      {
        name: "@org/pkg+special-chars!",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/pkg-special",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/pkg-special", stdio: "ignore" },
    );
  });

  it("should handle prerelease versions", () => {
    const updates: PackageUpdate[] = [
      {
        name: "prerelease-pkg",
        current: "1.0.0-beta.0",
        next: "1.0.0-beta.1",
        pkgDir: "/root/prerelease",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/prerelease", stdio: "ignore" },
    );
  });

  it("should handle packages with full URL registry in path", () => {
    const updates: PackageUpdate[] = [
      {
        name: "url-registry-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "https://registry.npmjs.org/pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "https://registry.npmjs.org/pkg", stdio: "ignore" },
    );
  });

  it("should handle packages with git+ssh URLs in path", () => {
    const updates: PackageUpdate[] = [
      {
        name: "git-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "git+ssh://git@github.com/org/pkg.git",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "git+ssh://git@github.com/org/pkg.git", stdio: "ignore" },
    );
  });

  it("should handle packages with query parameters in URL paths", () => {
    const updates: PackageUpdate[] = [
      {
        name: "query-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "https://example.com/pkg?version=1.0.0&token=abc",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      {
        cwd: "https://example.com/pkg?version=1.0.0&token=abc",
        stdio: "ignore",
      },
    );
  });

  it("should handle packages with numeric directory names", () => {
    const updates: PackageUpdate[] = [
      {
        name: "numeric-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/123/456/package",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/123/456/package", stdio: "ignore" },
    );
  });

  it("should handle mixed forward and backward slashes in paths", () => {
    const updates: PackageUpdate[] = [
      {
        name: "mixed-slashes-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "C:\\root/mixed/slashes\\pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "C:\\root/mixed/slashes\\pkg", stdio: "ignore" },
    );
  });

  it("should handle packages with URI-encoded characters in path", () => {
    const updates: PackageUpdate[] = [
      {
        name: "encoded-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/path%20with%20encoded%20chars",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/path%20with%20encoded%20chars", stdio: "ignore" },
    );
  });

  it("should handle packages with special npm dist-tags in path", () => {
    const updates: PackageUpdate[] = [
      {
        name: "dist-tag-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/@latest",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/packages/@latest", stdio: "ignore" },
    );
  });

  it("should handle packages with shell metacharacters in path", () => {
    const updates: PackageUpdate[] = [
      {
        name: "metachar-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/pkg&meta|chars",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/pkg&meta|chars", stdio: "ignore" },
    );
  });

  it("should handle packages with only semver metadata", () => {
    const updates: PackageUpdate[] = [
      {
        name: "metadata-pkg",
        current: "1.0.0+20130313144700",
        next: "1.0.0+20240313144700",
        pkgDir: "/root/metadata-pkg",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root/metadata-pkg", stdio: "ignore" },
    );
  });

  it("should handle packages with empty path segments", () => {
    const updates: PackageUpdate[] = [
      {
        name: "empty-segments-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root//pkg///test//",
        dependencyUpdates: new Map(),
      },
    ];

    runDryRun(updates);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --dry-run --registry ${REGISTRY}`,
      { cwd: "/root//pkg///test//", stdio: "ignore" },
    );
  });
});
