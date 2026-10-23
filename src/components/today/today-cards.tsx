/**
 * Hoy building blocks. Server-safe (no hooks); interactive bits are the
 * client children (StartWorkoutButton).
 */
import Link from "next/link";
import type { TodayOverview } from "@/server/services/workout.service";
import { WeekBanner } from "../workout/badges";
import { Badge } from "../ui/badge";
import { ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";
import { ProgressBar } from "../ui/progress-bar";
import { DAY_STATUS, blockName, dayHref, deloadText } from "../program/format";
import { StartWorkoutButton } from "./start-workout-button";

type Next = NonNullable<TodayOverview["next"]>;
type InProgress = NonNullable<TodayOverview["inProgress"]>;

export function NextSessionCard({ next, inProgress }: { next: Next; inProgress: InProgress | null }) {
  const log =
    inProgress && inProgress.dayId === next.day.id
      ? ({ id: inProgress.workoutLogId, status: "in_progress" } as const)
      : next.workoutLog;
  const status = log ? DAY_STATUS[log.status] : null;
  const deload = deloadText(next.week);
  return (
    <Card tone="accent" padding="lg" className="animate-rise overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow min-w-0 truncate text-accent-text">
          {inProgress && inProgress.dayId === next.day.id ? "En curso" : "Siguiente sesión"}
        </p>
        {status && log?.status !== "in_progress" ? (
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        ) : null}
      </div>
      <h2 className="mt-1 font-display text-[2.5rem] leading-[0.95] font-bold uppercase">
        <span className="block text-fg-muted">Semana {next.week.number}</span>
        <span className="block">{next.day.name}</span>
      </h2>
      <p className="mt-2 text-sm text-fg-muted">
        Bloque {next.block.number} · {blockName(next.block)}
      </p>

      {deload ? <WeekBanner isDeload text={deload} className="mt-4" /> : null}
      {next.day.restAfter ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-fg-muted">
          <Icon.Info className="size-4 shrink-0 text-info" />
          Después de esta sesión toca día de descanso.
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        <StartWorkoutButton workoutDayId={next.day.id} workoutLog={log} />
        <ButtonLink
          href={dayHref(next.week.number, next.day.position)}
          variant="ghost"
          block
          iconRight={<Icon.ChevronRight className="size-4" />}
        >
          Ver ejercicios
        </ButtonLink>
      </div>
    </Card>
  );
}

/** A different session is still open (started earlier, not the next one). */
export function InProgressCard({ inProgress }: { inProgress: InProgress }) {
  return (
    <Card padding="md" className="animate-rise flex items-center gap-3 border-accent/40">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
        <Icon.Timer />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-accent-text">Sesión abierta</p>
        <p className="truncate font-semibold">
          Semana {inProgress.weekNumber} · {inProgress.dayName}
        </p>
      </div>
      <ButtonLink href={`/sesion/${inProgress.workoutLogId}`} prefetch size="sm" icon={<Icon.Play className="size-4" />}>
        Continuar
      </ButtonLink>
    </Card>
  );
}

export function RestDayNotice({ lastDayName }: { lastDayName: string | null }) {
  return (
    <div
      role="note"
      className="animate-rise flex items-start gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3"
    >
      <Icon.Info className="mt-0.5 size-5 shrink-0 text-info" />
      <div className="min-w-0">
        <p className="font-semibold text-fg">Hoy toca descanso</p>
        <p className="text-sm leading-relaxed text-fg-muted">
          {lastDayName ? `Después de ${lastDayName} el programa marca un día de descanso. ` : null}
          Es solo una sugerencia: si te sientes recuperado, puedes entrenar.
        </p>
      </div>
    </div>
  );
}

export function FinishedCard() {
  return (
    <Card tone="raised" padding="lg" className="animate-rise flex flex-col items-center gap-3 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
        <Icon.Check className="size-8" />
      </span>
      <p className="eyebrow text-accent-text">10 semanas · 50 sesiones</p>
      <h2 className="font-display text-4xl leading-none font-bold uppercase">¡Terminaste el programa!</h2>
      <p className="text-base text-fg-muted">
        Revisa tu progreso en el historial. Si quieres volver a empezar, reinicia el programa desde tu perfil; tu
        historial se conserva.
      </p>
      <div className="mt-1 flex w-full flex-col gap-2">
        <ButtonLink href="/historial" block size="lg" icon={<Icon.History />}>
          Ver historial
        </ButtonLink>
        <ButtonLink href="/perfil" block variant="secondary">
          Reiniciar en Perfil
        </ButtonLink>
      </div>
    </Card>
  );
}

export function ProgramProgress({
  progress,
  deloadIndexes,
  currentWeek,
}: {
  progress: TodayOverview["progress"];
  deloadIndexes: number[];
  currentWeek: number | null;
}) {
  const pct = Math.round(progress.ratio * 100);
  return (
    <Card padding="md" className="animate-rise" style={{ animationDelay: "60ms" }}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-fg-subtle">Progreso del programa</p>
          <p className="font-display text-3xl leading-none font-bold">
            <span className="nums">{progress.done}</span>
            <span className="text-fg-subtle">/{progress.total}</span>
            <span className="ml-2 align-middle font-sans text-sm font-medium text-fg-muted">sesiones</span>
          </p>
        </div>
        <span className="nums shrink-0 font-display text-2xl leading-none font-bold text-accent-text">{pct}%</span>
      </div>
      <ProgressBar
        label="Progreso del programa"
        value={progress.ratio}
        segments={10}
        markedSegments={deloadIndexes}
        valueText={`${progress.done} de ${progress.total} sesiones`}
      />
      <div className="mt-1.5 flex justify-between text-[0.6875rem] font-semibold text-fg-subtle" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cx("nums flex-1 text-center", currentWeek === i + 1 && "text-accent-text")}>
            {i + 1}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function LastCompletedCard({
  last,
  when,
}: {
  last: NonNullable<TodayOverview["lastCompleted"]>;
  when: string;
}) {
  return (
    <Link
      href={`/historial/${last.workoutLogId}`}
      className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:bg-surface-2"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
        <Icon.Check />
      </span>
      <span className="min-w-0 flex-1">
        <span className="eyebrow block text-fg-subtle">Última sesión · {when}</span>
        <span className="block truncate font-semibold">
          Semana {last.weekNumber} · {last.dayName}
        </span>
      </span>
      <Icon.ChevronRight className="size-5 shrink-0 text-fg-subtle" />
    </Link>
  );
}
