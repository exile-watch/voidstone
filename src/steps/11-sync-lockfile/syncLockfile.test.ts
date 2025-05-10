// src/steps/11-sync-lockfile/syncLockfile.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as execWithLogModule from "../../utils/execWithLog/execWithLog.js";
import { syncLockfile } from "./syncLockfile.js";

describe("syncLockfile", () => {
  const mockExecWithLog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(execWithLogModule, "execWithLog").mockImplementation(
      mockExecWithLog,
    );
    // Set up the mock to return 'has-changes' for the git diff command
    mockExecWithLog
      .mockReturnValueOnce("")
      .mockReturnValueOnce("")
      .mockReturnValueOnce("has-changes");
  });

  it("runs npm install and git commands with changes detected", () => {
    const rootDir = "/path/to/root";
    // Remove await since the function is now synchronous
    syncLockfile(rootDir);

    expect(mockExecWithLog).toHaveBeenCalledTimes(4);
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      1,
      "npm install --ignore-scripts",
      {
        cwd: rootDir,
        stdio: "inherit",
      },
    );
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      2,
      "git add package-lock.json",
      { cwd: rootDir },
    );
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      3,
      "git diff --staged --quiet package-lock.json || echo 'has-changes'",
      { cwd: rootDir },
    );
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      4,
      'git commit -m "chore(deps): sync package-lock.json [skip ci]"',
      { cwd: rootDir },
    );
  });

  it("skips commit when no changes are detected", () => {
    mockExecWithLog.mockReset();
    // Return empty string for all calls including git diff
    mockExecWithLog.mockReturnValue("");

    const rootDir = "/path/to/root";
    syncLockfile(rootDir);

    expect(mockExecWithLog).toHaveBeenCalledTimes(3);
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      1,
      "npm install --ignore-scripts",
      {
        cwd: rootDir,
        stdio: "inherit",
      },
    );
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      2,
      "git add package-lock.json",
      { cwd: rootDir },
    );
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      3,
      "git diff --staged --quiet package-lock.json || echo 'has-changes'",
      { cwd: rootDir },
    );
    // The commit command should not be called
  });

  it("passes through the root directory to each command", () => {
    const customRoot = "/custom/project/root";
    syncLockfile(customRoot);

    // Check that each call used the custom root directory
    expect(
      mockExecWithLog.mock.calls.every((call) => call[1].cwd === customRoot),
    ).toBe(true);
  });
});
