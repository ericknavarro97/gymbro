/** Integration-test fixtures: throwaway users (deleted afterwards, cascading their data) + catalog lookups. */
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db/client";
import { exercises, prescriptions, user, weeks, workoutDays } from "@/server/db/schema";
import { ServiceError, type ServiceErrorCode } from "@/server/services/errors";
import { completeOnboarding } from "@/server/services/onboarding.service";

const created: string[] = [];

export async function createTestUser(label = "u"): Promise<string> {
  const id = `test_${randomUUID()}`;
  const username = `t_${label}_${randomUUID().slice(0, 8)}`;
  await db.insert(user).values({
    id,
    name: `Test ${label}`,
    email: `${username}@gymbros.test`,
    username,
    displayUsername: username,
  });
  created.push(id);
  return id;
}

export async function createOnboardedUser(label = "u", weakPointKey: string | null = null) {
  const id = await createTestUser(label);
  await completeOnboarding(id, { unit: "lb", weakPointKey, startedOn: "2026-01-05" });
  return id;
}

export async function cleanupUsers() {
  if (created.length) await db.delete(user).where(inArray(user.id, created.splice(0)));
}

export async function dayId(week: number, position: number): Promise<number> {
  const [r] = await db
    .select({ id: workoutDays.id })
    .from(workoutDays)
    .innerJoin(weeks, eq(weeks.id, workoutDays.weekId))
    .where(and(eq(weeks.number, week), eq(workoutDays.position, position)));
  if (!r) throw new Error(`no day w${week} p${position}`);
  return r.id;
}

export async function exerciseId(slug: string): Promise<number> {
  const [r] = await db.select({ id: exercises.id }).from(exercises).where(eq(exercises.slug, slug));
  if (!r) throw new Error(`no exercise ${slug}`);
  return r.id;
}

/** Prescription of a day whose main exercise is `slug`. */
export async function prescriptionFor(dayIdValue: number, slug: string) {
  const ex = await exerciseId(slug);
  const [p] = await db
    .select()
    .from(prescriptions)
    .where(and(eq(prescriptions.workoutDayId, dayIdValue), eq(prescriptions.exerciseId, ex)));
  if (!p) throw new Error(`no prescription for ${slug} in day ${dayIdValue}`);
  return p;
}

export async function prescriptionBySlot(dayIdValue: number, slot: "weak_point_1" | "weak_point_2") {
  const [p] = await db
    .select()
    .from(prescriptions)
    .where(and(eq(prescriptions.workoutDayId, dayIdValue), eq(prescriptions.slot, slot)));
  if (!p) throw new Error(`no ${slot} in day ${dayIdValue}`);
  return p;
}

/** Await a promise expected to reject with a ServiceError of `code`. */
export async function expectServiceError(p: Promise<unknown>, code: ServiceErrorCode) {
  try {
    await p;
  } catch (e) {
    if (e instanceof ServiceError && e.code === code) return e;
    throw new Error(`expected ServiceError ${code}, got ${e instanceof ServiceError ? e.code : String(e)}`);
  }
  throw new Error(`expected ServiceError ${code}, but it resolved`);
}
