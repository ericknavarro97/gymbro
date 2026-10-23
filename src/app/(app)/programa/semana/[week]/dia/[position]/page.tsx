import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MediaCredit } from "@/components/exercise/media-credit";
import { PageBody, PageHeader } from "@/components/layout/page";
import { DayPrescriptions } from "@/components/program/day-prescriptions";
import { DAY_STATUS, blockName, deloadText, startLabel } from "@/components/program/format";
import { StartWorkoutButton } from "@/components/today/start-workout-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { PageSkeleton } from "@/components/ui/skeleton";
import { WeekBanner } from "@/components/workout/badges";
import { requireUser } from "@/server/auth/session";
import { isServiceError } from "@/server/services/errors";
import { getWorkoutDayDetailByPosition, type WorkoutDayDetail } from "@/server/services/workout.service";

export const metadata: Metadata = { title: "Vista previa del día" };

export default function DiaPage({ params }: PageProps<"/programa/semana/[week]/dia/[position]">) {
  return (
    <Suspense fallback={<PageSkeleton label="Cargando día" />}>
      <Day params={params} />
    </Suspense>
  );
}

async function Day({ params }: { params: PageProps<"/programa/semana/[week]/dia/[position]">["params"] }) {
  const { week, position } = await params;
  const user = await requireUser();
  let detail: WorkoutDayDetail;
  try {
    detail = await getWorkoutDayDetailByPosition(user.id, Number(week), Number(position));
  } catch (e) {
    if (isServiceError(e) && (e.code === "NOT_FOUND" || e.code === "VALIDATION")) notFound();
    throw e;
  }

  const { day, block, workoutLog, prescriptions } = detail;
  const deload = deloadText(detail.week);
  const status = workoutLog ? DAY_STATUS[workoutLog.status] : null;
  const setCount = prescriptions.reduce((acc, p) => acc + p.workingSets, 0);

  return (
    <>
      <PageHeader
        back="/programa"
        backLabel="Volver al programa"
        size="md"
        eyebrow={`Semana ${detail.week.number} · ${blockName(block)}`}
        title={day.name}
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-1.5">
          {status ? (
            <Badge tone={status.tone} icon={workoutLog?.status === "completed" ? <Icon.Check className="size-3.5" /> : undefined}>
              {status.label}
            </Badge>
          ) : null}
          <Badge icon={<Icon.Dumbbell className="size-3.5" />}>{prescriptions.length} ejercicios</Badge>
          <Badge>{setCount} series efectivas</Badge>
          {day.restAfter ? <Badge tone="info">Descanso después</Badge> : null}
        </div>

        {deload ? <WeekBanner isDeload text={deload} /> : null}

        {prescriptions.length === 0 ? (
          <EmptyState icon={<Icon.Dumbbell />} title="Sin ejercicios" description="Este día no tiene prescripciones." />
        ) : (
          <DayPrescriptions
            prescriptions={prescriptions}
            needsWeakPoint={detail.needsWeakPoint}
            weakPoint={detail.settings.weakPoint}
          />
        )}

        <MediaCredit className="text-center" />

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-2 border-t border-line/70 bg-bg/90 px-4 py-3 backdrop-blur-md">
          <StartWorkoutButton
            workoutDayId={day.id}
            workoutLog={workoutLog}
            label={workoutLog?.status === "completed" ? "Ver sesión" : `${startLabel(workoutLog?.status)} sesión`}
          />
        </div>
      </PageBody>
    </>
  );
}
