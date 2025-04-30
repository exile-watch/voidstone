import fs from "node:fs";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageUpdate } from "../../types.js";
import { computeDependencyUpdates } from "./computeDependencyUpdates.js";

vi.mock("node:fs");

describe("computeDependencyUpdates", () => {
  const mockedReadFileSync = fs.readFileSync as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty map when no packages have dependencies to update", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "external-pkg": "1.0.0",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.size).toBe(0);
  });

  it("correctly maps dependencies that need updates", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "1.0.0",
          "pkg-c": "2.0.0",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-c",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["pkg-b", "1.1.0"],
        ["pkg-c", "2.1.0"],
      ]),
    );
  });

  it("handles all dependency types", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: { "pkg-b": "1.0.0" },
        devDependencies: { "pkg-c": "2.0.0" },
        peerDependencies: { "pkg-d": "3.0.0" },
        optionalDependencies: { "pkg-e": "4.0.0" },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "b.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-c",
        current: "2.0.0",
        next: "c.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-d",
        current: "3.0.0",
        next: "d.1.0",
        pkgDir: "pkg-d",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-e",
        current: "4.0.0",
        next: "e.1.0",
        pkgDir: "pkg-e",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["pkg-b", "b.1.0"],
        ["pkg-c", "c.1.0"],
        ["pkg-d", "d.1.0"],
        ["pkg-e", "e.1.0"],
      ]),
    );
  });

  it("handles missing dependency fields", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.size).toBe(0);
  });

  it("handles multiple packages", () => {
    mockedReadFileSync
      .mockReturnValueOnce(
        JSON.stringify({
          name: "pkg-a",
          dependencies: { "pkg-c": "1.0.0" },
        }),
      )
      .mockReturnValueOnce(
        JSON.stringify({
          name: "pkg-b",
          devDependencies: { "pkg-c": "1.0.0" },
        }),
      );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-c",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a", "pkg-b"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-c", "1.1.0"]]));
    expect(result.get("pkg-b")).toEqual(new Map([["pkg-c", "1.1.0"]]));
  });

  it("handles invalid JSON", () => {
    mockedReadFileSync.mockReturnValue("invalid json");

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    expect(() => computeDependencyUpdates(["pkg-a"], updates)).toThrow();
  });

  it("reads files with utf-8 encoding", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
      }),
    );

    computeDependencyUpdates(["pkg-a"], []);
    expect(mockedReadFileSync).toHaveBeenCalledWith("pkg-a", "utf-8");
  });

  it("handles circular dependencies correctly", () => {
    mockedReadFileSync
      .mockReturnValueOnce(
        JSON.stringify({
          name: "pkg-a",
          dependencies: { "pkg-b": "1.0.0" },
        }),
      )
      .mockReturnValueOnce(
        JSON.stringify({
          name: "pkg-b",
          dependencies: { "pkg-a": "1.0.0" },
        }),
      );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-a",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-a",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a", "pkg-b"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-b", "1.1.0"]]));
    expect(result.get("pkg-b")).toEqual(new Map([["pkg-a", "1.1.0"]]));
  });

  it("handles duplicate dependencies across different types", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: { "pkg-b": "1.0.0" },
        devDependencies: { "pkg-b": "1.0.0" },
        peerDependencies: { "pkg-b": "1.0.0" },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-b", "1.1.0"]]));
  });

  it("handles empty package paths array", () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates([], updates);
    expect(result.size).toBe(0);
    expect(mockedReadFileSync).not.toHaveBeenCalled();
  });

  it("handles version ranges in dependencies", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "^1.0.0",
          "pkg-c": "~2.0.0",
          "pkg-d": ">=3.0.0",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-c",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-d",
        current: "3.0.0",
        next: "3.1.0",
        pkgDir: "pkg-d",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["pkg-b", "1.1.0"],
        ["pkg-c", "2.1.0"],
        ["pkg-d", "3.1.0"],
      ]),
    );
  });

  it("handles workspace protocol dependencies", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "workspace:^1.0.0",
          "pkg-c": "workspace:*",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-c",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["pkg-b", "1.1.0"],
        ["pkg-c", "2.1.0"],
      ]),
    );
  });

  it("handles file path dependencies", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "file:../pkg-b",
          "pkg-c": "link:../pkg-c",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-c",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["pkg-b", "1.1.0"],
        ["pkg-c", "2.1.0"],
      ]),
    );
  });

  it.skip("handles npm alias dependencies", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "alias-b": "npm:pkg-b@^1.0.0",
          "alias-c": "npm:pkg-c",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-c",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["alias-b", "1.1.0"],
        ["alias-c", "2.1.0"],
      ]),
    );
  });

  it("handles git dependencies", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "git+https://github.com/org/pkg-b.git#v1.0.0",
          "pkg-c": "git://github.com/org/pkg-c.git#semver:^2.0.0",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-c",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["pkg-b", "1.1.0"],
        ["pkg-c", "2.1.0"],
      ]),
    );
  });

  it("handles malformed package.json with invalid dependency values", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": null,
          "pkg-c": undefined,
          "pkg-d": 123,
          "pkg-e": true,
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-b", "1.1.0"]]));
  });

  it("handles scoped package names", () => {
    // Test for a dependency using a scoped name (e.g. @scope/pkg-b)
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "@scope/pkg-b": "^1.0.0",
        },
      }),
    );
    const updates: PackageUpdate[] = [
      {
        name: "@scope/pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];
    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["@scope/pkg-b", "1.1.0"]]));
  });

  it("handles dependency version strings with extra whitespace", () => {
    // Test for version strings that include extra whitespace
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "   ^1.0.0  ",
        },
      }),
    );
    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];
    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-b", "1.1.0"]]));
  });

  it("handles pre-release versions", () => {
    // Test for dependencies with pre-release version strings
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "1.0.0-alpha.0",
        },
      }),
    );
    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0-alpha.0",
        next: "1.0.0-beta.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];
    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-b", "1.0.0-beta.0"]]));
  });

  it("handles empty dependency version string (only whitespace)", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "       ",
        },
      }),
    );
    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];
    // Even if the version string is whitespace, we still match using the dependency key.
    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-b", "1.1.0"]]));
  });

  it("ignores dependency version expressed as an array", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": ["1.0.0", ">=1.0.0"],
        },
      }),
    );
    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];
    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.size).toBe(0);
  });

  it("ignores dependency version expressed as an object", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": { version: "1.0.0" },
        },
      }),
    );
    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];
    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.size).toBe(0);
  });

  it("handles complex workspace protocol with extra formatting", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "workspace:  ^1.0.0 ",
        },
      }),
    );
    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];
    // Even with extra spaces, the dependency key is used as the lookup.
    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-b", "1.1.0"]]));
  });

  it("handles dependency version with only a protocol prefix", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "workspace:",
          "pkg-c": "npm:",
          "pkg-d": "file:",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-b", "1.1.0"]]));
  });

  it("handles unicode characters in dependency versions", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "1.0.0-β.1",
          "pkg-c": "workspace:⚡2.0.0",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0-β.1",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-c",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["pkg-b", "1.1.0"],
        ["pkg-c", "2.1.0"],
      ]),
    );
  });

  it("handles dependency versions with environment variables", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "${VERSION:-1.0.0}",
          "pkg-c": "$PACKAGE_VERSION",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(new Map([["pkg-b", "1.1.0"]]));
  });

  it("handles invalid package.json with non-object dependency fields", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: "not-an-object",
        devDependencies: ["array-instead-of-object"],
        peerDependencies: 123,
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.size).toBe(0);
  });

  it("handles dependency aliases with multiple @ symbols", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "alias@2.0": "npm:@scope/pkg-b@1.0.0",
          "@alias/pkg@1.0": "npm:@scope/pkg-c@2.0.0",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "@scope/pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "@scope/pkg-c",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "pkg-c",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["alias@2.0", "1.1.0"],
        ["@alias/pkg@1.0", "2.1.0"],
      ]),
    );
  });

  it("handles dependency versions with build metadata", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "1.0.0+build.001",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0+build.001",
        next: "1.0.1+build.002",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([["pkg-b", "1.0.1+build.002"]]),
    );
  });

  it("handles mixed valid and invalid dependency aliases", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-a",
        dependencies: {
          "pkg-b": "npm:pkg-b@1.0.0",
          "pkg-invalid": "npm:pkg-invalid", // missing version separator
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.0.1",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-invalid",
        current: "",
        next: "2.0.0",
        pkgDir: "pkg-invalid",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-a"], updates);
    expect(result.get("pkg-a")).toEqual(
      new Map([
        ["pkg-b", "1.0.1"],
        // "pkg-invalid" remains unchanged because its alias does not resolve to a bump update.
      ]),
    );
  });

  it("handles duplicate dependencies in different fields", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-dup",
        dependencies: { "pkg-b": "^1.0.0" },
        devDependencies: { "pkg-b": "^1.0.0" },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-dup"], updates);
    expect(result.get("pkg-dup")).toEqual(new Map([["pkg-b", "1.1.0"]]));
  });

  it("handles dependency alias with extra whitespace and protocol formatting", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-space",
        dependencies: {
          "alias-b": "   npm:pkg-b@^1.0.0   ",
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-b",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "pkg-b",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-space"], updates);
    expect(result.get("pkg-space")).toEqual(new Map([["alias-b", "1.1.0"]]));
  });

  it.skip("skips ambiguous npm alias when missing version separator", () => {
    mockedReadFileSync.mockReturnValue(
      JSON.stringify({
        name: "pkg-ambiguous",
        dependencies: {
          "pkg-invalid": "npm:pkg-invalid", // missing version separator
        },
      }),
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-invalid",
        current: "",
        next: "2.0.0",
        pkgDir: "pkg-invalid",
        dependencyUpdates: new Map(),
      },
    ];

    const result = computeDependencyUpdates(["pkg-ambiguous"], updates);
    expect(result.get("pkg-ambiguous")).toEqual(new Map());
  });
});
