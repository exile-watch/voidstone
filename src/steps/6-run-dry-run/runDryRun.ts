import { REGISTRY } from "../../constants.js";
import type { PackageUpdate } from "../../types.js";
import { execWithLog } from "../../utils/execWithLog/execWithLog.js";

function runDryRun(updates: PackageUpdate[]): void {
  for (const u of updates) {
    execWithLog(`npm publish --dry-run --registry ${REGISTRY}`, {
      cwd: u.pkgDir,
      stdio: "ignore",
    });
  }
}

export { runDryRun };
