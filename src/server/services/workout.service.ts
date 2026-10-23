/**
 * Workout flow (PLAN §4, §6): today overview, program overview, day preview,
 * start/log/complete a session. Every function takes the authenticated
 * `userId` first and scopes all user-data access by it. No Next.js imports
 * here, so services are callable from tests, actions, pages and handlers.
 */
import { db } from "../db/client";
import {
  computeWarmupSets,
  convertWeight,
  doneDayIdsFromLogs,
  isRestDay,
  nextWorkout,
  programProgress,
  segmentCount,
  suggestProgression,
  isSegmented,
  type RepsScheme,
  type WarmupProtocol,
  type WeightUnit,
} from "../domain";
import { translateWeakPointNote } from "../domain/weak-point-note";
import { getExercisesByIds, type ExerciseRow } from "../repositories/exercise.repo";
import * as logs from "../repositories/logs.repo";
import * as program from "../repositories/program.repo";
import { getSettings, type UserSettingsRow } from "../repositories/settings.repo";
import { ServiceError, notFound } from "./errors";
import {
  chooseExerciseSchema,
  idSchema,
  parseInput,
  saveSetSchema,
  startWorkoutSchema,
  uuidSchema,
  workoutLogIdSchema,
  type ChooseExerciseInput,
  type SaveSetInput,
} from "./validation";
import {
  resolveProtocol,
  toBlockView,
  toDayView,
  toExerciseSummary,
  toPrescriptionView,
  toSetView,
  toWeakPointView,
  toWeekView,
  type BlockView,
  type DayView,
  type ExerciseChoice,
  type LastPerformanceView,
  type PrescriptionView,
  type SessionItem,
  type SetView,
  type WeakPointView,
  type WeekView,
} from "./views";
import type { WorkoutLogStatus } from "../db/schema";
import { z } from "zod";

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE ?? "America/Mexico_City";

// ------------------------------------------------------------------ shared types

export interface SettingsView {
  unit: WeightUnit;
  roundingLb: number;
  roundingKg: number;
  weakPoint: WeakPointView | null;
}

export interface RunView {
  id: string;
  startedOn: string;
  status: "active" | "finished" | "abandoned";
}

export interface ProgressView {
  done: number;
  total: number;
  ratio: number;
}

export type DayStatus = "pending" | WorkoutLogStatus;

const toRunView = (r: logs.ProgramRunRow): RunView => ({
  id: r.id,
  startedOn: r.startedOn,
  status: r.status,
});

async function loadSettingsView(userId: string): Promise<{ row: UserSettingsRow | null; view: SettingsView }> {
  const row = await getSettings(userId);
  const wp = row?.weakPointId ? await program.getWeakPointById(row.weakPointId) : null;
  return {
    row,
    view: {
      unit: row?.weightUnit ?? "lb",
      roundingLb: row?.roundingLb ?? 5,
      roundingKg: row?.roundingKg ?? 2.5,
      weakPoint: wp ? toWeakPointView(wp) : null,
    },
  };
}

async function requireProgram() {
  const p = await program.getProgram();
  if (!p) throw new ServiceError("NOT_FOUND", "No hay programa cargado (corre pnpm db:seed)");
  return p;
}

// ------------------------------------------------------------------ today

export interface TodayOverview {
  needsOnboarding: boolean;
  settings: SettingsView;
  run: RunView | null;
  next: {
    day: DayView;
    week: WeekView;
    block: BlockView;
    /** Existing log for that day in the active run (e.g. in progress), else null. */
    workoutLog: { id: string; status: WorkoutLogStatus } | null;
  } | null;
  /** Most recently started in-progress session (may differ from `next`). */
  inProgress: { workoutLogId: string; dayId: number; dayName: string; weekNumber: number } | null;
  progress: ProgressView;
  programFinished: boolean;
  /** Informative only: last completed day had rest_after and was today/yesterday. */
  restDay: boolean;
  lastCompleted: { workoutLogId: string; completedAt: string; dayName: string; weekNumber: number } | null;
}

