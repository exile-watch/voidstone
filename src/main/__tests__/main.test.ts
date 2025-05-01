import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnvs } from "../../steps/1-validate-envs/validateEnvs.js";
import { getRootDir } from "../../steps/2-discover-root-dir/getRootDir.js";
import { computeDirectBumps } from "../../steps/3-compute-direct-bumps/computeDirectBumps.js";
import { computeDependencyUpdates } from "../../steps/4-compute-dependency-updates/computeDependencyUpdates.js";
import { computeTriggeredBumps } from "../../steps/5-compute-triggered-bumps/computeTriggeredBumps.js";
import { runDryRun } from "../../steps/6-run-dry-run/runDryRun.js";
import { updatePackageJsons } from "../../steps/7-update-package-jsons/updatePackageJsons.js";
import { commitDependencyUpdates } from "../../steps/8-commit-dependency-updates/commitDependencyUpdates.js";
import { updateChangelogs } from "../../steps/9-update-changelogs/updateChangelogs.js";
import { commitAndTagReleases } from "../../steps/10-commit-tag-releases/commitAndTagReleases.js";
import { publishAndRelease } from "../../steps/11-publish-and-release/publishAndRelease.js";
import type { PackageUpdate } from "../../types.js";
import { getWorkspacePackagePaths } from "../../utils/getWorkspacePackagePaths/getWorkspacePackagePaths.js";
import { rollback } from "../../utils/rollback/rollback.js";
import { main } from "../main.js";

vi.mock("../../steps/1-validate-envs/validateEnvs.js");
vi.mock("../../steps/2-discover-root-dir/getRootDir.js");
vi.mock("../../steps/3-compute-direct-bumps/computeDirectBumps.js");
vi.mock("../../steps/4-compute-dependency-updates/computeDependencyUpdates.js");
vi.mock("../../steps/5-compute-triggered-bumps/computeTriggeredBumps.js");
vi.mock("../../steps/6-run-dry-run/runDryRun.js");
vi.mock("../../steps/7-update-package-jsons/updatePackageJsons.js");
vi.mock("../../steps/8-commit-dependency-updates/commitDependencyUpdates.js");
vi.mock("../../steps/9-update-changelogs/updateChangelogs.js");
vi.mock("../../steps/10-commit-tag-releases/commitAndTagReleases.js");
vi.mock("../../steps/11-publish-and-release/publishAndRelease.js");
vi.mock("../../utils/getWorkspacePackagePaths/getWorkspacePackagePaths.js");
vi.mock("../../utils/rollback/rollback.js");

describe("main", () => {
  const mockUpdates: PackageUpdate[] = [
    {
      name: "pkg-1",
      current: "1.0.0",
      next: "1.1.0",
      pkgDir: "/root/packages/pkg-1",
      dependencyUpdates: new Map(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRootDir).mockReturnValue("/root");
    vi.mocked(getWorkspacePackagePaths).mockReturnValue([
      "/root/packages/pkg-1",
    ]);
    vi.mocked(computeDirectBumps).mockResolvedValue(mockUpdates);
    vi.mocked(computeDependencyUpdates).mockReturnValue(new Map());
    console.log = vi.fn();
    console.error = vi.fn();
  });

  it("should successfully complete the release flow", async () => {
    await main();

    expect(validateEnvs).toHaveBeenCalled();
    expect(getRootDir).toHaveBeenCalled();
    expect(computeDirectBumps).toHaveBeenCalledWith("/root", [
      "/root/packages/pkg-1",
    ]);
    expect(computeDependencyUpdates).toHaveBeenCalled();
    expect(computeTriggeredBumps).toHaveBeenCalled();
    expect(runDryRun).toHaveBeenCalledWith(mockUpdates);
    expect(updatePackageJsons).toHaveBeenCalledWith(mockUpdates);
    expect(commitDependencyUpdates).toHaveBeenCalledWith("/root", mockUpdates);
    expect(updateChangelogs).toHaveBeenCalledWith("/root", mockUpdates);
    expect(commitAndTagReleases).toHaveBeenCalledWith(mockUpdates);
    expect(publishAndRelease).toHaveBeenCalledWith("/root", mockUpdates, {});
    expect(console.log).toHaveBeenCalledWith(
      "🎉 All packages released successfully!",
    );
  });

  it("should skip release when no updates detected", async () => {
    vi.mocked(computeDirectBumps).mockResolvedValue([]);

    await main();

    expect(runDryRun).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      "📦 No package changes detected. Nothing to release.",
    );
  });

  it("should handle errors and trigger rollback", async () => {
    const error = new Error("Test error");
    vi.mocked(runDryRun).mockImplementation(() => {
      throw error;
    });

    await expect(main()).rejects.toThrow("Test error");
    expect(runDryRun).toHaveBeenCalledWith(mockUpdates);
  });

  it("should handle child process errors", async () => {
    const error = new Error("Process error") as Error & {
      stdout: Buffer;
      stderr: Buffer;
    };
    error.stdout = Buffer.from("stdout content");
    error.stderr = Buffer.from("stderr content");

    vi.mocked(runDryRun).mockImplementation(() => {
      throw error;
    });

    await expect(main()).rejects.toThrow("Process error");
    expect(runDryRun).toHaveBeenCalledWith(mockUpdates);
  });
});
