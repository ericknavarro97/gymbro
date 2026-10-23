/** Weight units (PLAN §4.5): 1 kg = 2.20462 lb. Stored values keep their unit; convert for display. */

export type WeightUnit = "lb" | "kg";

export const LB_PER_KG = 2.20462;

export const DEFAULT_ROUNDING: Readonly<Record<WeightUnit, number>> = { lb: 5, kg: 2.5 };

export function isWeightUnit(value: unknown): value is WeightUnit {
  return value === "lb" || value === "kg";
}

/** Remove binary floating noise (e.g. 0.1 + 0.2). */
function clean(n: number, decimals = 6): number {
  return Number(n.toFixed(decimals));
}

export function kgToLb(kg: number): number {
  return clean(kg * LB_PER_KG);
}

export function lbToKg(lb: number): number {
  return clean(lb / LB_PER_KG);
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === "kg" ? kgToLb(value) : lbToKg(value);
}

/** Round to the nearest multiple of `step` (step <= 0 → unchanged). */
export function roundToStep(value: number, step: number): number {
  if (!(step > 0)) return value;
  return clean(Math.round(value / step) * step);
}

export interface FormatWeightOptions {
  /** Unit to display in; converts if different from `unit`. Default: `unit`. */
  displayUnit?: WeightUnit;
  /** Max decimals shown (trailing zeros removed). Default 1. */
  decimals?: number;
  /** Round to this step before formatting (e.g. 2.5). */
  step?: number;
  /** Append the unit (" lb"). Default true. */
  withUnit?: boolean;
}

/** "35 lb", "15.9 kg"; null/undefined → "—". */
export function formatWeight(
  value: number | null | undefined,
  unit: WeightUnit,
  options: FormatWeightOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const displayUnit = options.displayUnit ?? unit;
  let v = convertWeight(value, unit, displayUnit);
  if (options.step !== undefined) v = roundToStep(v, options.step);
  const decimals = options.decimals ?? 1;
  const text = `${Number(v.toFixed(decimals))}`;
  return options.withUnit === false ? text : `${text} ${displayUnit}`;
}
