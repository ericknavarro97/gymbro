/**
 * Weekly load (PLAN §3.3 "Carga por semana"): per program week, the top set of an
 * exercise = heaviest weight (compared across units), ties broken by more reps.
 * Sets without weight only count when the week has no weighted set (bodyweight work).
 */
import { convertWeight, type WeightUnit } from "./units";

export interface WeeklySetLog {
  week: number;
  weight: number | null;
  unit: WeightUnit;
  reps: number | null;
}

export interface WeeklyTopSet {
  week: number;
  weight: number | null;
  unit: WeightUnit;
  reps: number | null;
}

export interface WeeklyLoadOptions {
  /**
   * Convert every result to this unit, at full precision (callers round once for display,
   * e.g. formatWeight; pre-rounding here caused double rounding: 81.6466 → 81.65 → 81.7).
   * Default: keep the logged unit.
   */
  displayUnit?: WeightUnit;
}

function isBetter(a: WeeklySetLog, b: WeeklySetLog): boolean {
  if (a.weight !== null && b.weight === null) return true;
  if (a.weight === null && b.weight !== null) return false;
  if (a.weight !== null && b.weight !== null) {
    const aKg = convertWeight(a.weight, a.unit, "kg");
    const bKg = convertWeight(b.weight, b.unit, "kg");
    if (Math.abs(aKg - bKg) > 1e-6) return aKg > bKg;
  }
  return (a.reps ?? -1) > (b.reps ?? -1);
}

/** Top set per week, sorted by week ascending. Sets with neither weight nor reps are ignored. */
export function weeklyTopSets(
  sets: readonly WeeklySetLog[],
  options: WeeklyLoadOptions = {},
): WeeklyTopSet[] {
  const best = new Map<number, WeeklySetLog>();
  for (const s of sets) {
    if (s.weight === null && s.reps === null) continue;
    if (s.reps !== null && s.reps <= 0 && s.weight === null) continue;
    const cur = best.get(s.week);
    if (!cur || isBetter(s, cur)) best.set(s.week, s);
  }
  return [...best.values()]
    .sort((a, b) => a.week - b.week)
    .map((s) => {
      if (!options.displayUnit || s.weight === null) {
        return { week: s.week, weight: s.weight, unit: options.displayUnit ?? s.unit, reps: s.reps };
      }
      return {
        week: s.week,
        weight: convertWeight(s.weight, s.unit, options.displayUnit),
        unit: options.displayUnit,
        reps: s.reps,
      };
    });
}
