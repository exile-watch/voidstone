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

  it("runs npm install and commits changes when package-lock.json is modified", () => {
    const rootDir = "/path/to/root";
    mockExecWithLog
      .mockReturnValueOnce("") // npm install
      .mockReturnValueOnce("has-changes"); // git diff

    syncLockfile(rootDir);

    expect(mockExecWithLog).toHaveBeenCalledTimes(3);
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      1,
      "npm install --ignore-scripts",
      { cwd: rootDir, stdio: "inherit" },
    );
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      2,
      "git diff --staged --quiet package-lock.json || echo 'has-changes'",
      { cwd: rootDir },
    );
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      3,
      "git add package-lock.json",
      { cwd: rootDir },
    );
  });

  it("skips adding and committing when no changes are detected", () => {
    const rootDir = "/path/to/root";
    mockExecWithLog
      .mockReturnValueOnce("") // npm install
      .mockReturnValueOnce(""); // git diff

    syncLockfile(rootDir);

    expect(mockExecWithLog).toHaveBeenCalledTimes(2);
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      1,
      "npm install --ignore-scripts",
      { cwd: rootDir, stdio: "inherit" },
    );
    expect(mockExecWithLog).toHaveBeenNthCalledWith(
      2,
      "git diff --staged --quiet package-lock.json || echo 'has-changes'",
      { cwd: rootDir },
    );
  });

  it("throws an error if a command fails", () => {
    const rootDir = "/path/to/root";
    mockExecWithLog.mockImplementationOnce(() => {
      throw new Error("Command failed");
    });

    expect(() => syncLockfile(rootDir)).toThrow("Command failed");
    expect(mockExecWithLog).toHaveBeenCalledTimes(1);
    expect(mockExecWithLog).toHaveBeenCalledWith(
      "npm install --ignore-scripts",
      { cwd: rootDir, stdio: "inherit" },
    );
  });

  it("passes the correct root directory to all commands", () => {
    const rootDir = "/custom/root";
    mockExecWithLog.mockReturnValue("");

    syncLockfile(rootDir);

    expect(
      mockExecWithLog.mock.calls.every((call) => call[1]?.cwd === rootDir),
    ).toBe(true);
  });
});
