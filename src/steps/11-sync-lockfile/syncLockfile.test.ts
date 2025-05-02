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
  });

  it("runs npm install and git commands in sequence", async () => {
    const rootDir = "/path/to/root";
    await syncLockfile(rootDir);

    expect(mockExecWithLog).toHaveBeenCalledTimes(3);
    expect(mockExecWithLog).toHaveBeenNthCalledWith(1, "npm install", {
      cwd: rootDir,
      stdio: "inherit",
    });
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      2,
      "git add package-lock.json",
      { cwd: rootDir },
    );
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      3,
      'git commit -m "chore(deps): sync package-lock.json"',
      { cwd: rootDir },
    );
  });

  it("passes through the root directory to each command", async () => {
    const customRoot = "/custom/project/root";
    await syncLockfile(customRoot);

    // Check that each call used the custom root directory
    expect(
      mockExecWithLog.mock.calls.every((call) => call[1].cwd === customRoot),
    ).toBe(true);
  });
});
