/**
 * /perfil read model (additive; UI agent): onboarding state plus the exercise
 * options of every weak point, so the picker can preview what each choice
 * brings to the Arms & Weak Points day. Writes go through updateSettings /
 * restartProgram (settings.actions.ts).
 */
import * as program from "../repositories/program.repo";
import { translateWeakPointNote } from "../domain/weak-point-note";
import { getOnboardingState, type OnboardingState } from "./onboarding.service";
import { toExerciseSummary, type ExerciseSummary } from "./views";

export interface WeakPointOptionPreview {
  slot: 1 | 2;
  note: string | null;
  exercise: ExerciseSummary;
}

export interface ProfileState extends OnboardingState {
  weakPoints: Array<OnboardingState["weakPoints"][number] & { options: WeakPointOptionPreview[] }>;
}

export async function getProfileState(userId: string): Promise<ProfileState> {
  const state = await getOnboardingState(userId);
  const weakPoints = await Promise.all(
    state.weakPoints.map(async (w) => {
      const rows = await program.listWeakPointOptions(w.id);
      return {
        ...w,
        options: rows.map((r) => ({
          slot: (r.option.slot === 2 ? 2 : 1) as 1 | 2,
          note: translateWeakPointNote(r.option.note),
          exercise: toExerciseSummary(r.exercise),
        })),
      };
    }),
  );
  return { ...state, weakPoints };
}
