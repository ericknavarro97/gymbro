"use client";
/** Weak point picker sheet (Perfil) with a preview of each choice's exercise options. */
import { useState, type ReactNode } from "react";
import type { ProfileState, WeakPointOptionPreview } from "@/server/services/profile.service";
import { ExerciseMedia } from "../exercise/exercise-media";
import { MediaCredit } from "../exercise/media-credit";
import { BottomSheet } from "../ui/bottom-sheet";
import { Button } from "../ui/button";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";

type WeakPoint = ProfileState["weakPoints"][number];
const NONE = "__none__";

export function WeakPointOptionsPreview({
  options,
  enlargeable = true,
}: {
  options: WeakPointOptionPreview[];
  enlargeable?: boolean;
}) {
  const slots = ([1, 2] as const)
    .map((slot) => ({ slot, items: options.filter((o) => o.slot === slot) }))
    .filter((s) => s.items.length > 0);
  return (
    <div className="flex flex-col gap-3">
      {slots.map(({ slot, items }) => (
        <div key={slot} className="flex flex-col gap-1.5">
          <p className="eyebrow text-fg-subtle">
            Ejercicio {slot}
            {slot === 2 ? " · opcional" : ""} — elige uno
          </p>
          <ul className="flex flex-col gap-1.5">
            {items.map((o) => (
              <li key={o.exercise.id} className="flex items-center gap-2.5">
                <ExerciseMedia exercise={o.exercise} size="thumb" enlargeable={enlargeable} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.exercise.name}</p>
                  {o.note ? <p className="truncate text-xs text-fg-subtle">{o.note}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function WeakPointSheet({
  open,
  onOpenChange,
  weakPoints,
  currentKey,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weakPoints: WeakPoint[];
  currentKey: string | null;
  saving: boolean;
  onSave: (key: string | null) => void;
}) {
  const [selected, setSelected] = useState<string>(currentKey ?? NONE);
  // Reset the selection to the saved value every time the sheet opens
  // (state adjustment during render, no effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelected(currentKey ?? NONE);
  }

  const withOptions = weakPoints.filter((w) => w.options.length > 0);
  const guidanceOnly = weakPoints.filter((w) => w.options.length === 0);
  const unchanged = selected === (currentKey ?? NONE);

  const option = (key: string, title: string, sub: string | null, body?: ReactNode) => {
    const checked = selected === key;
    return (
      <label
        key={key}
        className={cx(
          "flex min-h-13 cursor-pointer flex-col justify-center gap-1 rounded-lg border px-3.5 py-2.5 transition-colors",
          "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent",
          checked ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
        )}
      >
        <input
          type="radio"
          name="profile-weak-point"
          value={key}
          checked={checked}
          onChange={() => setSelected(key)}
          className="sr-only"
        />
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold">{title}</span>
          <span
            aria-hidden="true"
            className={cx(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2",
              checked ? "border-accent bg-accent text-accent-fg" : "border-line-strong",
            )}
          >
            {checked ? <Icon.Check className="size-3.5" strokeWidth={3} /> : null}
          </span>
        </span>
        {sub ? <span className="text-xs text-fg-subtle">{sub}</span> : null}
        {checked && body ? <div className="mt-1.5 flex flex-col gap-2">{body}</div> : null}
      </label>
    );
  };

  const body = (w: WeakPoint) => (
    <>
      {w.guidanceEs ? <p className="text-sm leading-snug text-fg-muted">{w.guidanceEs}</p> : null}
      {w.options.length > 0 ? <WeakPointOptionsPreview options={w.options} enlargeable={false} /> : null}
    </>
  );

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Día de brazos y punto débil"
      title="Elige tu punto débil"
      description="Cambia los ejercicios de punto débil en las sesiones siguientes. Lo que ya registraste no cambia."
      size="full"
      footer={
        <Button size="lg" block loading={saving} disabled={unchanged} onClick={() => onSave(selected === NONE ? null : selected)}>
          Guardar
        </Button>
      }
    >
      <div className="flex flex-col gap-4" role="radiogroup" aria-label="Punto débil">
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-fg-subtle">Con ejercicios</p>
          {withOptions.map((w) =>
            option(w.key, w.nameEs, `${w.options.length} ${w.options.length === 1 ? "ejercicio" : "ejercicios"} para elegir`, body(w)),
          )}
        </div>
        {guidanceOnly.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="eyebrow text-fg-subtle">Solo guía</p>
            <p className="-mt-1 text-xs text-fg-subtle">
              Sin ejercicios propios: el programa te da una recomendación para trabajarlo.
            </p>
            {guidanceOnly.map((w) => option(w.key, w.nameEs, null, body(w)))}
          </div>
        ) : null}
        {option(NONE, "Ninguno por ahora", "Lo decides después; te lo pediremos en el día de brazos.")}
        <MediaCredit className="text-center" />
      </div>
    </BottomSheet>
  );
}
