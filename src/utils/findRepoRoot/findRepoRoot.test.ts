import * as fs from "node:fs";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findRepoRoot } from "./findRepoRoot.js";

vi.mock("node:fs");
vi.mock("node:path");

describe("findRepoRoot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "cwd").mockReturnValue("/test/project/src");

    // Override path.dirname/path.join to simulate directory traversal in a platform-independent way.
    // This mock ensures that when we are at the root ('' or '/'), it returns '/' and that
    // directories with only one level (e.g., '/dir') return '/' as their parent.
    vi.mocked(path.dirname).mockImplementation((p) => {
      if (p === "/" || p === "") return "/";
      const parts = p.split("/");
      if (parts.length <= 2) return "/";
      return parts.slice(0, -1).join("/") || "/";
    });

    vi.mocked(path.join).mockImplementation((...parts) => {
      if (parts[0] === "/") {
        return `/${parts.slice(1).join("/")}`;
      }
      return parts.join("/");
    });
  });

  it("should find package.json in current directory", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return p === "/test/project/src/package.json";
    });

    const result = findRepoRoot();

    expect(result).toBe("/test/project/src");
    expect(fs.existsSync).toHaveBeenCalledWith(
      "/test/project/src/package.json",
    );
  });

  it("should find package.json in parent directory", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return p === "/test/project/package.json";
    });

    const result = findRepoRoot();

    expect(result).toBe("/test/project");
    expect(fs.existsSync).toHaveBeenCalledWith(
      "/test/project/src/package.json",
    );
    expect(fs.existsSync).toHaveBeenCalledWith("/test/project/package.json");
  });

  it("should find package.json in root directory", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (p === "/package.json") {
        return true;
      }
      return false;
    });

    const result = findRepoRoot();

    expect(result).toBe("/");
    expect(fs.existsSync).toHaveBeenCalledWith(
      "/test/project/src/package.json",
    );
    expect(fs.existsSync).toHaveBeenCalledWith("/test/project/package.json");
    expect(fs.existsSync).toHaveBeenCalledWith("/test/package.json");
    expect(fs.existsSync).toHaveBeenCalledWith("/package.json");
  });

  it("should throw error if no package.json is found", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => findRepoRoot()).toThrow(
      "Could not find package.json in any parent directory",
    );
    expect(fs.existsSync).toHaveBeenCalledWith(
      "/test/project/src/package.json",
    );
    expect(fs.existsSync).toHaveBeenCalledWith("/test/project/package.json");
    expect(fs.existsSync).toHaveBeenCalledWith("/test/package.json");
    expect(fs.existsSync).toHaveBeenCalledWith("/package.json");
  });

  it("should handle Windows-style paths", () => {
    vi.spyOn(process, "cwd").mockReturnValue("C:\\test\\project\\src");

    vi.mocked(path.join).mockImplementation((...parts) => {
      // Basic Windows join
      return parts.join("\\");
    });
    vi.mocked(path.dirname).mockImplementation((p) => {
      const parts = p.split("\\");
      return parts.slice(0, -1).join("\\");
    });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return p === "C:\\test\\project\\package.json";
    });

    const result = findRepoRoot();

    expect(result).toBe("C:\\test\\project");
    expect(fs.existsSync).toHaveBeenCalledWith(
      "C:\\test\\project\\src\\package.json",
    );
    expect(fs.existsSync).toHaveBeenCalledWith(
      "C:\\test\\project\\package.json",
    );
  });
});
