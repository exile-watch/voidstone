import fs from "node:fs";
import type { PackageUpdate } from "../../types.js";
import { extractPackageNameFromAlias } from "../../utils/extractPackageNameFromAlias/extractPackageNameFromAlias.js";

function computeDependencyUpdates(
  pkgPaths: string[],
  updates: PackageUpdate[],
): Map<string, Map<string, string>> {
  const bumpMap = new Map(updates.map((u) => [u.name, u.next]));
  const result = new Map<string, Map<string, string>>();
  const depFields = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const;

  for (const pkgPath of pkgPaths) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const bumpsForThisPkg = new Map<string, string>();

    for (const field of depFields) {
      const fieldDeps = pkgJson[field];
      if (
        !fieldDeps ||
        typeof fieldDeps !== "object" ||
        Array.isArray(fieldDeps)
      ) {
        continue;
      }

      for (const [rawAlias, rawVal] of Object.entries(fieldDeps)) {
        const aliasKey = rawAlias.trim();
        if (
          Array.isArray(rawVal) ||
          (typeof rawVal === "object" && rawVal !== null)
        ) {
          continue; // skip weird shapes
        }
        const val = typeof rawVal === "string" ? rawVal.trim() : "";

        // 1) If someone literally bumped the alias name itself, use that:
        const candidates: string[] = [aliasKey];

        // 2) If it’s an npm: alias, try to extract the real pkg name:
        if (val.startsWith("npm:")) {
          // Skip if missing version separator (i.e. ambiguous alias)
          if (!val.slice(4).includes("@")) {
            continue;
          }
          const pkgName = extractPackageNameFromAlias(val);
          if (pkgName) {
            candidates.push(pkgName);
          } else {
            continue; // Skip if we can’t extract a valid package name
          }
        }

        // 3) If the alias key itself has an inline "@version" suffix, strip it off:
        const inlineMatch = aliasKey.match(/^(@?[^@]+)@.+$/);
        if (inlineMatch) {
          candidates.push(inlineMatch[1]);
        }

        // 4) In priority order, pick the first candidate that has an entry in bumpMap:
        let picked: string | undefined;
        for (const name of candidates) {
          if (bumpMap.has(name)) {
            picked = name;
            break;
          }
        }
        if (!picked) {
          continue; // no matches → skip quietly
        }

        // 5) Now we have a bump. Skip "no\-op" if it’s already at that exact version:
        const nextVer = bumpMap.get(picked);
        if (nextVer === undefined) continue;
        let currentVer = "";
        if (val.startsWith("npm:")) {
          const cut = val.slice(4);
          const at = cut.lastIndexOf("@");
          currentVer = at > 0 ? cut.slice(at + 1) : "";
        } else {
          currentVer = val.replace(/^[~^]/, "");
        }

        if (currentVer && currentVer === nextVer) {
          continue; // already up\-to\-date
        }

        // 6) Record it under the *alias* key
        bumpsForThisPkg.set(aliasKey, nextVer);
      }
    }

    if (bumpsForThisPkg.size > 0) {
      result.set(pkgPath, bumpsForThisPkg);
    }
  }

  return result;
}

export { computeDependencyUpdates };
