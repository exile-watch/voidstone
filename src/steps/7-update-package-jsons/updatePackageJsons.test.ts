import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageUpdate } from "../../types.js";
import { updatePackageJsons } from "./updatePackageJsons.js";

vi.mock("node:fs");
vi.mock("node:path");

describe("updatePackageJsons", () => {
  const mockFs = {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };

  const mockPath = {
    join: vi.fn((dir, file) => `${dir}/${file}`),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(path.join).mockImplementation((dir, file) => `${dir}/${file}`);
    vi.mocked(fs.readFileSync).mockImplementation(vi.fn());
    vi.mocked(fs.writeFileSync).mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should update package version", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map(),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.version).toBe("2.0.0");
  });

  it("should handle multiple dependency types", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: { "dep-a": "^1.0.0" },
      devDependencies: { "dep-a": "^1.0.0" },
      peerDependencies: { "dep-a": "^1.0.0" },
      optionalDependencies: { "dep-a": "^1.0.0" },
    };

    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.devDependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.peerDependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.optionalDependencies["dep-a"]).toBe("^2.0.0");
  });

  it("should handle multiple package updates", () => {
    const pkg1Content = {
      name: "pkg-1",
      version: "1.0.0",
      dependencies: { "dep-a": "^1.0.0" },
    };
    const pkg2Content = {
      name: "pkg-2",
      version: "2.0.0",
      devDependencies: { "dep-b": "^1.0.0" },
    };

    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(JSON.stringify(pkg1Content))
      .mockReturnValueOnce(JSON.stringify(pkg2Content));

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/test1",
        dependencyUpdates: new Map([["dep-a", "1.5.0"]]),
      },
      {
        name: "pkg-2",
        current: "2.0.0",
        next: "2.1.0",
        pkgDir: "/test2",
        dependencyUpdates: new Map([["dep-b", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);

    const written1 = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    const written2 = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[1][1].toString(),
    );

    expect(written1.version).toBe("1.1.0");
    expect(written1.dependencies["dep-a"]).toBe("^1.5.0");
    expect(written2.version).toBe("2.1.0");
    expect(written2.devDependencies["dep-b"]).toBe("^2.0.0");
  });

  it("should handle empty updates array", () => {
    updatePackageJsons([]);
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("should handle package.json without dependencies", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.version).toBe("2.0.0");
    expect(writtenContent.dependencies).toBeUndefined();
  });

  it("should maintain existing caret/tilde ranges", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "^1.0.0",
        "dep-b": "~1.0.0",
      },
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
  });

  it("should preserve package.json formatting", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      private: true,
      license: "MIT",
    };
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify(pkgContent, null, 2),
    );
    vi.mocked(fs.writeFileSync).mockImplementation(vi.fn());

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map(),
      },
    ];

    updatePackageJsons(updates);

    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      "/test/package.json",
      expect.stringMatching(/\n$/),
    );
  });

  it("should handle invalid package.json", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map(),
      },
    ];

    expect(() => updatePackageJsons(updates)).toThrow();
  });

  it("should handle non-existent dependency types", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
    );
    expect(writtenContent.version).toBe("2.0.0");
  });

  it("should handle file system write errors", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
    };
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify(pkgContent));
    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw new Error("write error");
    });

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map(),
      },
    ];

    expect(() => updatePackageJsons(updates)).toThrow("write error");
  });

  it("should handle file system read errors", () => {
    vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
      throw new Error("read error");
    });

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map(),
      },
    ];

    expect(() => updatePackageJsons(updates)).toThrow("read error");
  });

  it("should handle circular dependencies in package.json", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      circular: "[Circular]",
    };
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify(pkgContent));
    vi.mocked(fs.writeFileSync).mockImplementation(vi.fn());

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map(),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
    );
    expect(writtenContent.version).toBe("2.0.0");
  });

  it("should keep dependency version if not in dependencyUpdates", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "^1.0.0",
        "dep-b": "^1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify(pkgContent));
    vi.mocked(fs.writeFileSync).mockImplementation(vi.fn());

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^1.0.0");
  });

  it("should handle package.json with BOM", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
    };
    const bomContent = `\uFEFF${JSON.stringify(pkgContent)}`;
    vi.mocked(fs.readFileSync).mockReturnValueOnce(bomContent);
    vi.mocked(fs.writeFileSync).mockImplementation(vi.fn());

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map(),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
    );
    expect(writtenContent.version).toBe("2.0.0");
  });

  it("should handle package.json with comments", () => {
    vi.mocked(fs.readFileSync).mockReturnValue('{"name": "test" // comment\n}');

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map(),
      },
    ];

    expect(() => updatePackageJsons(updates)).toThrow();
  });

  it("should handle empty version strings", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: { "dep-a": "" },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
  });

  it("should handle different path separators", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));
    vi.mocked(path.join).mockReturnValue("C:\\test\\package.json");

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "C:\\test",
        dependencyUpdates: new Map(),
      },
    ];

    updatePackageJsons(updates);

    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      "C:\\test\\package.json",
      expect.any(String),
    );
  });

  it("should handle empty version strings", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: { "dep-a": "" },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
  });

  it("should handle various version range formats", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": ">=1.0.0",
        "dep-b": "~1.0.0",
        "dep-c": "*",
        "dep-d": "1.x",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
          ["dep-c", "2.0.0"],
          ["dep-d", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-c"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-d"]).toBe("^2.0.0");
  });

  it("should handle workspace dependencies", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "workspace:*",
        "dep-b": "workspace:^1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("workspace:^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("workspace:^2.0.0");
  });

  it("should not modify git dependencies", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "git+https://github.com/user/repo.git#v1.0.0",
        "dep-b": "github:user/repo#v1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "git+https://github.com/user/repo.git#v1.0.0",
    );
    expect(writtenContent.dependencies["dep-b"]).toBe(
      "github:user/repo#v1.0.0",
    );
  });

  it("should handle dependency versions without semver", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "latest",
        "dep-b": "next",
        "dep-c": "*",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
          ["dep-c", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-c"]).toBe("^2.0.0");
  });

  it("should handle file: protocol dependencies", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "file:../dep-a",
        "dep-b": "file:packages/dep-b",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("file:../dep-a");
    expect(writtenContent.dependencies["dep-b"]).toBe("file:packages/dep-b");
  });

  it("should handle npm aliases", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "my-dep": "npm:actual-package@1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["my-dep", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["my-dep"]).toBe(
      "npm:actual-package@^2.0.0",
    );
  });

  it("should handle version ranges with spaces", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": ">= 1.0.0",
        "dep-b": "~ 1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
  });

  it("should handle link: protocol dependencies", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "link:../dep-a",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("link:../dep-a");
  });

  it("should handle non-string version values", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": null,
        "dep-b": undefined,
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);

    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
  });

  it("should update dependencies with non‑standard version strings like 'latest'", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "latest",
        "dep-b": "next",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
  });

  it("should not add dependency key when dependency group does not exist", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      // no dependencies group
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        // dependencyUpdates provided but package.json does not have a dependencies field
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.version).toBe("2.0.0");
    expect(writtenContent.dependencies).toBeUndefined();
  });

  it("should handle deprecated npm tag syntax", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "@latest",
        "dep-b": "@next",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
  });

  it("should handle scoped workspace dependencies", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "@scope/dep-a": "workspace:*",
        "@scope/dep-b": "workspace:^1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["@scope/dep-a", "2.0.0"],
          ["@scope/dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["@scope/dep-a"]).toBe(
      "workspace:^2.0.0",
    );
    expect(writtenContent.dependencies["@scope/dep-b"]).toBe(
      "workspace:^2.0.0",
    );
  });

  it("should handle scoped npm aliases", () => {
    const pkgContent = {
      name: "test-pkg",
      version: "1.0.0",
      dependencies: {
        "dep-a": "npm:@scope/pkg@1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("npm:@scope/pkg@^2.0.0");
  });

  it("should handle local file path with version", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "file:../local-pkg@1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "file:../local-pkg@1.0.0",
    );
  });

  it("should handle multiple version separators in npm aliases", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "npm:package@name@1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "npm:package@name@^2.0.0",
    );
  });

  it("should handle URL-style dependencies", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "https://github.com/user/repo/tarball/1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "https://github.com/user/repo/tarball/1.0.0",
    );
  });

  it("should handle npm aliases with multiple @ symbols in package name", () => {
    const pkgContent = {
      dependencies: {
        dep: "npm:@org/pkg@name@1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies.dep).toBe("npm:@org/pkg@name@^2.0.0");
  });

  it("should handle git dependencies with branches containing @", () => {
    const pkgContent = {
      dependencies: {
        dep: "git+ssh://git@github.com/org/repo.git#feature/test@1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies.dep).toBe(
      "git+ssh://git@github.com/org/repo.git#feature/test@1.0.0",
    );
  });

  it("should handle invalid npm alias format", () => {
    const pkgContent = {
      dependencies: {
        dep: "npm:invalid-format",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies.dep).toBe("^2.0.0");
  });

  it("should handle semver ranges with pre-release identifiers", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "^1.0.0-beta.1",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0-beta.1"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0-beta.1");
  });

  it("should handle git+ssh protocol with complex URLs", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "git+ssh://git@gitlab.company.com:1234/scope/repo.git#v1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "git+ssh://git@gitlab.company.com:1234/scope/repo.git#v1.0.0",
    );
  });

  it("should handle numeric version without quotes", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": 1,
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
  });

  it("should handle environment variables in file paths", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "file:${WORKSPACE}/packages/dep-a",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "file:${WORKSPACE}/packages/dep-a",
    );
  });

  it("should handle private registry URLs", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "https://npm.company.com/package/dep-a/-/dep-a-1.0.0.tgz",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "https://npm.company.com/package/dep-a/-/dep-a-1.0.0.tgz",
    );
  });

  it("should handle unicode in package names and paths", () => {
    const pkgContent = {
      dependencies: {
        包: "file:./测试/包",
        пакет: "1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["包", "2.0.0"],
          ["пакет", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies.包).toBe("file:./测试/包");
    expect(writtenContent.dependencies.пакет).toBe("^2.0.0");
  });

  it("should handle extremely long version strings", () => {
    const longVersion = "1".repeat(256);
    const pkgContent = {
      dependencies: {
        "dep-a": longVersion,
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
  });

  it("should handle path traversal attempts", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "file:../../../malicious/path",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "file:../../../malicious/path",
    );
  });

  it("should handle multiple protocols in single version string", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "git+https+ssh://example.com/repo.git#v1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "git+https+ssh://example.com/repo.git#v1.0.0",
    );
  });

  it("should handle zero-width characters in version strings", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "^1.0.0\u200B",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
  });

  it("should handle version strings with escape sequences", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "1.0.0\\n",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
  });

  it("should handle mixed CRLF/LF line endings", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "1.0.0\r\n",
        "dep-b": "1.0.0\n",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
  });

  it("should handle version ranges with multiple version constraints", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": ">=1.0.0 <2.0.0 || >=3.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "4.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^4.0.0");
  });

  it("should handle git+file protocol combinations", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "git+file:///absolute/path/to/repo.git#master",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "git+file:///absolute/path/to/repo.git#master",
    );
  });

  it("should handle npm aliases with subpath imports", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "npm:@scope/pkg/subpath@1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "npm:@scope/pkg/subpath@^2.0.0",
    );
  });

  it("should handle composite npm aliases with version ranges", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "npm:@org/name-with-range@>=1.0.0 <2.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([["dep-a", "2.0.0"]]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe(
      "npm:@org/name-with-range@^2.0.0",
    );
  });

  it("should handle space-like unicode characters in versions", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "1.0.0\u2002",
        "dep-b": "1.0.0\u3000",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
  });

  it("should handle legacy semver syntax with 'v' prefix", () => {
    const pkgContent = {
      dependencies: {
        "dep-a": "v1.0.0",
        "dep-b": "=v1.0.0",
      },
    };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(pkgContent));

    const updates: PackageUpdate[] = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/test",
        dependencyUpdates: new Map([
          ["dep-a", "2.0.0"],
          ["dep-b", "2.0.0"],
        ]),
      },
    ];

    updatePackageJsons(updates);
    const writtenContent = JSON.parse(
      vi.mocked(fs.writeFileSync).mock.calls[0][1].toString(),
    );
    expect(writtenContent.dependencies["dep-a"]).toBe("^2.0.0");
    expect(writtenContent.dependencies["dep-b"]).toBe("^2.0.0");
  });
});
