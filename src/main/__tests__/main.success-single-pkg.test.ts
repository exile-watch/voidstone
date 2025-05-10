import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { main } from "../main.js";

// Step modules (for spying)
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
import * as publishMod from "../../steps/12-publish-and-release/publishAndRelease.js";
import * as pathsMod from "../../utils/getWorkspacePackagePaths/getWorkspacePackagePaths.js";
import * as rollbackMod from "../../utils/rollback/rollback.js";

import type { PackageUpdate, ReleaseIds } from "../../types.js";

describe("main(): single package flow", () => {
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

  // shared in-memory state:
  const state = {
    version: "",
    tag: "",
    lockfileUpdated: false,
    released: 0,
  };

  beforeAll(() => {
    // noop out process.exit so top‐level guard can't kill the test process
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // reset state
    state.version = "";
    state.tag = "";
    state.lockfileUpdated = false;
    state.released = 0;

    // 1–5: allow main() to get into the try
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

    // 7. updatePackageJsons *bump versions* in our state
    vi.spyOn(updatePkgMod, "updatePackageJsons").mockImplementation(
      (updates) => {
        state.version = updates[0].next;
      },
    );

    // 8. commitDependencyUpdates: no state change
    vi.spyOn(commitDepMod, "commitDependencyUpdates").mockResolvedValue(
      undefined,
    );

    // 9. updateChangelogs: no state change
    vi.spyOn(changelogMod, "updateChangelogs").mockResolvedValue(undefined);

    // 10. commitAndTagReleases *create tag and update lockfile* in our state
    vi.spyOn(commitTagMod, "commitAndTagReleases").mockImplementation(
      (updates) => {
        state.tag = `${updates[0].name}@${updates[0].next}`;
        state.lockfileUpdated = true; // Now lockfile update happens here
      },
    );

    // 12. publishAndRelease *record release ID* in our state
    vi.spyOn(publishMod, "publishAndRelease").mockImplementation(
      async (_root, updates, _ids) => {
        const out: ReleaseIds = {};
        out[updates[0].name] = mockReleaseIds[updates[0].name];
        state.released = mockReleaseIds[updates[0].name];
        return out;
      },
    );

    // rollback must *not* be called
    vi.spyOn(rollbackMod, "rollback").mockImplementation(async () => {
      throw new Error("rollback invoked on success!");
    });

    // spy console.log for the final 🎉 message
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  test("main() successfully bumps version, creates tag, updates lockfile, and returns release ID", async () => {
    await main();

    // Version bumped correctly
    expect(state.version).toBe("1.1.0");

    // Tag created
    expect(state.tag).toBe("pkg-1@1.1.0");

    // Lockfile updated (as part of commitAndTagReleases)
    expect(state.lockfileUpdated).toBe(true);

    // Release ID recorded
    expect(state.released).toBe(101);

    // Final success log
    expect(console.log).toHaveBeenCalledWith(
      "🎉 All packages released successfully!",
    );
  });
});
