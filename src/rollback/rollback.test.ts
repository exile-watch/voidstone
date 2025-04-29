import { Octokit } from "@octokit/rest";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { execWithLog } from "../execWithLog/execWithLog.js";
import { findPRNumberFromCommitMessage } from "../findPRNumberFromCommitMessage/findPRNumberFromCommitMessage.js";
import { rollback } from "./rollback.js";

vi.mock("@octokit/rest");
vi.mock("../execWithLog/execWithLog");
vi.mock("../findPRNumberFromCommitMessage/findPRNumberFromCommitMessage");

describe("rollback", () => {
  const mockedExec = execWithLog as Mock;
  const mockedFindPR = findPRNumberFromCommitMessage as Mock;
  let deleteRelease: Mock;
  let pullsUpdate: Mock;
  let issuesComment: Mock;

  const singleReleaseInfo = [
    { name: "pkg1", current: "0.9.0", next: "1.0.0", pkgDir: "/tmp/pkg1" },
  ];
  const singleReleaseIds = { pkg1: 123 };

  beforeEach(() => {
    // Default environment
    process.env.GITHUB_REPOSITORY = "owner/repo";
    process.env.GITHUB_RUN_ID = "999";
    process.env.GH_TOKEN = "token123";

    vi.clearAllMocks();

    // Default execWithLog to return HEAD or no-op
    mockedExec.mockImplementation((cmd: string) => {
      if (cmd === "git rev-parse HEAD") return Buffer.from("abc123\n");
      return Buffer.from("");
    });

    // Mock Octokit methods
    deleteRelease = vi.fn().mockResolvedValue({});
    pullsUpdate = vi.fn().mockResolvedValue({});
    issuesComment = vi.fn().mockResolvedValue({});
    (Octokit as unknown as Mock).mockImplementation(() => ({
      repos: { deleteRelease },
      pulls: { update: pullsUpdate },
      issues: { createComment: issuesComment },
    }));
  });

  it("should perform rollback without reopening PR when no PR number is found", async () => {
    mockedFindPR.mockReturnValue(null);

    await rollback(singleReleaseInfo, singleReleaseIds);

    expect(mockedExec).toHaveBeenCalledWith("git rev-parse HEAD");
    expect(mockedExec).toHaveBeenCalledWith("git tag -d pkg1@1.0.0");
    expect(mockedExec).toHaveBeenCalledWith(
      "git push origin :refs/tags/pkg1@1.0.0",
    );
    expect(mockedExec).toHaveBeenCalledWith("git reset --hard abc123");
    expect(mockedExec).toHaveBeenCalledWith("git push origin main --force");
    expect(mockedExec).toHaveBeenCalledWith(
      expect.stringContaining("npm unpublish pkg1@1.0.0"),
      expect.objectContaining({ cwd: "/tmp/pkg1" }),
    );
    expect(deleteRelease).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      release_id: 123,
    });
    expect(pullsUpdate).not.toHaveBeenCalled();
    expect(issuesComment).not.toHaveBeenCalled();
  });

  it("should reopen PR and add a comment with workflow URL when a PR number is found", async () => {
    mockedFindPR.mockReturnValue(42);

    await rollback(singleReleaseInfo, singleReleaseIds);

    expect(pullsUpdate).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      pull_number: 42,
      state: "open",
    });
    expect(issuesComment).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      issue_number: 42,
      body: expect.stringContaining("Release failed for: pkg1@1.0.0"),
    });
    // Check workflow URL in comment body
    expect(issuesComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(
          "https://github.com/owner/repo/actions/runs/999",
        ),
      }),
    );
  });

  it("should throw and log an error if execWithLog throws in the try block", async () => {
    const error = new Error("fail-reset");
    mockedExec.mockImplementation((cmd: string) => {
      if (cmd.startsWith("git reset")) throw error;
      if (cmd === "git rev-parse HEAD") return Buffer.from("abc123\n");
      return Buffer.from("");
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(rollback(singleReleaseInfo, singleReleaseIds)).rejects.toThrow(
      error,
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to complete rollback:",
      error,
    );
    consoleErrorSpy.mockRestore();
  });

  it("should warn on tag deletion failure and continue", async () => {
    const tagError = new Error("tag-fail");
    mockedExec.mockImplementation((cmd: string) => {
      if (cmd === "git rev-parse HEAD") return Buffer.from("abc123\n");
      if (cmd.startsWith("git tag -d")) throw tagError;
      return Buffer.from("");
    });
    mockedFindPR.mockReturnValue(null);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await rollback(singleReleaseInfo, singleReleaseIds);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to remove tag pkg1@1.0.0"),
      tagError,
    );
    expect(mockedExec).toHaveBeenCalledWith("git reset --hard abc123");
    expect(deleteRelease).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should warn on npm unpublish failure and continue", async () => {
    const unpubError = new Error("unpublish-fail");
    mockedExec.mockImplementation((cmd: string) => {
      if (cmd === "git rev-parse HEAD") return Buffer.from("abc123\n");
      if (cmd.includes("npm unpublish")) throw unpubError;
      return Buffer.from("");
    });
    mockedFindPR.mockReturnValue(null);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await rollback(singleReleaseInfo, singleReleaseIds);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to unpublish pkg1@1.0.0"),
      unpubError,
    );
    expect(deleteRelease).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("should warn on deleteRelease failure and continue", async () => {
    const drError = new Error("delete-release-fail");
    deleteRelease.mockRejectedValue(drError);
    mockedFindPR.mockReturnValue(null);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await rollback(singleReleaseInfo, singleReleaseIds);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to delete GitHub release for pkg1"),
      drError,
    );
    warnSpy.mockRestore();
  });

  it("should handle multiple releases correctly", async () => {
    const multiInfo = [
      { name: "pkg1", current: "0.9.0", next: "1.0.0", pkgDir: "/tmp/pkg1" },
      { name: "pkg2", current: "1.5.0", next: "2.0.0", pkgDir: "/tmp/pkg2" },
    ];
    const multiIds = { pkg1: 123, pkg2: 456 };
    mockedFindPR.mockReturnValue(null);

    await rollback(multiInfo, multiIds);

    expect(mockedExec).toHaveBeenCalledWith("git tag -d pkg1@1.0.0");
    expect(mockedExec).toHaveBeenCalledWith("git tag -d pkg2@2.0.0");
    expect(mockedExec).toHaveBeenCalledWith(
      "git push origin :refs/tags/pkg1@1.0.0",
    );
    expect(mockedExec).toHaveBeenCalledWith(
      "git push origin :refs/tags/pkg2@2.0.0",
    );
    expect(deleteRelease).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      release_id: 123,
    });
    expect(deleteRelease).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      release_id: 456,
    });
  });

  it("should handle missing GITHUB_REPOSITORY env gracefully", async () => {
    process.env.GITHUB_REPOSITORY = undefined;
    mockedFindPR.mockReturnValue(null);
    await rollback(singleReleaseInfo, singleReleaseIds);

    expect(deleteRelease).toHaveBeenCalledWith({
      owner: "undefined",
      repo: "",
      release_id: 123,
    });
  });

  it("should handle empty releases array without errors", async () => {
    mockedFindPR.mockReturnValue(null);

    await rollback([], {});

    expect(mockedExec).toHaveBeenCalledWith("git rev-parse HEAD");
    expect(mockedExec).not.toHaveBeenCalledWith(
      expect.stringContaining("git tag -d"),
    );
    expect(deleteRelease).not.toHaveBeenCalled();
    expect(pullsUpdate).not.toHaveBeenCalled();
    expect(issuesComment).not.toHaveBeenCalled();
  });

  it("should throw and log if PR reopen fails", async () => {
    const reopenError = new Error("pulls-update-fail");
    mockedFindPR.mockReturnValue(42);
    pullsUpdate.mockRejectedValue(reopenError);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await expect(rollback(singleReleaseInfo, singleReleaseIds)).rejects.toThrow(
      reopenError,
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to complete rollback:",
      reopenError,
    );
    consoleErrorSpy.mockRestore();
  });

  it("should throw and log if PR parser throws", async () => {
    const parserError = new Error("pr-parser-fail");
    mockedFindPR.mockImplementation(() => {
      throw parserError;
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await expect(rollback(singleReleaseInfo, singleReleaseIds)).rejects.toThrow(
      parserError,
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to complete rollback:",
      parserError,
    );
    consoleErrorSpy.mockRestore();
  });

  it("should work when GH_TOKEN is missing", async () => {
    process.env.GH_TOKEN = undefined;
    mockedFindPR.mockReturnValue(null);

    await expect(
      rollback(singleReleaseInfo, singleReleaseIds),
    ).resolves.toBeUndefined();
    expect(deleteRelease).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      release_id: 123,
    });
  });
});
