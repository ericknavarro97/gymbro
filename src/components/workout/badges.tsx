/**
 * Small workout display primitives. Server-safe (no hooks): usable anywhere.
 * They take the `{text,...}` shapes from PrescriptionView.
 */
import type { ReactNode } from "react";
import type { ProgressionSuggestion } from "@/server/domain/progression";
import { Badge } from "../ui/badge";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";

const isNA = (t: string | null | undefined) => !t || /^n\/?a$/i.test(t.trim());

/** "~1-2 min" with a timer icon. Renders nothing for null / N/A. */
export function RestBadge({ rest, className }: { rest: { text: string | null }; className?: string }) {
  if (isNA(rest.text)) return null;
  return (
    <Badge tone="neutral" icon={<Icon.Timer className="size-3.5" />} className={className} aria-label={`Descanso ${rest.text}`}>
      {rest.text}
    </Badge>
  );
}

/** "RPE ~7-8" (optionally prefixed, e.g. "Temprana"). Renders nothing for null / N/A. */
export function RpeBadge({
  rpe,
  label,
  tone = "neutral",
  className,
}: {
  rpe: { text: string | null };
  /** "Temprana" / "Última" etc. */
  label?: string;
  tone?: "neutral" | "accent";
  className?: string;
}) {
  if (isNA(rpe.text)) return null;
  return (
    <Badge tone={tone} icon={<Icon.Gauge className="size-3.5" />} className={className}>
      {label ? <span className="font-medium">{label}</span> : null}
      RPE {rpe.text}
    </Badge>
  );
}

/** Early + last-set RPE as a pair (collapses to one when equal). */
export function RpePair({
  earlyRpe,
  lastRpe,
  className,
}: {
  earlyRpe: { text: string | null };
  lastRpe: { text: string | null };
  className?: string;
}) {
  const same = earlyRpe.text === lastRpe.text;
  return (
    <span className={cx("inline-flex flex-wrap gap-1.5", className)}>
      {same ? (
        <RpeBadge rpe={lastRpe} />
      ) : (
        <>
          <RpeBadge rpe={earlyRpe} label="Primeras" />
          <RpeBadge rpe={lastRpe} label="Última" tone="accent" />
        </>
      )}
    </span>
  );
}

/** "A1" superset marker. */
export function SupersetTag({ label, className }: { label: string | null; className?: string }) {
  if (!label) return null;
  return (
    <span
      className={cx(
        "inline-flex h-6.5 min-w-8 items-center justify-center rounded-sm bg-fg px-1.5 font-display text-base leading-none font-bold text-bg",
        className,
      )}
      aria-label={`Superserie ${label}`}
    >
      {label}
    </span>
  );
}

/** Progression hint (the app's own double-progression rule, PLAN §4.4). */
export function SuggestionBadge({ suggestion, className }: { suggestion: ProgressionSuggestion | null; className?: string }) {
  if (!suggestion) return null;
  return suggestion === "increase" ? (
    <Badge tone="success" className={className} title="Regla propia de doble progresión">
      ↑ Prueba subir peso
    </Badge>
  ) : (
    <Badge tone="info" className={className} title="Regla propia de doble progresión">
      = Mantén el peso, busca más reps
    </Badge>
  );
}

/** Week banner: deload (hazard stripes) or the week's bannerEs text. */
export function WeekBanner({
  isDeload,
  text,
  className,
}: {
  isDeload: boolean;
  /** week.bannerEs ?? week.banner */
  text?: ReactNode;
  className?: string;
}) {
  if (!isDeload && !text) return null;
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-lg border px-3.5 py-2.5 text-sm",
        isDeload ? "hazard border-warning/40 bg-warning-soft" : "border-info/30 bg-info-soft",
        className,
      )}
    >
      <p className="flex items-start gap-2">
        <Icon.Alert className={cx("mt-0.5 size-4 shrink-0", isDeload ? "text-warning" : "text-info")} />
        <span>
          {isDeload ? <strong className="font-display text-base tracking-wide uppercase">Semana de descarga. </strong> : null}
          <span className="text-fg">{text}</span>
        </span>
      </p>
    </div>
  );
}
