/** Empty / error / "en construcción" state block. Server-safe. */
import type { ReactNode } from "react";
import { cx } from "./cx";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons / links. */
  action?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}

export function EmptyState({ icon, title, description, action, tone = "neutral", className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center",
        tone === "danger" ? "border-danger/40 bg-danger-soft/40" : "border-line-strong bg-surface/60",
        className,
      )}
    >
      {icon ? (
        <div
          className={cx(
            "flex size-14 items-center justify-center rounded-full [&>svg]:size-7",
            tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-2 text-accent-text",
          )}
        >
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-2xl leading-tight font-bold uppercase">{title}</h2>
      {description ? <p className="max-w-xs text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2 flex w-full max-w-xs flex-col gap-2">{action}</div> : null}
    </div>
  );
}
