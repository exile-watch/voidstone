import Stream from "node:stream";
import { Octokit } from "@octokit/rest";
import conventionalChangelog from "conventional-changelog";
import changelog from "conventional-changelog";
import getStream from "get-stream";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { REGISTRY } from "../../constants.js";
import type { PackageUpdate, ReleaseIds } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";
import { generateChangelogArgs } from "../../utils/testUtils/index.js";
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
    expect(conventionalChangelog).toHaveBeenCalledWith(
      opts,
      ctx,
      raw,
      undefined,
      expect.objectContaining({
        transform: expect.any(Function),
      }),
    );

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

  it("should remove date from changelog when creating GitHub release", async () => {
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

    // Mock a changelog with a date line at the beginning
    const changelogWithDate = "## (2023-05-25)\n## Features\n\n* new feature";
    vi.mocked(getStream).mockResolvedValue(changelogWithDate);

    mockOctokit.repos.createRelease.mockResolvedValueOnce({
      data: { id: 123 },
    });

    await publishAndRelease("/root", updates, releaseIds);

    // Verify the date was removed from the changelog in the GitHub release
    expect(mockOctokit.repos.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "## Features\n\n* new feature", // Date line should be removed
      }),
    );
  });

  it("should filter out commits with [skip ci] in actual changelog generation flow", async () => {
    // Setup mock commits that will be processed by the transform function
    const mockCommits = [
      { header: "feat: normal feature" },
      { header: "feat: feature with [skip ci]" },
      { header: "fix: normal bugfix" },
    ];

    // Capture the transform function when conventionalChangelog is called
    let capturedTransform: any;
    vi.mocked(conventionalChangelog).mockImplementation(
      (options, context, gitRawCommitsOpts, parserOpts, writerOpts: any) => {
        // Capture the transform function
        capturedTransform = writerOpts?.transform;
        return {} as any;
      },
    );

    // Start the process that will call conventionalChangelog
    const updates = [
      {
        name: "test-pkg",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/test",
        dependencyUpdates: new Map(),
      },
    ];

    // Mock release creation
    mockOctokit.repos.createRelease.mockResolvedValueOnce({
      data: { id: 123 },
    });

    // Call the function that will trigger conventionalChangelog
    publishAndRelease("/root", updates, {});

    // Verify transform was captured
    expect(capturedTransform).toBeDefined();

    // Now manually test the transform function with our mock commits
    const mockCallback = vi.fn();

    // Test normal commit - should pass through
    capturedTransform(mockCommits[0], mockCallback);
    expect(mockCallback).toHaveBeenLastCalledWith(null, mockCommits[0]);

    // Test skip-ci commit - should be filtered out
    capturedTransform(mockCommits[1], mockCallback);
    expect(mockCallback).toHaveBeenLastCalledWith(null, false);

    // Test another normal commit - should pass through
    capturedTransform(mockCommits[2], mockCallback);
    expect(mockCallback).toHaveBeenLastCalledWith(null, mockCommits[2]);
  });

  it("should properly filter [skip ci] commits across multiple packages", async () => {
    const updates = [
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
    const releaseIds = {};

    // Captured transform functions for each package
    const capturedTransforms: any = [];

    // Mock implementation to capture transform functions
    vi.mocked(conventionalChangelog).mockImplementation(
      (options, context, gitRawCommitsOpts, parserOpts, writerOpts: any) => {
        // Store transform function for later testing
        if (writerOpts?.transform) {
          capturedTransforms.push(writerOpts.transform);
        }

        // Mock changelog content for each package
        if (options?.lernaPackage === "pkg-1") {
          vi.mocked(getStream).mockResolvedValueOnce(
            "### Features\n\n* regular feature for pkg-1",
          );
        } else {
          vi.mocked(getStream).mockResolvedValueOnce(
            "### Features\n\n* regular feature for pkg-2",
          );
        }

        return {} as any;
      },
    );

    mockOctokit.repos.createRelease
      .mockResolvedValueOnce({ data: { id: 123 } })
      .mockResolvedValueOnce({ data: { id: 456 } });

    await publishAndRelease("/root", updates, releaseIds);

    // Verify transform functions were captured
    expect(capturedTransforms.length).toBe(2);

    // Test commits for each package
    const pkg1Commits = [
      { header: "feat: normal feature for pkg-1" },
      { header: "fix: bug fix [skip ci] for pkg-1" },
    ];

    const pkg2Commits = [
      { header: "feat: feature for pkg-2" },
      { header: "chore: maintenance task [CI SKIP] for pkg-2" },
    ];

    const mockCallback = vi.fn();

    // Test pkg-1 transform function
    capturedTransforms[0](pkg1Commits[0], mockCallback); // Regular commit
    expect(mockCallback).toHaveBeenLastCalledWith(null, pkg1Commits[0]);

    capturedTransforms[0](pkg1Commits[1], mockCallback); // Skip CI commit
    expect(mockCallback).toHaveBeenLastCalledWith(null, false);

    // Test pkg-2 transform function
    capturedTransforms[1](pkg2Commits[0], mockCallback); // Regular commit
    expect(mockCallback).toHaveBeenLastCalledWith(null, pkg2Commits[0]);

    capturedTransforms[1](pkg2Commits[1], mockCallback); // Skip CI commit
    expect(mockCallback).toHaveBeenLastCalledWith(null, false);

    // Verify releases were created
    expect(mockOctokit.repos.createRelease).toHaveBeenCalledTimes(2);
  });

  it("should properly handle transform function in real-world integration scenario", async () => {
    let capturedTransform: any = null;
    // Spy on console.error to verify our error message
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Capture and manually verify transform integrity
    vi.mocked(changelog).mockImplementationOnce(
      (options, context, gitRawCommitsOpts, parserOpts, writerOpts: any) => {
        capturedTransform = writerOpts?.transform;

        // Create a fake stream that will use the transform
        const fakeStream = new Stream.Transform({
          objectMode: true,
          transform(commit, encoding, callback) {
            if (writerOpts?.transform) {
              // Call transform with appropriate arguments
              writerOpts.transform(commit, (err: any, result: any) => {
                // Normal transform processing
              });
            }
          },
        });

        return fakeStream;
      },
    );

    // Call publishAndRelease to initialize transform function
    const updates = [
      {
        name: "pkg-1",
        current: "1.0.0",
        next: "1.1.0",
        pkgDir: "/root/packages/pkg-1",
        dependencyUpdates: new Map(),
      },
    ];
    mockOctokit.repos.createRelease.mockResolvedValueOnce({
      data: { id: 123 },
    });

    publishAndRelease("/root", updates, {});

    // Ensure transform was captured
    expect(capturedTransform).toBeDefined();

    // Test normal case with valid function callback
    const validCallback = vi.fn();
    const validCommit = { header: "feat: normal feature" };
    capturedTransform(validCommit, validCallback);
    expect(validCallback).toHaveBeenCalledWith(null, validCommit);

    // Test with skip ci commit and valid callback
    const skipCiCommit = { header: "fix: bug fix [skip ci]" };
    capturedTransform(skipCiCommit, validCallback);
    expect(validCallback).toHaveBeenCalledWith(null, false);

    // Test with object as callback (invalid)
    const objectCallback = {};
    capturedTransform(validCommit, objectCallback);
    expect(errorSpy).toHaveBeenCalledWith(
      "Invalid callback provided to transform function",
    );

    // Test with null as callback (invalid)
    errorSpy.mockClear();
    capturedTransform(validCommit, null);
    expect(errorSpy).toHaveBeenCalledWith(
      "Invalid callback provided to transform function",
    );

    // Test with undefined as callback (invalid)
    errorSpy.mockClear();
    capturedTransform(validCommit, undefined);
    expect(errorSpy).toHaveBeenCalledWith(
      "Invalid callback provided to transform function",
    );

    // Restore console.error
    errorSpy.mockRestore();
  });
});
