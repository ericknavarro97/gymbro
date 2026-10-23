"use server";
/** Onboarding / profile server actions (see workout.actions.ts for the revalidation rationale). */
import { revalidatePath } from "next/cache";
import { requireUser } from "../auth/session";
import * as onboarding from "../services/onboarding.service";
import type {
  CompleteOnboardingInput,
  RestartProgramInput,
  UpdateSettingsInput,
} from "../services/validation";
import type { SettingsView } from "../services/workout.service";
import { toResult, type ActionResult } from "./result";

export async function completeOnboardingAction(
  input: CompleteOnboardingInput,
): Promise<ActionResult<onboarding.OnboardingResult>> {
  const user = await requireUser();
  const r = await toResult(() => onboarding.completeOnboarding(user.id, input));
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function updateSettingsAction(input: UpdateSettingsInput): Promise<ActionResult<SettingsView>> {
  const user = await requireUser();
  const r = await toResult(() => onboarding.updateSettings(user.id, input));
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function restartProgramAction(
  input: RestartProgramInput = {},
): Promise<ActionResult<onboarding.RestartResult>> {
  const user = await requireUser();
  const r = await toResult(() => onboarding.restartProgram(user.id, input));
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
