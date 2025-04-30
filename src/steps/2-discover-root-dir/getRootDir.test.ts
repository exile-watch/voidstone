import { afterEach, describe, expect, it, vi } from "vitest";
import { findRepoRoot } from "../../utils/findRepoRoot/findRepoRoot.js";
import { getRootDir } from "./getRootDir.js";

vi.mock("../../utils/findRepoRoot/findRepoRoot.js", () => ({
  findRepoRoot: vi.fn(),
}));

describe("getRootDir", () => {
  const mockExit = vi
    .spyOn(process, "exit")
    .mockImplementation(() => undefined as never);
  const mockConsoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return repository root path when found", () => {
    const expectedPath = "/path/to/repo";
    vi.mocked(findRepoRoot).mockReturnValue(expectedPath);

    const result = getRootDir();

    expect(result).toBe(expectedPath);
    expect(findRepoRoot).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should exit with error when repository root is not found", () => {
    const errorMessage = "Repository root not found";
    vi.mocked(findRepoRoot).mockImplementation(() => {
      throw new Error(errorMessage);
    });

    getRootDir();

    expect(findRepoRoot).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(`❌ ${errorMessage}`);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit with error when findRepoRoot throws any error", () => {
    const errorMessage = "Something went wrong";
    vi.mocked(findRepoRoot).mockImplementation(() => {
      throw new Error(errorMessage);
    });

    getRootDir();

    expect(findRepoRoot).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(`❌ ${errorMessage}`);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
