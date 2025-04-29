import type { Commit, CommitBase } from "conventional-commits-parser";
import { describe, expect, it } from "vitest";
import { defaultWhatBump } from "./defaultWhatBump.js";

function createTestCommit(options: {
  type?: string | null;
  notes?: Array<{ title: string; text: string }>;
  header?: string | null;
  body?: string | null;
  footer?: string | null;
  merge?: string | null;
  subject?: string | null;
  scope?: string | null;
}): Commit {
  return Object.assign({}, {
    type: options.type ?? null,
    notes: options.notes ?? [],
    header: options.header ?? null,
    body: options.body ?? null,
    footer: options.footer ?? null,
    merge: options.merge ?? null,
    references: [],
    mentions: [],
    revert: null,
    subject: options.subject ?? null,
    scope: options.scope ?? null,
  } as unknown as CommitBase) as Commit;
}
const commitTypes = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "chore",
  "docs",
  "style",
  "test",
];

describe("defaultWhatBump", () => {
  it("should return null when there are no commits", async () => {
    const result = await defaultWhatBump([]);
    expect(result).toBeNull();
  });

  it("should recommend major bump when there are breaking changes", async () => {
    const commits: Commit[] = [
      createTestCommit({
        type: "feat",
        notes: [
          { title: "BREAKING CHANGE", text: "breaking change description" },
        ],
      }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 0,
      reason: "There are 1 BREAKING CHANGES",
      releaseType: "major",
    });
  });

  it.each(commitTypes)(
    "should recommend major bump for %s! commits",
    async (type) => {
      const commits: Commit[] = [
        createTestCommit({
          type,
          notes: [],
          header: `${type}!: breaking change`,
        }),
      ];

      const result = await defaultWhatBump(commits);

      expect(result).toEqual({
        level: 0,
        reason: "There are 1 BREAKING CHANGES",
        releaseType: "major",
      });
    },
  );

  it("should recommend patch bump for non-feature commits", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: "fix", notes: [] }),
      createTestCommit({ type: "chore", notes: [] }),
      createTestCommit({ type: "docs", notes: [] }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 2,
      reason: "There are only patch changes in this release",
      releaseType: "patch",
    });
  });

  it("should prioritize breaking changes over features", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: "feat", notes: [] }),
      createTestCommit({
        type: "fix",
        notes: [
          { title: "BREAKING CHANGE", text: "breaking change description" },
        ],
      }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 0,
      reason: "There are 1 BREAKING CHANGES",
      releaseType: "major",
    });
  });

  it("should count multiple features correctly", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: "feat", notes: [] }),
      createTestCommit({ type: "feat", notes: [] }),
      createTestCommit({ type: "feat", notes: [] }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 1,
      reason: "There are 3 new features",
      releaseType: "minor",
    });
  });

  it("should count multiple breaking changes correctly", async () => {
    const commits: Commit[] = [
      createTestCommit({
        type: "feat",
        notes: [{ title: "BREAKING CHANGE", text: "first breaking change" }],
      }),
      createTestCommit({
        type: "fix",
        notes: [{ title: "BREAKING CHANGE", text: "second breaking change" }],
      }),
      createTestCommit({
        type: "chore",
        header: "chore!: third breaking change",
      }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 0,
      reason: "There are 3 BREAKING CHANGES",
      releaseType: "major",
    });
  });

  it("should handle mixed commit types with patch-level changes", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: "fix", notes: [] }),
      createTestCommit({ type: "docs", notes: [] }),
      createTestCommit({ type: "style", notes: [] }),
      createTestCommit({ type: "chore", notes: [] }),
      createTestCommit({ type: "test", notes: [] }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 2,
      reason: "There are only patch changes in this release",
      releaseType: "patch",
    });
  });

  it("should handle mix of features and breaking changes", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: "feat", notes: [] }),
      createTestCommit({ type: "feat", notes: [] }),
      createTestCommit({
        type: "feat",
        notes: [{ title: "BREAKING CHANGE", text: "breaking change" }],
      }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 0,
      reason: "There are 1 BREAKING CHANGES",
      releaseType: "major",
    });
  });

  it("should handle mix of features and patch changes", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: "feat", notes: [] }),
      createTestCommit({ type: "fix", notes: [] }),
      createTestCommit({ type: "chore", notes: [] }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 1,
      reason: "There are 1 new features",
      releaseType: "minor",
    });
  });

  it("should handle unknown commit types as patch changes", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: "unknown", notes: [] }),
      createTestCommit({ type: "custom", notes: [] }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 2,
      reason: "There are only patch changes in this release",
      releaseType: "patch",
    });
  });

  it("should handle undefined commit type as patch change", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: undefined, notes: [] }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 2,
      reason: "There are only patch changes in this release",
      releaseType: "patch",
    });
  });

  it("should handle breaking change with empty notes text", async () => {
    const commits: Commit[] = [
      createTestCommit({
        type: "feat",
        notes: [{ title: "BREAKING CHANGE", text: "" }],
      }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 0,
      reason: "There are 1 BREAKING CHANGES",
      releaseType: "major",
    });
  });

  it("should handle commit with multiple breaking change notes", async () => {
    const commits: Commit[] = [
      createTestCommit({
        type: "feat",
        notes: [
          { title: "BREAKING CHANGE", text: "first" },
          { title: "BREAKING CHANGE", text: "second" },
        ],
      }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 0,
      reason: "There are 2 BREAKING CHANGES",
      releaseType: "major",
    });
  });

  it("should recommend minor bump for mix of features and patch changes regardless of order", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: "fix", notes: [] }),
      createTestCommit({ type: "feat", notes: [] }),
      createTestCommit({ type: "chore", notes: [] }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 1,
      reason: "There are 1 new features",
      releaseType: "minor",
    });
  });

  it("should handle mix of fix and refactor as patch changes", async () => {
    const commits: Commit[] = [
      createTestCommit({ type: "fix", notes: [] }),
      createTestCommit({ type: "refactor", notes: [] }),
      createTestCommit({ type: "perf", notes: [] }),
    ];

    const result = await defaultWhatBump(commits);

    expect(result).toEqual({
      level: 2,
      reason: "There are only patch changes in this release",
      releaseType: "patch",
    });
  });
});
