import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { PageSkeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";
import { calendarDate } from "@/server/domain";
import { getOnboardingState } from "@/server/services/onboarding.service";
import { APP_TIME_ZONE } from "@/server/services/workout.service";

export const metadata: Metadata = { title: "Bienvenida" };

export default function BienvenidaPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  if (state.onboarded) redirect("/");
  const firstName = user.name?.split(" ")[0] ?? "";
  return (
    <OnboardingForm
      firstName={firstName}
      weakPoints={state.weakPoints}
      defaultUnit={state.settings.unit}
      defaultWeakPointKey={state.settings.weakPoint?.key ?? null}
      today={calendarDate(new Date(), APP_TIME_ZONE)}
    />
  );
}
