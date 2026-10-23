/**
 * User data: program runs, workout/exercise/set logs. Every entry point takes
 * `userId` and filters by it (directly on program_runs/workout_logs, or via the
 * owning workout log for exercise/set logs). Functions that take a bare
 * workoutLogId/exerciseLogId assume the caller already verified ownership with
 * {@link getWorkoutLogForUser}.
 */
import { and, asc, desc, eq, exists, inArray, lt, ne, sql } from "drizzle-orm";
import { db, type Transaction } from "../db/client";
import {
  exerciseLogs,
  programRuns,
  setLogs,
  weeks,
  workoutDays,
  workoutLogs,
} from "../db/schema";
import type { ProgramRunStatus, WeightUnit, WorkoutLogStatus } from "../db/schema";

type Executor = typeof db | Transaction;

export type ProgramRunRow = typeof programRuns.$inferSelect;
export type WorkoutLogRow = typeof workoutLogs.$inferSelect;
export type ExerciseLogRow = typeof exerciseLogs.$inferSelect;
export type SetLogRow = typeof setLogs.$inferSelect;

// ------------------------------------------------------------------ runs

export async function getActiveRun(userId: string, tx: Executor = db): Promise<ProgramRunRow | null> {
  const [r] = await tx
    .select()
    .from(programRuns)
    .where(and(eq(programRuns.userId, userId), eq(programRuns.status, "active")))
    .limit(1);
  return r ?? null;
}

/** Active run if any, otherwise the most recently created one. */
export async function getCurrentOrLatestRun(userId: string): Promise<ProgramRunRow | null> {
  const [r] = await db
    .select()
    .from(programRuns)
    .where(eq(programRuns.userId, userId))
    .orderBy(sql`(${programRuns.status} = 'active') desc`, desc(programRuns.createdAt))
    .limit(1);
  return r ?? null;
}

export async function getRunForUser(userId: string, runId: string): Promise<ProgramRunRow | null> {
  const [r] = await db
    .select()
    .from(programRuns)
    .where(and(eq(programRuns.id, runId), eq(programRuns.userId, userId)))
    .limit(1);
  return r ?? null;
}

export async function createRun(
  userId: string,
  programId: number,
  startedOn: string,
  tx: Executor = db,
): Promise<ProgramRunRow> {
  const [r] = await tx
    .insert(programRuns)
    .values({ userId, programId, startedOn, status: "active" })
    .returning();
  return r;
}

export async function closeActiveRun(
  userId: string,
  status: Exclude<ProgramRunStatus, "active">,
  tx: Executor = db,
): Promise<void> {
  await tx
    .update(programRuns)
    .set({ status, finishedAt: new Date() })
    .where(and(eq(programRuns.userId, userId), eq(programRuns.status, "active")));
}

// ------------------------------------------------------------------ workout logs

export async function listWorkoutLogsForRun(userId: string, runId: string): Promise<WorkoutLogRow[]> {
  return db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.programRunId, runId)));
}

/** Ownership check: returns the log only if it belongs to `userId`. */
export async function getWorkoutLogForUser(
  userId: string,
  workoutLogId: string,
  tx: Executor = db,
): Promise<WorkoutLogRow | null> {
  const [l] = await tx
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, workoutLogId), eq(workoutLogs.userId, userId)))
    .limit(1);
  return l ?? null;
}

/** Idempotent create: one log per (run, day). Returns the row and whether it was created. */
export async function insertOrGetWorkoutLog(
  userId: string,
  runId: string,
  workoutDayId: number,
  tx: Executor = db,
): Promise<{ log: WorkoutLogRow; created: boolean }> {
  const [inserted] = await tx
    .insert(workoutLogs)
    .values({ userId, programRunId: runId, workoutDayId, status: "in_progress" })
    .onConflictDoNothing({ target: [workoutLogs.programRunId, workoutLogs.workoutDayId] })
    .returning();
  if (inserted) return { log: inserted, created: true };
  const [existing] = await tx
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.programRunId, runId),
        eq(workoutLogs.workoutDayId, workoutDayId),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("workout log vanished after conflict");
  return { log: existing, created: false };
}

