import * as fs from "node:fs";
import path from "node:path";

function findRepoRoot(): string {
  let dir = process.cwd();

  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      return dir;
    }

    const parent = path.dirname(dir);
    // We've reached the root when parent equals dir
    if (parent === dir) {
      // At root, check for package.json one last time
      const rootPkgPath = path.join(parent, "package.json");
      if (fs.existsSync(rootPkgPath)) {
        return parent;
      }
      throw new Error("Could not find package.json in any parent directory");
    }

    dir = parent;
  }
}

export { findRepoRoot };
