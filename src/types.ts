interface ReleaseInfo {
  name: string;
  current: string;
  next: string;
  pkgDir: string;
}

interface PackageUpdate extends ReleaseInfo {
  dependencyUpdates: Map<string, string>;
}

type ReleaseIds = Record<string, number>;

export type { ReleaseInfo, PackageUpdate, ReleaseIds };
