import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SessionScreen } from "@/components/session/session-screen";
import { PageSkeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";
import { isServiceError } from "@/server/services/errors";
import { getWorkoutSession } from "@/server/services/workout.service";

export const metadata: Metadata = { title: "Sesión" };

export default function Page({ params }: PageProps<"/sesion/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton label="Cargando sesión" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/sesion/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  let session;
  try {
    session = await getWorkoutSession(user.id, id);
  } catch (e) {
    if (isServiceError(e)) {
      if (e.code === "NOT_FOUND" || e.code === "VALIDATION") notFound();
      if (e.code === "NO_ACTIVE_RUN" || e.code === "NOT_ONBOARDED") redirect("/bienvenida");
    }
    throw e;
  }
  // The client store is built once from these props and Activity keeps it
  // alive across navigations, so rebuild it when a Perfil change alters what
  // it holds: the unit weights are typed in, and the weak point (its slots'
  // options). Unsaved edits survive the rebuild through the localStorage drafts.
  const storeKey = [session.workoutLog.id, session.settings.unit, session.settings.weakPoint?.key ?? "-"].join(":");
  return <SessionScreen key={storeKey} session={session} />;
}