export async function getTodayOverview(
  userId: string,
  opts: { now?: Date; timeZone?: string } = {},
): Promise<TodayOverview> {
  const { row: settingsRow, view: settings } = await loadSettingsView(userId);
  const run = await logs.getActiveRun(userId);
  const prog = await program.getProgram();
  const days = prog ? await program.listProgramDays(prog.id) : [];
  const refs = days.map((d) => ({ id: d.day.id, week: d.week.number, position: d.day.position, row: d }));
  const emptyProgress = programProgress(refs, []);

  if (!run || !settingsRow) {
    return {
      needsOnboarding: true,
      settings,
      run: run ? toRunView(run) : null,
      next: null,
      inProgress: null,
      progress: emptyProgress,
      programFinished: false,
      restDay: false,
      lastCompleted: null,
    };
  }

  const runLogs = await logs.listWorkoutLogsForRun(userId, run.id);
  const done = doneDayIdsFromLogs(runLogs.map((l) => ({ workoutDayId: l.workoutDayId, status: l.status })));
  const nxt = nextWorkout(refs, done);
  const logByDay = new Map(runLogs.map((l) => [l.workoutDayId, l]));
  const dayById = new Map(days.map((d) => [d.day.id, d]));

  const inProgressLog = runLogs
    .filter((l) => l.status === "in_progress")
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  const lastCompletedLog = runLogs
    .filter((l) => l.status === "completed" && l.completedAt)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];
  const lcDay = lastCompletedLog ? dayById.get(lastCompletedLog.workoutDayId) : undefined;
  const ipDay = inProgressLog ? dayById.get(inProgressLog.workoutDayId) : undefined;

  return {
    needsOnboarding: false,
    settings,
    run: toRunView(run),
    next: nxt
      ? {
          day: toDayView(nxt.row.day),
          week: toWeekView(nxt.row.week),
          block: toBlockView(nxt.row.block),
          workoutLog: logByDay.get(nxt.id)
            ? { id: logByDay.get(nxt.id)!.id, status: logByDay.get(nxt.id)!.status }
            : null,
        }
      : null,
    inProgress:
      inProgressLog && ipDay
        ? {
            workoutLogId: inProgressLog.id,
            dayId: ipDay.day.id,
            dayName: ipDay.day.name,
            weekNumber: ipDay.week.number,
          }
        : null,
    progress: programProgress(refs, done),
    programFinished: nxt === null && refs.length > 0,
    restDay:
      lastCompletedLog && lcDay
        ? isRestDay(
            { restAfter: lcDay.day.restAfter, completedAt: lastCompletedLog.completedAt! },
            opts.now ?? new Date(),
            opts.timeZone ?? APP_TIME_ZONE,
          )
        : false,
    lastCompleted:
      lastCompletedLog && lcDay
        ? {
            workoutLogId: lastCompletedLog.id,
            completedAt: lastCompletedLog.completedAt!.toISOString(),
            dayName: lcDay.day.name,
            weekNumber: lcDay.week.number,
          }
        : null,
  };
}

// ------------------------------------------------------------------ program overview

export interface ProgramOverviewDay extends DayView {
  status: DayStatus;
  workoutLogId: string | null;
  isNext: boolean;
}

export interface ProgramOverview {
  program: {
    id: number;
    slug: string;
    name: string;
    author: string | null;
    description: string | null;
    notesEs: string[];
  };
  run: RunView | null;
  progress: ProgressView;
  nextDayId: number | null;
  blocks: Array<BlockView & { weeks: Array<WeekView & { days: ProgramOverviewDay[] }> }>;
}

