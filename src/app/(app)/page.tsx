import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageBody, PageHeader } from "@/components/layout/page";
import { relativeDay } from "@/components/program/format";
import {
  FinishedCard,
  InProgressCard,
  LastCompletedCard,
  NextSessionCard,
  ProgramProgress,
  RestDayNotice,
} from "@/components/today/today-cards";
import { getWarmupGuide } from "@/components/today/warmup-data";
import { WarmupGuideButton } from "@/components/today/warmup-guide";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";
import { APP_TIME_ZONE, getProgramOverview, getTodayOverview } from "@/server/services/workout.service";

export const metadata: Metadata = { title: "Hoy" };

export default function HoyPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Cargando Hoy" />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const user = await requireUser();
  const today = await getTodayOverview(user.id);
  // Keep: users without settings/run go through onboarding first.
  if (today.needsOnboarding) redirect("/bienvenida");

  const [overview, guide] = await Promise.all([getProgramOverview(user.id), getWarmupGuide()]);
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat("es-MX", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  const weeks = overview.blocks.flatMap((b) => b.weeks);
  const deloadIndexes = weeks.filter((w) => w.isDeload).map((w) => w.number - 1);
  const { next, inProgress, lastCompleted } = today;
  const firstName = user.name?.trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader eyebrow={dateLabel} title={firstName ? `Hola, ${firstName}` : "Hoy"} />
      <PageBody>
        {today.restDay && !inProgress && !today.programFinished ? (
          <RestDayNotice lastDayName={lastCompleted?.dayName ?? null} />
        ) : null}

        {inProgress && (!next || inProgress.dayId !== next.day.id) ? <InProgressCard inProgress={inProgress} /> : null}

        {today.programFinished ? (
          <FinishedCard />
        ) : next ? (
          <NextSessionCard next={next} inProgress={inProgress} />
        ) : (
          <Card padding="lg">
            <p className="font-semibold">No hay sesiones pendientes.</p>
          </Card>
        )}

        <ProgramProgress
          progress={today.progress}
          deloadIndexes={deloadIndexes}
          currentWeek={next?.week.number ?? null}
        />

        <WarmupGuideButton guide={guide} />

        {lastCompleted ? (
          <LastCompletedCard last={lastCompleted} when={relativeDay(lastCompleted.completedAt, now, APP_TIME_ZONE)} />
        ) : null}
      </PageBody>
    </>
  );
}
