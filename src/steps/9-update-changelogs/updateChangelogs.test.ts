import fs from "node:fs";
import changelog from "conventional-changelog";
import getStream from "get-stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageUpdate } from "../../types.js";
import { updateChangelogs } from "./updateChangelogs.js";

vi.mock("node:fs");
vi.mock("conventional-changelog");
vi.mock("get-stream");

describe("updateChangelogs", () => {
  const rootDir = "/root";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(changelog).mockReturnValue("mock-stream" as any);
    vi.mocked(getStream).mockResolvedValue(
      "# Changelog\n\nChange details...\n\n## 1.0.0",
    );
  });

  it("should create changelog for each package update", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: "pkg-1@",
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: "packages/pkg-1" },
      },
    });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/root/packages/pkg-1/CHANGELOG.md",
      "# Changelog\n\nChange details...\n\n## 1.0.0",
    );
  });

  it("should handle scoped packages", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "@scope/pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/@scope/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: "@scope/pkg-1@",
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: "packages/@scope/pkg-1" },
      },
    });
  });

  it("should handle empty updates array", async () => {
    await updateChangelogs(rootDir, []);

    expect(changelog).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it("should handle changelog generation error", async () => {
    vi.mocked(getStream).mockRejectedValueOnce(new Error("Changelog error"));

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await expect(updateChangelogs(rootDir, updates)).rejects.toThrow(
      "Changelog error",
    );
  });

  it("should handle filesystem write error", async () => {
    // Force valid changelog content from getStream
    vi.mocked(getStream).mockResolvedValueOnce(
      "# Changelog\n\nChange details...\n\n## 1.0.0",
    );

    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw new Error("Write error");
    });

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    // The implementation will now throw Write error, not the empty changelog error.
    await expect(updateChangelogs(rootDir, updates)).rejects.toThrow(
      "Write error",
    );
  });

  it("should handle changelog paths with spaces", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg with space",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg with space",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: "pkg with space@",
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: "packages/pkg with space" },
      },
    });
  });

  it("should handle deep package paths", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/group/subgroup/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: "pkg-1@",
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: "packages/group/subgroup/pkg-1" },
      },
    });
  });

  it("should normalize paths across platforms", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "\\root\\packages\\pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    const expectedPath = "packages/pkg-1";
    expect(changelog).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          gitRawCommitsOpts: { path: expectedPath },
        },
      }),
    );
  });

  it("should handle malformed conventional commits", async () => {
    const rootDir = "/root";
    const updates = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    // Mock changelog stream to return invalid content
    vi.mocked(getStream).mockResolvedValueOnce("# Changelog");

    await expect(updateChangelogs(rootDir, updates)).rejects.toThrow(
      "Empty changelog generated for package: pkg-1",
    );
  });

  it("should handle packages with no git history", async () => {
    // Simulate empty changelog from no git history
    vi.mocked(getStream).mockResolvedValueOnce("");

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await expect(updateChangelogs(rootDir, updates)).rejects.toThrow(
      "Empty changelog generated",
    );
  });

  it("should handle packages with only whitespace in changelog", async () => {
    // Test various whitespace combinations
    const testCases = [" ", "\n", "\t", "  \n  \n  ", "\r\n"];

    for (const content of testCases) {
      vi.mocked(getStream).mockResolvedValueOnce(content);

      const updates: PackageUpdate[] = [
        {
          name: "pkg-1",
          current: "1.0.0",
          next: "2.0.0",
          pkgDir: "/root/packages/pkg-1",
          dependencyUpdates: new Map(),
        },
      ];

      await expect(updateChangelogs(rootDir, updates)).rejects.toThrow(
        "Empty changelog generated",
      );
    }
  });

  it("should handle valid conventional commits with different types", async () => {
    vi.mocked(getStream).mockResolvedValueOnce(
      "# Changelog\n\n## 2.0.0\n\n" +
        "feat: add new feature\n" +
        "fix: resolve bug\n" +
        "chore: update dependencies\n" +
        "docs: update readme\n\n" +
        "## 1.0.0",
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await expect(updateChangelogs(rootDir, updates)).resolves.not.toThrow();
  });

  it("should handle changelog with minimal valid content", async () => {
    // Test with just enough content to be valid
    vi.mocked(getStream).mockResolvedValueOnce(
      "# Changelog\n\n## 2.0.0\n\nfeat: initial commit",
    );

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await expect(updateChangelogs(rootDir, updates)).resolves.not.toThrow();
  });

  it("should handle package with root directory as pkgDir", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "root-pkg",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: "root-pkg@",
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: "." },
      },
    });
  });

  it("should handle package with no changelog file", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw new Error("File not found");
    });

    await expect(updateChangelogs(rootDir, updates)).rejects.toThrow(
      "File not found",
    );
  });

  it("should handle package with no updates", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).not.toHaveBeenCalled();
  });

  it("should handle package with no changelog content", async () => {
    vi.mocked(getStream).mockResolvedValueOnce("");

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await expect(updateChangelogs(rootDir, updates)).rejects.toThrow(
      "Empty changelog generated",
    );
  });

  it("should handle changelog with very long package names", async () => {
    const longName = "a".repeat(214); // npm's maximum package name length
    const updates: PackageUpdate[] = [
      {
        name: longName,
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: `/root/packages/${longName}`,
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: `${longName}@`,
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: `packages/${longName}` },
      },
    });
  });

  it("should handle updates with non-standard version strings", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0-rc.1+build.123",
        next: "2.0.0-beta.1+exp.sha.5114f85",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: "pkg-1@",
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: "packages/pkg-1" },
      },
    });
  });

  it("should handle package with absolute root path", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: process.cwd(),
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(process.cwd(), updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: "pkg-1@",
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: "." },
      },
    });
  });

  it("should handle package with only dependency updates", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.0.1",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map([
          ["dep-1", "2.0.0"],
          ["dep-2", "3.0.0"],
        ]),
      },
    ];

    const expectedContent =
      "# Changelog\n\n## 1.0.1\n\n" +
      "fix: update dependencies\n" +
      "* dep-1 to 2.0.0\n" +
      "* dep-2 to 3.0.0\n\n" +
      "## 1.0.0";

    vi.mocked(getStream).mockResolvedValueOnce(expectedContent);

    await updateChangelogs(rootDir, updates);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/root/packages/pkg-1/CHANGELOG.md",
      expectedContent,
    );
  });

  it("should handle changelog with backslash in package path", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "C:\\root\\packages\\pkg-1", // Windows-style path
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs("C:\\root", updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: "pkg-1@",
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: "packages/pkg-1" },
      },
    });
  });

  it("should handle changelog with very large version jumps", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "999.999.999",
        pkgDir: "/root/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledWith({
      preset: "angular",
      tagPrefix: "pkg-1@",
      releaseCount: 0,
      config: {
        gitRawCommitsOpts: { path: "pkg-1" },
      },
    });
  });

  it("should generate separate changelogs for each package", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
      {
        name: "pkg-2",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-2",
        dependencyUpdates: new Map(),
      },
    ];

    vi.mocked(getStream)
      .mockResolvedValueOnce("# Changelog\n\n## 2.0.0\n\nfeat: pkg-1 feature")
      .mockResolvedValueOnce("# Changelog\n\n## 1.1.0\n\nfix: pkg-2 bugfix");

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledTimes(2);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect(fs.writeFileSync).toHaveBeenNthCalledWith(
      1,
      "/root/packages/pkg-1/CHANGELOG.md",
      expect.stringContaining("pkg-1 feature"),
    );
    expect(fs.writeFileSync).toHaveBeenNthCalledWith(
      2,
      "/root/packages/pkg-2/CHANGELOG.md",
      expect.stringContaining("pkg-2 bugfix"),
    );
  });

  it("should handle invalid version strings", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "invalid",
        next: "also-invalid",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await updateChangelogs(rootDir, updates);

    expect(changelog).toHaveBeenCalledWith(
      expect.objectContaining({
        tagPrefix: "pkg-1@",
      }),
    );
  });
});
