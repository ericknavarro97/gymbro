"use server";
/**
 * Workout server actions. Each one authenticates with requireUser() (redirects
 * to /login when signed out), validates with zod inside the service, and
 * scopes everything by the session user's id.
 *
 * Revalidation (Cache Components): user data is never cached with "use cache",
 * so pages always render fresh on the server; revalidatePath("/", "layout")
 * re-renders the current route in the action response and drops stale
 * client-router entries for Hoy/Programa/Historial. saveSet/chooseExercise
 * skip it on purpose: they are autosave calls whose return value carries the
 * new state, and re-rendering the session on each keystroke would be wasteful.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "../auth/session";
import * as workout from "../services/workout.service";
import type { ChooseExerciseInput, SaveSetInput } from "../services/validation";
import type { SessionItem } from "../services/views";
import { toResult, type ActionResult } from "./result";

function revalidateApp() {
  revalidatePath("/", "layout");
}

export async function startWorkoutAction(input: {
  workoutDayId: number;
}): Promise<ActionResult<workout.StartWorkoutResult>> {
  const user = await requireUser();
  const r = await toResult(() => workout.startWorkout(user.id, input));
  if (r.ok && (r.data.created || r.data.status === "in_progress")) revalidateApp();
  return r;
}

export async function saveSetAction(input: SaveSetInput): Promise<ActionResult<workout.SaveSetResult>> {
  const user = await requireUser();
  return toResult(() => workout.saveSet(user.id, input));
}

export async function chooseExerciseAction(
  input: ChooseExerciseInput,
): Promise<ActionResult<SessionItem>> {
  const user = await requireUser();
  return toResult(() => workout.chooseExercise(user.id, input));
}

export async function completeWorkoutAction(input: {
  workoutLogId: string;
}): Promise<ActionResult<workout.CloseWorkoutResult>> {
  const user = await requireUser();
  const r = await toResult(() => workout.completeWorkout(user.id, input));
  if (r.ok) revalidateApp();
  return r;
}

export async function skipWorkoutAction(input: {
  workoutLogId: string;
}): Promise<ActionResult<workout.CloseWorkoutResult>> {
  const user = await requireUser();
  const r = await toResult(() => workout.skipWorkout(user.id, input));
  if (r.ok) revalidateApp();
  return r;
}
