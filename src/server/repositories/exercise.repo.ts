/** Exercise catalog queries. */
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { exercises } from "../db/schema";

export type ExerciseRow = typeof exercises.$inferSelect;

export async function getExerciseBySlug(slug: string): Promise<ExerciseRow | null> {
  const [e] = await db.select().from(exercises).where(eq(exercises.slug, slug)).limit(1);
  return e ?? null;
}

export async function getExerciseById(id: number): Promise<ExerciseRow | null> {
  const [e] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
  return e ?? null;
}

/** Map id → row for the given ids (missing ids are simply absent). */
export async function getExercisesByIds(ids: Iterable<number>): Promise<Map<number, ExerciseRow>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db.select().from(exercises).where(inArray(exercises.id, unique));
  return new Map(rows.map((r) => [r.id, r]));
}
