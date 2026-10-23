/** Onboarding, settings and program restarts (PLAN §5 /bienvenida, /perfil). */
import { db } from "../db/client";
import { calendarDate, doneDayIdsFromLogs } from "../domain";
import * as logs from "../repositories/logs.repo";
import * as program from "../repositories/program.repo";
import { getSettings, upsertSettings, type SettingsPatch } from "../repositories/settings.repo";
import { ServiceError } from "./errors";
import {
  completeOnboardingSchema,
  parseInput,
  restartProgramSchema,
  updateSettingsSchema,
  type CompleteOnboardingInput,
  type RestartProgramInput,
  type UpdateSettingsInput,
} from "./validation";
import { toWeakPointView, type WeakPointView } from "./views";
import { APP_TIME_ZONE, type RunView, type SettingsView } from "./workout.service";

const today = () => calendarDate(new Date(), APP_TIME_ZONE);

async function resolveWeakPointId(key: string | null | undefined): Promise<number | null | undefined> {
  if (key === undefined) return undefined;
  if (key === null) return null;
  const wp = await program.getWeakPointByKey(key);
  if (!wp) {
    throw new ServiceError("VALIDATION", "Punto débil desconocido", { weakPointKey: ["Desconocido"] });
  }
  return wp.id;
}

async function settingsView(userId: string): Promise<SettingsView> {
  const s = await getSettings(userId);
  const wp = s?.weakPointId ? await program.getWeakPointById(s.weakPointId) : null;
  return {
    unit: s?.weightUnit ?? "lb",
    roundingLb: s?.roundingLb ?? 5,
    roundingKg: s?.roundingKg ?? 2.5,
    weakPoint: wp ? toWeakPointView(wp) : null,
  };
}

const toRunView = (r: logs.ProgramRunRow): RunView => ({ id: r.id, startedOn: r.startedOn, status: r.status });

export interface OnboardingState {
  onboarded: boolean;
  settings: SettingsView;
  run: RunView | null;
  /** Weak point catalog for the picker, with option counts per slot (0 = guidance only). */
  weakPoints: Array<WeakPointView & { optionCount: { slot1: number; slot2: number } }>;
}

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [s, run, wps] = await Promise.all([getSettings(userId), logs.getActiveRun(userId), program.listWeakPoints()]);
  const withCounts = await Promise.all(
    wps.map(async (w) => {
      const opts = await program.listWeakPointOptions(w.id);
      return {
        ...toWeakPointView(w),
        optionCount: {
          slot1: opts.filter((o) => o.option.slot === 1).length,
          slot2: opts.filter((o) => o.option.slot === 2).length,
        },
      };
    }),
  );
  return {
    onboarded: Boolean(s && run),
    settings: await settingsView(userId),
    run: run ? toRunView(run) : null,
    weakPoints: withCounts,
  };
}

export interface OnboardingResult {
  settings: SettingsView;
  run: RunView;
  /** false when an active run already existed (it is kept as is). */
  createdRun: boolean;
}

/** Save unit + weak point and create the active program run (idempotent: keeps an existing active run). */
export async function completeOnboarding(userId: string, input: CompleteOnboardingInput): Promise<OnboardingResult> {
  const v = parseInput(completeOnboardingSchema, input);
  const prog = await program.getProgram();
  if (!prog) throw new ServiceError("NOT_FOUND", "No hay programa cargado");
  // undefined keeps an existing choice (re-onboarding); null clears it.
  const weakPointId = await resolveWeakPointId(v.weakPointKey);
  const result = await db.transaction(async (tx) => {
    await upsertSettings(userId, { weightUnit: v.unit, weakPointId }, tx);
    const existing = await logs.getActiveRun(userId, tx);
    if (existing) return { run: existing, createdRun: false };
    const run = await logs.createRun(userId, prog.id, v.startedOn ?? today(), tx);
    return { run, createdRun: true };
  });
  return { settings: await settingsView(userId), run: toRunView(result.run), createdRun: result.createdRun };
}

/** Partial update of unit / weak point (null clears) / rounding steps. */
export async function updateSettings(userId: string, input: UpdateSettingsInput): Promise<SettingsView> {
  const v = parseInput(updateSettingsSchema, input);
  const patch: SettingsPatch = {
    weightUnit: v.unit,
    weakPointId: await resolveWeakPointId(v.weakPointKey),
    roundingLb: v.roundingLb,
    roundingKg: v.roundingKg,
  };
  await upsertSettings(userId, patch);
  return settingsView(userId);
}

export interface RestartResult {
  previousRun: (RunView & { closedAs: "finished" | "abandoned" }) | null;
  run: RunView;
}

/**
 * Close the active run (as "finished" when every day was completed/skipped,
 * else "abandoned") and start a new one. History of old runs is kept.
 */
export async function restartProgram(userId: string, input: RestartProgramInput = {}): Promise<RestartResult> {
  const v = parseInput(restartProgramSchema, input);
  const prog = await program.getProgram();
  if (!prog) throw new ServiceError("NOT_FOUND", "No hay programa cargado");
  const settings = await getSettings(userId);
  if (!settings) throw new ServiceError("NOT_ONBOARDED", "Completa la bienvenida primero");
  const days = await program.listProgramDays(prog.id);

  return db.transaction(async (tx) => {
    const active = await logs.getActiveRun(userId, tx);
    let previousRun: RestartResult["previousRun"] = null;
    if (active) {
      const runLogs = await logs.listWorkoutLogsForRun(userId, active.id);
      const done = doneDayIdsFromLogs(runLogs.map((l) => ({ workoutDayId: l.workoutDayId, status: l.status })));
      const closedAs = days.every((d) => done.has(d.day.id)) ? "finished" : "abandoned";
      await logs.closeActiveRun(userId, closedAs, tx);
      previousRun = { ...toRunView(active), status: closedAs, closedAs };
    }
    const run = await logs.createRun(userId, prog.id, v.startedOn ?? today(), tx);
    return { previousRun, run: toRunView(run) };
  });
}

export { settingsView as getSettingsView };
