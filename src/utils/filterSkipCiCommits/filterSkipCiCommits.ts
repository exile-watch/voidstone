import type { Commit } from "conventional-commits-parser";

const filterSkipCiCommits = (commit: Commit, callback: any) => {
  // Ensure callback is actually a function
  if (typeof callback !== "function") {
    console.error("Invalid callback provided to transform function");
    return;
  }

  // Ensure we're working with a valid commit object
  if (!commit) {
    return callback(null, commit);
  }

  // Check for skip ci in the header
  if (commit.header) {
    const skipCiRegex = /\[(skip ci|ci skip)\]/i;
    if (skipCiRegex.test(commit.header)) {
      return callback(null, false);
    }
  }

  // Pass through the commit unchanged
  return callback(null, commit);
};

export { filterSkipCiCommits };
