import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { main } from "../main.js";

// Step modules (so we can spy on them)
import * as envMod from "../../steps/1-validate-envs/validateEnvs.js";
import * as rootMod from "../../steps/2-discover-root-dir/getRootDir.js";
import * as directMod from "../../steps/3-compute-direct-bumps/computeDirectBumps.js";
import * as depMod from "../../steps/4-compute-dependency-updates/computeDependencyUpdates.js";
import * as trigMod from "../../steps/5-compute-triggered-bumps/computeTriggeredBumps.js";
import * as pathsMod from "../../utils/getWorkspacePackagePaths/getWorkspacePackagePaths.js";

import * as dryRunMod from "../../steps/6-run-dry-run/runDryRun.js";
import * as updatePkgMod from "../../steps/7-update-package-jsons/updatePackageJsons.js";
import * as commitDepMod from "../../steps/8-commit-dependency-updates/commitDependencyUpdates.js";
import * as changelogMod from "../../steps/9-update-changelogs/updateChangelogs.js";
import * as commitTagMod from "../../steps/10-commit-tag-releases/commitAndTagReleases.js";
import * as publishMod from "../../steps/12-publish-and-release/publishAndRelease.js";

import type { PackageUpdate, ReleaseIds } from "../../types.js";
import * as rollbackMod from "../../utils/rollback/rollback.js";

// --- In-memory state for a single package:
type State = {
  version: string;
  tags: string[];
  published: string[];
};

const initialState: State = {
  version: "1.0.0",
  tags: [],
  published: [],
};

let state: State;

// Remove syncLockfile from test steps as it's now part of commitAndTagReleases
const TEST_STEPS = [
  { name: "commitAndTagReleases", fn: commitTagMod.commitAndTagReleases },
  { name: "publishAndRelease", fn: publishMod.publishAndRelease },
] as const;

describe("main(): single-package rollback restores state", () => {
  const mockUpdates: PackageUpdate[] = [
    {
      name: "pkg-1",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/pkg-1",
      dependencyUpdates: new Map(),
    },
  ];

  beforeAll(() => {
    // Prevent top-level process.exit from killing the runner
    vi.spyOn(process, "exit").mockImplementation(
      (code?: string | number | null | undefined) => {
        throw new Error(`process.exit called with ${code}`);
      },
    );
    // Silence console.error
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    // Reset our fake state
    state = { ...initialState, tags: [], published: [] };
    vi.clearAllMocks();

    // Stub steps 1–5 so main() enters the big try
    vi.spyOn(envMod, "validateEnvs").mockImplementation(() => {});
    vi.spyOn(rootMod, "getRootDir").mockReturnValue("/root");
    vi.spyOn(pathsMod, "getWorkspacePackagePaths").mockReturnValue([
      "/root/pkg-1",
    ]);
    vi.spyOn(directMod, "computeDirectBumps").mockResolvedValue(mockUpdates);
    vi.spyOn(depMod, "computeDependencyUpdates").mockReturnValue(new Map());
    vi.spyOn(trigMod, "computeTriggeredBumps").mockResolvedValue();

    // Default no-ops for steps inside the try
    vi.spyOn(dryRunMod, "runDryRun").mockImplementation(() => {});
    vi.spyOn(updatePkgMod, "updatePackageJsons").mockImplementation(() => {});
    vi.spyOn(commitDepMod, "commitDependencyUpdates").mockResolvedValue(
      undefined,
    );
    vi.spyOn(changelogMod, "updateChangelogs").mockResolvedValue(undefined);
    vi.spyOn(commitTagMod, "commitAndTagReleases").mockImplementation(() => {});
    vi.spyOn(publishMod, "publishAndRelease").mockResolvedValue(
      {} as ReleaseIds,
    );

    // Mock rollback to restore our in-memory state
    vi.spyOn(rollbackMod, "rollback").mockImplementation(async () => {
      state = { ...initialState, tags: [], published: [] };
    });
  });

  test.each(TEST_STEPS)(
    "when %s mutates state then throws → rollback restores version, tags, published",
    async ({ name, fn }) => {
      const error = new Error(`${name} exploded`);

      // Override the step to mutate our single-pkg state, then throw/reject
      const mutateThenThrow = () => {
        state.version = "9.9.9";
        state.tags.push("pkg-1@9.9.9");
        state.published.push("9.9.9");
        throw error;
      };

      if (name === "publishAndRelease") {
        vi.spyOn(publishMod, "publishAndRelease").mockRejectedValue(error);
      } else {
        vi.spyOn(commitTagMod, "commitAndTagReleases").mockImplementation(
          mutateThenThrow,
        );
      }

      await expect(main()).rejects.toThrow(error);

      // rollback must have been called once
      expect(rollbackMod.rollback).toHaveBeenCalledTimes(1);

      // And our fake state is back to the original snapshot:
      expect(state).toStrictEqual(initialState);
    },
  );
});
