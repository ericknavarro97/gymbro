/** Read-only catalog queries (program structure, prescriptions, weak points, warm-up). */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
  blocks,
  exercises,
  generalWarmup,
  prescriptions,
  programs,
  techniques,
  warmupProtocol,
  weakPointOptions,
  weakPoints,
  weeks,
  workoutDays,
} from "../db/schema";
import type { WarmupProtocol, WarmupProtocolStep } from "../domain";

export type ProgramRow = typeof programs.$inferSelect;
export type BlockRow = typeof blocks.$inferSelect;
export type WeekRow = typeof weeks.$inferSelect;
export type WorkoutDayRow = typeof workoutDays.$inferSelect;
export type PrescriptionRow = typeof prescriptions.$inferSelect;
export type TechniqueRow = typeof techniques.$inferSelect;
export type WeakPointRow = typeof weakPoints.$inferSelect;
export type WeakPointOptionRow = typeof weakPointOptions.$inferSelect;

/** The app ships a single program; the first one by id is "the" program. */
export async function getProgram(): Promise<ProgramRow | null> {
  const [p] = await db.select().from(programs).orderBy(asc(programs.id)).limit(1);
  return p ?? null;
}

export interface DayWithWeek {
  day: WorkoutDayRow;
  week: WeekRow;
  block: BlockRow;
}

/** All days of a program ordered by week → position, with their week and block. */
export async function listProgramDays(programId: number): Promise<DayWithWeek[]> {
  const rows = await db
    .select({ day: workoutDays, week: weeks, block: blocks })
    .from(workoutDays)
    .innerJoin(weeks, eq(weeks.id, workoutDays.weekId))
    .innerJoin(blocks, eq(blocks.id, weeks.blockId))
    .where(eq(blocks.programId, programId))
    .orderBy(asc(weeks.number), asc(workoutDays.position));
  return rows;
}

export async function listBlocks(programId: number): Promise<BlockRow[]> {
  return db.select().from(blocks).where(eq(blocks.programId, programId)).orderBy(asc(blocks.number));
}

export async function getDayWithWeek(dayId: number): Promise<DayWithWeek | null> {
  const [row] = await db
    .select({ day: workoutDays, week: weeks, block: blocks })
    .from(workoutDays)
    .innerJoin(weeks, eq(weeks.id, workoutDays.weekId))
    .innerJoin(blocks, eq(blocks.id, weeks.blockId))
    .where(eq(workoutDays.id, dayId))
    .limit(1);
  return row ?? null;
}

export async function findDayByWeekAndPosition(
  programId: number,
  weekNumber: number,
  position: number,
): Promise<DayWithWeek | null> {
  const [row] = await db
    .select({ day: workoutDays, week: weeks, block: blocks })
    .from(workoutDays)
    .innerJoin(weeks, eq(weeks.id, workoutDays.weekId))
    .innerJoin(blocks, eq(blocks.id, weeks.blockId))
    .where(
      and(
        eq(blocks.programId, programId),
        eq(weeks.number, weekNumber),
        eq(workoutDays.position, position),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listPrescriptionsForDay(dayId: number): Promise<PrescriptionRow[]> {
  return db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.workoutDayId, dayId))
    .orderBy(asc(prescriptions.position));
}

export async function getPrescription(id: number): Promise<PrescriptionRow | null> {
  const [p] = await db.select().from(prescriptions).where(eq(prescriptions.id, id)).limit(1);
  return p ?? null;
}

export async function getPrescriptionsByIds(ids: number[]): Promise<PrescriptionRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(prescriptions).where(inArray(prescriptions.id, ids));
}

export async function getTechniquesByIds(ids: number[]): Promise<TechniqueRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(techniques).where(inArray(techniques.id, ids));
}

export async function listWeakPoints(): Promise<WeakPointRow[]> {
  return db.select().from(weakPoints).orderBy(asc(weakPoints.id));
}

export async function getWeakPointByKey(key: string): Promise<WeakPointRow | null> {
  const [w] = await db.select().from(weakPoints).where(eq(weakPoints.key, key)).limit(1);
  return w ?? null;
}

export async function getWeakPointById(id: number): Promise<WeakPointRow | null> {
  const [w] = await db.select().from(weakPoints).where(eq(weakPoints.id, id)).limit(1);
  return w ?? null;
}

/** Options for one weak point, ordered by slot → position, with their exercise rows. */
export async function listWeakPointOptions(weakPointId: number) {
  return db
    .select({ option: weakPointOptions, exercise: exercises })
    .from(weakPointOptions)
    .innerJoin(exercises, eq(exercises.id, weakPointOptions.exerciseId))
    .where(eq(weakPointOptions.weakPointId, weakPointId))
    .orderBy(asc(weakPointOptions.slot), asc(weakPointOptions.position));
}

/** Warm-up protocol from the DB, falling back to nothing (callers use the domain default). */
export async function getWarmupProtocol(): Promise<WarmupProtocol | null> {
  const rows = await db
    .select()
    .from(warmupProtocol)
    .orderBy(asc(warmupProtocol.setsCount), asc(warmupProtocol.setNumber));
  const by: Record<1 | 2 | 3, WarmupProtocolStep[]> = { 1: [], 2: [], 3: [] };
  for (const r of rows) {
    if (r.setsCount === 1 || r.setsCount === 2 || r.setsCount === 3) {
      by[r.setsCount].push({
        setNumber: r.setNumber,
        pctOfWorking: r.pctOfWorking,
        repsText: r.repsText,
      });
    }
  }
  if (by[1].length !== 1 || by[2].length !== 2 || by[3].length !== 3) return null;
  return by;
}

export async function listGeneralWarmup() {
  return db.select().from(generalWarmup).orderBy(asc(generalWarmup.position));
}
