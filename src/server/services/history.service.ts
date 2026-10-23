/** Exercise detail/history and completed-workout history (PLAN §5 /ejercicios, /historial). */
import { weeklyTopSets, type WeeklyTopSet, type WeightUnit } from "../domain";
import { getExerciseBySlug } from "../repositories/exercise.repo";
import * as logs from "../repositories/logs.repo";
import { getSettings } from "../repositories/settings.repo";
import { notFound } from "./errors";
import { z } from "zod";
import {
  exerciseHistoryOptionsSchema,
  parseInput,
  slugSchema,
  uuidSchema,
  type ExerciseHistoryOptions,
} from "./validation";
import { toExerciseDetail, type ExerciseDetailView, type SetView } from "./views";
import type { WorkoutLogStatus } from "../db/schema";

/** Catalog data for /ejercicios/[slug]. Throws NOT_FOUND for unknown slugs. */
export async function getExerciseDetail(slug: string): Promise<ExerciseDetailView> {
  const s = parseInput(slugSchema, slug);
  const e = await getExerciseBySlug(s);
  if (!e) throw notFound("Ejercicio");
  return toExerciseDetail(e);
}

export interface ExerciseHistorySession {
  workoutLogId: string;
  runId: string;
  status: WorkoutLogStatus;
  startedAt: string;
  completedAt: string | null;
  weekNumber: number;
  dayPosition: number;
  dayName: string;
  prescriptionId: number;
  sets: Omit<SetView, "updatedAt">[];
}

export interface ExerciseHistory {
  exercise: { id: number; slug: string; name: string };
  /** Unit weights in `weekly` are expressed in (user's unit unless overridden). */
  unit: WeightUnit;
  /**
   * Run the weekly chart covers: the requested one; else the active (or latest) run; and when
   * that run has no data for this exercise (e.g. right after "Reiniciar programa"), the most
   * recent earlier run that has. Null if the user has no runs.
   */
  runId: string | null;
  /**
   * True when `weekly` falls back to an earlier run because the active/latest run has no data
   * for this exercise yet (UI labels it "Ciclo anterior"). Always false when `runId` was requested.
   */
  weeklyFromPreviousRun: boolean;
  /** Top set per program week for `runId` (weeklyTopSets domain fn). */
  weekly: WeeklyTopSet[];
  /** Every non-skipped session with saved sets for this exercise, all runs, newest first. */
  sessions: ExerciseHistorySession[];
}

export async function getExerciseHistory(
  userId: string,
  slug: string,
  options: ExerciseHistoryOptions = {},
): Promise<ExerciseHistory> {
  const s = parseInput(slugSchema, slug);
  const opts = parseInput(exerciseHistoryOptionsSchema, options);
  const e = await getExerciseBySlug(s);
  if (!e) throw notFound("Ejercicio");
  const settings = await getSettings(userId);
  const unit: WeightUnit = opts.displayUnit ?? settings?.weightUnit ?? "lb";

  let runId: string | null = null;
  if (opts.runId) {
    const r = await logs.getRunForUser(userId, opts.runId);
    if (!r) throw notFound("Programa");
    runId = r.id;
  } else {
    runId = (await logs.getCurrentOrLatestRun(userId))?.id ?? null;
  }

  const rows = await logs.listExerciseHistorySets(userId, e.id);
  const sessions: ExerciseHistorySession[] = [];
  const byLog = new Map<string, ExerciseHistorySession>();
  for (const r of rows) {
    let sess = byLog.get(r.exerciseLogId);
    if (!sess) {
      sess = {
        workoutLogId: r.workoutLogId,
        runId: r.runId,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        weekNumber: r.weekNumber,
        dayPosition: r.dayPosition,
        dayName: r.dayName,
        prescriptionId: r.prescriptionId,
        sets: [],
      };
      byLog.set(r.exerciseLogId, sess);
      sessions.push(sess);
    }
    sess.sets.push({
      setNumber: r.setNumber,
      weight: r.weight,
      unit: r.weightUnit,
      reps: r.reps,
      rpe: r.rpe,
      segmentReps: r.segmentReps,
    });
  }

  const weeklyFor = (id: string) =>
    weeklyTopSets(
      rows
        .filter((r) => r.runId === id)
        .map((r) => ({ week: r.weekNumber, weight: r.weight, unit: r.weightUnit, reps: r.reps })),
      { displayUnit: unit },
    );

  let weekly = runId ? weeklyFor(runId) : [];
  let weeklyFromPreviousRun = false;
  if (!opts.runId && weekly.length === 0) {
    // Rows are newest session first, so the first other run with chartable data is the latest one.
    const tried = new Set(runId ? [runId] : []);
    for (const r of rows) {
      if (tried.has(r.runId)) continue;
      tried.add(r.runId);
      const w = weeklyFor(r.runId);
      if (w.length > 0) {
        runId = r.runId;
        weekly = w;
        weeklyFromPreviousRun = true;
        break;
      }
    }
  }

  return {
    exercise: { id: e.id, slug: e.slug, name: e.name },
    unit,
    runId,
    weeklyFromPreviousRun,
    weekly,
    sessions,
  };
}

export interface HistoryEntry {
  workoutLogId: string;
  runId: string;
  workoutDayId: number;
  /** "completed", or "skipped" when requested with `includeSkipped`. */
  status: WorkoutLogStatus;
  startedAt: string;
  completedAt: string | null;
  weekNumber: number;
  isDeload: boolean;
  dayPosition: number;
  dayName: string;
  dayKind: "full_body" | "arms_weak_points";
  exerciseCount: number;
  setCount: number;
}

/**
 * Completed workouts (plus skipped ones with `includeSkipped`), newest first
 * (detail: use getWorkoutSession(workoutLogId)).
 */
export async function getHistory(
  userId: string,
  opts: { limit?: number; runId?: string; includeSkipped?: boolean } = {},
): Promise<HistoryEntry[]> {
  const o = parseInput(
    z.object({
      limit: z.coerce.number().int().min(1).max(500).optional(),
      runId: uuidSchema.optional(),
      includeSkipped: z.boolean().optional(),
    }),
    opts,
  );
  const rows = await logs.listCompletedWorkouts(userId, o);
  return rows.map((r) => ({
    ...r,
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  }));
}
