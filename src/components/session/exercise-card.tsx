"use client";
/** One prescription of the session: media, targets, last week, controls and set rows. */
import Link from "next/link";
import { useState } from "react";
import { Badge, Chip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { useDisclosure } from "@/components/ui/bottom-sheet";
import { Card } from "@/components/ui/card";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icons";
import { ExerciseMedia } from "@/components/exercise/exercise-media";
import { TechniqueChip } from "@/components/exercise/technique-chip";
import { VideoButton } from "@/components/exercise/video";
import { RestBadge, RpePair, SuggestionBadge, SupersetTag } from "@/components/workout/badges";
import type { SessionItem } from "@/server/services/views";
import { formatLastPerformance, maxSetsOf, segmentsOf, slotLabel, targetLine } from "./format";
import { useSession, useStore } from "./session-context";
import { isGuidanceOnlyItem, isLoggedSet, isWeakSlotWithoutOptions, rowKey } from "./session-store";
import { SEG_GRID, SEG_GRID_RPE, SET_GRID, SET_GRID_RPE, SetRow } from "./set-row";
import { SubstituteSheet } from "./substitute-sheet";
import { UnitToggle } from "./unit-toggle";
import { WarmupPanel } from "./warmup-panel";

export function ExerciseCard({ item, current }: { item: SessionItem; current?: boolean }) {
  const { store, needsWeakPoint, weakPoint } = useSession();
  const rowCount = useStore((s) => s.getRowCount(item.id));
  const unit = useStore((s) => s.getItemUnit(item.id));
  const logged = useStore((s) => {
    let n = 0;
    for (let i = 1; i <= item.workingSets; i++) if (isLoggedSet(s.getRow(rowKey(item.id, i))?.saved ?? null)) n++;
    return n;
  });
  const [showRpe, setShowRpe] = useState(() => item.sets.some((s) => s.rpe !== null));
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesEn, setNotesEn] = useState(false);
  const [warmupOpen, setWarmupOpen] = useState(false);
  const swap = useDisclosure();

  const ex = item.performedExercise ?? item.exercise;
  const done = item.workingSets > 0 && logged >= item.workingSets;
  const slot = slotLabel(item);
  const weak = item.slot !== "exercise";
  // Guidance only when nothing was logged; sets logged before the weak point
  // changed to one without options stay visible and editable.
  const noOptions = isGuidanceOnlyItem(item);
  const orphanLog = !noOptions && isWeakSlotWithoutOptions(item);
  const notes = notesEn ? item.notesEn : (item.notesEs ?? item.notesEn);
  const hasBothNotes = Boolean(item.notesEs && item.notesEn && item.notesEs !== item.notesEn);
  const segmented = segmentsOf(item) > 1;
  const canSwap = item.choices.length > 1;
  const hasWarmup = (item.warmup.max ?? 0) > 0;
  const name = ex?.name ?? (weak ? "Ejercicio de punto débil" : "Ejercicio");

  return (
    <Card
      as="article"
      tone={current ? "accent" : "default"}
      padding="sm"
      className={cx("flex flex-col gap-3", done && "border-success/40")}
      aria-label={`${item.supersetLabel ? `${item.supersetLabel} · ` : ""}${name}`}
    >
      {/* Header */}
      <div className="flex gap-3">
        {ex ? (
          <ExerciseMedia
            exercise={ex}
            size="card"
            sheetFooter={<VideoButton youtubeId={ex.youtubeId} title={ex.name} block size="md" />}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <SupersetTag label={item.supersetLabel} />
            {slot ? <span className="eyebrow text-accent-text">{slot}</span> : null}
            {item.isOptional ? (
              <Badge size="sm" tone="neutral">
                Opcional
              </Badge>
            ) : null}
            {done ? (
              <Badge size="sm" tone="success" icon={<Icon.Check className="size-3" />}>
                Hecho
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-0.5 text-lg leading-tight font-bold">
            {ex ? (
              <Link
                href={`/ejercicios/${ex.slug}`}
                className="-my-1 inline-flex min-h-11 max-w-full items-center gap-1 py-1 hover:text-accent-text"
              >
                <span className="line-clamp-2">{name}</span>
                <Icon.ChevronRight className="size-4 shrink-0 text-fg-subtle" />
              </Link>
            ) : (
              <span className="line-clamp-2">{name}</span>
            )}
          </h3>
          <p className="mt-0.5 font-display text-2xl leading-none font-bold nums">
            {targetLine(item)}
            <span className="ml-1.5 align-middle font-sans text-xs font-semibold text-fg-subtle normal-case">
              {segmented ? "reps por fase" : "reps"}
            </span>
          </p>
        </div>
      </div>
      <div className="-mt-1 flex flex-wrap gap-1.5">
        <RpePair earlyRpe={item.earlyRpe} lastRpe={item.lastRpe} />
        <RestBadge rest={item.rest} />
      </div>

      {/* Last time + suggestion */}
      <div className="flex flex-col gap-1.5">
        <p className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="shrink-0 font-semibold text-fg-muted">Semana pasada</span>
          <span className="min-w-0 nums font-semibold">
            {item.lastPerformance ? formatLastPerformance(item.lastPerformance, unit) : "Primera vez"}
          </span>
        </p>
        {item.suggestion ? (
          <div>
            <SuggestionBadge suggestion={item.suggestion} />
          </div>
        ) : null}
      </div>

      {/* Controls */}
      <div className="-my-1 flex flex-wrap gap-x-1.5">
        {item.technique ? <TechniqueChip technique={item.technique} /> : null}
        {ex ? <VideoButton youtubeId={ex.youtubeId} title={ex.name} variant="chip" label="Video" /> : null}
        {canSwap ? (
          <Chip icon={<Icon.Swap className="size-4" />} onClick={swap.onOpen} aria-haspopup="dialog">
            {weak ? "Elegir" : "Sustituir"}
          </Chip>
        ) : null}
        {notes ? (
          <Chip
            toggle
            selected={notesOpen}
            icon={<Icon.Note className="size-4" />}
            onClick={() => setNotesOpen((o) => !o)}
            aria-expanded={notesOpen}
          >
            Notas
          </Chip>
        ) : null}
        {hasWarmup && !noOptions ? (
          <Chip
            toggle
            selected={warmupOpen}
            icon={<Icon.Flame className="size-4" />}
            onClick={() => setWarmupOpen((o) => !o)}
            aria-expanded={warmupOpen}
          >
            Calentar
          </Chip>
        ) : null}
        {!noOptions ? (
          <Chip
            toggle
            selected={showRpe}
            icon={<Icon.Gauge className="size-4" />}
            onClick={() => setShowRpe((o) => !o)}
          >
            RPE
          </Chip>
        ) : null}
      </div>

      {notesOpen && notes ? (
        <div className="rounded-lg border border-line bg-surface-2 p-3 text-sm leading-relaxed">
          <p className="whitespace-pre-line">{notes}</p>
          {hasBothNotes ? (
            <button
              type="button"
              onClick={() => setNotesEn((v) => !v)}
              className="mt-1 -mb-2 min-h-11 text-sm font-semibold text-accent-text"
            >
              {notesEn ? "Ver en español" : "Ver original (inglés)"}
            </button>
          ) : null}
        </div>
      ) : null}

      {warmupOpen && hasWarmup ? <WarmupPanel item={item} /> : null}

      {/* Sets */}
      {noOptions ? (
        <div className="rounded-lg border border-dashed border-line-strong p-3 text-sm">
          {needsWeakPoint ? (
            <>
              <p className="font-semibold">Elige tu punto débil para ver las opciones.</p>
              <ButtonLink href="/perfil" variant="secondary" size="sm" className="mt-2">
                Elegir en Perfil
              </ButtonLink>
            </>
          ) : (
            <>
              <p className="text-fg-muted">
                {weakPoint ? <strong className="text-fg">{weakPoint.nameEs}: </strong> : null}
                tu punto débil no tiene ejercicios para este espacio{item.isOptional ? "; puedes saltarlo." : "."}
              </p>
              {weakPoint?.guidanceEs ? <p className="mt-1.5 leading-relaxed whitespace-pre-line">{weakPoint.guidanceEs}</p> : null}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {orphanLog ? (
            <p className="rounded-lg border border-dashed border-line-strong p-3 text-sm text-fg-muted">
              {needsWeakPoint
                ? "Ya no tienes punto débil elegido; puedes editar lo que registraste aquí."
                : <>
                    {weakPoint ? <strong className="text-fg">{weakPoint.nameEs}: </strong> : null}
                    tu punto débil actual no tiene ejercicios para este espacio; puedes editar lo que ya registraste.
                  </>}
            </p>
          ) : null}
          <div
            className={cx(
              "grid items-center gap-1.5 text-center text-[0.6875rem] font-semibold tracking-wide text-fg-subtle uppercase",
              segmented ? (showRpe ? SEG_GRID_RPE : SEG_GRID) : showRpe ? SET_GRID_RPE : SET_GRID,
            )}
          >
            <span aria-hidden>Serie</span>
            <UnitToggle
              value={unit}
              onChange={(u) => store.setItemUnit(item.id, u)}
              exerciseName={name}
            />
            {segmented ? null : <span aria-hidden>Reps</span>}
            {showRpe ? <span aria-hidden>RPE</span> : null}
            <span aria-hidden />
          </div>
          <ol className="flex flex-col gap-2">
            {Array.from({ length: rowCount }, (_, i) => (
              <SetRow key={i + 1} item={item} setNumber={i + 1} showRpe={showRpe} />
            ))}
          </ol>
          <div className="flex items-center justify-between gap-2">
            {rowCount < maxSetsOf(item) ? (
              <button
                type="button"
                onClick={() => store.addRow(item.id)}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg"
              >
                <Icon.Plus className="size-4" />
                Serie extra
              </button>
            ) : (
              <span />
            )}
            {rowCount > item.workingSets ? (
              <button
                type="button"
                onClick={() => store.removeRow(item.id)}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-fg-subtle hover:text-fg"
              >
                <Icon.Minus className="size-4" />
                Quitar extra vacía
              </button>
            ) : null}
          </div>
        </div>
      )}

      {canSwap ? <SubstituteSheet item={item} open={swap.open} onOpenChange={swap.setOpen} /> : null}
    </Card>
  );
}