export async function getProgramOverview(userId: string): Promise<ProgramOverview> {
  const prog = await requireProgram();
  const [days, blockRows, run] = await Promise.all([
    program.listProgramDays(prog.id),
    program.listBlocks(prog.id),
    logs.getActiveRun(userId),
  ]);
  const runLogs = run ? await logs.listWorkoutLogsForRun(userId, run.id) : [];
  const logByDay = new Map(runLogs.map((l) => [l.workoutDayId, l]));
  const refs = days.map((d) => ({ id: d.day.id, week: d.week.number, position: d.day.position }));
  const done = doneDayIdsFromLogs(runLogs.map((l) => ({ workoutDayId: l.workoutDayId, status: l.status })));
  const nxt = run ? nextWorkout(refs, done) : null;

  const blocksOut = blockRows.map((b) => {
    const weekMap = new Map<number, WeekView & { days: ProgramOverviewDay[] }>();
    for (const d of days) {
      if (d.block.id !== b.id) continue;
      let w = weekMap.get(d.week.id);
      if (!w) {
        w = { ...toWeekView(d.week), days: [] };
        weekMap.set(d.week.id, w);
      }
      const log = logByDay.get(d.day.id);
      w.days.push({
        ...toDayView(d.day),
        status: log ? log.status : "pending",
        workoutLogId: log?.id ?? null,
        isNext: nxt?.id === d.day.id,
      });
    }
    return { ...toBlockView(b), weeks: [...weekMap.values()].sort((x, y) => x.number - y.number) };
  });

  return {
    program: {
      id: prog.id,
      slug: prog.slug,
      name: prog.name,
      author: prog.author,
      description: prog.description,
      notesEs: prog.notesEs,
    },
    run: run ? toRunView(run) : null,
    progress: programProgress(refs, done),
    nextDayId: nxt?.id ?? null,
    blocks: blocksOut,
  };
}

// ------------------------------------------------------------------ day context

interface DayContext {
  dayRow: program.DayWithWeek;
  prescriptions: program.PrescriptionRow[];
  views: PrescriptionView[];
  exercises: Map<number, ExerciseRow>;
  settings: SettingsView;
  settingsRow: UserSettingsRow | null;
  needsWeakPoint: boolean;
}

async function loadDayContext(userId: string, dayId: number): Promise<DayContext> {
  const dayRow = await program.getDayWithWeek(dayId);
  if (!dayRow) throw notFound("Día");
  const [prescriptions, { row: settingsRow, view: settings }] = await Promise.all([
    program.listPrescriptionsForDay(dayId),
    loadSettingsView(userId),
  ]);
  const hasWeakSlots = prescriptions.some((p) => p.slot !== "exercise");
  const wpOptions =
    hasWeakSlots && settings.weakPoint ? await program.listWeakPointOptions(settings.weakPoint.id) : [];

  const exIds = new Set<number>();
  for (const p of prescriptions) {
    for (const id of [p.exerciseId, p.sub1ExerciseId, p.sub2ExerciseId]) if (id !== null) exIds.add(id);
  }
  const [exercises, techniqueRows] = await Promise.all([
    getExercisesByIds(exIds),
    program.getTechniquesByIds(
      [...new Set(prescriptions.map((p) => p.techniqueId).filter((x): x is number => x !== null))],
    ),
  ]);
  for (const o of wpOptions) exercises.set(o.exercise.id, o.exercise);
  const techniques = new Map(techniqueRows.map((t) => [t.id, t]));

  const choicesForSlot = (slot: 1 | 2): ExerciseChoice[] =>
    wpOptions
      .filter((o) => o.option.slot === slot)
      .map((o) => ({ kind: "weak_point_option", exercise: toExerciseSummary(o.exercise), note: translateWeakPointNote(o.option.note) }));

  const views = prescriptions.map((p) =>
    toPrescriptionView(p, {
      exercises,
      techniques,
      weakPointChoices:
        p.slot === "weak_point_1" ? choicesForSlot(1) : p.slot === "weak_point_2" ? choicesForSlot(2) : [],
    }),
  );
  return {
    dayRow,
    prescriptions,
    views,
    exercises,
    settings,
    settingsRow,
    needsWeakPoint: hasWeakSlots && !settings.weakPoint,
  };
}

// ------------------------------------------------------------------ day detail (preview)

export interface WorkoutDayDetail {
  day: DayView;
  week: WeekView;
  block: BlockView;
  settings: SettingsView;
  /** The day has weak-point slots and the user hasn't chosen a weak point. */
  needsWeakPoint: boolean;
  prescriptions: PrescriptionView[];
  /** This day's log in the active run, if any. */
  workoutLog: { id: string; status: WorkoutLogStatus } | null;
}

export async function getWorkoutDayDetail(userId: string, dayId: number): Promise<WorkoutDayDetail> {
  const id = parseInput(idSchema, dayId);
  const ctx = await loadDayContext(userId, id);
  const run = await logs.getActiveRun(userId);
  const runLogs = run ? await logs.listWorkoutLogsForRun(userId, run.id) : [];
  const log = runLogs.find((l) => l.workoutDayId === id);
  return {
    day: toDayView(ctx.dayRow.day),
    week: toWeekView(ctx.dayRow.week),
    block: toBlockView(ctx.dayRow.block),
    settings: ctx.settings,
    needsWeakPoint: ctx.needsWeakPoint,
    prescriptions: ctx.views,
    workoutLog: log ? { id: log.id, status: log.status } : null,
  };
}

