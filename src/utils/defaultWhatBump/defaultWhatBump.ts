import type { Commit } from "conventional-commits-parser";
import type { BumperRecommendation } from "conventional-recommended-bump";

const defaultWhatBump = async (
  commits: Commit[],
): Promise<BumperRecommendation | null | undefined> => {
  if (commits.length === 0) return null;

  let features = 0;
  let breaks = 0;

  for (const commit of commits) {
    // Check for breaking changes in notes
    const breakingNotes = commit.notes.filter(
      (note) => note.title === "BREAKING CHANGE",
    );
    breaks += breakingNotes.length;

    // Check for breaking change marker in type (!)
    if (commit.header?.includes("!:")) {
      breaks += 1;
    }

    // Count features
    if (commit.type === "feat") {
      features += 1;
    }
  }

  if (breaks > 0) {
    return {
      level: 0,
      reason: `There are ${breaks} BREAKING CHANGES`,
      releaseType: "major",
    };
  }

  if (features > 0) {
    return {
      level: 1,
      reason: `There are ${features} new features`,
      releaseType: "minor",
    };
  }

  return {
    level: 2,
    reason: "There are only patch changes in this release",
    releaseType: "patch",
  };
};

export { defaultWhatBump };