export async function setWorkoutLogStatus(
  userId: string,
  workoutLogId: string,
  status: WorkoutLogStatus,
  tx: Executor = db,
): Promise<WorkoutLogRow | null> {
  const [l] = await tx
    .update(workoutLogs)
    .set({ status, completedAt: status === "in_progress" ? null : new Date() })
    .where(and(eq(workoutLogs.id, workoutLogId), eq(workoutLogs.userId, userId)))
    .returning();
  return l ?? null;
}

// ------------------------------------------------------------------ exercise + set logs

export async function listExerciseLogs(workoutLogId: string): Promise<ExerciseLogRow[]> {
  return db.select().from(exerciseLogs).where(eq(exerciseLogs.workoutLogId, workoutLogId));
}

export async function listSetLogsForExerciseLogs(exerciseLogIds: string[]): Promise<SetLogRow[]> {
  if (exerciseLogIds.length === 0) return [];
  return db
    .select()
    .from(setLogs)
    .where(inArray(setLogs.exerciseLogId, exerciseLogIds))
    .orderBy(asc(setLogs.setNumber));
}

export async function getExerciseLog(
  workoutLogId: string,
  prescriptionId: number,
  tx: Executor = db,
): Promise<ExerciseLogRow | null> {
  const [e] = await tx
    .select()
    .from(exerciseLogs)
    .where(
      and(eq(exerciseLogs.workoutLogId, workoutLogId), eq(exerciseLogs.prescriptionId, prescriptionId)),
    )
    .limit(1);
  return e ?? null;
}

/** Create the exercise log, or switch its performed exercise. */
export async function upsertExerciseLog(
  workoutLogId: string,
  prescriptionId: number,
  performedExerciseId: number,
  tx: Executor = db,
): Promise<ExerciseLogRow> {
  const [e] = await tx
    .insert(exerciseLogs)
    .values({ workoutLogId, prescriptionId, performedExerciseId })
    .onConflictDoUpdate({
      target: [exerciseLogs.workoutLogId, exerciseLogs.prescriptionId],
      set: { performedExerciseId, updatedAt: new Date() },
    })
    .returning();
  return e;
}

/** Create the exercise log only if missing (keeps an existing performed exercise). */
export async function ensureExerciseLog(
  workoutLogId: string,
  prescriptionId: number,
  performedExerciseId: number,
  tx: Executor = db,
): Promise<ExerciseLogRow> {
  await tx
    .insert(exerciseLogs)
    .values({ workoutLogId, prescriptionId, performedExerciseId })
    .onConflictDoNothing({ target: [exerciseLogs.workoutLogId, exerciseLogs.prescriptionId] });
  const e = await getExerciseLog(workoutLogId, prescriptionId, tx);
  if (!e) throw new Error("exercise log vanished after upsert");
  return e;
}

export interface SetLogValues {
  setNumber: number;
  weight: number | null;
  weightUnit: WeightUnit;
  reps: number | null;
  rpe: number | null;
  segmentReps: number[] | null;
}

export async function upsertSetLog(
  exerciseLogId: string,
  v: SetLogValues,
  tx: Executor = db,
): Promise<SetLogRow> {
  const [s] = await tx
    .insert(setLogs)
    .values({ exerciseLogId, ...v })
    .onConflictDoUpdate({
      target: [setLogs.exerciseLogId, setLogs.setNumber],
      set: {
        weight: v.weight,
        weightUnit: v.weightUnit,
        reps: v.reps,
        rpe: v.rpe,
        segmentReps: v.segmentReps,
        updatedAt: new Date(),
      },
    })
    .returning();
  return s;
}

export async function deleteSetLog(exerciseLogId: string, setNumber: number, tx: Executor = db) {
  await tx
    .delete(setLogs)
    .where(and(eq(setLogs.exerciseLogId, exerciseLogId), eq(setLogs.setNumber, setNumber)));
}

// ------------------------------------------------------------------ last performance

