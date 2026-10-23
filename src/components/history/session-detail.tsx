/** /historial/[workoutLogId]: one past session, its exercises and sets. Server-safe. */
import Link from "next/link";
import type { WorkoutSession } from "@/server/services/workout.service";
import type { SessionItem } from "@/server/services/views";
import { ExerciseMedia } from "../exercise/exercise-media";
import { MediaCredit } from "../exercise/media-credit";
import { PageBody, PageHeader, SectionTitle } from "../layout/page";
import { Badge } from "../ui/badge";
import { ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";
import { SupersetTag } from "../workout/badges";
import { formatLongDate, formatTime, repsText, setWeightText } from "./format";

function durationText(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  const min = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  if (!(min > 0) || min > 12 * 60) return null;
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-md bg-surface-2 px-2 py-2">
      <span className="nums font-display text-2xl leading-none font-bold">{value}</span>
      <span className="eyebrow mt-1 text-[0.625rem] text-fg-subtle">{label}</span>
    </div>
  );
}

function ItemCard({ item, unit }: { item: SessionItem; unit: WorkoutSession["settings"]["unit"] }) {
  const ex = item.performedExercise;
  if (!ex) return null;
  const sets = [...item.sets].sort((a, b) => a.setNumber - b.setNumber);
  const empty = sets.length === 0;
  const substituted = item.slot === "exercise" && item.exercise && item.exercise.id !== ex.id;
  return (
    // Empty state is conveyed by the dashed border + "Sin series registradas." in fg-muted. No opacity
    // anywhere in the card: it drops text below WCAG AA (4.5:1), and the thumbnail's tap-to-open sheet
    // and its "≈" badge would inherit it too.
    <Card as="li" padding="sm" className={cx(empty && "border-dashed")} data-empty={empty || undefined}>
      <div className="flex gap-3">
        <ExerciseMedia exercise={ex} size="thumb" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <SupersetTag label={item.supersetLabel} />
            <Link
              href={`/ejercicios/${ex.slug}`}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-1 font-semibold hover:text-accent-text"
            >
              <span className="truncate">{ex.name}</span>
              <Icon.ChevronRight className="size-4 shrink-0 text-fg-subtle" />
            </Link>
          </div>
          <p className="nums -mt-1 text-sm text-fg-muted">
            {item.workingSets} × {item.reps.text}
            {substituted ? <span className="text-fg-subtle"> · sustituto</span> : null}
            {item.slot !== "exercise" ? <span className="text-fg-subtle"> · punto débil</span> : null}
          </p>
        </div>
      </div>
      {empty ? (
        <p className="mt-2 text-sm text-fg-muted">Sin series registradas.</p>
      ) : (
        <table className="nums mt-2 w-full text-sm">
          <caption className="sr-only">Series de {ex.name}</caption>
          <thead>
            <tr className="text-left text-[0.6875rem] tracking-wide text-fg-subtle uppercase">
              <th scope="col" className="w-12 py-1 font-medium">
                Serie
              </th>
              <th scope="col" className="py-1 font-medium">
                Peso
              </th>
              <th scope="col" className="py-1 font-medium">
                Reps
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                RPE
              </th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => (
              <tr key={s.setNumber} className="border-t border-line">
                <td className="py-1.5 text-fg-subtle">
                  {s.setNumber > item.workingSets ? `${s.setNumber}+` : s.setNumber}
                </td>
                <td className="py-1.5 font-semibold">{setWeightText(s, unit) ?? "—"}</td>
                <td className="py-1.5 font-semibold">{repsText(s)}</td>
                <td className="py-1.5 text-right text-fg-muted">{s.rpe ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function SessionDetail({ session, timeZone }: { session: WorkoutSession; timeZone: string }) {
  const { workoutLog: log, day, week, block, settings, items } = session;
  const when = log.completedAt ?? log.startedAt;
  const skipped = log.status === "skipped";
  const inProgress = log.status === "in_progress";
  const performed = items.filter((i) => i.performedExercise);
  const withSets = performed.filter((i) => i.sets.length > 0);
  const setCount = withSets.reduce((n, i) => n + i.sets.length, 0);
  const duration = log.status === "completed" ? durationText(log.startedAt, log.completedAt) : null;
  const shown = skipped && withSets.length === 0 ? [] : performed;
  const hasThumbs = shown.some((i) => i.performedExercise?.thumbPath || i.performedExercise?.gifPath);

  return (
    <>
      <PageHeader eyebrow={`Semana ${week.number} · ${block.nameEs ?? block.name}`} title={day.name} back="/historial" size="md" />
      <PageBody>
        <Card padding="md" tone={skipped ? "inset" : "default"}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold first-letter:uppercase">{formatLongDate(when, timeZone)}</p>
              <p className="text-sm text-fg-muted">
                {skipped ? "Saltada" : inProgress ? "En curso" : "Terminada"}
                {log.completedAt && !skipped ? ` a las ${formatTime(log.completedAt, timeZone)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              {skipped ? <Badge tone="neutral" size="sm">Saltada</Badge> : null}
              {inProgress ? <Badge tone="accent" size="sm">En curso</Badge> : null}
              {week.isDeload ? <Badge tone="warning" size="sm">Descarga</Badge> : null}
            </div>
          </div>
          {!skipped ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat value={withSets.length} label="Ejercicios" />
              <Stat value={setCount} label="Series" />
              <Stat value={duration ?? "—"} label="Duración" />
            </div>
          ) : null}
        </Card>

        <SectionTitle>Ejercicios</SectionTitle>
        {skipped && withSets.length === 0 ? (
          <p className="text-sm text-fg-muted">Saltaste este día; no hay series registradas.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {shown.map((item) => (
            <ItemCard key={item.id} item={item} unit={settings.unit} />
          ))}
        </ul>
        {hasThumbs ? <MediaCredit className="text-center" /> : null}

        <ButtonLink href={`/sesion/${log.id}`} variant="outline" block icon={<Icon.Note />}>
          {inProgress ? "Continuar sesión" : skipped ? "Abrir sesión" : "Editar registros"}
        </ButtonLink>
      </PageBody>
    </>
  );
}
