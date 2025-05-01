import { Octokit } from "@octokit/rest";
import getStream from "get-stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGISTRY } from "../../constants.js";
import type { PackageUpdate, ReleaseIds } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";
import { publishAndRelease } from "./publishAndRelease.js";

vi.mock("../../utils/execWithLog/execWithLog.js");
vi.mock("@octokit/rest");
vi.mock("get-stream");
vi.mock("conventional-changelog");

describe("publishAndRelease", () => {
  const mockOctokit = {
    repos: {
      createRelease: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "cwd").mockReturnValue("/root");
    vi.stubEnv("GITHUB_REPOSITORY", "owner/repo");
    vi.stubEnv("GH_TOKEN", "mock-token");
    vi.mocked(Octokit).mockImplementation(() => mockOctokit as any);
    vi.mocked(getStream).mockResolvedValue("## Changelog content");
  });

  it("should publish package and create release", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];
    const releaseIds: ReleaseIds = {};

    mockOctokit.repos.createRelease.mockResolvedValueOnce({
      data: { id: 123 },
    });

    await publishAndRelease("/root", updates, releaseIds);

    expect(execWithLog).toHaveBeenCalledWith(
      `npm publish --registry ${REGISTRY}`,
      { cwd: "/root/packages/pkg-1", stdio: "inherit" },
    );
    expect(mockOctokit.repos.createRelease).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      tag_name: "pkg-1@1.1.0",
      name: "pkg-1@1.1.0",
      body: "## Changelog content",
    });
    expect(releaseIds).toEqual({ "pkg-1": 123 });
  });

  it("should handle multiple packages", async () => {
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
    const releaseIds: ReleaseIds = {};

    mockOctokit.repos.createRelease
      .mockResolvedValueOnce({ data: { id: 123 } })
      .mockResolvedValueOnce({ data: { id: 456 } });

    await publishAndRelease("/root", updates, releaseIds);

    expect(execWithLog).toHaveBeenCalledTimes(2);
    expect(mockOctokit.repos.createRelease).toHaveBeenCalledTimes(2);
    expect(releaseIds).toEqual({ "pkg-1": 123, "pkg-2": 456 });
  });

  it("should handle npm publish failure", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    vi.mocked(execWithLog).mockImplementationOnce(() => {
      throw new Error("npm publish failed");
    });

    await expect(publishAndRelease("/root", updates, {})).rejects.toThrow(
      "npm publish failed",
    );

    expect(mockOctokit.repos.createRelease).not.toHaveBeenCalled();
  });

  it("should throw when GitHub repository is malformed", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", "invalid-format");

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await expect(publishAndRelease("/root", updates, {})).rejects.toThrow(
      "Missing GITHUB_REPOSITORY environment variable or invalid format",
    );

    expect(mockOctokit.repos.createRelease).not.toHaveBeenCalled();
  });

  it("should handle missing GitHub token", async () => {
    vi.stubEnv("GH_TOKEN", "");

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await publishAndRelease("/root", updates, {});

    expect(mockOctokit.repos.createRelease).toHaveBeenCalled();
    // Note: The Octokit instance will be created without auth, which is fine for public repos
  });

  it("should throw when GitHub repository is not configured", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", "");

    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    await expect(publishAndRelease("/root", updates, {})).rejects.toThrow(
      "Missing GITHUB_REPOSITORY environment variable or invalid format",
    );

    expect(mockOctokit.repos.createRelease).not.toHaveBeenCalled();
  });

  it("should handle GitHub API failure", async () => {
    const updates: PackageUpdate[] = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];

    mockOctokit.repos.createRelease.mockRejectedValueOnce(
      new Error("GitHub API error"),
    );

    await expect(publishAndRelease("/root", updates, {})).rejects.toThrow(
      "GitHub API error",
    );

    expect(execWithLog).toHaveBeenCalled();
  });
});
