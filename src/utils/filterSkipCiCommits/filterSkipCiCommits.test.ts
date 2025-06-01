import type { Commit } from "conventional-commits-parser";
import { describe, expect, it, vi } from "vitest";
import { filterSkipCiCommits } from "./filterSkipCiCommits.js";

describe("filterSkipCiCommits", () => {
  it("should pass through regular commits unchanged", () => {
    const commit = { header: "feat: add new feature" } as Commit;
    const callback = vi.fn();

    filterSkipCiCommits(commit, callback);

    expect(callback).toHaveBeenCalledWith(null, commit);
  });

  it("should filter out commits with [skip ci]", () => {
    const commit = { header: "fix: bug fix [skip ci]" } as Commit;
    const callback = vi.fn();

    filterSkipCiCommits(commit, callback);

    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it("should filter out commits with [CI SKIP] (case insensitive)", () => {
    const commit = { header: "chore: update deps [CI SKIP]" } as Commit;
    const callback = vi.fn();

    filterSkipCiCommits(commit, callback);

    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it("should handle undefined commit gracefully", () => {
    const commit = undefined as unknown as Commit;
    const callback = vi.fn();

    filterSkipCiCommits(commit, callback);

    expect(callback).toHaveBeenCalledWith(null, commit);
  });

  it("should handle commit without header gracefully", () => {
    const commit = { body: "commit body only" } as Commit;
    const callback = vi.fn();

    filterSkipCiCommits(commit, callback);

    expect(callback).toHaveBeenCalledWith(null, commit);
  });

  it("should log error when callback is not a function", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const commit = { header: "fix: bug fix" } as Commit;
    const invalidCallback = {} as any;

    filterSkipCiCommits(commit, invalidCallback);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Invalid callback provided to transform function",
    );
    consoleErrorSpy.mockRestore();
  });

  it("should handle null callback gracefully", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const commit = { header: "fix: bug fix" } as Commit;

    filterSkipCiCommits(commit, null as any);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Invalid callback provided to transform function",
    );
    consoleErrorSpy.mockRestore();
  });
});
