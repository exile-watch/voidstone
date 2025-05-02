import path from "node:path";

/**
 * Joins any number of path segments into a POSIX-style path (forward slashes),
 * regardless of the operating system.
 *
 * @param segments - Path segments to join
 * @returns A normalized path string with forward slashes
 *
 * @example
 * normalizeExpectedPath("root", "packages", "pkg-1", "CHANGELOG.md");
 * // => "root/packages/pkg-1/CHANGELOG.md"
 */
export function normalizeExpectedPath(...segments: string[]): string {
  return path.posix.join(...segments);
}

/**
 * Generates the full set of arguments for conventionalChangelog:
 * [options, context, gitRawCommitsOpts].
 *
 * @param name    - Package name (with scope if any)
 * @param current - Current version string
 * @param next    - Next version string
 * @param pkgDir  - Absolute path to the package directory
 * @param rootDir - Absolute path to the repository root
 * @returns A tuple: [options, context, gitRawCommitsOpts]
 *
 * @example
 * const [opts, ctx, raw] = generateChangelogArgs(
 *   '@scope/pkg-1', '1.0.0', '2.0.0',
 *   '/root/packages/@scope/pkg-1', '/root'
 * );
 * expect(conventionalChangelog).toHaveBeenCalledWith(opts, ctx, raw);
 */
export function generateChangelogArgs(
  name: string,
  current: string,
  next: string,
  pkgDir: string,
  rootDir: string,
): [
  {
    preset: string;
    tagPrefix: string;
    releaseCount: number;
    lernaPackage: string;
  },
  Record<string, unknown>,
  { from: string; to: string; path: string },
] {
  const options = {
    preset: "angular",
    tagPrefix: `${name}@`,
    releaseCount: 1,
    lernaPackage: name,
  };
  const context = {};
  const relPath =
    path.relative(rootDir, pkgDir).split(path.sep).join("/") || ".";
  const gitRawCommitsOpts = {
    from: `${name}@${current}`,
    to: `${name}@${next}`,
    path: relPath,
  };
  return [options, context, gitRawCommitsOpts];
}

/**
 * Returns only the `options` object for conventionalChangelog,
 * useful in tests that only assert the first argument.
 *
 * @param name - Package name (with scope if any)
 * @returns The options portion of the args.
 */
export function getChangelogOptions(name: string): {
  preset: string;
  tagPrefix: string;
  releaseCount: number;
  lernaPackage: string;
} {
  return {
    preset: "angular",
    tagPrefix: `${name}@`,
    releaseCount: 1,
    lernaPackage: name,
  };
}
