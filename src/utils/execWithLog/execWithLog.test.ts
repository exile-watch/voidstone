import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execWithLog } from "./execWithLog.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Import after mocking
import { execSync } from "node:child_process";

describe("execWithLog", () => {
  const mockConsole = {
    log: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(mockConsole.log);
    vi.spyOn(console, "error").mockImplementation(mockConsole.error);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should execute command and log output", () => {
    const command = "test command";
    const output = "command output";
    vi.mocked(execSync).mockReturnValue(output);

    const result = execWithLog(command);

    expect(execSync).toHaveBeenCalledWith(command, {
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(mockConsole.log).toHaveBeenCalledWith("ℹ️ Executing: test command");
    expect(mockConsole.log).toHaveBeenCalledWith("✅ Output:\ncommand output");
    expect(result).toBe(output);
  });

  it("should handle command with working directory", () => {
    const command = "test command";
    const cwd = "/test/dir";
    vi.mocked(execSync).mockReturnValue("");

    execWithLog(command, { cwd });

    expect(execSync).toHaveBeenCalledWith(command, {
      encoding: "utf8",
      stdio: "pipe",
      cwd,
    });
    expect(mockConsole.log).toHaveBeenCalledWith(
      "ℹ️ Executing: test command (in /test/dir)",
    );
  });

  it("should throw and log error on command failure", () => {
    const command = "failing command";
    const error = new Error("Command failed");
    vi.mocked(execSync).mockImplementation(() => {
      throw error;
    });

    expect(() => execWithLog(command)).toThrow(error);
    expect(mockConsole.error).toHaveBeenCalledWith(
      "❌ Failed: failing command",
    );
  });

  it("should not log output when command returns empty string", () => {
    const command = "empty command";
    vi.mocked(execSync).mockReturnValue("");

    execWithLog(command);

    expect(mockConsole.log).toHaveBeenCalledTimes(2);
    expect(mockConsole.log).toHaveBeenCalledWith("ℹ️ Executing: empty command");
    expect(mockConsole.log).toHaveBeenCalledWith("✅ Executed: empty command");
  });

  it("should pass through all provided options to execSync", () => {
    const command = "test command";
    const options = {
      cwd: "/test/dir",
      env: { TEST: "value" },
      maxBuffer: 1024,
      timeout: 1000,
    };
    vi.mocked(execSync).mockReturnValue("");

    execWithLog(command, options);

    expect(execSync).toHaveBeenCalledWith(command, {
      ...options,
      encoding: "utf8",
      stdio: "pipe",
    });
  });
});
