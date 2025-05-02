import { Octokit } from "@octokit/rest";
import conventionalChangelog from "conventional-changelog";
import getStream from "get-stream";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { REGISTRY } from "../../constants.js";
import type { PackageUpdate, ReleaseIds } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";
import {
  generateChangelogArgs,
  getChangelogOptions,
} from "../../utils/testUtils/index.js";
import { publishAndRelease } from "./publishAndRelease.js";

vi.mock("../../utils/execWithLog/execWithLog.js");
vi.mock("@octokit/rest");
vi.mock("get-stream");
vi.mock("conventional-changelog", () => ({
  default: vi.fn(),
}));

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

    expect(execWithLog).toHaveBeenCalledTimes(3);
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

  it("publishes and creates a GitHub release with proper changelog", async () => {
    const rootDir = "/root";
    const updates = [
      {
        name: "@scope/pkg-1",
        current: "1.0.0",
        next: "2.0.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];
    const releaseIds = {};

    // stub publish
    (execWithLog as Mock).mockReturnValue(Buffer.from(""));
    // stub changelog content
    (getStream as Mock).mockResolvedValue("### Features\n\n* foo change\n");
    // stub GitHub release
    const mockCreate = vi.fn().mockResolvedValue({ data: { id: 123 } });
    (Octokit as any).mockImplementation(() => ({
      repos: { createRelease: mockCreate },
    }));

    const result = await publishAndRelease(rootDir, updates, {});

    // execWithLog called for npm publish
    expect(execWithLog).toHaveBeenCalledWith(
      expect.stringContaining("npm publish"),
      expect.objectContaining({ cwd: updates[0].pkgDir }),
    );

    // conventionalChangelog called with correct args:
    const [opts, ctx, raw] = generateChangelogArgs(
      updates[0].name,
      updates[0].current,
      updates[0].next,
      updates[0].pkgDir,
      rootDir,
    );
    // getStream was passed the stream from conventionalChangelog:
    expect(getStream).toHaveBeenCalledWith(expect.anything());
    // if you spy on conventionalChangelog itself, you can:
    expect(conventionalChangelog).toHaveBeenCalledWith(opts, ctx, raw);

    // GitHub release called with that changelog as body
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_name: "@scope/pkg-1@2.0.0",
        body: "### Features\n\n* foo change\n",
      }),
    );

    // we got back the release id
    expect(result).toEqual({ "@scope/pkg-1": 123 });
  });
});
