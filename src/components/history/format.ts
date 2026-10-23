/** Display helpers for history screens. Pure: safe in server and client components. */
import { formatWeight, type WeightUnit } from "@/server/domain/units";

export interface LoggedSet {
  setNumber: number;
  weight: number | null;
  unit: WeightUnit;
  reps: number | null;
  rpe?: number | null;
  segmentReps?: number[] | null;
}

const DEFAULT_TZ = "America/Mexico_City";

/** "mié 22 oct" (es-MX). */
export function formatShortDate(iso: string | null, timeZone = DEFAULT_TZ): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone })
    .format(new Date(iso))
    .replace(/\./g, "")
    .replace(",", "")
    .replace(/ de /g, " ");
}

/** "22 oct 2026" (es-MX). */
export function formatDate(iso: string | null, timeZone = DEFAULT_TZ): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone })
    .format(new Date(iso))
    .replace(/\./g, "");
}

/** "miércoles, 22 de octubre de 2026". */
export function formatLongDate(iso: string | null, timeZone = DEFAULT_TZ): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeZone }).format(new Date(iso));
}

/** "octubre de 2026" — month key for grouping lists. */
export function formatMonth(iso: string, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone }).format(new Date(iso));
}

/** "18:42". */
export function formatTime(iso: string | null, timeZone = DEFAULT_TZ): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(
    new Date(iso),
  );
}

export function repsText(s: Pick<LoggedSet, "reps" | "segmentReps">): string {
  if (s.segmentReps && s.segmentReps.length > 1) return s.segmentReps.join("+");
  return s.reps === null || s.reps === undefined ? "—" : String(s.reps);
}

export function setWeightText(s: Pick<LoggedSet, "weight" | "unit">, displayUnit: WeightUnit): string | null {
  return s.weight === null ? null : formatWeight(s.weight, s.unit, { displayUnit });
}

/**
 * Compact line for a session's sets, grouping consecutive sets with the same
 * weight: "35 lb × 12·12·11", "40 lb × 10 · 35 lb × 12", "12·10 reps" (no weight).
 */
export function formatSetsLine(sets: readonly LoggedSet[], displayUnit: WeightUnit): string {
  const sorted = [...sets].sort((a, b) => a.setNumber - b.setNumber);
  const groups: { weight: string | null; reps: string[] }[] = [];
  for (const s of sorted) {
    const w = setWeightText(s, displayUnit);
    const last = groups.at(-1);
    if (last && last.weight === w) last.reps.push(repsText(s));
    else groups.push({ weight: w, reps: [repsText(s)] });
  }
  return groups
    .map((g) => (g.weight ? `${g.weight} × ${g.reps.join("·")}` : `${g.reps.join("·")} reps`))
    .join(" · ");
}
