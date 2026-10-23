import { describe, expect, it } from "vitest";
import {
  formatRepsScheme,
  formatSetTarget,
  isSegmented,
  parseReps,
  segmentCount,
  targetForSet,
  tryParseReps,
  type RepsScheme,
} from "@/server/domain/reps-scheme";
import { DomainParseError } from "@/server/domain/text";

const CLOSED_SET: Array<[string, RepsScheme]> = [
  ["8", { type: "fixed", reps: 8 }],
  ["10", { type: "fixed", reps: 10 }],
  ["8-10", { type: "range", min: 8, max: 10 }],
  ["10-12", { type: "range", min: 10, max: 12 }],
  ["10-15", { type: "range", min: 10, max: 15 }],
  ["12-15", { type: "range", min: 12, max: 15 }],
  ["8-12", { type: "range", min: 8, max: 12 }],
  ["10-20", { type: "range", min: 10, max: 20 }],
  ["4, 6, 8", { type: "per_set", targets: [4, 6, 8] }],
  ["4, 6", { type: "per_set", targets: [4, 6] }],
  ["5,4,3+", { type: "mechanical_dropset", segments: [5, 4, 3], lastOpen: true }],
  [
    "8-10 + 4-6",
    { type: "compound", main: { min: 8, max: 10 }, finisher: { min: 4, max: 6 }, finisherLabel: "finisher" },
  ],
];

describe("parseReps — closed set from the PDF", () => {
  it.each(CLOSED_SET)("parses %j", (text, expected) => {
    expect(parseReps(text)).toEqual(expected);
  });

  it.each(CLOSED_SET)("round-trips %j through formatRepsScheme", (text) => {
    expect(parseReps(formatRepsScheme(parseReps(text)))).toEqual(parseReps(text));
  });

  it("canonical formatting", () => {
    expect(formatRepsScheme(parseReps("4,6,8"))).toBe("4, 6, 8");
    expect(formatRepsScheme(parseReps("5, 4, 3+"))).toBe("5,4,3+");
    expect(formatRepsScheme(parseReps("8-10+4-6"))).toBe("8-10 + 4-6");
    expect(formatRepsScheme(parseReps("10-12"))).toBe("10-12");
  });
});

describe("parseReps — tolerant input", () => {
  it.each([
    [" 8 ", { type: "fixed", reps: 8 }],
    ["8–10", { type: "range", min: 8, max: 10 }],
    ["8 - 10", { type: "range", min: 8, max: 10 }],
    ["4,6,8", { type: "per_set", targets: [4, 6, 8] }],
    ["4 ,  6", { type: "per_set", targets: [4, 6] }],
    ["5, 4, 3 +", { type: "mechanical_dropset", segments: [5, 4, 3], lastOpen: true }],
    ["8-10+4-6", { type: "compound", main: { min: 8, max: 10 }, finisher: { min: 4, max: 6 }, finisherLabel: "finisher" }],
    ["10 + 5", { type: "compound", main: { min: 10, max: 10 }, finisher: { min: 5, max: 5 }, finisherLabel: "finisher" }],
  ] as Array<[string, RepsScheme]>)("parses %j", (text, expected) => {
    expect(parseReps(text)).toEqual(expected);
  });

  it("accepts a custom finisher label", () => {
    const s = parseReps("8-10 + 4-6", { finisherLabel: "partials" });
    expect(s).toMatchObject({ type: "compound", finisherLabel: "partials" });
  });
});

describe("parseReps — invalid input", () => {
  it.each(["", "  ", "abc", "0", "10-8", "0-5", "8-", "-8", "4,,6", "4, 6,", "3+, 4", "5,a,3+", "8-10 +", "+ 4-6", "8 + 4 + 2", "N/A", "8.5", "4, 0"])(
    "rejects %j",
    (text) => {
      expect(tryParseReps(text)).toBeNull();
      expect(() => parseReps(text)).toThrow(DomainParseError);
    },
  );
});

describe("targetForSet", () => {
  it("fixed", () => {
    const t = targetForSet(parseReps("8"), 3);
    expect(t).toEqual({ setNumber: 3, segmented: false, segments: [{ min: 8, max: 8 }] });
    expect(formatSetTarget(t)).toBe("8");
  });

  it("range", () => {
    const t = targetForSet(parseReps("10-12"), 1);
    expect(t.segments).toEqual([{ min: 10, max: 12 }]);
    expect(formatSetTarget(t)).toBe("10-12");
  });

  it("per_set uses the set index and clamps beyond the list", () => {
    const s = parseReps("4, 6, 8");
    expect(targetForSet(s, 1).segments[0]).toEqual({ min: 4, max: 4 });
    expect(targetForSet(s, 2).segments[0]).toEqual({ min: 6, max: 6 });
    expect(targetForSet(s, 3).segments[0]).toEqual({ min: 8, max: 8 });
    expect(targetForSet(s, 4).segments[0]).toEqual({ min: 8, max: 8 });
    expect(formatSetTarget(targetForSet(parseReps("4, 6"), 2))).toBe("6");
  });

  it("mechanical dropset: last segment open", () => {
    const t = targetForSet(parseReps("5,4,3+"), 1);
    expect(t.segmented).toBe(true);
    expect(t.segments).toEqual([
      { min: 5, max: 5 },
      { min: 4, max: 4 },
      { min: 3, max: null },
    ]);
    expect(formatSetTarget(t)).toBe("5 / 4 / 3+");
  });

  it("compound: main + labelled finisher", () => {
    const t = targetForSet(parseReps("8-10 + 4-6"), 2);
    expect(t.segments).toEqual([
      { min: 8, max: 10 },
      { min: 4, max: 6, label: "finisher" },
    ]);
    expect(formatSetTarget(t)).toBe("8-10 + 4-6");
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects setNumber %s", (n) => {
    expect(() => targetForSet(parseReps("8"), n)).toThrow(RangeError);
  });
});

describe("isSegmented / segmentCount", () => {
  it.each([
    ["8", false, 1],
    ["8-10", false, 1],
    ["4, 6, 8", false, 1],
    ["5,4,3+", true, 3],
    ["8-10 + 4-6", true, 2],
  ] as const)("%j → segmented=%s count=%i", (text, seg, count) => {
    expect(isSegmented(parseReps(text))).toBe(seg);
    expect(segmentCount(parseReps(text))).toBe(count);
  });
});
