/**
 * Serializable view shapes returned by services (safe to pass from Server
 * Components to Client Components: plain objects, dates as ISO strings).
 */
import type { ExerciseMatch, PrescriptionSlot, TechniqueScope, WorkoutDayKind } from "../db/schema";
import {
  DEFAULT_WARMUP_PROTOCOL,
  formatSetTarget,
  targetForSet,
  type ProgressionSuggestion,
  type RepsScheme,
  type SetTarget,
  type WarmupPlan,
  type WarmupProtocol,
  type WeightUnit,
} from "../domain";
import type { ExerciseRow } from "../repositories/exercise.repo";
import type { SetLogRow } from "../repositories/logs.repo";
import type {
  BlockRow,
  PrescriptionRow,
  TechniqueRow,
  WeakPointRow,
  WeekRow,
  WorkoutDayRow,
} from "../repositories/program.repo";

export interface ExerciseSummary {
  id: number;
  slug: string;
  name: string;
  youtubeId: string | null;
  datasetId: string | null;
  match: ExerciseMatch;
  matchNote: string | null;
  /** `/media/exercises/{datasetId}.gif` or null when unmapped. */
  gifPath: string | null;
  /** `/media/exercises/{datasetId}.jpg` or null when unmapped. */
  thumbPath: string | null;
  target: string | null;
  equipment: string | null;
}

export interface ExerciseDetailView extends ExerciseSummary {
  bodyPart: string | null;
  secondaryMuscles: string[];
  instructionsEs: string[];
  instructionsEn: string[];
}

export interface WeekView {
  id: number;
  number: number;
  isDeload: boolean;
  banner: string | null;
  bannerEs: string | null;
}

export interface BlockView {
  id: number;
  number: number;
  name: string;
  nameEs: string | null;
  description: string | null;
}

export interface DayView {
  id: number;
  position: number;
  name: string;
  kind: WorkoutDayKind;
  restAfter: boolean;
}

export interface TechniqueView {
  key: string;
  name: string;
  nameEs: string | null;
  scope: TechniqueScope;
  descriptionEs: string | null;
}

export interface WeakPointView {
  id: number;
  key: string;
  nameEn: string;
  nameEs: string;
  guidanceEn: string | null;
  guidanceEs: string | null;
}

export type ExerciseChoiceKind = "main" | "sub1" | "sub2" | "weak_point_option";

export interface ExerciseChoice {
  kind: ExerciseChoiceKind;
  exercise: ExerciseSummary;
  /** Weak point option note (e.g. "1 arm at a time"), else null. */
  note: string | null;
}

export interface SetTargetView extends SetTarget {
  /** e.g. "10-12", "5 / 4 / 3+", "8-10 + 4-6". */
  label: string;
}

export interface PrescriptionView {
  id: number;
  position: number;
  slot: PrescriptionSlot;
  isOptional: boolean;
  supersetGroup: string | null;
  supersetOrder: number | null;
  /** "A1", "B2"… or null when not in a superset. */
  supersetLabel: string | null;
  /** Main exercise (null for weak-point slots). */
  exercise: ExerciseSummary | null;
  sub1: ExerciseSummary | null;
  sub2: ExerciseSummary | null;
  /**
   * Allowed choices for `chooseExercise`: main/sub1/sub2, or the user's weak
   * point options for this slot (empty when no weak point is set or it has
   * no options for this slot).
   */
  choices: ExerciseChoice[];
  technique: TechniqueView | null;
  workingSets: number;
  warmup: { text: string | null; min: number | null; max: number | null };
  reps: {
    text: string;
    scheme: RepsScheme | null;
    segmented: boolean;
    /** One entry per working set (set 1..workingSets). */
    targets: SetTargetView[];
  };
  earlyRpe: { text: string | null; min: number | null; max: number | null };
  lastRpe: { text: string | null; min: number | null; max: number | null };
  rest: { text: string | null; minSec: number | null; maxSec: number | null };
  notesEn: string | null;
  notesEs: string | null;
}

export interface SetView {
  setNumber: number;
  weight: number | null;
  unit: WeightUnit;
  reps: number | null;
  rpe: number | null;
  segmentReps: number[] | null;
  updatedAt: string;
}

export interface LastPerformanceView {
  workoutLogId: string;
  runId: string;
  /** completedAt ?? startedAt, ISO. */
  date: string;
  weekNumber: number;
  dayPosition: number;
  dayName: string;
  /** Prescription the sets were logged under (may be another day's). */
  prescriptionId: number;
  sets: SetView[];
}

export interface SessionItem extends PrescriptionView {
  exerciseLogId: string | null;
  /** Exercise being performed: the saved choice, else the default (main / first weak point option). */
  performedExercise: ExerciseSummary | null;
  /** true while no exercise_log exists yet (performedExercise is the default). */
  performedIsDefault: boolean;
  sets: SetView[];
  lastPerformance: LastPerformanceView | null;
  /** App's own double-progression rule (PLAN §4.4); null when there's no previous data. */
  suggestion: ProgressionSuggestion | null;
  /**
   * Warm-up computed from current set 1 weight, else last performance set 1
   * (converted to the user's unit). Null when the prescription has 0 warm-up sets.
   */
  warmupPlan: WarmupPlan | null;
}

