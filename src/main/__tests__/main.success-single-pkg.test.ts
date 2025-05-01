import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { main } from "../main.js";

// Step modules to spy on
import * as envMod from "../../steps/1-validate-envs/validateEnvs.js";
import * as rootMod from "../../steps/2-discover-root-dir/getRootDir.js";
import * as directMod from "../../steps/3-compute-direct-bumps/computeDirectBumps.js";
import * as depMod from "../../steps/4-compute-dependency-updates/computeDependencyUpdates.js";
import * as trigMod from "../../steps/5-compute-triggered-bumps/computeTriggeredBumps.js";
import * as dryRunMod from "../../steps/6-run-dry-run/runDryRun.js";
import * as updatePkgMod from "../../steps/7-update-package-jsons/updatePackageJsons.js";
import * as commitDepMod from "../../steps/8-commit-dependency-updates/commitDependencyUpdates.js";
import * as changelogMod from "../../steps/9-update-changelogs/updateChangelogs.js";
import * as commitTagMod from "../../steps/10-commit-tag-releases/commitAndTagReleases.js";
import * as publishMod from "../../steps/11-publish-and-release/publishAndRelease.js";
import * as pathsMod from "../../utils/getWorkspacePackagePaths/getWorkspacePackagePaths.js";
import * as rollbackMod from "../../utils/rollback/rollback.js";

import type { PackageUpdate, ReleaseIds } from "../../types.js";

describe("main(): successful flow for single package", () => {
  const mockUpdates: PackageUpdate[] = [
    {
      name: "pkg-1",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-1",
      dependencyUpdates: new Map(),
    },
  ];
  const mockReleaseIds: ReleaseIds = { "pkg-1": 101 };

  // in-memory state
  const state = {
    version: "",
    tag: "",
    releasedId: 0 as number | null,
  };

  beforeAll(() => {
    // Prevent top-level process.exit from killing the test runner
    vi.spyOn(process, "exit").mockImplementation(
      (code?: string | number | null | undefined) => {
        throw new Error(`process.exit called with ${code}`);
      },
    );
    // Silence error logs
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // reset state
    state.version = "";
    state.tag = "";
    state.releasedId = null;

    // Steps 1–5: allow main() to enter the try block
    vi.spyOn(envMod, "validateEnvs").mockImplementation(() => {});
    vi.spyOn(rootMod, "getRootDir").mockReturnValue("/root");
    vi.spyOn(pathsMod, "getWorkspacePackagePaths").mockReturnValue([
      "/root/pkg-1",
    ]);
    vi.spyOn(directMod, "computeDirectBumps").mockResolvedValue(mockUpdates);
    vi.spyOn(depMod, "computeDependencyUpdates").mockReturnValue(new Map());
    vi.spyOn(trigMod, "computeTriggeredBumps").mockResolvedValue();

    // 6. dry-run: no state change
    vi.spyOn(dryRunMod, "runDryRun").mockImplementation(() => {});

    // 7. bump version
    vi.spyOn(updatePkgMod, "updatePackageJsons").mockImplementation(
      (updates) => {
        state.version = updates[0].next;
      },
    );

    // 8. commit deps: noop
    vi.spyOn(commitDepMod, "commitDependencyUpdates").mockResolvedValue(
      undefined,
    );

    // 9. changelogs: noop
    vi.spyOn(changelogMod, "updateChangelogs").mockResolvedValue(undefined);

    // 10. tag
    vi.spyOn(commitTagMod, "commitAndTagReleases").mockImplementation(
      (updates) => {
        state.tag = `${updates[0].name}@${updates[0].next}`;
      },
    );

    // 11. publish
    vi.spyOn(publishMod, "publishAndRelease").mockImplementation(
      async (_root, updates, _ids) => {
        state.releasedId = mockReleaseIds[updates[0].name];
        return mockReleaseIds;
      },
    );

    // rollback must not fire
    vi.spyOn(rollbackMod, "rollback").mockImplementation(async () => {
      throw new Error("rollback should not be called on success");
    });

    // capture final log
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  test("main() bumps version, tags, and records release ID", async () => {
    await main();

    // state was mutated as expected:
    expect(state.version).toBe("1.1.0");
    expect(state.tag).toBe("pkg-1@1.1.0");
    expect(state.releasedId).toBe(101);

    // final success log
    expect(console.log).toHaveBeenCalledWith(
      "🎉 All packages released successfully!",
    );
  });
});
