/**
 * Pure display helpers for the session screen (no React, safe anywhere).
 */
import { convertWeight, formatWeight, roundToStep, segmentCount, type WeightUnit } from "@/server/domain";
import type { LastPerformanceView, SessionItem, SetTargetView, SetView } from "@/server/services/views";

/**
 * Text value for a weight input, in the input's unit ("35", "15.9"). Same
 * unit: the stored number as is (so re-saving the row never alters it).
 * Converted: rounded to 1 decimal like every other converted weight in the UI
 * (PLAN §4.5: convert, round only for display).
 */
export function weightToInput(weight: number | null, from: WeightUnit, to: WeightUnit): string {
  if (weight === null) return "";
  return formatWeight(weight, from, { displayUnit: to, withUnit: false, decimals: from === to ? 2 : 1 });
}

/** Placeholder for a weight input (last week's weight): same 1-decimal rounding as "Semana pasada". */
export function weightPlaceholder(weight: number | null, from: WeightUnit, to: WeightUnit): string {
  if (weight === null) return "—";
  return formatWeight(weight, from, { displayUnit: to, withUnit: false });
}

/** Reps of a logged set as text: "12", "5+4+3", "—". */
export function repsText(s: Pick<SetView, "reps" | "segmentReps">): string {
  if (s.segmentReps && s.segmentReps.length > 1) return s.segmentReps.join("+");
  if (s.segmentReps && s.segmentReps.length === 1) return String(s.segmentReps[0]);
  return s.reps !== null ? String(s.reps) : "—";
}

/**
 * "S2 · 35 lb × 12 · 12 · 11" (same weight) or "S2 · 35 × 12 · 40 × 10 lb".
 * Weights converted to the user's unit.
 */
export function formatLastPerformance(lp: LastPerformanceView, unit: WeightUnit): string {
  const sets = [...lp.sets].sort((a, b) => a.setNumber - b.setNumber);
  const prefix = `S${lp.weekNumber}`;
  if (sets.length === 0) return `${prefix} · sin series`;
  const weights = sets.map((s) => (s.weight === null ? null : convertWeight(s.weight, s.unit, unit)));
  const fmt = (w: number | null) => (w === null ? "—" : formatWeight(w, unit, { withUnit: false }));
  const allSame = weights.every((w) => w === weights[0]);
  if (allSame) {
    const reps = sets.map(repsText).join(" · ");
    return weights[0] === null ? `${prefix} · ${reps} reps` : `${prefix} · ${fmt(weights[0])} ${unit} × ${reps}`;
  }
  return `${prefix} · ${sets.map((s, i) => `${fmt(weights[i])} × ${repsText(s)}`).join(" · ")} ${unit}`;
}

/** Last week's set for a set number (falls back to the closest lower set, then the last one). */
export function lastSetFor(lp: LastPerformanceView | null, setNumber: number): SetView | null {
  if (!lp || lp.sets.length === 0) return null;
  const sorted = [...lp.sets].sort((a, b) => a.setNumber - b.setNumber);
  const exact = sorted.find((s) => s.setNumber === setNumber);
  if (exact) return exact;
  const lower = sorted.filter((s) => s.setNumber < setNumber);
  return lower.length ? lower[lower.length - 1] : sorted[sorted.length - 1];
}

/** Target for a set number (extra sets reuse the last target). */
export function targetFor(item: SessionItem, setNumber: number): SetTargetView | null {
  const t = item.reps.targets;
  if (t.length === 0) return null;
  return t[Math.min(setNumber, t.length) - 1];
}

/** Segments per set for this item (1 when not segmented). */
export function segmentsOf(item: SessionItem): number {
  return item.reps.scheme && item.reps.segmented ? segmentCount(item.reps.scheme) : 1;
}

/** Upper bound of set numbers the backend accepts. */
export function maxSetsOf(item: SessionItem): number {
  return item.workingSets + 2;
}

/** true when the targets differ between sets (reverse pyramid) → show per-row targets. */
export function hasPerSetTargets(item: SessionItem): boolean {
  return item.reps.scheme?.type === "per_set";
}

/** Prescribed target line: "3 × 10-12". */
export function targetLine(item: SessionItem): string {
  return `${item.workingSets} × ${item.reps.text}`;
}

/** Strip a leading "~" from an RPE text for a placeholder ("~7-8" → "7-8"). */
export function rpePlaceholder(text: string | null): string {
  if (!text || /^n\/?a$/i.test(text.trim())) return "RPE";
  return text.replace(/^~\s*/, "");
}

/** Round RPE to the nearest 0.5 (backend requires 0.5 steps). */
export function normalizeRpe(v: number): number {
  return roundToStep(v, 0.5);
}

export function slotLabel(item: SessionItem): string | null {
  if (item.slot === "weak_point_1") return "Punto débil · 1";
  if (item.slot === "weak_point_2") return "Punto débil · 2";
  return null;
}

export const CHOICE_LABEL: Record<string, string> = {
  main: "Principal",
  sub1: "Sustituto 1",
  sub2: "Sustituto 2",
};
