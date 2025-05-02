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
import * as syncLockfileMod from "../../steps/11-sync-lockfile/syncLockfile.js";
import * as publishMod from "../../steps/12-publish-and-release/publishAndRelease.js";
import * as pathsMod from "../../utils/getWorkspacePackagePaths/getWorkspacePackagePaths.js";
import * as rollbackMod from "../../utils/rollback/rollback.js";

import type { PackageUpdate, ReleaseIds } from "../../types.js";

describe("main(): successful flow mutates state correctly", () => {
  const mockUpdates: PackageUpdate[] = [
    {
      name: "pkg-1",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-1",
      dependencyUpdates: new Map(),
    },
    {
      name: "pkg-2",
      current: "2.0.0",
      next: "2.2.0",
      pkgDir: "/root/pkg-2",
      dependencyUpdates: new Map(),
    },
  ];
  const mockReleaseIds: ReleaseIds = { "pkg-1": 101, "pkg-2": 202 };

  // shared in-memory state:
  const state = {
    versions: {} as Record<string, string>,
    tags: [] as string[],
    lockfileUpdated: false,
    released: {} as ReleaseIds,
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
    state.versions = {};
    state.tags = [];
    state.lockfileUpdated = false;
    state.released = {};

    // 1–5: allow main() to get into the try
    vi.spyOn(envMod, "validateEnvs").mockImplementation(() => {});
    vi.spyOn(rootMod, "getRootDir").mockReturnValue("/root");
    vi.spyOn(pathsMod, "getWorkspacePackagePaths").mockReturnValue([
      "/root/pkg-1",
      "/root/pkg-2",
    ]);
    vi.spyOn(directMod, "computeDirectBumps").mockResolvedValue(mockUpdates);
    vi.spyOn(depMod, "computeDependencyUpdates").mockReturnValue(new Map());
    vi.spyOn(trigMod, "computeTriggeredBumps").mockResolvedValue();

    // 6. dry-run: no state change
    vi.spyOn(dryRunMod, "runDryRun").mockImplementation(() => {});

    // 7. updatePackageJsons *bump versions* in our state
    vi.spyOn(updatePkgMod, "updatePackageJsons").mockImplementation(
      (updates) => {
        for (const u of updates) {
          state.versions[u.name] = u.next;
        }
      },
    );

    // 8. commitDependencyUpdates: no state change
    vi.spyOn(commitDepMod, "commitDependencyUpdates").mockResolvedValue(
      undefined,
    );

    // 9. updateChangelogs: no state change
    vi.spyOn(changelogMod, "updateChangelogs").mockResolvedValue(undefined);

    // 10. commitAndTagReleases *create tags* in our state
    vi.spyOn(commitTagMod, "commitAndTagReleases").mockImplementation(
      (updates) => {
        for (const u of updates) {
          state.tags.push(`${u.name}@${u.next}`);
        }
      },
    );

    // 11. syncLockfile: update lockfile state
    vi.spyOn(syncLockfileMod, "syncLockfile").mockImplementation(() => {
      state.lockfileUpdated = true;
      return Promise.resolve();
    });

    // 12. publishAndRelease *record release IDs* in our state
    vi.spyOn(publishMod, "publishAndRelease").mockImplementation(
      async (_root, updates, _ids) => {
        const out: ReleaseIds = {};
        for (const u of updates) {
          out[u.name] = mockReleaseIds[u.name];
          state.released[u.name] = mockReleaseIds[u.name];
        }
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

  test("main() bumps versions, creates tags, updates lockfile, and returns release IDs", async () => {
    await main();

    // Versions bumped correctly
    expect(state.versions).toEqual({
      "pkg-1": "1.1.0",
      "pkg-2": "2.2.0",
    });

    // Tags created
    expect(state.tags).toEqual(["pkg-1@1.1.0", "pkg-2@2.2.0"]);

    // Lockfile updated
    expect(state.lockfileUpdated).toBe(true);

    // Release IDs recorded
    expect(state.released).toEqual({
      "pkg-1": 101,
      "pkg-2": 202,
    });

    // Final success log
    expect(console.log).toHaveBeenCalledWith(
      "🎉 All packages released successfully!",
    );
  });
});
