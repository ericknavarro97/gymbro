import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/profile-view";
import { PageSkeleton } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getProfileState } from "@/server/services/profile.service";

export const metadata: Metadata = { title: "Perfil" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton label="Cargando perfil" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireUser();
  const state = await getProfileState(user.id);
  const startedOn = state.run
    ? new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${state.run.startedOn}T00:00:00Z`))
    : null;
  return (
    <ProfileView
      user={{
        name: user.name ?? "",
        username: user.displayUsername ?? user.username ?? "",
      }}
      onboarded={state.onboarded}
      settings={state.settings}
      weakPoints={state.weakPoints}
      runStartedOn={startedOn}
    />
  );
}
