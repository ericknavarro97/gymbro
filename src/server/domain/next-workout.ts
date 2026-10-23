/**
 * Next session (PLAN §4.1): first workout day (week → position) without a
 * completed/skipped log. Rest-day hint is informative only.
 */

export type DayId = string | number;

export interface WorkoutDayRef {
  id: DayId;
  week: number;
  position: number;
  restAfter?: boolean;
}

export type WorkoutLogStatus = "in_progress" | "completed" | "skipped";

export function compareDays(a: WorkoutDayRef, b: WorkoutDayRef): number {
  return a.week - b.week || a.position - b.position;
}

/** Days sorted by week then position (does not mutate the input). */
export function sortDays<T extends WorkoutDayRef>(days: readonly T[]): T[] {
  return [...days].sort(compareDays);
}

/**
 * @param days the program's workout days (any order; sorted internally)
 * @param doneDayIds ids of days with a `completed` or `skipped` log
 * @returns the next day, or null when the whole program is done
 */
export function nextWorkout<T extends WorkoutDayRef>(
  days: readonly T[],
  doneDayIds: Iterable<DayId>,
): T | null {
  const done = new Set<DayId>(doneDayIds);
  return sortDays(days).find((d) => !done.has(d.id)) ?? null;
}

/** Convenience: build the done-set from a status map/list. */
export function doneDayIdsFromLogs(
  logs: Iterable<{ workoutDayId: DayId; status: WorkoutLogStatus }>,
): Set<DayId> {
  const out = new Set<DayId>();
  for (const l of logs) if (l.status === "completed" || l.status === "skipped") out.add(l.workoutDayId);
  return out;
}

export interface ProgramProgress {
  done: number;
  total: number;
  /** 0..1 */
  ratio: number;
}

export function programProgress(days: readonly WorkoutDayRef[], doneDayIds: Iterable<DayId>): ProgramProgress {
  const done = new Set<DayId>(doneDayIds);
  const count = days.filter((d) => done.has(d.id)).length;
  return { done: count, total: days.length, ratio: days.length === 0 ? 0 : count / days.length };
}

/** Calendar date "YYYY-MM-DD" of an instant in a time zone (default: runtime local). */
export function calendarDate(instant: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Whole calendar days between two "YYYY-MM-DD" strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export interface CompletedDay {
  restAfter: boolean;
  completedAt: Date;
}

/**
 * Rest hint: the most recently completed workout has `restAfter` and was completed
 * today or yesterday (calendar days in `timeZone`). Informative only — never blocks.
 */
export function isRestDay(
  lastCompleted: CompletedDay | null | undefined,
  now: Date,
  timeZone?: string,
): boolean {
  if (!lastCompleted || !lastCompleted.restAfter) return false;
  const diff = daysBetween(calendarDate(lastCompleted.completedAt, timeZone), calendarDate(now, timeZone));
  return diff === 0 || diff === 1;
}

/** Picks the latest completed entry, then applies {@link isRestDay}. */
export function isRestDayFromHistory(
  completed: readonly CompletedDay[],
  now: Date,
  timeZone?: string,
): boolean {
  let latest: CompletedDay | null = null;
  for (const c of completed) if (!latest || c.completedAt > latest.completedAt) latest = c;
  return isRestDay(latest, now, timeZone);
}