/** Same as getWorkoutDayDetail, addressed by week number (1..10) and day position (1..5). */
export async function getWorkoutDayDetailByPosition(
  userId: string,
  weekNumber: number,
  position: number,
): Promise<WorkoutDayDetail> {
  const w = parseInput(z.coerce.number().int().min(1).max(52), weekNumber);
  const pos = parseInput(z.coerce.number().int().min(1).max(7), position);
  const prog = await requireProgram();
  const d = await program.findDayByWeekAndPosition(prog.id, w, pos);
  if (!d) throw notFound("Día");
  return getWorkoutDayDetail(userId, d.day.id);
}

// ------------------------------------------------------------------ start

export interface StartWorkoutResult {
  workoutLogId: string;
  status: WorkoutLogStatus;
  created: boolean;
}

/**
 * Create or fetch the log for (active run, day). Idempotent. A skipped day is
 * reopened as in_progress; a completed one stays completed (editable).
 */
export async function startWorkout(userId: string, input: { workoutDayId: number }): Promise<StartWorkoutResult> {
  const { workoutDayId } = parseInput(startWorkoutSchema, input);
  const run = await logs.getActiveRun(userId);
  if (!run) throw new ServiceError("NO_ACTIVE_RUN", "Completa la bienvenida para empezar el programa");
  const day = await program.getDayWithWeek(workoutDayId);
  if (!day || day.block.programId !== run.programId) throw notFound("Día");
  const { log, created } = await logs.insertOrGetWorkoutLog(userId, run.id, workoutDayId);
  if (log.status === "skipped") {
    const reopened = await logs.setWorkoutLogStatus(userId, log.id, "in_progress");
    return { workoutLogId: log.id, status: reopened?.status ?? "in_progress", created };
  }
  return { workoutLogId: log.id, status: log.status, created };
}

// ------------------------------------------------------------------ session

export interface WorkoutSession {
  workoutLog: {
    id: string;
    runId: string;
    status: WorkoutLogStatus;
    startedAt: string;
    completedAt: string | null;
  };
  day: DayView;
  week: WeekView;
  block: BlockView;
  settings: SettingsView;
  needsWeakPoint: boolean;
  /** Warm-up percentages by set count (DB-seeded, falls back to the PDF default). */
  warmupProtocol: WarmupProtocol;
  generalWarmup: Array<{ position: number; item: string; itemEs: string | null; dose: string | null; doseEs: string | null }>;
  items: SessionItem[];
}

function defaultPerformed(view: PrescriptionView): number | null {
  if (view.slot === "exercise") return view.exercise?.id ?? null;
  return view.choices[0]?.exercise.id ?? null;
}

function toLastPerformanceView(r: logs.LastPerformanceRow): LastPerformanceView {
  return {
    workoutLogId: r.workoutLogId,
    runId: r.runId,
    date: (r.completedAt ?? r.startedAt).toISOString(),
    weekNumber: r.weekNumber,
    dayPosition: r.dayPosition,
    dayName: r.dayName,
    prescriptionId: r.prescriptionId,
    sets: r.sets.map(toSetView),
  };
}