export interface LastPerformanceRow {
  performedExerciseId: number;
  exerciseLogId: string;
  prescriptionId: number;
  workoutLogId: string;
  runId: string;
  status: WorkoutLogStatus;
  startedAt: Date;
  completedAt: Date | null;
  weekNumber: number;
  isDeload: boolean;
  dayPosition: number;
  dayName: string;
  sets: SetLogRow[];
}

/**
 * Most recent previous performance (with ≥1 saved set, not skipped) of each
 * exercise by this user, across all runs, days and prescriptions.
 * "Previous" = workout log started before `before` (the current log's start),
 * excluding `excludeWorkoutLogId` itself.
 */
export async function lastPerformanceMany(
  userId: string,
  exerciseIds: number[],
  opts: { excludeWorkoutLogId?: string; before?: Date } = {},
): Promise<Map<number, LastPerformanceRow>> {
  const ids = [...new Set(exerciseIds)];
  if (ids.length === 0) return new Map();
  const conds = [
    eq(workoutLogs.userId, userId),
    inArray(exerciseLogs.performedExerciseId, ids),
    ne(workoutLogs.status, "skipped"),
    exists(
      db
        .select({ one: sql`1` })
        .from(setLogs)
        .where(eq(setLogs.exerciseLogId, exerciseLogs.id)),
    ),
  ];
  if (opts.excludeWorkoutLogId) conds.push(ne(workoutLogs.id, opts.excludeWorkoutLogId));
  if (opts.before) conds.push(lt(workoutLogs.startedAt, opts.before));

  const rows = await db
    .selectDistinctOn([exerciseLogs.performedExerciseId], {
      performedExerciseId: exerciseLogs.performedExerciseId,
      exerciseLogId: exerciseLogs.id,
      prescriptionId: exerciseLogs.prescriptionId,
      workoutLogId: workoutLogs.id,
      runId: workoutLogs.programRunId,
      status: workoutLogs.status,
      startedAt: workoutLogs.startedAt,
      completedAt: workoutLogs.completedAt,
      weekNumber: weeks.number,
      isDeload: weeks.isDeload,
      dayPosition: workoutDays.position,
      dayName: workoutDays.name,
    })
    .from(exerciseLogs)
    .innerJoin(workoutLogs, eq(workoutLogs.id, exerciseLogs.workoutLogId))
    .innerJoin(workoutDays, eq(workoutDays.id, workoutLogs.workoutDayId))
    .innerJoin(weeks, eq(weeks.id, workoutDays.weekId))
    .where(and(...conds))
    .orderBy(exerciseLogs.performedExerciseId, desc(workoutLogs.startedAt), desc(exerciseLogs.updatedAt));

  const sets = await listSetLogsForExerciseLogs(rows.map((r) => r.exerciseLogId));
  const byLog = new Map<string, SetLogRow[]>();
  for (const s of sets) {
    const list = byLog.get(s.exerciseLogId) ?? [];
    list.push(s);
    byLog.set(s.exerciseLogId, list);
  }
  return new Map(
    rows.map((r) => [r.performedExerciseId, { ...r, sets: byLog.get(r.exerciseLogId) ?? [] }]),
  );
}

// ------------------------------------------------------------------ history

export interface ExerciseHistorySetRow {
  workoutLogId: string;
  runId: string;
  status: WorkoutLogStatus;
  startedAt: Date;
  completedAt: Date | null;
  weekNumber: number;
  dayPosition: number;
  dayName: string;
  prescriptionId: number;
  exerciseLogId: string;
  setNumber: number;
  weight: number | null;
  weightUnit: WeightUnit;
  reps: number | null;
  rpe: number | null;
  segmentReps: number[] | null;
}

