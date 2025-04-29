import { afterEach, describe, expect, it, vi } from "vitest";
import { findPRNumberFromCommitMessage } from "./findPRNumberFromCommitMessage.js";

vi.mock("../execWithLog/execWithLog.js", () => ({
  execWithLog: vi.fn(),
}));

import { execWithLog } from "../execWithLog/execWithLog.js";

describe("findPRNumberFromCommitMessage", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    {
      name: "basic PR reference",
      commitHash: "abc123",
      message: "Some commit message (#42)",
      expected: 42,
    },
    {
      name: "multiple PR references",
      commitHash: "ghi789",
      message: "Implement feature (#100) and fix bug (#200)",
      expected: 100,
    },
    {
      name: "PR number with leading zeros",
      commitHash: "uvw456",
      message: "Fix bug (#0042)",
      expected: 42,
    },
    {
      name: "very large PR number",
      commitHash: "vwx234",
      message: "Fix issue (#999999999)",
      expected: 999999999,
    },
    {
      name: "multiline commit message",
      commitHash: "xyz789",
      message: "First line\nSecond line (#42)\nThird line",
      expected: 42,
    },
  ])(
    "should extract PR number from $name",
    ({ commitHash, message, expected }) => {
      vi.mocked(execWithLog).mockReturnValue({
        toString: () => message,
      } as string);

      const prNumber = findPRNumberFromCommitMessage(commitHash);

      expect(execWithLog).toHaveBeenCalledWith(
        `git log -1 --format=%B ${commitHash}`,
      );
      expect(prNumber).toBe(expected);
    },
  );

  it.each([
    {
      name: "no PR pattern",
      commitHash: "def456",
      message: "Some commit message without PR info",
    },
    {
      name: "non-numeric PR reference",
      commitHash: "rst123",
      message: "Invalid (#abc)",
    },
    {
      name: "non-standard PR format",
      commitHash: "mno345",
      message: "PR #42: Some change",
    },
    {
      name: "empty message",
      commitHash: "pqr678",
      message: "",
    },
    {
      name: "whitespace only",
      commitHash: "stu901",
      message: "  \n  \t  ",
    },
    {
      name: "PR in footer",
      commitHash: "def222",
      message: "fix: bug fix\n\nFixes a critical bug\n\nCloses #42",
    },
  ])("should return null for $name", ({ commitHash, message }) => {
    vi.mocked(execWithLog).mockReturnValue({
      toString: () => message,
    } as string);

    const prNumber = findPRNumberFromCommitMessage(commitHash);

    expect(execWithLog).toHaveBeenCalledWith(
      `git log -1 --format=%B ${commitHash}`,
    );
    expect(prNumber).toBeNull();
  });

  it.each([
    {
      name: "PR in body",
      commitHash: "abc111",
      message: "feat: add new feature\n\nImplements new feature (#42)",
    },
    {
      name: "breaking change",
      commitHash: "ghi333",
      message:
        "feat!: breaking feature (#42)\n\nBREAKING CHANGE: This changes everything",
    },
    {
      name: "scope with parentheses",
      commitHash: "jkl444",
      message: "fix(core): update dependency (#42)",
    },
  ])(
    "should handle conventional commit with $name",
    ({ commitHash, message }) => {
      vi.mocked(execWithLog).mockReturnValue({
        toString: () => message,
      } as string);

      const prNumber = findPRNumberFromCommitMessage(commitHash);

      expect(execWithLog).toHaveBeenCalledWith(
        `git log -1 --format=%B ${commitHash}`,
      );
      expect(prNumber).toBe(42);
    },
  );

  it("should return null if an error occurs", () => {
    const commitHash = "jkl012";
    vi.mocked(execWithLog).mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const prNumber = findPRNumberFromCommitMessage(commitHash);

    expect(execWithLog).toHaveBeenCalledWith(
      `git log -1 --format=%B ${commitHash}`,
    );
    expect(prNumber).toBeNull();
  });

  it.each([
    {
      name: "multiple PRs with spaces",
      commitHash: "def111",
      message: "chore: update deps (#42 #43)",
      expected: 42,
    },
    {
      name: "PR reference after hyphen",
      commitHash: "ghi222",
      message: "chore - (#42)",
      expected: 42,
    },
    {
      name: "commit with command injection attempt",
      commitHash: "$(echo hack)",
      message: "malicious commit",
    },
    {
      name: "commit with no parentheses",
      commitHash: "jkl333",
      message: "chore: update deps #42",
    },
    {
      name: "commit with other parentheses content",
      commitHash: "mno444",
      message: "fix(scope): update (beta) version (#42)",
      expected: 42,
    },
    {
      name: "commit with whitespace variations inside parentheses",
      commitHash: "whitespace01",
      message: "chore: update deps (   #42   #43  )",
      expected: 42,
    },
  ])("should handle $name", ({ commitHash, message, expected = null }) => {
    vi.mocked(execWithLog).mockReturnValue({
      toString: () => message,
    } as string);

    const prNumber = findPRNumberFromCommitMessage(commitHash);

    expect(execWithLog).toHaveBeenCalledWith(
      `git log -1 --format=%B ${commitHash}`,
    );
    expect(prNumber).toBe(expected);
  });
});
