"use client";
/**
 * /sesion/[id] — workout logging screen (PLAN §5 "Registro").
 * Receives the serialized WorkoutSession from the server page and owns the
 * client SessionStore (autosave, drafts, rest timer).
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MediaCredit } from "@/components/exercise/media-credit";
import { WeekBanner } from "@/components/workout/badges";
import { bannerSentence, deloadText } from "@/components/program/format";
import { saveSetAction } from "@/server/actions/workout.actions";
import type { WorkoutSession } from "@/server/services/workout.service";
import type { SessionItem } from "@/server/services/views";
import { ExerciseCard } from "./exercise-card";
import { RestTimer } from "./rest-timer";
import { SessionProvider, useSession, useStore, type SessionContextValue } from "./session-context";
import { SessionFooter } from "./session-footer";
import { isLoggableItem, isLoggedSet, rowKey, SessionStore } from "./session-store";

type Group = { key: string; label: string | null; items: SessionItem[] };

function groupItems(items: SessionItem[]): Group[] {
  const out: Group[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (it.supersetGroup && prev && prev.label === it.supersetGroup) prev.items.push(it);
    else out.push({ key: `${it.id}`, label: it.supersetGroup, items: [it] });
  }
  return out;
}

export function SessionScreen({ session }: { session: WorkoutSession }) {
  const [store] = useState(
    () =>
      new SessionStore(
        { workoutLogId: session.workoutLog.id, unit: session.settings.unit, items: session.items },
        saveSetAction,
      ),
  );

  useEffect(() => {
    store.attach();
    return () => store.detach();
  }, [store]);

  const ctx = useMemo<SessionContextValue>(
    () => ({
      store,
      workoutLogId: session.workoutLog.id,
      unit: store.unit,
      rounding: { lb: session.settings.roundingLb, kg: session.settings.roundingKg },
      protocol: session.warmupProtocol,
      isDeload: session.week.isDeload,
      needsWeakPoint: session.needsWeakPoint,
      weakPoint: session.settings.weakPoint,
    }),
    [store, session],
  );

  return (
    <SessionProvider value={ctx}>
      <SessionView session={session} />
    </SessionProvider>
  );
}

function SessionView({ session }: { session: WorkoutSession }) {
  const { store } = useSession();
  const items = useStore((s) => s.getItems());
  const progress = useStore((s) => s.getProgress());
  const unsaved = useStore((s) => s.getUnsavedCount());
  const timerOn = useStore((s) => s.getTimerEnabled());
  const currentId = useStore((s) => {
    for (const it of s.getItems()) {
      if (!isLoggableItem(it) || (it.isOptional && it.sets.length === 0)) continue;
      let n = 0;
      for (let i = 1; i <= it.workingSets; i++) if (isLoggedSet(s.getRow(rowKey(it.id, i))?.saved ?? null)) n++;
      if (n < it.workingSets) return it.id;
    }
    return null;
  });
  const groups = useMemo(() => groupItems(items), [items]);
  const [done, total] = progress.split("/").map(Number);
  const { week, block, day, workoutLog } = session;
  const blockName = block.nameEs ?? block.name;
  const status = workoutLog.status;
  const hasThumbs = items.some((i) => {
    const ex = i.performedExercise ?? i.exercise;
    return Boolean(ex?.thumbPath || ex?.gifPath);
  });
  // Deload weeks: same sentence-case text as Hoy/Programa (the raw banner is
  // ALL CAPS and repeats "Semana de descarga").
  const bannerText = week.isDeload ? deloadText(week) : bannerSentence(week.bannerEs ?? week.banner);

  return (
    <>
      <PageHeader
        eyebrow={`Semana ${week.number} · ${blockName}`}
        title={day.name}
        back="/"
        backLabel="Salir a Hoy"
        backHistory={false}
        size="md"
        actions={
          <>
            {unsaved > 0 ? (
              <button
                type="button"
                onClick={store.retryAll}
                className="inline-flex min-h-11 items-center"
                aria-label={`${unsaved} series sin guardar. Reintentar`}
              >
                <Badge tone="warning" icon={<Icon.Alert className="size-3.5" />}>
                  {unsaved} sin guardar
                </Badge>
              </button>
            ) : null}
            <IconButton
              label="Temporizador de descanso"
              aria-pressed={timerOn}
              onClick={() => store.setTimerEnabled(!timerOn)}
              className={timerOn ? "text-accent-text" : "text-fg-subtle"}
            >
              <Icon.Timer />
            </IconButton>
          </>
        }
      >
        <ProgressBar
          label="Progreso de la sesión"
          showLabel
          value={total > 0 ? done / total : 0}
          valueText={`${done} de ${total} ejercicios`}
          tone={total > 0 && done >= total ? "success" : "accent"}
        />
      </PageHeader>

      <div className="flex flex-col gap-4 px-4 pt-4 pb-[calc(9rem+env(safe-area-inset-bottom))]">
        {status === "completed" ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-sm">
            <Icon.Check className="size-4 shrink-0 text-success" />
            <span>Sesión terminada. Puedes corregir tus series; se guardan solas.</span>
          </div>
        ) : status === "skipped" ? (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-sm">
            <Icon.Info className="size-4 shrink-0 text-fg-muted" />
            <span>Saltaste esta sesión. Si registras una serie, se vuelve a abrir.</span>
          </div>
        ) : null}

        <WeekBanner isDeload={week.isDeload} text={bannerText ?? undefined} />

        {session.needsWeakPoint && items.some((i) => i.slot !== "exercise") ? (
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm">
            <p>
              <strong>Aún no eliges punto débil.</strong> Hoy hay ejercicios para él; elígelo para ver tus opciones.
            </p>
            <ButtonLink href="/perfil" variant="secondary" size="sm" className="self-start">
              Elegir punto débil
            </ButtonLink>
          </div>
        ) : null}

        {session.generalWarmup.length > 0 ? <GeneralWarmup items={session.generalWarmup} /> : null}

        {groups.map((g) =>
          g.label && g.items.length > 1 ? (
            <section
              key={g.key}
              aria-label={`Superserie ${g.label}`}
              className="flex flex-col gap-2 rounded-2xl border border-line-strong/60 bg-surface-2/40 p-1.5 pt-2"
            >
              <p className="flex items-center gap-2 px-2 font-display text-lg leading-none font-bold tracking-wide uppercase">
                <Icon.Swap className="size-4 text-accent-text" />
                Superserie {g.label}
                <span className="font-sans text-xs font-medium tracking-normal text-fg-subtle normal-case">
                  alterna los ejercicios
                </span>
              </p>
              {g.items.map((it) => (
                <ExerciseCard key={it.id} item={it} current={it.id === currentId} />
              ))}
            </section>
          ) : (
            <Fragment key={g.key}>
              {g.items.map((it) => (
                <ExerciseCard key={it.id} item={it} current={it.id === currentId} />
              ))}
            </Fragment>
          ),
        )}

        {hasThumbs ? <MediaCredit className="text-center" /> : null}

        <SessionFooter status={status} />
      </div>

      <RestTimer />
    </>
  );
}

function GeneralWarmup({ items }: { items: WorkoutSession["generalWarmup"] }) {
  return (
    <details className="group rounded-xl border border-line bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
        <Icon.Flame className="size-5 text-accent-text" />
        <span className="flex-1">Calentamiento general</span>
        <Icon.ChevronDown className="size-5 text-fg-muted transition-transform group-open:rotate-180" />
      </summary>
      <ol className="flex flex-col gap-1 px-4 pb-3">
        {items.map((g) => (
          <li key={g.position} className="flex items-baseline justify-between gap-3 border-t border-line py-2 text-sm first:border-t-0">
            <span>{g.itemEs ?? g.item}</span>
            {g.doseEs ?? g.dose ? <span className="shrink-0 text-fg-muted nums">{g.doseEs ?? g.dose}</span> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
