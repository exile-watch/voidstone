import { findRepoRoot } from "../../utils/findRepoRoot/findRepoRoot.js";

function getRootDir(): string {
  try {
    return findRepoRoot();
  } catch (e: any) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}

export { getRootDir };