async function buildSessionItems(
  userId: string,
  ctx: DayContext,
  log: logs.WorkoutLogRow,
  protocol: WarmupProtocol,
  onlyPrescriptionId?: number,
): Promise<SessionItem[]> {
  const exLogs = await logs.listExerciseLogs(log.id);
  const exLogByPrescription = new Map(exLogs.map((e) => [e.prescriptionId, e]));
  const sets = await logs.listSetLogsForExerciseLogs(exLogs.map((e) => e.id));
  const setsByExLog = new Map<string, SetView[]>();
  for (const s of sets) {
    const list = setsByExLog.get(s.exerciseLogId) ?? [];
    list.push(toSetView(s));
    setsByExLog.set(s.exerciseLogId, list);
  }

  const views = onlyPrescriptionId ? ctx.views.filter((v) => v.id === onlyPrescriptionId) : ctx.views;
  const performedIds = views.map((v) => exLogByPrescription.get(v.id)?.performedExerciseId ?? defaultPerformed(v));
  const last = await logs.lastPerformanceMany(
    userId,
    performedIds.filter((x): x is number => x !== null),
    { excludeWorkoutLogId: log.id, before: log.startedAt },
  );

  // Extra exercise rows not in the day context (e.g. a performed exercise no longer an option).
  const missing = performedIds.filter((id): id is number => id !== null && !ctx.exercises.has(id));
  if (missing.length) for (const [id, row] of await getExercisesByIds(missing)) ctx.exercises.set(id, row);

  // Schemes of the prescriptions the last performances were logged under.
  const lastPrescriptions = new Map(
    (await program.getPrescriptionsByIds([...new Set([...last.values()].map((l) => l.prescriptionId))])).map(
      (p) => [p.id, p],
    ),
  );

  const unit = ctx.settings.unit;
  const rounding = unit === "lb" ? ctx.settings.roundingLb : ctx.settings.roundingKg;

  return views.map((v, i) => {
    const exLog = exLogByPrescription.get(v.id) ?? null;
    const performedId = performedIds[i];
    const performedRow = performedId !== null ? ctx.exercises.get(performedId) : undefined;
    const mySets = exLog ? (setsByExLog.get(exLog.id) ?? []) : [];
    const lp = performedId !== null ? last.get(performedId) : undefined;

    let suggestion: SessionItem["suggestion"] = null;
    if (lp) {
      const lpPrescription = lastPrescriptions.get(lp.prescriptionId);
      const scheme = (lpPrescription?.repsScheme ?? v.reps.scheme) as RepsScheme | null;
      if (scheme) {
        suggestion = suggestProgression({
          scheme,
          lastSets: lp.sets.map((s) => ({ setNumber: s.setNumber, reps: s.reps, segmentReps: s.segmentReps })),
          isDeload: ctx.dayRow.week.isDeload,
          workingSets: lpPrescription?.workingSets ?? v.workingSets,
        });
      }
    }

    let warmupPlan: SessionItem["warmupPlan"] = null;
    const warmupCount = v.warmup.max ?? 0;
    if (warmupCount > 0) {
      const ref =
        mySets.find((s) => s.setNumber === 1 && s.weight !== null) ??
        (lp ? lp.sets.map(toSetView).find((s) => s.setNumber === 1 && s.weight !== null) : undefined) ??
        null;
      const working = ref && ref.weight !== null ? convertWeight(ref.weight, ref.unit, unit) : null;
      warmupPlan = computeWarmupSets(working, warmupCount, unit, rounding, protocol);
    }

    return {
      ...v,
      exerciseLogId: exLog?.id ?? null,
      performedExercise: performedRow ? toExerciseSummary(performedRow) : null,
      performedIsDefault: exLog === null,
      sets: mySets,
      lastPerformance: lp ? toLastPerformanceView(lp) : null,
      suggestion,
      warmupPlan,
    };
  });
}

async function requireOwnedLog(userId: string, workoutLogId: string) {
  const log = await logs.getWorkoutLogForUser(userId, workoutLogId);
  if (!log) throw notFound("Sesión");
  return log;
}

export async function getWorkoutSession(userId: string, workoutLogId: string): Promise<WorkoutSession> {
  const id = parseInput(uuidSchema, workoutLogId);
  const log = await requireOwnedLog(userId, id);
  const ctx = await loadDayContext(userId, log.workoutDayId);
  const [protocolRow, general] = await Promise.all([program.getWarmupProtocol(), program.listGeneralWarmup()]);
  const protocol = resolveProtocol(protocolRow);
  const items = await buildSessionItems(userId, ctx, log, protocol);
  return {
    workoutLog: {
      id: log.id,
      runId: log.programRunId,
      status: log.status,
      startedAt: log.startedAt.toISOString(),
      completedAt: log.completedAt?.toISOString() ?? null,
    },
    day: toDayView(ctx.dayRow.day),
    week: toWeekView(ctx.dayRow.week),
    block: toBlockView(ctx.dayRow.block),
    settings: ctx.settings,
    needsWeakPoint: ctx.needsWeakPoint,
    warmupProtocol: protocol,
    generalWarmup: general.map((g) => ({
      position: g.position,
      item: g.item,
      itemEs: g.itemEs,
      dose: g.dose,
      doseEs: g.doseEs,
    })),
    items,
  };
}

