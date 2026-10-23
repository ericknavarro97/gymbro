import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SessionDetail } from "@/components/history/session-detail";
import { PageSkeleton } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { isServiceError } from "@/server/services/errors";
import { APP_TIME_ZONE, getWorkoutSession } from "@/server/services/workout.service";

export const metadata: Metadata = { title: "Sesión" };

export default function Page({ params }: PageProps<"/historial/[workoutLogId]">) {
  return (
    <Suspense fallback={<PageSkeleton label="Cargando sesión" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/historial/[workoutLogId]">["params"] }) {
  const { workoutLogId } = await params;
  const user = await requireUser();
  let session;
  try {
    session = await getWorkoutSession(user.id, workoutLogId);
  } catch (e) {
    if (isServiceError(e)) {
      if (e.code === "NOT_FOUND" || e.code === "VALIDATION") notFound();
      if (e.code === "NO_ACTIVE_RUN" || e.code === "NOT_ONBOARDED") redirect("/bienvenida");
    }
    throw e;
  }
  return <SessionDetail session={session} timeZone={APP_TIME_ZONE} />;
}
