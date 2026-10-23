/**
 * ProgressBar. Continuous (`value` 0..1) or segmented (`segments` = e.g. 10
 * weeks, fills `value * segments` cells). Server-safe.
 */
import type { ReactNode } from "react";
import { cx } from "./cx";

export interface ProgressBarProps {
  /** 0..1 (clamped). */
  value: number;
  /** Accessible label, e.g. "Progreso del programa". */
  label: string;
  /** Text for screen readers / the visible caption, e.g. "12 de 50 sesiones". */
  valueText?: string;
  /** Render N cells instead of a continuous bar. */
  segments?: number;
  /** Highlight these 0-based segment indexes (e.g. deload weeks) with stripes. */
  markedSegments?: number[];
  /** Visible label row above the bar. */
  showLabel?: boolean;
  trailing?: ReactNode;
  tone?: "accent" | "success";
  className?: string;
}

export function ProgressBar({
  value,
  label,
  valueText,
  segments,
  markedSegments = [],
  showLabel = false,
  trailing,
  tone = "accent",
  className,
}: ProgressBarProps) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const pct = Math.round(v * 100);
  const fill = tone === "success" ? "bg-success" : "bg-accent";
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {showLabel ? (
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="eyebrow text-fg-subtle">{label}</span>
          <span className="nums font-semibold text-fg-muted">{trailing ?? valueText ?? `${pct}%`}</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={valueText ?? `${pct}%`}
        className={cx(segments ? "flex gap-1" : "h-2.5 overflow-hidden rounded-full bg-surface-2")}
      >
        {segments ? (
          Array.from({ length: segments }, (_, i) => {
            const cellFill = Math.min(1, Math.max(0, v * segments - i));
            return (
              <div
                key={i}
                className={cx(
                  "relative h-2.5 flex-1 overflow-hidden rounded-xs bg-surface-2",
                  markedSegments.includes(i) && "hazard",
                )}
              >
                <div className={cx("absolute inset-y-0 left-0", fill)} style={{ width: `${cellFill * 100}%` }} />
              </div>
            );
          })
        ) : (
          <div className={cx("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}
