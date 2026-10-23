"use client";
/**
 * ExerciseMedia: Gym visual thumbnail/GIF on a white rounded tile.
 *
 * - size "thumb" (64px) / "card" (96px): static JPG; tap → BottomSheet with the
 *   animated GIF at up to 2× (360px), approx note and credit.
 * - size "hero": animated GIF, full width up to 360px, credit + approx note below.
 * - No media (gifPath/thumbPath null) → neutral placeholder (not tappable).
 * - match !== "exact" → "Aproximado" badge (+ matchNote in hero and sheet).
 *
 * Media is auth-protected (/media/*), so this uses plain <img> (no next/image).
 * Screens that only render thumbs must show <MediaCredit/> once (e.g. footer).
 */
import type { ReactNode } from "react";
import type { ExerciseSummary } from "@/server/services/views";
import { Badge } from "../ui/badge";
import { BottomSheet, useDisclosure } from "../ui/bottom-sheet";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";
import { MediaCredit } from "./media-credit";

export type MediaExercise = Pick<ExerciseSummary, "name" | "gifPath" | "thumbPath" | "match" | "matchNote">;

export interface ExerciseMediaProps {
  exercise: MediaExercise;
  size?: "thumb" | "card" | "hero";
  /** Tap to open the large GIF sheet (default true for thumb/card). */
  enlargeable?: boolean;
  /** Show the credit under the media (default true for hero). */
  credit?: boolean;
  /** Extra content at the bottom of the enlarge sheet (e.g. <VideoButton/>). */
  sheetFooter?: ReactNode;
  className?: string;
}

const NATIVE = 180;

/** White tile wrapper (media have white backgrounds). */
function Tile({ px, className, children }: { px?: number; className?: string; children: ReactNode }) {
  return (
    <div
      className={cx("relative shrink-0 overflow-hidden rounded-lg bg-media ring-1 ring-black/10", className)}
      style={px ? { width: px, height: px } : undefined}
    >
      {children}
    </div>
  );
}

function Placeholder({ px, label, className }: { px?: number; label?: boolean; className?: string }) {
  return (
    <div
      className={cx(
        "flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong bg-surface-2 text-fg-subtle",
        className,
      )}
      style={px ? { width: px, height: px } : undefined}
      role="img"
      aria-label="Sin animación disponible"
    >
      <Icon.Dumbbell className={px && px < 80 ? "size-6" : "size-9"} />
      {label ? <span className="text-xs font-medium">Sin animación</span> : null}
    </div>
  );
}

export function ApproxNote({ note }: { note: string | null }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-fg">
      <Icon.Info className="mt-0.5 size-4 shrink-0 text-warning" />
      <p>
        <span className="font-semibold">Animación aproximada.</span>{" "}
        <span className="text-fg-muted">{note ?? "La animación no es exactamente el mismo ejercicio; sigue las notas y el video."}</span>
      </p>
    </div>
  );
}

/** Large GIF tile: renders 180px media at up to 2× (360px), fluid below that. */
export function GifHero({ exercise, className }: { exercise: MediaExercise; className?: string }) {
  if (!exercise.gifPath) return <Placeholder label className={cx("aspect-square w-full max-w-90", className)} />;
  return (
    <Tile className={cx("aspect-square w-full max-w-90", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected media, skip the optimizer */}
      <img
        src={exercise.gifPath}
        alt={`Animación: ${exercise.name}`}
        width={NATIVE}
        height={NATIVE}
        decoding="async"
        className="size-full object-contain [image-rendering:auto]"
      />
    </Tile>
  );
}

export function ExerciseMedia({
  exercise,
  size = "thumb",
  enlargeable,
  credit,
  sheetFooter,
  className,
}: ExerciseMediaProps) {
  const sheet = useDisclosure();
  const approx = exercise.match !== "exact";
  const hasMedia = Boolean(exercise.gifPath || exercise.thumbPath);

  if (size === "hero") {
    return (
      <figure className={cx("flex flex-col items-center gap-2", className)}>
        <div className="relative w-full max-w-90">
          <GifHero exercise={exercise} />
          {approx && hasMedia ? (
            <Badge tone="warning" size="sm" className="absolute top-2 left-2">
              Aproximado
            </Badge>
          ) : null}
        </div>
        <figcaption className="flex w-full max-w-90 flex-col gap-2">
          {approx && hasMedia ? <ApproxNote note={exercise.matchNote} /> : null}
          {(credit ?? true) && hasMedia ? <MediaCredit className="text-center" /> : null}
        </figcaption>
      </figure>
    );
  }

  const px = size === "card" ? 96 : 64;
  const canEnlarge = (enlargeable ?? true) && Boolean(exercise.gifPath);
  const src = exercise.thumbPath ?? exercise.gifPath;

  const visual = !src ? (
    <Placeholder px={px} />
  ) : (
    <Tile px={px}>
      {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected media, skip the optimizer */}
      <img
        src={src}
        alt={canEnlarge ? "" : `Imagen: ${exercise.name}`}
        width={NATIVE}
        height={NATIVE}
        loading="lazy"
        decoding="async"
        className="size-full object-contain"
      />
      {approx ? (
        <span
          className="absolute right-1 bottom-1 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#ffc247] px-1 text-[0.625rem] leading-none font-bold text-black"
          title="Animación aproximada"
          aria-label="Animación aproximada"
        >
          ≈
        </span>
      ) : null}
      {canEnlarge ? (
        <span className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-black/55 text-white">
          <Icon.Expand className="size-3" />
        </span>
      ) : null}
    </Tile>
  );

  return (
    <div className={cx("flex shrink-0 flex-col items-start gap-1", className)}>
      {canEnlarge ? (
        <button
          type="button"
          onClick={sheet.onOpen}
          className="rounded-lg active:scale-[0.97]"
          aria-label={`Ver animación de ${exercise.name}`}
          aria-haspopup="dialog"
        >
          {visual}
        </button>
      ) : (
        visual
      )}
      {credit && src ? <MediaCredit className="max-w-24 text-[0.625rem] leading-3" /> : null}

      {canEnlarge ? (
        <BottomSheet open={sheet.open} onOpenChange={sheet.setOpen} title={exercise.name} eyebrow="Animación">
          <div className="flex flex-col items-center gap-3">
            <GifHero exercise={exercise} />
            <div className="flex w-full max-w-90 flex-col gap-2">
              {approx ? <ApproxNote note={exercise.matchNote} /> : null}
              <MediaCredit className="text-center" />
              {sheetFooter}
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}
