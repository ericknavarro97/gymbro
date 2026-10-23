/**
 * Día preview: list of prescriptions (read-only), supersets visually linked,
 * substitutes and weak-point options. Server-safe; media, technique, video
 * and notes toggles are client children.
 *
 * The screen that renders this must render <MediaCredit/> once (thumbs).
 */
import Link from "next/link";
import type { ExerciseChoice, ExerciseSummary, PrescriptionView, WeakPointView } from "@/server/services/views";
import { ExerciseMedia } from "../exercise/exercise-media";
import { TechniqueChip } from "../exercise/technique-chip";
import { VideoButton } from "../exercise/video";
import { Badge } from "../ui/badge";
import { ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";
import { RestBadge, RpePair, SupersetTag } from "../workout/badges";
import { NotesToggle } from "./notes-toggle";

type Group = { key: string; superset: string | null; items: PrescriptionView[] };

/** Consecutive prescriptions sharing a superset group form one visual group. */
export function groupPrescriptions(list: PrescriptionView[]): Group[] {
  const out: Group[] = [];
  for (const p of list) {
    const last = out[out.length - 1];
    if (p.supersetGroup && last?.superset === p.supersetGroup) last.items.push(p);
    else out.push({ key: `p${p.id}`, superset: p.supersetGroup, items: [p] });
  }
  return out;
}

export function DayPrescriptions({
  prescriptions,
  needsWeakPoint,
  weakPoint,
}: {
  prescriptions: PrescriptionView[];
  needsWeakPoint: boolean;
  weakPoint: WeakPointView | null;
}) {
  const groups = groupPrescriptions(prescriptions);
  return (
    <ol className="flex flex-col gap-3">
      {groups.map((g, gi) => {
        const cards = g.items.map((p) => (
          <PrescriptionCard key={p.id} index={p.position} p={p} needsWeakPoint={needsWeakPoint} weakPoint={weakPoint} />
        ));
        return (
          <li key={g.key} className="animate-rise" style={{ animationDelay: `${Math.min(gi, 8) * 40}ms` }}>
            {g.superset && g.items.length > 1 ? (
              <section
                aria-label={`Superserie ${g.superset}`}
                className="rounded-2xl border border-accent/40 bg-accent-soft/40 p-1.5"
              >
                <p className="flex items-center gap-2 px-2.5 pt-1.5 pb-2 text-sm">
                  <Icon.Swap className="size-4 shrink-0 text-accent-text" />
                  <span className="font-display text-base leading-none font-bold tracking-wide text-accent-text uppercase">
                    Superserie {g.superset}
                  </span>
                  <span className="min-w-0 truncate text-fg-muted">alterna los ejercicios</span>
                </p>
                <div className="flex flex-col gap-1.5">{cards}</div>
              </section>
            ) : (
              cards
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ExerciseLink({ exercise, className }: { exercise: ExerciseSummary; className?: string }) {
  return (
    <Link
      href={`/ejercicios/${exercise.slug}`}
      className={cx("underline-offset-2 hover:underline", className)}
    >
      {exercise.name}
    </Link>
  );
}

function PrescriptionCard({
  p,
  index,
  needsWeakPoint,
  weakPoint,
}: {
  p: PrescriptionView;
  index: number;
  needsWeakPoint: boolean;
  weakPoint: WeakPointView | null;
}) {
  const isWeak = p.slot !== "exercise";
  const shown = p.exercise;
  const perSet = p.reps.scheme?.type === "per_set";
  const subs = [p.sub1, p.sub2].filter((x): x is ExerciseSummary => x !== null);

  return (
    <Card as="article" padding="md" className="flex flex-col gap-3">
      <div className="flex gap-3">
        {shown ? (
          <ExerciseMedia
            exercise={shown}
            sheetFooter={<VideoButton youtubeId={shown.youtubeId} title={shown.name} block />}
          />
        ) : (
          <span
            aria-hidden
            className={cx(
              "flex size-16 shrink-0 items-center justify-center rounded-lg",
              isWeak
                ? "bg-accent-soft text-accent-text"
                : "border border-dashed border-line-strong bg-surface-2 text-fg-subtle",
            )}
          >
            {isWeak ? <Icon.Gauge className="size-7" /> : <Icon.Dumbbell className="size-6" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {p.supersetLabel ? (
              <SupersetTag label={p.supersetLabel} />
            ) : (
              <span className="nums shrink-0 font-display text-lg leading-none font-bold text-fg-subtle">{index}</span>
            )}
            {isWeak ? (
              <p className="eyebrow min-w-0 truncate text-accent-text">
                Punto débil {p.slot === "weak_point_1" ? 1 : 2}
              </p>
            ) : null}
            {p.isOptional ? (
              <Badge size="sm" tone="info">
                Opcional
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-1 text-[1.0625rem] leading-snug font-semibold">
            {isWeak ? (
              weakPoint ? (
                <span>{weakPoint.nameEs}</span>
              ) : (
                <span className="text-fg-muted">Tu punto débil</span>
              )
            ) : p.exercise ? (
              <ExerciseLink exercise={p.exercise} />
            ) : (
              "Ejercicio"
            )}
          </h3>
          <p className="nums mt-0.5 font-display text-xl leading-tight font-bold">
            {p.workingSets} × {p.reps.text}
            {p.reps.segmented ? <span className="ml-1.5 font-sans text-xs font-medium text-fg-muted">por segmento</span> : null}
          </p>
          {p.warmup.max ? (
            <p className="text-sm text-fg-muted">
              Calentamiento: {p.warmup.text ?? p.warmup.max} {p.warmup.max === 1 ? "serie" : "series"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <RpePair earlyRpe={p.earlyRpe} lastRpe={p.lastRpe} />
        <RestBadge rest={p.rest} />
        {p.technique ? <TechniqueChip technique={p.technique} className="-my-1.5" /> : null}
      </div>

      {perSet && p.reps.targets.length > 1 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Objetivo por serie">
          {p.reps.targets.map((t) => (
            <li key={t.setNumber} className="nums rounded-sm bg-surface-2 px-2 py-1 text-xs text-fg-muted">
              Serie {t.setNumber}: <span className="font-semibold text-fg">{t.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {isWeak ? (
        <WeakPointOptions choices={p.choices} needsWeakPoint={needsWeakPoint} weakPoint={weakPoint} />
      ) : null}

      <NotesToggle es={p.notesEs} en={p.notesEn} />

      {!isWeak && (p.exercise?.youtubeId || subs.length > 0) ? (
        <div className="flex flex-col gap-2">
          {subs.length > 0 ? <SubstituteList subs={subs} /> : null}
          {p.exercise ? (
            <VideoButton youtubeId={p.exercise.youtubeId} title={p.exercise.name} variant="chip" className="self-start" />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function SubstituteList({ subs }: { subs: ExerciseSummary[] }) {
  return (
    <details className="group rounded-lg border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <Icon.Swap className="size-4 shrink-0 text-fg-subtle" />
        <span className="flex-1">Sustitutos ({subs.length})</span>
        <Icon.ChevronDown className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
      </summary>
      <ul className="flex flex-col divide-y divide-line border-t border-line">
        {subs.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 px-3 py-2">
            <ExerciseMedia exercise={s} sheetFooter={<VideoButton youtubeId={s.youtubeId} title={s.name} block />} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-fg-subtle">Sustituto {i + 1}</p>
              <ExerciseLink exercise={s} className="block text-sm leading-snug font-semibold" />
            </div>
            <VideoButton youtubeId={s.youtubeId} title={s.name} variant="chip" label="Video" />
          </li>
        ))}
      </ul>
    </details>
  );
}

function WeakPointOptions({
  choices,
  needsWeakPoint,
  weakPoint,
}: {
  choices: ExerciseChoice[];
  needsWeakPoint: boolean;
  weakPoint: WeakPointView | null;
}) {
  if (needsWeakPoint || !weakPoint) {
    return (
      <div className="flex flex-col gap-2.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-3">
        <p className="text-sm text-fg">
          Aún no eliges tu punto débil. Elígelo para ver qué ejercicios hacer en este espacio.
        </p>
        <ButtonLink href="/perfil" size="sm" icon={<Icon.User className="size-4" />}>
          Elegir en Perfil
        </ButtonLink>
      </div>
    );
  }
  if (choices.length === 0) {
    return (
      <div className="rounded-lg border border-info/30 bg-info-soft px-3 py-2.5 text-sm leading-relaxed text-fg">
        <p className="font-semibold">{weakPoint.nameEs}: solo guía</p>
        <p className="mt-0.5 text-fg-muted">
          {weakPoint.guidanceEs ?? weakPoint.guidanceEn ?? "Este punto débil no tiene ejercicios fijos en este espacio."}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="eyebrow text-fg-subtle">Opciones · elige una en la sesión</p>
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {choices.map((c, i) => (
          <li key={c.exercise.id} className="flex items-center gap-3 px-3 py-2">
            <ExerciseMedia
              exercise={c.exercise}
              sheetFooter={<VideoButton youtubeId={c.exercise.youtubeId} title={c.exercise.name} block />}
            />
            <div className="min-w-0 flex-1">
              <ExerciseLink exercise={c.exercise} className="block text-sm leading-snug font-semibold" />
              {c.note ? <p className="text-xs text-fg-muted">{c.note}</p> : null}
              {i === 0 ? (
                <Badge size="sm" tone="accent" className="mt-1">
                  Por defecto
                </Badge>
              ) : null}
            </div>
            <VideoButton youtubeId={c.exercise.youtubeId} title={c.exercise.name} variant="chip" label="Video" />
          </li>
        ))}
      </ul>
    </div>
  );
}
