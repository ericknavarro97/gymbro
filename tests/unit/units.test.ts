import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUNDING,
  LB_PER_KG,
  convertWeight,
  formatWeight,
  isWeightUnit,
  kgToLb,
  lbToKg,
  roundToStep,
} from "@/server/domain/units";

describe("conversion", () => {
  it("uses 1 kg = 2.20462 lb", () => {
    expect(LB_PER_KG).toBe(2.20462);
    expect(kgToLb(1)).toBe(2.20462);
    expect(kgToLb(100)).toBeCloseTo(220.462, 6);
    expect(lbToKg(2.20462)).toBe(1);
    expect(lbToKg(45)).toBeCloseTo(20.4117, 4);
  });

  it("convertWeight is identity for same unit and reversible", () => {
    expect(convertWeight(35, "lb", "lb")).toBe(35);
    expect(convertWeight(20, "kg", "kg")).toBe(20);
    expect(convertWeight(convertWeight(135, "lb", "kg"), "kg", "lb")).toBeCloseTo(135, 4);
    expect(convertWeight(0, "kg", "lb")).toBe(0);
  });

  it("isWeightUnit", () => {
    expect(isWeightUnit("lb")).toBe(true);
    expect(isWeightUnit("kg")).toBe(true);
    expect(isWeightUnit("LB")).toBe(false);
    expect(isWeightUnit(undefined)).toBe(false);
  });
});

describe("roundToStep", () => {
  it.each([
    [37, 5, 35],
    [37.5, 5, 40],
    [21.3, 2.5, 22.5],
    [21.2, 2.5, 20],
    [0.1 + 0.2, 0.1, 0.3],
    [12.34, 0, 12.34],
    [12.34, -1, 12.34],
  ])("roundToStep(%d, %d) = %d", (v, step, out) => expect(roundToStep(v, step)).toBe(out));

  it("defaults", () => expect(DEFAULT_ROUNDING).toEqual({ lb: 5, kg: 2.5 }));
});

describe("formatWeight", () => {
  it("formats in the logged unit", () => {
    expect(formatWeight(35, "lb")).toBe("35 lb");
    expect(formatWeight(22.5, "kg")).toBe("22.5 kg");
    expect(formatWeight(22.25, "kg")).toBe("22.3 kg");
    expect(formatWeight(22.25, "kg", { decimals: 2 })).toBe("22.25 kg");
  });

  it("converts to the display unit", () => {
    expect(formatWeight(100, "kg", { displayUnit: "lb" })).toBe("220.5 lb");
    expect(formatWeight(45, "lb", { displayUnit: "kg" })).toBe("20.4 kg");
    expect(formatWeight(45, "lb", { displayUnit: "kg", step: 2.5 })).toBe("20 kg");
  });

  it("handles missing values and unit suffix", () => {
    expect(formatWeight(null, "lb")).toBe("—");
    expect(formatWeight(undefined, "kg")).toBe("—");
    expect(formatWeight(Number.NaN, "kg")).toBe("—");
    expect(formatWeight(0, "lb")).toBe("0 lb");
    expect(formatWeight(35, "lb", { withUnit: false })).toBe("35");
  });
});
