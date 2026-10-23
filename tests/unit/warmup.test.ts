import { describe, expect, it } from "vitest";
import { DomainParseError } from "@/server/domain/text";
import {
  DEFAULT_WARMUP_PROTOCOL,
  computeWarmupSets,
  parseWarmupSets,
  warmupSetsToPerform,
} from "@/server/domain/warmup";

const CLOSED_SET = [
  ["0", 0, 0, 0, false],
  ["1", 1, 1, 1, false],
  ["1-2", 1, 2, 2, false],
  ["1-3", 1, 3, 3, false],
  ["2", 2, 2, 2, false],
  ["2-3", 2, 3, 3, false],
  ["2-4", 2, 4, 3, true],
] as const;

describe("parseWarmupSets", () => {
  it.each(CLOSED_SET)("%j → {%i, %i}", (text, min, max) => {
    expect(parseWarmupSets(text)).toEqual({ min, max });
  });

  it.each(CLOSED_SET)("%j → perform %i sets (extra=%s)", (text, _min, _max, count, extra) => {
    expect(warmupSetsToPerform(parseWarmupSets(text))).toEqual({ count, extraSetSuggested: extra });
  });

  it("tolerates whitespace and dashes", () => {
    expect(parseWarmupSets(" 2 – 4 ")).toEqual({ min: 2, max: 4 });
  });

  it.each(["", "N/A", "a", "3-1", "1-", "-1", "1.5"])("rejects %j", (text) => {
    expect(() => parseWarmupSets(text)).toThrow(DomainParseError);
  });
});

describe("computeWarmupSets", () => {
  it("1 set: 60% × 6-10", () => {
    expect(computeWarmupSets(100, 1, "lb")).toEqual({
      extraSetSuggested: false,
      sets: [{ setNumber: 1, pctOfWorking: 60, repsText: "6-10", weight: 60, unit: "lb" }],
    });
  });

  it("2 sets: 50/70", () => {
    const plan = computeWarmupSets(100, 2, "lb");
    expect(plan.sets.map((s) => [s.pctOfWorking, s.repsText, s.weight])).toEqual([
      [50, "6-10", 50],
      [70, "4-6", 70],
    ]);
  });

  it("3 sets: 45/65/85 rounded to 5 lb", () => {
    const plan = computeWarmupSets(135, 3, "lb");
    // 60.75 → 60, 87.75 → 90, 114.75 → 115
    expect(plan.sets.map((s) => [s.pctOfWorking, s.repsText, s.weight])).toEqual([
      [45, "6-10", 60],
      [65, "4-6", 90],
      [85, "3-4", 115],
    ]);
    expect(plan.extraSetSuggested).toBe(false);
  });

  it("4 sets (from '2-4'): 3-set protocol + extra flag", () => {
    const plan = computeWarmupSets(100, 4, "lb");
    expect(plan.sets).toHaveLength(3);
    expect(plan.sets.map((s) => s.pctOfWorking)).toEqual([45, 65, 85]);
    expect(plan.extraSetSuggested).toBe(true);
  });

  it("rounds to 2.5 kg by default for kg", () => {
    const plan = computeWarmupSets(60, 3, "kg");
    // 27 → 27.5, 39 → 40, 51 → 50
    expect(plan.sets.map((s) => s.weight)).toEqual([27.5, 40, 50]);
    expect(plan.sets.every((s) => s.unit === "kg")).toBe(true);
  });

  it("custom rounding", () => {
    expect(computeWarmupSets(100, 3, "lb", 2.5).sets.map((s) => s.weight)).toEqual([45, 65, 85]);
    expect(computeWarmupSets(61, 1, "kg", 1).sets[0].weight).toBe(37);
    expect(computeWarmupSets(61, 1, "kg", 0).sets[0].weight).toBe(36.6);
  });

  it("0 sets → empty", () => {
    expect(computeWarmupSets(100, 0, "lb")).toEqual({ sets: [], extraSetSuggested: false });
    expect(computeWarmupSets(100, -1, "lb")).toEqual({ sets: [], extraSetSuggested: false });
    expect(computeWarmupSets(100, Number.NaN, "lb")).toEqual({ sets: [], extraSetSuggested: false });
  });

  it("no working weight → percentages with null weights", () => {
    for (const w of [null, 0, -5, Number.NaN]) {
      const plan = computeWarmupSets(w, 2, "lb");
      expect(plan.sets).toHaveLength(2);
      expect(plan.sets.every((s) => s.weight === null)).toBe(true);
    }
  });

  it("accepts a protocol from the DB", () => {
    const protocol = { ...DEFAULT_WARMUP_PROTOCOL, 1: [{ setNumber: 1, pctOfWorking: 50, repsText: "8" }] };
    expect(computeWarmupSets(100, 1, "lb", 5, protocol).sets[0]).toMatchObject({ weight: 50, repsText: "8" });
  });

  it("every closed-set warmup value computes", () => {
    for (const [text, , , count, extra] of CLOSED_SET) {
      const range = parseWarmupSets(text);
      const plan = computeWarmupSets(200, range.max, "lb");
      expect(plan.sets).toHaveLength(count);
      expect(plan.extraSetSuggested).toBe(extra);
      expect(plan.sets.every((s) => s.weight! % 5 === 0 && s.weight! < 200)).toBe(true);
    }
  });
});
