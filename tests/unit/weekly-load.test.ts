import { describe, expect, it } from "vitest";
import { formatWeight } from "@/server/domain/units";
import { weeklyTopSets, type WeeklySetLog } from "@/server/domain/weekly-load";

const s = (week: number, weight: number | null, reps: number | null, unit: "lb" | "kg" = "lb"): WeeklySetLog => ({
  week,
  weight,
  reps,
  unit,
});

describe("weeklyTopSets", () => {
  it("empty input → empty", () => {
    expect(weeklyTopSets([])).toEqual([]);
  });

  it("heaviest set per week, sorted by week", () => {
    const out = weeklyTopSets([s(2, 40, 10), s(1, 35, 12), s(1, 35, 11), s(2, 45, 8), s(1, 30, 15)]);
    expect(out).toEqual([
      { week: 1, weight: 35, unit: "lb", reps: 12 },
      { week: 2, weight: 45, unit: "lb", reps: 8 },
    ]);
  });

  it("ties on weight break by reps", () => {
    expect(weeklyTopSets([s(1, 50, 8), s(1, 50, 10), s(1, 50, 9)])[0].reps).toBe(10);
  });

  it("compares across units", () => {
    // 20 kg = 44.09 lb > 40 lb
    expect(weeklyTopSets([s(1, 40, 10, "lb"), s(1, 20, 6, "kg")])[0]).toEqual({ week: 1, weight: 20, unit: "kg", reps: 6 });
    // 45 lb > 20 kg
    expect(weeklyTopSets([s(1, 45, 6, "lb"), s(1, 20, 10, "kg")])[0]).toMatchObject({ weight: 45, unit: "lb" });
  });

  it("displayUnit converts results", () => {
    const lb = weeklyTopSets([s(1, 100, 5, "kg")], { displayUnit: "lb" })[0];
    expect(lb).toMatchObject({ week: 1, unit: "lb", reps: 5 });
    expect(lb.weight).toBeCloseTo(220.462, 3);
    expect(weeklyTopSets([s(1, 45, 5, "lb")], { displayUnit: "lb" })[0].weight).toBe(45);
  });

  it("displayUnit keeps full precision so display rounds once (180 lb → 81.6 kg, not 81.7)", () => {
    const kg = weeklyTopSets([s(1, 180, 8, "lb")], { displayUnit: "kg" })[0];
    expect(kg.unit).toBe("kg");
    expect(kg.weight).toBeCloseTo(81.6467, 3);
    expect(formatWeight(kg.weight, "kg")).toBe("81.6 kg");
    expect(formatWeight(kg.weight, "kg")).toBe(formatWeight(180, "lb", { displayUnit: "kg" }));
  });

  it("weighted sets beat bodyweight (null weight) sets; bodyweight-only weeks use reps", () => {
    expect(weeklyTopSets([s(1, null, 20), s(1, 0, 5)])[0]).toMatchObject({ weight: 0, reps: 5 });
    expect(weeklyTopSets([s(1, null, 12), s(1, null, 15)])[0]).toMatchObject({ weight: null, reps: 15 });
  });

  it("ignores empty sets; weighted set with null reps still counts", () => {
    expect(weeklyTopSets([s(1, null, null), s(2, null, 0)])).toEqual([]);
    expect(weeklyTopSets([s(1, 50, null), s(1, 45, 10)])[0]).toMatchObject({ weight: 50, reps: null });
  });

  it("covers all 10 weeks independently", () => {
    const logs = Array.from({ length: 10 }, (_, i) => s(i + 1, 100 + i * 5, 10));
    const out = weeklyTopSets(logs.reverse());
    expect(out.map((o) => o.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(out.map((o) => o.weight)).toEqual([100, 105, 110, 115, 120, 125, 130, 135, 140, 145]);
  });
});
