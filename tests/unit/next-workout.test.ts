import { describe, expect, it } from "vitest";
import {
  calendarDate,
  daysBetween,
  doneDayIdsFromLogs,
  isRestDay,
  isRestDayFromHistory,
  nextWorkout,
  programProgress,
  sortDays,
  type WorkoutDayRef,
} from "@/server/domain/next-workout";

// 2 weeks × 5 days, rest after days 2 and 5 (like the PDF)
const days: WorkoutDayRef[] = [];
for (let week = 1; week <= 2; week++)
  for (let position = 1; position <= 5; position++)
    days.push({ id: `w${week}d${position}`, week, position, restAfter: position === 2 || position === 5 });

describe("nextWorkout", () => {
  it("first day when nothing done", () => {
    expect(nextWorkout(days, [])?.id).toBe("w1d1");
  });

  it("first not-done day in week → position order, regardless of input order", () => {
    const shuffled = [...days].reverse();
    expect(nextWorkout(shuffled, ["w1d1", "w1d2"])?.id).toBe("w1d3");
    expect(nextWorkout(shuffled, ["w1d1", "w1d2", "w1d3", "w1d4", "w1d5"])?.id).toBe("w2d1");
  });

  it("gaps: an earlier undone day comes first", () => {
    expect(nextWorkout(days, ["w1d1", "w1d3", "w1d4"])?.id).toBe("w1d2");
  });

  it("null when the program is finished", () => {
    expect(nextWorkout(days, days.map((d) => d.id))).toBeNull();
    expect(nextWorkout([], [])).toBeNull();
  });

  it("numeric ids and Set input", () => {
    const numeric = [
      { id: 2, week: 1, position: 2 },
      { id: 1, week: 1, position: 1 },
    ];
    expect(nextWorkout(numeric, new Set([1]))?.id).toBe(2);
  });

  it("doneDayIdsFromLogs counts completed and skipped, not in_progress", () => {
    const done = doneDayIdsFromLogs([
      { workoutDayId: "w1d1", status: "completed" },
      { workoutDayId: "w1d2", status: "skipped" },
      { workoutDayId: "w1d3", status: "in_progress" },
    ]);
    expect([...done]).toEqual(["w1d1", "w1d2"]);
    expect(nextWorkout(days, done)?.id).toBe("w1d3");
  });

  it("sortDays does not mutate", () => {
    const input = [days[3], days[0]];
    expect(sortDays(input).map((d) => d.id)).toEqual(["w1d1", "w1d4"]);
    expect(input[0].id).toBe("w1d4");
  });

  it("programProgress", () => {
    expect(programProgress(days, ["w1d1", "w1d2", "nope"])).toEqual({ done: 2, total: 10, ratio: 0.2 });
    expect(programProgress([], [])).toEqual({ done: 0, total: 0, ratio: 0 });
  });
});

describe("dates", () => {
  it("calendarDate respects the time zone", () => {
    const instant = new Date("2026-10-22T03:00:00Z");
    expect(calendarDate(instant, "UTC")).toBe("2026-10-22");
    expect(calendarDate(instant, "America/Mexico_City")).toBe("2026-10-21");
  });

  it("daysBetween", () => {
    expect(daysBetween("2026-10-21", "2026-10-22")).toBe(1);
    expect(daysBetween("2026-10-22", "2026-10-22")).toBe(0);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2); // across DST
  });
});

describe("isRestDay", () => {
  const tz = "UTC";
  const now = new Date("2026-10-22T12:00:00Z");

  it("rest_after completed today or yesterday → true", () => {
    expect(isRestDay({ restAfter: true, completedAt: new Date("2026-10-22T07:00:00Z") }, now, tz)).toBe(true);
    expect(isRestDay({ restAfter: true, completedAt: new Date("2026-10-21T23:59:00Z") }, now, tz)).toBe(true);
  });

  it("older than yesterday → false", () => {
    expect(isRestDay({ restAfter: true, completedAt: new Date("2026-10-20T23:59:00Z") }, now, tz)).toBe(false);
  });

  it("no rest_after or nothing completed → false", () => {
    expect(isRestDay({ restAfter: false, completedAt: new Date("2026-10-22T07:00:00Z") }, now, tz)).toBe(false);
    expect(isRestDay(null, now, tz)).toBe(false);
    expect(isRestDay(undefined, now, tz)).toBe(false);
  });

  it("future completedAt (clock skew) → false", () => {
    expect(isRestDay({ restAfter: true, completedAt: new Date("2026-10-23T07:00:00Z") }, now, tz)).toBe(false);
  });

  it("uses the time zone for calendar boundaries", () => {
    // 2026-10-20 23:00 in Mexico City is 2026-10-21 05:00Z; now is 10-22 06:00 local
    const completedAt = new Date("2026-10-21T05:00:00Z");
    expect(isRestDay({ restAfter: true, completedAt }, now, "America/Mexico_City")).toBe(false);
    expect(isRestDay({ restAfter: true, completedAt }, now, "UTC")).toBe(true);
  });

  it("isRestDayFromHistory picks the latest completion", () => {
    const history = [
      { restAfter: true, completedAt: new Date("2026-10-19T10:00:00Z") },
      { restAfter: false, completedAt: new Date("2026-10-22T08:00:00Z") },
      { restAfter: true, completedAt: new Date("2026-10-21T10:00:00Z") },
    ];
    expect(isRestDayFromHistory(history, now, tz)).toBe(false);
    expect(isRestDayFromHistory(history.slice(2), now, tz)).toBe(true);
    expect(isRestDayFromHistory([], now, tz)).toBe(false);
  });
});
