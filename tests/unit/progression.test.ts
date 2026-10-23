import { describe, expect, it } from "vitest";
import { setReachedTop, suggestProgression, type PerformedSet } from "@/server/domain/progression";
import { parseReps } from "@/server/domain/reps-scheme";

const sets = (...reps: Array<number | null>): PerformedSet[] => reps.map((r, i) => ({ setNumber: i + 1, reps: r }));

describe("suggestProgression — fixed", () => {
  it.each([
    ["8", [8, 8, 8], "increase"],
    ["8", [9, 8], "increase"],
    ["8", [8, 7], "hold"],
    ["10", [10, 10], "increase"],
    ["10", [10, 9, 10], "hold"],
  ] as const)("%j with %j → %s", (text, reps, expected) => {
    expect(suggestProgression({ scheme: parseReps(text), lastSets: sets(...reps) })).toBe(expected);
  });
});

describe("suggestProgression — ranges (top of range)", () => {
  it.each([
    ["8-10", [10, 10], "increase"],
    ["8-10", [10, 9], "hold"],
    ["10-12", [12, 12, 13], "increase"],
    ["10-12", [12, 11], "hold"],
    ["10-15", [15, 15], "increase"],
    ["10-15", [14, 15], "hold"],
    ["12-15", [15], "increase"],
    ["12-15", [12], "hold"],
    ["8-12", [12, 12], "increase"],
    ["8-12", [10, 12], "hold"],
    ["10-20", [20, 20], "increase"],
    ["10-20", [19, 20], "hold"],
  ] as const)("%j with %j → %s", (text, reps, expected) => {
    expect(suggestProgression({ scheme: parseReps(text), lastSets: sets(...reps) })).toBe(expected);
  });
});

describe("suggestProgression — per_set (reverse pyramid) evaluates set 1 only", () => {
  it.each([
    ["4, 6, 8", [4, 5, 6], "increase"],
    ["4, 6, 8", [3, 6, 8], "hold"],
    ["4, 6, 8", [5, 1, 1], "increase"],
    ["4, 6", [4, 2], "increase"],
    ["4, 6", [3, 9], "hold"],
  ] as const)("%j with %j → %s", (text, reps, expected) => {
    expect(suggestProgression({ scheme: parseReps(text), lastSets: sets(...reps) })).toBe(expected);
  });

  it("null when set 1 was not logged", () => {
    const lastSets: PerformedSet[] = [{ setNumber: 2, reps: 6 }];
    expect(suggestProgression({ scheme: parseReps("4, 6, 8"), lastSets })).toBeNull();
  });

  it("ignores workingSets for per_set", () => {
    expect(suggestProgression({ scheme: parseReps("4, 6, 8"), lastSets: sets(4), workingSets: 3 })).toBe("increase");
  });
});

describe("suggestProgression — segmented schemes", () => {
  const drop = parseReps("5,4,3+");
  const comp = parseReps("8-10 + 4-6");

  it("mechanical dropset: every segment reached (open last segment at its min)", () => {
    expect(
      suggestProgression({ scheme: drop, lastSets: [{ setNumber: 1, reps: null, segmentReps: [5, 4, 3] }] }),
    ).toBe("increase");
    expect(
      suggestProgression({ scheme: drop, lastSets: [{ setNumber: 1, reps: null, segmentReps: [5, 4, 6] }] }),
    ).toBe("increase");
    expect(
      suggestProgression({ scheme: drop, lastSets: [{ setNumber: 1, reps: null, segmentReps: [5, 3, 6] }] }),
    ).toBe("hold");
    expect(
      suggestProgression({ scheme: drop, lastSets: [{ setNumber: 1, reps: null, segmentReps: [5, 4] }] }),
    ).toBe("hold");
  });

  it("compound: main and finisher at top", () => {
    const mk = (seg: number[]): PerformedSet[] => [
      { setNumber: 1, reps: null, segmentReps: seg },
      { setNumber: 2, reps: null, segmentReps: seg },
    ];
    expect(suggestProgression({ scheme: comp, lastSets: mk([10, 6]) })).toBe("increase");
    expect(suggestProgression({ scheme: comp, lastSets: mk([10, 5]) })).toBe("hold");
    expect(suggestProgression({ scheme: comp, lastSets: mk([9, 6]) })).toBe("hold");
  });

  it("segmented set without segmentReps falls back to reps for segment 1 only → hold", () => {
    expect(suggestProgression({ scheme: comp, lastSets: [{ setNumber: 1, reps: 10 }] })).toBe("hold");
    expect(setReachedTop(comp, { setNumber: 1, reps: 10 })).toBe(false);
  });
});

describe("suggestProgression — general rules", () => {
  it("no data → null", () => {
    expect(suggestProgression({ scheme: parseReps("8-10"), lastSets: [] })).toBeNull();
    expect(suggestProgression({ scheme: parseReps("8-10"), lastSets: sets(null, null) })).toBeNull();
  });

  it("unlogged sets are ignored", () => {
    expect(suggestProgression({ scheme: parseReps("8-10"), lastSets: sets(10, null) })).toBe("increase");
  });

  it("fewer sets than prescribed → hold", () => {
    expect(suggestProgression({ scheme: parseReps("8-10"), lastSets: sets(10), workingSets: 2 })).toBe("hold");
    expect(suggestProgression({ scheme: parseReps("8-10"), lastSets: sets(10, 10), workingSets: 2 })).toBe("increase");
  });

  it("deload week never suggests increase", () => {
    for (const text of ["8", "8-10", "4, 6, 8", "5,4,3+", "8-10 + 4-6"]) {
      const scheme = parseReps(text);
      const lastSets: PerformedSet[] = [{ setNumber: 1, reps: 99, segmentReps: [99, 99, 99] }];
      expect(suggestProgression({ scheme, lastSets })).toBe("increase");
      expect(suggestProgression({ scheme, lastSets, isDeload: true })).toBe("hold");
    }
  });

  it("unsorted input is fine", () => {
    const lastSets: PerformedSet[] = [
      { setNumber: 3, reps: 1 },
      { setNumber: 1, reps: 4 },
    ];
    expect(suggestProgression({ scheme: parseReps("4, 6, 8"), lastSets })).toBe("increase");
  });
});
