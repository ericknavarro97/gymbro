"use client";
/**
 * SegmentedControl: single choice among 2–4 short options (radiogroup
 * semantics, arrow keys move selection). Pass `name` to also submit the
 * value inside a <form> via a hidden input.
 */
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible label if `label` isn't plain text. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Visible group label (or use `aria-label` via `label` + `hideLabel`). */
  label: string;
  hideLabel?: boolean;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  name?: string;
  size?: "md" | "lg";
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  hideLabel,
  options,
  value,
  onChange,
  name,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const labelId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    for (let i = 1; i <= options.length; i++) {
      const next = (index + dir * i + options.length) % options.length;
      if (!options[next].disabled) {
        onChange(options[next].value);
        refs.current[next]?.focus();
        break;
      }
    }
  };

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <span id={labelId} className={cx("text-sm font-semibold", hideLabel && "sr-only")}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg border border-line bg-surface-2 p-1"
      >
        {options.map((o, i) => {
          const checked = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={o.ariaLabel}
              disabled={o.disabled}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cx(
                "inline-flex items-center justify-center gap-1.5 rounded-md px-3 font-semibold transition-colors disabled:opacity-40",
                size === "lg" ? "min-h-13 text-lg" : "min-h-11 text-sm",
                checked ? "bg-accent text-accent-fg shadow-sm" : "text-fg-muted hover:text-fg",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
