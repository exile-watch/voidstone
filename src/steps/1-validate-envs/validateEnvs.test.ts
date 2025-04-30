import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnvs } from "./validateEnvs.js";

describe("validateEnvs", () => {
  const originalEnv = process.env;
  const mockExit = vi
    .spyOn(process, "exit")
    .mockImplementation(() => undefined as never);
  const mockConsoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("should exit when GH_TOKEN is missing", () => {
    process.env.GH_TOKEN = undefined;
    process.env.GITHUB_REPOSITORY = "owner/repo";

    validateEnvs();

    expect(mockConsoleError).toHaveBeenCalledWith(
      "❌ GH_TOKEN environment variable is required for releasing",
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit when GITHUB_REPOSITORY is missing", () => {
    process.env.GH_TOKEN = "dummy-token";
    process.env.GITHUB_REPOSITORY = undefined;

    validateEnvs();

    expect(mockConsoleError).toHaveBeenCalledWith(
      "❌ GITHUB_REPOSITORY environment variable is required for releasing",
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit when both env variables are missing", () => {
    process.env.GH_TOKEN = undefined;
    process.env.GITHUB_REPOSITORY = undefined;

    validateEnvs();

    expect(mockConsoleError).toHaveBeenCalledWith(
      "❌ GH_TOKEN environment variable is required for releasing",
    );
    expect(mockConsoleError).toHaveBeenCalledWith(
      "❌ GITHUB_REPOSITORY environment variable is required for releasing",
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should not exit when both env variables are present", () => {
    process.env.GH_TOKEN = "dummy-token";
    process.env.GITHUB_REPOSITORY = "owner/repo";

    validateEnvs();

    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });
});