// ------------------------------------------------------------------ mappers

export function toExerciseSummary(e: ExerciseRow): ExerciseSummary {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    youtubeId: e.youtubeId,
    datasetId: e.datasetId,
    match: e.match,
    matchNote: e.matchNote,
    gifPath: e.gifPath,
    thumbPath: e.thumbPath,
    target: e.target,
    equipment: e.equipment,
  };
}

export function toExerciseDetail(e: ExerciseRow): ExerciseDetailView {
  return {
    ...toExerciseSummary(e),
    bodyPart: e.bodyPart,
    secondaryMuscles: e.secondaryMuscles,
    instructionsEs: e.instructionsEs,
    instructionsEn: e.instructionsEn,
  };
}

export const toWeekView = (w: WeekRow): WeekView => ({
  id: w.id,
  number: w.number,
  isDeload: w.isDeload,
  banner: w.banner,
  bannerEs: w.bannerEs,
});

export const toBlockView = (b: BlockRow): BlockView => ({
  id: b.id,
  number: b.number,
  name: b.name,
  nameEs: b.nameEs,
  description: b.description,
});

export const toDayView = (d: WorkoutDayRow): DayView => ({
  id: d.id,
  position: d.position,
  name: d.name,
  kind: d.kind,
  restAfter: d.restAfter,
});

export const toTechniqueView = (t: TechniqueRow): TechniqueView => ({
  key: t.key,
  name: t.name,
  nameEs: t.nameEs,
  scope: t.scope,
  descriptionEs: t.descriptionEs,
});

export const toWeakPointView = (w: WeakPointRow): WeakPointView => ({
  id: w.id,
  key: w.key,
  nameEn: w.nameEn,
  nameEs: w.nameEs,
  guidanceEn: w.guidanceEn,
  guidanceEs: w.guidanceEs,
});

export function toSetView(s: SetLogRow): SetView {
  return {
    setNumber: s.setNumber,
    weight: s.weight,
    unit: s.weightUnit,
    reps: s.reps,
    rpe: s.rpe,
    segmentReps: s.segmentReps,
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function setTargets(scheme: RepsScheme | null, workingSets: number): SetTargetView[] {
  if (!scheme) return [];
  const out: SetTargetView[] = [];
  for (let n = 1; n <= Math.max(workingSets, 1); n++) {
    const t = targetForSet(scheme, n);
    out.push({ ...t, label: formatSetTarget(t) });
  }
  return out;
}

export function toPrescriptionView(
  p: PrescriptionRow,
  ctx: {
    exercises: Map<number, ExerciseRow>;
    techniques: Map<number, TechniqueRow>;
    weakPointChoices: ExerciseChoice[];
  },
): PrescriptionView {
  const ex = (id: number | null) => {
    const row = id !== null ? ctx.exercises.get(id) : undefined;
    return row ? toExerciseSummary(row) : null;
  };
  const exercise = ex(p.exerciseId);
  const sub1 = ex(p.sub1ExerciseId);
  const sub2 = ex(p.sub2ExerciseId);
  let choices: ExerciseChoice[];
  if (p.slot === "exercise") {
    choices = [];
    if (exercise) choices.push({ kind: "main", exercise, note: null });
    if (sub1) choices.push({ kind: "sub1", exercise: sub1, note: null });
    if (sub2) choices.push({ kind: "sub2", exercise: sub2, note: null });
  } else {
    choices = ctx.weakPointChoices;
  }
  const technique = p.techniqueId !== null ? ctx.techniques.get(p.techniqueId) : undefined;
  const scheme = (p.repsScheme ?? null) as RepsScheme | null;
  return {
    id: p.id,
    position: p.position,
    slot: p.slot,
    isOptional: p.isOptional,
    supersetGroup: p.supersetGroup,
    supersetOrder: p.supersetOrder,
    supersetLabel: p.supersetGroup ? `${p.supersetGroup}${p.supersetOrder ?? ""}` : null,
    exercise,
    sub1,
    sub2,
    choices,
    technique: technique ? toTechniqueView(technique) : null,
    workingSets: p.workingSets,
    warmup: { text: p.warmupText, min: p.warmupSetsMin, max: p.warmupSetsMax },
    reps: {
      text: p.repsText,
      scheme,
      segmented: scheme?.type === "mechanical_dropset" || scheme?.type === "compound",
      targets: setTargets(scheme, p.workingSets),
    },
    earlyRpe: { text: p.earlyRpeText, min: p.earlyRpeMin, max: p.earlyRpeMax },
    lastRpe: { text: p.lastRpeText, min: p.lastRpeMin, max: p.lastRpeMax },
    rest: { text: p.restText, minSec: p.restMinSec, maxSec: p.restMaxSec },
    notesEn: p.notesEn,
    notesEs: p.notesEs,
  };
}

export function resolveProtocol(p: WarmupProtocol | null): WarmupProtocol {
  return p ?? DEFAULT_WARMUP_PROTOCOL;
}