/** Every saved set of `exerciseId` by this user (non-skipped logs), newest session first. */
export async function listExerciseHistorySets(
  userId: string,
  exerciseId: number,
): Promise<ExerciseHistorySetRow[]> {
  return db
    .select({
      workoutLogId: workoutLogs.id,
      runId: workoutLogs.programRunId,
      status: workoutLogs.status,
      startedAt: workoutLogs.startedAt,
      completedAt: workoutLogs.completedAt,
      weekNumber: weeks.number,
      dayPosition: workoutDays.position,
      dayName: workoutDays.name,
      prescriptionId: exerciseLogs.prescriptionId,
      exerciseLogId: exerciseLogs.id,
      setNumber: setLogs.setNumber,
      weight: setLogs.weight,
      weightUnit: setLogs.weightUnit,
      reps: setLogs.reps,
      rpe: setLogs.rpe,
      segmentReps: setLogs.segmentReps,
    })
    .from(setLogs)
    .innerJoin(exerciseLogs, eq(exerciseLogs.id, setLogs.exerciseLogId))
    .innerJoin(workoutLogs, eq(workoutLogs.id, exerciseLogs.workoutLogId))
    .innerJoin(workoutDays, eq(workoutDays.id, workoutLogs.workoutDayId))
    .innerJoin(weeks, eq(weeks.id, workoutDays.weekId))
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(exerciseLogs.performedExerciseId, exerciseId),
        ne(workoutLogs.status, "skipped"),
      ),
    )
    .orderBy(desc(workoutLogs.startedAt), asc(setLogs.setNumber));
}

export interface CompletedWorkoutRow {
  workoutLogId: string;
  runId: string;
  workoutDayId: number;
  status: WorkoutLogStatus;
  startedAt: Date;
  completedAt: Date | null;
  weekNumber: number;
  isDeload: boolean;
  dayPosition: number;
  dayName: string;
  dayKind: "full_body" | "arms_weak_points";
  exerciseCount: number;
  setCount: number;
}

export async function listCompletedWorkouts(
  userId: string,
  opts: { limit?: number; runId?: string; includeSkipped?: boolean } = {},
): Promise<CompletedWorkoutRow[]> {
  const conds = [
    eq(workoutLogs.userId, userId),
    opts.includeSkipped
      ? inArray(workoutLogs.status, ["completed", "skipped"])
      : eq(workoutLogs.status, "completed"),
  ];
  if (opts.runId) conds.push(eq(workoutLogs.programRunId, opts.runId));
  return db
    .select({
      workoutLogId: workoutLogs.id,
      runId: workoutLogs.programRunId,
      workoutDayId: workoutLogs.workoutDayId,
      status: workoutLogs.status,
      startedAt: workoutLogs.startedAt,
      completedAt: workoutLogs.completedAt,
      weekNumber: weeks.number,
      isDeload: weeks.isDeload,
      dayPosition: workoutDays.position,
      dayName: workoutDays.name,
      dayKind: workoutDays.kind,
      exerciseCount: sql<number>`(select count(*)::int from ${exerciseLogs} el where el.workout_log_id = ${workoutLogs.id} and exists (select 1 from ${setLogs} sl where sl.exercise_log_id = el.id))`,
      setCount: sql<number>`(select count(*)::int from ${setLogs} sl join ${exerciseLogs} el on el.id = sl.exercise_log_id where el.workout_log_id = ${workoutLogs.id})`,
    })
    .from(workoutLogs)
    .innerJoin(workoutDays, eq(workoutDays.id, workoutLogs.workoutDayId))
    .innerJoin(weeks, eq(weeks.id, workoutDays.weekId))
    .where(and(...conds))
    .orderBy(desc(workoutLogs.completedAt))
    .limit(opts.limit ?? 200);
}

/** Completed logs (with rest_after of their day) for the rest-day hint. */
export async function getLastCompletedWithRest(userId: string, runId: string) {
  const [r] = await db
    .select({ completedAt: workoutLogs.completedAt, restAfter: workoutDays.restAfter })
    .from(workoutLogs)
    .innerJoin(workoutDays, eq(workoutDays.id, workoutLogs.workoutDayId))
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.programRunId, runId),
        eq(workoutLogs.status, "completed"),
      ),
    )
    .orderBy(desc(workoutLogs.completedAt))
    .limit(1);
  return r && r.completedAt ? { completedAt: r.completedAt, restAfter: r.restAfter } : null;
}