/** Prescription of the log's day + the allowed exercise ids for it. */
async function loadPrescriptionForLog(userId: string, log: logs.WorkoutLogRow, prescriptionId: number) {
  const ctx = await loadDayContext(userId, log.workoutDayId);
  const view = ctx.views.find((v) => v.id === prescriptionId);
  if (!view) throw notFound("Ejercicio de la sesión");
  return { ctx, view, allowed: new Set(view.choices.map((c) => c.exercise.id)) };
}

function assertAllowed(view: PrescriptionView, allowed: Set<number>, exerciseId: number, needsWeakPoint: boolean) {
  if (allowed.has(exerciseId)) return;
  if (view.slot !== "exercise" && needsWeakPoint) {
    throw new ServiceError("WEAK_POINT_NOT_SET", "Elige tu punto débil antes de registrar este ejercicio");
  }
  throw new ServiceError(
    "EXERCISE_NOT_ALLOWED",
    view.slot === "exercise"
      ? "Solo puedes elegir el ejercicio principal o uno de sus sustitutos"
      : "Ese ejercicio no es una opción de tu punto débil para este espacio",
  );
}

// ------------------------------------------------------------------ choose exercise

export async function chooseExercise(userId: string, input: ChooseExerciseInput): Promise<SessionItem> {
  const { workoutLogId, prescriptionId, exerciseId } = parseInput(chooseExerciseSchema, input);
  const log = await requireOwnedLog(userId, workoutLogId);
  const { ctx, view, allowed } = await loadPrescriptionForLog(userId, log, prescriptionId);
  assertAllowed(view, allowed, exerciseId, ctx.needsWeakPoint);
  // Sets belong to the exercise that was performed: switching an exercise log that
  // already has sets would move them into the other exercise's history.
  const existing = await logs.getExerciseLog(log.id, prescriptionId);
  if (existing && existing.performedExerciseId !== exerciseId) {
    const sets = await logs.listSetLogsForExerciseLogs([existing.id]);
    if (sets.length > 0) {
      throw new ServiceError(
        "CONFLICT",
        "Ya registraste series con este ejercicio. Bórralas antes de cambiarlo para no mezclar historiales.",
      );
    }
  }
  await logs.upsertExerciseLog(log.id, prescriptionId, exerciseId);
  const protocol = resolveProtocol(await program.getWarmupProtocol());
  const [item] = await buildSessionItems(userId, ctx, log, protocol, prescriptionId);
  return item;
}

// ------------------------------------------------------------------ save set

export interface SaveSetResult {
  exerciseLogId: string;
  performedExerciseId: number;
  /** Saved set, or null when the set was cleared (weight, reps, segments and RPE all empty). */
  set: SetView | null;
}

/**
 * Upsert one set. Creates the exercise log if missing (performed exercise =
 * `performedExerciseId`, the existing choice, or the default). Sending
 * weight=null, reps=null, rpe=null and no segmentReps deletes the set. For segmented
 * schemes (mechanical dropset / compound) `segmentReps` has one entry per
 * logged segment, in order (at most one per segment; trailing phases may be
 * missing); when `reps` is null it defaults to the first segment.
 */
