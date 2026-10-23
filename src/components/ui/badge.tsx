/** Badge (static label) and Chip (interactive pill button). Server-safe. */
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted border-line",
  accent: "bg-accent-soft text-accent-text border-accent/30",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/30",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** "sm" = 20px tall, "md" = 26px tall. */
  size?: "sm" | "md";
  icon?: ReactNode;
}

export function Badge({ tone = "neutral", size = "md", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-semibold whitespace-nowrap nums",
        size === "sm" ? "h-5 px-2 text-[0.6875rem]" : "h-6.5 px-2.5 text-xs",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  icon?: ReactNode;
  /** Pressed/selected look (sets aria-pressed when `toggle`). */
  selected?: boolean;
  /** Render as a toggle button (aria-pressed). */
  toggle?: boolean;
}

/** Tappable pill (44px hit area, 34px visual). */
export function Chip({
  tone = "neutral",
  icon,
  selected,
  toggle,
  className,
  children,
  type = "button",
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={toggle ? Boolean(selected) : undefined}
      className={cx(
        "group relative inline-flex min-h-11 items-center",
        "disabled:opacity-45",
        className,
      )}
      {...rest}
    >
      <span
        className={cx(
          "inline-flex h-8.5 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors",
          "group-active:scale-[0.97]",
          selected ? "border-accent bg-accent text-accent-fg" : tones[tone],
        )}
      >
        {icon}
        {children}
      </span>
    </button>
  );
}
