/**
 * Catalog seed (PLAN §2.5). Idempotent: every row is upserted by its natural
 * key, so running it N times leaves the same counts. It NEVER touches user
 * tables (user, session, account, verification, user_settings, program_runs,
 * workout_logs, exercise_logs, set_logs).
 *
 * Inputs (data contract):
 *   data/source/exercises.json      required
 *   data/source/program.json        required
 *   data/source/techniques.json     recommended (missing → technique_id NULL, warning)
 *   data/source/weak-points.json    recommended (missing → no weak points, warning)
 *   data/source/warmup.json         recommended (missing → no warm-up rows, warning)
 *   data/source/notes-es.json       optional    (missing → notes_es NULL, warning)
 *   data/mapping/exercise-map.json  optional    (missing → dataset fields NULL, warning)
 *   .cache/exercises-dataset/data/exercises.json  optional (dataset fields)
 *
 * Usage: pnpm db:seed
 *   (SEED_EXERCISE_MAP / SEED_NOTES_ES env vars override those two paths, for testing)
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, count, eq, getTableColumns, notInArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db, sql as pg, type Transaction } from "../src/server/db/client";
import * as s from "../src/server/db/schema";
import { parseReps, parseRest, parseRpe, parseWarmupSets } from "../src/server/domain";
import { isNotApplicable } from "../src/server/domain/text";
import { translateWeakPointNote } from "../src/server/domain/weak-point-note";

const ROOT = path.resolve(__dirname, "..");
const P = {
  exercises: "data/source/exercises.json",
  program: "data/source/program.json",
  techniques: "data/source/techniques.json",
  weakPoints: "data/source/weak-points.json",
  warmup: "data/source/warmup.json",
  notesEs: process.env.SEED_NOTES_ES ?? "data/source/notes-es.json",
  exerciseMap: process.env.SEED_EXERCISE_MAP ?? "data/mapping/exercise-map.json",
  dataset: ".cache/exercises-dataset/data/exercises.json",
} as const;

// ------------------------------------------------------------------ contract types

type SourceExercise = { slug: string; name: string; youtubeId: string | null };
type SourcePrescription = {
  position: number;
  slot: "exercise" | "weak_point_1" | "weak_point_2";
  exercise: string | null;
  sub1: string | null;
  sub2: string | null;
  supersetGroup: string | null;
  supersetOrder: number | null;
  technique: string | null;
  warmupText: string | null;
  workingSets: number;
  repsText: string;
  earlyRpeText: string | null;
  lastRpeText: string | null;
  restText: string | null;
  notesEn: string | null;
  isOptional: boolean;
};
type SourceProgram = {
  program: { slug: string; name: string; author: string | null; description?: string | null };
  blocks: { number: number; name: string; nameEs: string | null; description: string | null }[];
  weeks: {
    number: number;
    block: number;
    isDeload: boolean;
    banner: string | null;
    bannerEs: string | null;
  }[];
  days: {
    week: number;
    position: number;
    name: string;
    kind: "full_body" | "arms_weak_points";
    restAfter: boolean;
    prescriptions: SourcePrescription[];
  }[];
};
type SourceTechnique = {
  key: string;
  name: string;
  nameEs: string | null;
  scope: "last_set" | "all_sets" | "between_sets";
  descriptionEs: string | null;
};
type SourceWeakPoint = {
  key: string;
  nameEn: string;
  nameEs: string;
  guidanceEn: string | null;
  guidanceEs: string | null;
  options: { slot: 1 | 2; position: number; exercise: string; note: string | null }[];
};
type SourceWarmup = {
  general: { position: number; item: string; itemEs: string | null; dose: string | null; doseEs: string | null }[];
  specific: { setsCount: number; setNumber: number; pctOfWorking: number; repsText: string }[];
  programNotesEs?: string[];
};
type ExerciseMap = Record<
  string,
  { datasetId: string | null; match: "exact" | "approx" | "none"; matchNote: string | null }
>;
type DatasetExercise = {
  id: string;
  name: string;
  body_part?: string | null;
  equipment?: string | null;
  target?: string | null;
  secondary_muscles?: string[] | null;
  instruction_steps?: { es?: string[]; en?: string[] } | null;
};

// ------------------------------------------------------------------ helpers

const warnings: string[] = [];
function warn(msg: string) {
  warnings.push(msg);
  console.warn(`  ! ${msg}`);
}

function readJson<T>(rel: string, opts: { required: true }): T;
function readJson<T>(rel: string, opts?: { required?: false }): T | null;
function readJson<T>(rel: string, opts: { required?: boolean } = {}): T | null {
  const abs = path.resolve(ROOT, rel);
  if (!existsSync(abs)) {
    if (opts.required) throw new Error(`Missing required file: ${rel}`);
    return null;
  }
  return JSON.parse(readFileSync(abs, "utf8")) as T;
}

/** `SET col = excluded.col` for every column except the PK/createdAt (and any extra excluded keys). */
function upsertSet<T extends PgTable>(table: T, exclude: string[] = []): Record<string, SQL> {
  const cols = getTableColumns(table) as Record<string, { name: string; primary: boolean }>;
  const out: Record<string, SQL> = {};
  for (const [key, col] of Object.entries(cols)) {
    if (col.primary || key === "createdAt" || exclude.includes(key)) continue;
    out[key] = key === "updatedAt" ? sql`now()` : sql.raw(`excluded."${col.name}"`);
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function rpeColumns(text: string | null) {
  if (text == null || isNotApplicable(text)) return { min: null, max: null };
  const r = parseRpe(text);
  return { min: r.min, max: r.max };
}

// ------------------------------------------------------------------ load inputs

function loadInputs() {
  const exercises = readJson<SourceExercise[]>(P.exercises, { required: true });
  const program = readJson<SourceProgram>(P.program, { required: true });

  const techniques = readJson<SourceTechnique[]>(P.techniques);
  if (!techniques) warn(`${P.techniques} not found → prescriptions.technique_id will be NULL`);
  const weakPoints = readJson<SourceWeakPoint[]>(P.weakPoints);
  if (!weakPoints) warn(`${P.weakPoints} not found → no weak points seeded`);
  const warmup = readJson<SourceWarmup>(P.warmup);
  if (!warmup) warn(`${P.warmup} not found → no warm-up protocol / general warm-up seeded`);
  const notesEs = readJson<Record<string, string>>(P.notesEs);
  if (!notesEs) warn(`${P.notesEs} not found → prescriptions.notes_es will be NULL`);
  const exerciseMap = readJson<ExerciseMap>(P.exerciseMap);
  if (!exerciseMap) warn(`${P.exerciseMap} not found → exercise dataset fields will be NULL`);
  const datasetList = readJson<DatasetExercise[]>(P.dataset);
  if (!datasetList && exerciseMap) warn(`${P.dataset} not found → dataset fields (muscles, instructions) NULL`);
  const dataset = new Map((datasetList ?? []).map((d) => [d.id, d]));

  return { exercises, program, techniques, weakPoints, warmup, notesEs, exerciseMap, dataset };
}

type Inputs = ReturnType<typeof loadInputs>;

// ------------------------------------------------------------------ seed steps

async function seedExercises(tx: Transaction, inp: Inputs): Promise<Map<string, number>> {
  const seen = new Set<string>();
  const rows = inp.exercises.map((e) => {
    if (seen.has(e.slug)) throw new Error(`Duplicate exercise slug in ${P.exercises}: ${e.slug}`);
    seen.add(e.slug);

    const m = inp.exerciseMap?.[e.slug];
    if (inp.exerciseMap && !m) warn(`exercise-map has no entry for "${e.slug}"`);
    const datasetId = m?.datasetId ?? null;
    const ds = datasetId ? inp.dataset.get(datasetId) : undefined;
    if (datasetId && inp.dataset.size > 0 && !ds) warn(`datasetId ${datasetId} (${e.slug}) not in dataset`);

    return {
      slug: e.slug,
      name: e.name,
      youtubeId: e.youtubeId ?? null,
      datasetId,
      match: m?.match ?? ("none" as const),
      matchNote: m?.matchNote ?? null,
      gifPath: datasetId ? `/media/exercises/${datasetId}.gif` : null,
      thumbPath: datasetId ? `/media/exercises/${datasetId}.jpg` : null,
      target: ds?.target ?? null,
      secondaryMuscles: ds?.secondary_muscles ?? [],
      equipment: ds?.equipment ?? null,
      bodyPart: ds?.body_part ?? null,
      instructionsEs: ds?.instruction_steps?.es ?? [],
      instructionsEn: ds?.instruction_steps?.en ?? [],
    };
  });

  const ids = new Map<string, number>();
  for (const part of chunk(rows, 200)) {
    const res = await tx
      .insert(s.exercises)
      .values(part)
      .onConflictDoUpdate({ target: s.exercises.slug, set: upsertSet(s.exercises, ["slug"]) })
      .returning({ id: s.exercises.id, slug: s.exercises.slug });
    for (const r of res) ids.set(r.slug, r.id);
  }

  if (inp.exerciseMap) {
    for (const slug of Object.keys(inp.exerciseMap)) {
      if (!seen.has(slug)) warn(`exercise-map entry "${slug}" is not in ${P.exercises}`);
    }
  }
  return ids;
}

async function seedTechniques(tx: Transaction, inp: Inputs): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  if (!inp.techniques?.length) return ids;
  const res = await tx
    .insert(s.techniques)
    .values(
      inp.techniques.map((t) => ({
        key: t.key,
        name: t.name,
        nameEs: t.nameEs ?? null,
        scope: t.scope,
        descriptionEs: t.descriptionEs ?? null,
      })),
    )
    .onConflictDoUpdate({ target: s.techniques.key, set: upsertSet(s.techniques, ["key"]) })
    .returning({ id: s.techniques.id, key: s.techniques.key });
  for (const r of res) ids.set(r.key, r.id);
  return ids;
}

function exerciseId(ids: Map<string, number>, slug: string, where: string): number {
  const id = ids.get(slug);
  if (id === undefined) throw new Error(`Unknown exercise slug "${slug}" referenced in ${where}`);
  return id;
}

async function seedWeakPoints(tx: Transaction, inp: Inputs, exIds: Map<string, number>) {
  if (!inp.weakPoints?.length) return;
  for (const wp of inp.weakPoints) {
    const [row] = await tx
      .insert(s.weakPoints)
      .values({
        key: wp.key,
        nameEn: wp.nameEn,
        nameEs: wp.nameEs,
        guidanceEn: wp.guidanceEn ?? null,
        guidanceEs: wp.guidanceEs ?? null,
      })
      .onConflictDoUpdate({ target: s.weakPoints.key, set: upsertSet(s.weakPoints, ["key"]) })
      .returning({ id: s.weakPoints.id });

    const options = wp.options.map((o) => ({
      weakPointId: row.id,
      slot: o.slot,
      position: o.position,
      exerciseId: exerciseId(exIds, o.exercise, `weak point "${wp.key}"`),
      note: translateWeakPointNote(o.note),
    }));
    const kept: number[] = [];
    if (options.length) {
      const res = await tx
        .insert(s.weakPointOptions)
        .values(options)
        .onConflictDoUpdate({
          target: [s.weakPointOptions.weakPointId, s.weakPointOptions.slot, s.weakPointOptions.position],
          set: upsertSet(s.weakPointOptions, ["weakPointId", "slot", "position"]),
        })
        .returning({ id: s.weakPointOptions.id });
      kept.push(...res.map((r) => r.id));
    }
    // Options are not referenced by user data → safe to prune stale ones.
    await tx
      .delete(s.weakPointOptions)
      .where(
        kept.length
          ? and(eq(s.weakPointOptions.weakPointId, row.id), notInArray(s.weakPointOptions.id, kept))
          : eq(s.weakPointOptions.weakPointId, row.id),
      );
  }
}

async function seedWarmup(tx: Transaction, inp: Inputs) {
  if (!inp.warmup) return;
  const { general, specific } = inp.warmup;

  if (specific.length) {
    const res = await tx
      .insert(s.warmupProtocol)
      .values(
        specific.map((w) => ({
          setsCount: w.setsCount,
          setNumber: w.setNumber,
          // Accept either 45 or 0.45 in the source.
          pctOfWorking: w.pctOfWorking <= 1 ? Math.round(w.pctOfWorking * 100) : w.pctOfWorking,
          repsText: w.repsText,
        })),
      )
      .onConflictDoUpdate({
        target: [s.warmupProtocol.setsCount, s.warmupProtocol.setNumber],
        set: upsertSet(s.warmupProtocol, ["setsCount", "setNumber"]),
      })
      .returning({ id: s.warmupProtocol.id });
    await tx.delete(s.warmupProtocol).where(notInArray(s.warmupProtocol.id, res.map((r) => r.id)));
  }

  if (general.length) {
    const res = await tx
      .insert(s.generalWarmup)
      .values(
        general.map((g) => ({
          position: g.position,
          item: g.item,
          itemEs: g.itemEs ?? null,
          dose: g.dose ?? null,
          doseEs: g.doseEs ?? null,
        })),
      )
      .onConflictDoUpdate({ target: s.generalWarmup.position, set: upsertSet(s.generalWarmup, ["position"]) })
      .returning({ id: s.generalWarmup.id });
    await tx.delete(s.generalWarmup).where(notInArray(s.generalWarmup.id, res.map((r) => r.id)));
  }
}

async function seedProgram(
  tx: Transaction,
  inp: Inputs,
  exIds: Map<string, number>,
  techIds: Map<string, number>,
) {
  const src = inp.program;

  const [program] = await tx
    .insert(s.programs)
    .values({
      slug: src.program.slug,
      name: src.program.name,
      author: src.program.author ?? null,
      description: src.program.description ?? null,
      notesEs: inp.warmup?.programNotesEs ?? [],
    })
    .onConflictDoUpdate({ target: s.programs.slug, set: upsertSet(s.programs, ["slug"]) })
    .returning({ id: s.programs.id });

  const blockIds = new Map<number, number>();
  for (const b of src.blocks) {
    const [row] = await tx
      .insert(s.blocks)
      .values({
        programId: program.id,
        number: b.number,
        name: b.name,
        nameEs: b.nameEs ?? null,
        description: b.description ?? null,
      })
      .onConflictDoUpdate({
        target: [s.blocks.programId, s.blocks.number],
        set: upsertSet(s.blocks, ["programId", "number"]),
      })
      .returning({ id: s.blocks.id });
    blockIds.set(b.number, row.id);
  }

  const weekIds = new Map<number, number>();
  for (const w of src.weeks) {
    const blockId = blockIds.get(w.block);
    if (!blockId) throw new Error(`Week ${w.number} references unknown block ${w.block}`);
    const [row] = await tx
      .insert(s.weeks)
      .values({
        blockId,
        number: w.number,
        isDeload: w.isDeload,
        banner: w.banner ?? null,
        bannerEs: w.bannerEs ?? null,
      })
      .onConflictDoUpdate({
        target: [s.weeks.blockId, s.weeks.number],
        set: upsertSet(s.weeks, ["blockId", "number"]),
      })
      .returning({ id: s.weeks.id });
    weekIds.set(w.number, row.id);
  }

  const dayIds: number[] = [];
  let notesMissing = 0;
  const unknownTechniques = new Set<string>();
  for (const d of src.days) {
    const weekId = weekIds.get(d.week);
    if (!weekId) throw new Error(`Day "${d.name}" references unknown week ${d.week}`);
    const [day] = await tx
      .insert(s.workoutDays)
      .values({ weekId, position: d.position, name: d.name, kind: d.kind, restAfter: d.restAfter })
      .onConflictDoUpdate({
        target: [s.workoutDays.weekId, s.workoutDays.position],
        set: upsertSet(s.workoutDays, ["weekId", "position"]),
      })
      .returning({ id: s.workoutDays.id });
    dayIds.push(day.id);

    const where = `week ${d.week} / ${d.name}`;
    const rows = d.prescriptions.map((p) => {
      const at = `${where} #${p.position}`;
      if (p.slot === "exercise" && !p.exercise) throw new Error(`${at}: slot "exercise" without exercise`);
      let techniqueId: number | null = null;
      if (p.technique) {
        techniqueId = techIds.get(p.technique) ?? null;
        if (techniqueId === null) unknownTechniques.add(p.technique);
      }
      const warmup = p.warmupText != null && p.warmupText !== "" ? parseWarmupSets(p.warmupText) : null;
      const rest = p.restText != null ? parseRest(p.restText) : null;
      const early = rpeColumns(p.earlyRpeText);
      const last = rpeColumns(p.lastRpeText);
      const isKelso = p.exercise?.includes("kelso") ?? false;
      const notesEs = p.notesEn ? (inp.notesEs?.[p.notesEn] ?? null) : null;
      if (p.notesEn && inp.notesEs && notesEs === null) notesMissing++;

      return {
        workoutDayId: day.id,
        position: p.position,
        slot: p.slot,
        exerciseId: p.exercise ? exerciseId(exIds, p.exercise, at) : null,
        sub1ExerciseId: p.sub1 ? exerciseId(exIds, p.sub1, `${at} (sub1)`) : null,
        sub2ExerciseId: p.sub2 ? exerciseId(exIds, p.sub2, `${at} (sub2)`) : null,
        supersetGroup: p.supersetGroup ?? null,
        supersetOrder: p.supersetOrder ?? null,
        techniqueId,
        warmupText: p.warmupText ?? null,
        warmupSetsMin: warmup?.min ?? null,
        warmupSetsMax: warmup?.max ?? null,
        workingSets: p.workingSets,
        repsText: p.repsText,
        repsScheme: parseReps(p.repsText, isKelso ? { finisherLabel: "Kelso Shrug" } : {}),
        earlyRpeText: p.earlyRpeText ?? null,
        earlyRpeMin: early.min,
        earlyRpeMax: early.max,
        lastRpeText: p.lastRpeText ?? null,
        lastRpeMin: last.min,
        lastRpeMax: last.max,
        restText: p.restText ?? null,
        restMinSec: rest?.minSec ?? null,
        restMaxSec: rest?.maxSec ?? null,
        notesEn: p.notesEn ?? null,
        notesEs,
        isOptional: p.isOptional,
      };
    });

    const kept: number[] = [];
    if (rows.length) {
      const res = await tx
        .insert(s.prescriptions)
        .values(rows)
        .onConflictDoUpdate({
          target: [s.prescriptions.workoutDayId, s.prescriptions.position],
          set: upsertSet(s.prescriptions, ["workoutDayId", "position"]),
        })
        .returning({ id: s.prescriptions.id });
      kept.push(...res.map((r) => r.id));
    }
    // Prune prescriptions that disappeared from the source. If a user already
    // logged one, the FK (ON DELETE RESTRICT) aborts the seed instead of
    // silently destroying history.
    await tx
      .delete(s.prescriptions)
      .where(
        kept.length
          ? and(eq(s.prescriptions.workoutDayId, day.id), notInArray(s.prescriptions.id, kept))
          : eq(s.prescriptions.workoutDayId, day.id),
      );
  }

  if (unknownTechniques.size) {
    warn(`technique keys without a techniques.json entry (technique_id NULL): ${[...unknownTechniques].join(", ")}`);
  }
  if (notesMissing) warn(`${notesMissing} prescriptions have notes_en without a notes-es.json translation`);
  return { programId: program.id, dayIds };
}

// ------------------------------------------------------------------ main

async function printCounts() {
  const tables = {
    exercises: s.exercises,
    exercises_with_dataset: null,
    techniques: s.techniques,
    programs: s.programs,
    blocks: s.blocks,
    weeks: s.weeks,
    workout_days: s.workoutDays,
    prescriptions: s.prescriptions,
    prescriptions_with_notes_es: null,
    weak_points: s.weakPoints,
    weak_point_options: s.weakPointOptions,
    warmup_protocol: s.warmupProtocol,
    general_warmup: s.generalWarmup,
  } as const;
  const out: Record<string, number> = {};
  for (const [name, table] of Object.entries(tables)) {
    if (!table) continue;
    const [r] = await db.select({ n: count() }).from(table);
    out[name] = r.n;
  }
  const [withDs] = await db
    .select({ n: count() })
    .from(s.exercises)
    .where(sql`${s.exercises.datasetId} is not null`);
  out.exercises_with_dataset = withDs.n;
  const [withNotes] = await db
    .select({ n: count() })
    .from(s.prescriptions)
    .where(sql`${s.prescriptions.notesEs} is not null`);
  out.prescriptions_with_notes_es = withNotes.n;
  console.table(out);
  return out;
}

async function main() {
  const started = Date.now();
  console.log("GymBros seed — loading inputs…");
  const inp = loadInputs();

  await db.transaction(async (tx) => {
    const exIds = await seedExercises(tx, inp);
    const techIds = await seedTechniques(tx, inp);
    await seedWeakPoints(tx, inp, exIds);
    await seedWarmup(tx, inp);
    await seedProgram(tx, inp, exIds, techIds);
  });

  const counts = await printCounts();
  const expected = { weeks: 10, workout_days: 50, prescriptions: 315 };
  for (const [k, v] of Object.entries(expected)) {
    if (counts[k] !== v) warn(`expected ${v} ${k}, found ${counts[k]}`);
  }
  console.log(
    `Seed done in ${Date.now() - started} ms${warnings.length ? ` with ${warnings.length} warning(s)` : ""}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pg.end({ timeout: 5 });
  });