export async function saveSet(userId: string, input: SaveSetInput): Promise<SaveSetResult> {
  const v = parseInput(saveSetSchema, input);
  const log = await requireOwnedLog(userId, v.workoutLogId);
  const { ctx, view, allowed } = await loadPrescriptionForLog(userId, log, v.prescriptionId);

  const maxSets = view.workingSets + 2;
  if (v.setNumber > maxSets) {
    throw new ServiceError("VALIDATION", `Serie fuera de rango (máximo ${maxSets})`, {
      setNumber: [`Máximo ${maxSets}`],
    });
  }

  const scheme = view.reps.scheme;
  let segmentReps = v.segmentReps && v.segmentReps.length > 0 ? v.segmentReps : null;
  if (segmentReps) {
    if (!scheme || !isSegmented(scheme)) {
      throw new ServiceError("VALIDATION", "Este ejercicio no usa reps por segmento", {
        segmentReps: ["No aplica"],
      });
    }
    const n = segmentCount(scheme);
    // Fewer entries = only the first phases were logged (the rest weren't done / not yet typed).
    if (segmentReps.length > n) {
      throw new ServiceError("VALIDATION", `Se esperan hasta ${n} segmentos`, { segmentReps: [`Máximo ${n}`] });
    }
  } else {
    segmentReps = null;
  }
  const reps = v.reps ?? (segmentReps ? segmentReps[0] : null);

  return db.transaction(async (tx) => {
    // Logging into a skipped session reopens it (skipped logs are excluded from history).
    if (log.status === "skipped") await logs.setWorkoutLogStatus(userId, log.id, "in_progress", tx);
    let exLog = await logs.getExerciseLog(log.id, v.prescriptionId, tx);
    if (v.performedExerciseId !== undefined) {
      assertAllowed(view, allowed, v.performedExerciseId, ctx.needsWeakPoint);
      if (!exLog || exLog.performedExerciseId !== v.performedExerciseId) {
        exLog = await logs.upsertExerciseLog(log.id, v.prescriptionId, v.performedExerciseId, tx);
      }
    } else if (!exLog) {
      const def = defaultPerformed(view);
      if (def === null) {
        if (ctx.needsWeakPoint) {
          throw new ServiceError("WEAK_POINT_NOT_SET", "Elige tu punto débil antes de registrar este ejercicio");
        }
        throw new ServiceError("EXERCISE_REQUIRED", "Elige qué ejercicio hiciste");
      }
      exLog = await logs.ensureExerciseLog(log.id, v.prescriptionId, def, tx);
    }

    const empty = v.weight === null && reps === null && !segmentReps && (v.rpe ?? null) === null;
    if (empty) {
      await logs.deleteSetLog(exLog.id, v.setNumber, tx);
      return { exerciseLogId: exLog.id, performedExerciseId: exLog.performedExerciseId, set: null };
    }
    const row = await logs.upsertSetLog(
      exLog.id,
      {
        setNumber: v.setNumber,
        weight: v.weight,
        weightUnit: v.unit,
        reps,
        rpe: v.rpe ?? null,
        segmentReps,
      },
      tx,
    );
    return { exerciseLogId: exLog.id, performedExerciseId: exLog.performedExerciseId, set: toSetView(row) };
  });
}

// ------------------------------------------------------------------ complete / skip

export interface CloseWorkoutResult {
  workoutLogId: string;
  status: WorkoutLogStatus;
  completedAt: string | null;
  /** Next day to train in the active run after this change (null = program finished). */
  nextDayId: number | null;
}

async function closeWorkout(
  userId: string,
  input: { workoutLogId: string },
  status: "completed" | "skipped",
): Promise<CloseWorkoutResult> {
  const { workoutLogId } = parseInput(workoutLogIdSchema, input);
  const current = await requireOwnedLog(userId, workoutLogId);
  if (status === "skipped" && current.status === "completed") {
    // Skipping would hide a finished session's sets from history/last performance.
    throw new ServiceError("CONFLICT", "Esta sesión ya está terminada; no se puede saltar");
  }
  // Re-completing keeps the original completedAt (no status change → no update).
  const updated =
    current.status === status ? current : await logs.setWorkoutLogStatus(userId, workoutLogId, status);
  if (!updated) throw notFound("Sesión");
  const prog = await requireProgram();
  const days = await program.listProgramDays(prog.id);
  const runLogs = await logs.listWorkoutLogsForRun(userId, updated.programRunId);
  const done = doneDayIdsFromLogs(runLogs.map((l) => ({ workoutDayId: l.workoutDayId, status: l.status })));
  const nxt = nextWorkout(
    days.map((d) => ({ id: d.day.id, week: d.week.number, position: d.day.position })),
    done,
  );
  return {
    workoutLogId,
    status: updated.status,
    completedAt: updated.completedAt?.toISOString() ?? null,
    nextDayId: nxt?.id ?? null,
  };
}

export function completeWorkout(userId: string, input: { workoutLogId: string }) {
  return closeWorkout(userId, input, "completed");
}

export function skipWorkout(userId: string, input: { workoutLogId: string }) {
  return closeWorkout(userId, input, "skipped");
}
