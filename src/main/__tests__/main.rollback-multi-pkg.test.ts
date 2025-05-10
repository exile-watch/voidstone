import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { main } from "../main.js";

// Import entire modules so we can spyOn their exports
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

// --- in-memory "state" stand-in for files/tags/published
type State = {
  versions: Record<string, string>;
  tags: string[];
  published: string[];
};

const initialState: State = {
  versions: {
    "/root/pkg-1/package.json": "1.0.0",
    "/root/pkg-2/package.json": "2.0.0",
  },
  tags: [],
  published: [],
};

let state: State;

// Steps we want to failure-test:
const TEST_STEPS = [
  { name: "commitAndTagReleases", fn: commitTagMod.commitAndTagReleases },
  { name: "publishAndRelease", fn: publishMod.publishAndRelease },
] as const;

describe("main(): multi-package rollback restores both packages' state", () => {
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

  beforeAll(() => {
    // Prevent the "if (require.main===module)" clause from calling process.exit(1)
    vi.spyOn(process, "exit").mockImplementation(
      (code?: string | number | null | undefined) => {
        throw new Error(`process.exit called with ${code}`);
      },
    );
    // Silence the error logger
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    state = JSON.parse(JSON.stringify(initialState));
    vi.clearAllMocks();

    // Stub out steps 1–5 so main() gets into the big try
    vi.spyOn(envMod, "validateEnvs").mockImplementation(() => {});
    vi.spyOn(rootMod, "getRootDir").mockReturnValue("/root");
    vi.spyOn(pathsMod, "getWorkspacePackagePaths").mockReturnValue([
      "/root/pkg-1",
      "/root/pkg-2",
    ]);
    vi.spyOn(directMod, "computeDirectBumps").mockResolvedValue(mockUpdates);
    vi.spyOn(depMod, "computeDependencyUpdates").mockReturnValue(new Map());
    vi.spyOn(trigMod, "computeTriggeredBumps").mockResolvedValue();

    // Default no-ops for the steps inside the try
    vi.spyOn(dryRunMod, "runDryRun").mockImplementation(() => {});
    vi.spyOn(updatePkgMod, "updatePackageJsons").mockImplementation(() => {});
    vi.spyOn(commitDepMod, "commitDependencyUpdates").mockResolvedValue(
      undefined,
    );
    vi.spyOn(changelogMod, "updateChangelogs").mockResolvedValue(undefined);

    // Mock all steps that should be in the try block
    vi.spyOn(commitTagMod, "commitAndTagReleases").mockImplementation(() => {});
    vi.spyOn(publishMod, "publishAndRelease").mockResolvedValue(
      {} as ReleaseIds,
    );

    // Mock rollback to restore our in-memory state
    vi.spyOn(rollbackMod, "rollback").mockImplementation(async (_up, _ids) => {
      state = JSON.parse(JSON.stringify(initialState));
    });
  });

  test.each(TEST_STEPS)(
    "when %s mutates both packages then throws → rollback restores both",
    async ({ name, fn }) => {
      const err = new Error(`${name} exploded`);

      // override that one step to mutate state for both, then throw/reject
      if (name === "publishAndRelease") {
        vi.spyOn(publishMod, "publishAndRelease").mockRejectedValue(err);
      } else {
        vi.spyOn(commitTagMod, "commitAndTagReleases").mockImplementation(
          () => {
            // mutate both
            state.versions["/root/pkg-1/package.json"] = "9.9.9";
            state.versions["/root/pkg-2/package.json"] = "9.9.9";
            state.tags.push("pkg-1@9.9.9", "pkg-2@9.9.9");
            state.published.push("9.9.9", "9.9.9");
            throw err;
          },
        );
      }

      await expect(main()).rejects.toThrow(err);

      // rollback must have been called
      expect(rollbackMod.rollback).toHaveBeenCalledTimes(1);

      // and state must be back to initial snapshot
      expect(state).toStrictEqual(initialState);
    },
  );
});
