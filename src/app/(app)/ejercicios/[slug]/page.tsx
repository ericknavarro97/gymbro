import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExerciseMedia, VideoButton } from "@/components/exercise";
import { formatSetsLine, formatShortDate } from "@/components/history/format";
import { ExerciseInstructions } from "@/components/history/instructions";
import { bodyPartEs, equipmentEs, muscleEs, musclesEs } from "@/components/history/labels";
import { WeeklyLoadChart } from "@/components/history/weekly-load-chart";
import { PageBody, PageHeader, SectionTitle } from "@/components/layout/page";
import { Badge, Card, EmptyState, Icon, PageSkeleton } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { isServiceError } from "@/server/services/errors";
import { getExerciseDetail, getExerciseHistory } from "@/server/services/history.service";
import { APP_TIME_ZONE } from "@/server/services/workout.service";

export const metadata: Metadata = { title: "Ejercicio" };

export default function Page({ params }: PageProps<"/ejercicios/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function load<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (isServiceError(e) && (e.code === "NOT_FOUND" || e.code === "VALIDATION")) notFound();
    throw e;
  }
}

async function Content({ params }: { params: PageProps<"/ejercicios/[slug]">["params"] }) {
  const { slug } = await params;
  const user = await requireUser();
  const [ex, history] = await Promise.all([
    load(getExerciseDetail(slug)),
    load(getExerciseHistory(user.id, slug)),
  ]);

  const target = muscleEs(ex.target);
  const secondary = musclesEs(ex.secondaryMuscles, [target]);
  const equipment = equipmentEs(ex.equipment);
  const bodyPart = bodyPartEs(ex.bodyPart);
  const hasInstructions = ex.instructionsEs.length > 0 || ex.instructionsEn.length > 0;
  const chartable = history.weekly.filter((w) => w.weight !== null || w.reps !== null);
  const unit = history.unit;

  return (
    <>
      <PageHeader eyebrow={bodyPart ?? "Ejercicio"} title={ex.name} back="/programa" size="md" />
      <PageBody>
        <ExerciseMedia exercise={ex} size="hero" className="animate-rise" />

        <h2 className="-mb-2 font-display text-[1.75rem] leading-[1.05] font-bold text-balance uppercase">{ex.name}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {ex.gifPath || ex.thumbPath ? (
            ex.match === "exact" ? (
              <Badge tone="success" size="sm" icon={<Icon.Check className="size-3.5" />}>
                Animación exacta
              </Badge>
            ) : null
          ) : (
            <Badge tone="neutral" size="sm">
              Sin animación
            </Badge>
          )}
          {equipment ? (
            <Badge tone="neutral" size="sm" icon={<Icon.Dumbbell className="size-3.5" />}>
              {equipment}
            </Badge>
          ) : null}
        </div>

        <VideoButton youtubeId={ex.youtubeId} title={ex.name} size="md" block buttonVariant="secondary" />

        {target || secondary.length > 0 || equipment ? (
          <Card padding="md">
            <dl className="grid grid-cols-1 gap-3 text-sm">
              {target ? (
                <div>
                  <dt className="eyebrow text-fg-subtle">Músculo principal</dt>
                  <dd className="mt-0.5 text-base font-semibold">{target}</dd>
                </div>
              ) : null}
              {secondary.length > 0 ? (
                <div>
                  <dt className="eyebrow text-fg-subtle">Secundarios</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {secondary.map((m) => (
                      <Badge key={m} tone="neutral" size="sm">
                        {m}
                      </Badge>
                    ))}
                  </dd>
                </div>
              ) : null}
              {equipment ? (
                <div>
                  <dt className="eyebrow text-fg-subtle">Equipo</dt>
                  <dd className="mt-0.5 font-medium">{equipment}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        ) : null}

        {hasInstructions ? (
          <section className="flex flex-col gap-3">
            <SectionTitle>Cómo se hace</SectionTitle>
            <ExerciseInstructions es={ex.instructionsEs} en={ex.instructionsEn} />
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <SectionTitle>Carga por semana</SectionTitle>
          {chartable.length > 0 ? (
            <>
              {history.weeklyFromPreviousRun ? (
                <div className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-subtle">
                  <Badge tone="neutral" size="sm">
                    Ciclo anterior
                  </Badge>
                  <span>Aún no hay registros en este ciclo; se muestra el ciclo anterior.</span>
                </div>
              ) : null}
              <Card padding="sm">
                <WeeklyLoadChart weekly={chartable} unit={unit} />
              </Card>
            </>
          ) : history.sessions.length > 0 ? (
            <EmptyState
              icon={<Icon.History />}
              title="Aún no hay registros en este ciclo"
              description="Cuando registres series de este ejercicio en este ciclo, aquí verás tu mejor serie de cada semana."
            />
          ) : (
            <EmptyState
              icon={<Icon.History />}
              title="Aún no hay historial"
              description="Cuando registres series de este ejercicio, aquí verás tu mejor serie de cada semana."
            />
          )}
        </section>

        {history.sessions.length > 0 ? (
          <section className="flex flex-col gap-3">
            <SectionTitle>Sesiones</SectionTitle>
            <ul className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
              {history.sessions.map((s) => (
                <li key={`${s.workoutLogId}-${s.prescriptionId}`} className="border-t border-line first:border-t-0">
                  <Link
                    href={`/historial/${s.workoutLogId}`}
                    className="flex min-h-14 items-center gap-3 px-3 py-2.5 hover:bg-surface-2"
                  >
                    <div className="w-20 shrink-0">
                      <p className="text-sm font-semibold whitespace-nowrap first-letter:uppercase">
                        {formatShortDate(s.completedAt ?? s.startedAt, APP_TIME_ZONE)}
                      </p>
                      <p className="eyebrow text-fg-subtle">Sem {s.weekNumber}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="nums text-sm break-words text-fg">{formatSetsLine(s.sets, unit)}</p>
                      <p className="truncate text-xs text-fg-subtle">
                        {s.dayName}
                        {s.status === "in_progress" ? " · en curso" : ""}
                      </p>
                    </div>
                    <Icon.ChevronRight className="size-4 shrink-0 text-fg-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageBody>
    </>
  );
}
