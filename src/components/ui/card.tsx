/** Card surfaces. Server-safe. */
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** "default" = surface + border, "raised" = elevated, "accent" = orange edge highlight, "inset" = sunken. */
  tone?: "default" | "raised" | "accent" | "inset";
  /** Inner padding. Default "md" (16px). */
  padding?: "none" | "sm" | "md" | "lg";
  as?: "section" | "article" | "div" | "li";
}

const paddings = { none: "", sm: "p-3", md: "p-4", lg: "p-5" } as const;

export function Card({ tone = "default", padding = "md", as: As = "section", className, ...rest }: CardProps) {
  return (
    <As
      className={cx(
        "relative rounded-xl",
        tone === "default" && "bg-surface border border-line",
        tone === "raised" && "bg-raised border border-line shadow-card",
        tone === "accent" &&
          "bg-surface border border-line shadow-card before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-accent",
        tone === "inset" && "bg-surface-2 border border-transparent",
        paddings[padding],
        className,
      )}
      {...rest}
    />
  );
}

/** Title row for a Card: eyebrow + title + optional trailing action. */
export function CardHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-3 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow text-fg-subtle">{eyebrow}</p> : null}
        <h2 className="font-display text-2xl leading-tight font-bold uppercase">{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
