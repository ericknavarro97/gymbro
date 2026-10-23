/**
 * Page chrome for (app) screens. Server-safe.
 *
 * <PageHeader eyebrow="Semana 3" title="Full Body #2" back="/programa" actions={<IconButton …/>} />
 * <PageBody>…</PageBody>
 */
import { BackLink } from "./back-link";
import type { ReactNode } from "react";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";

export interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  /** href for a back chevron (left). */
  back?: string;
  backLabel?: string;
  /** Back uses browser history when the user navigated here in-app (default true). */
  backHistory?: boolean;
  /** Right-side actions (IconButtons). */
  actions?: ReactNode;
  /** Extra row under the title (tabs, filters, progress). */
  children?: ReactNode;
  /** Large title (screen roots) vs compact (detail screens). Default "lg". */
  size?: "lg" | "md";
  className?: string;
}

/** Sticky header with safe-area top inset and blurred background. */
export function PageHeader({
  title,
  eyebrow,
  back,
  backLabel = "Atrás",
  backHistory = true,
  actions,
  children,
  size = "lg",
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cx(
        "sticky top-0 z-30 border-b border-line/70 bg-bg/85 pt-safe backdrop-blur-md supports-[backdrop-filter]:bg-bg/70",
        className,
      )}
    >
      <div className="flex min-h-14 items-center gap-1 px-2">
        {back ? (
          <BackLink
            href={back}
            label={backLabel}
            history={backHistory}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg hover:bg-surface-2"
          >
            <Icon.ChevronLeft />
          </BackLink>
        ) : (
          <span className="w-2" />
        )}
        <div className="min-w-0 flex-1 py-2">
          {eyebrow ? <p className="eyebrow truncate text-accent-text">{eyebrow}</p> : null}
          <h1
            className={cx(
              "truncate font-display leading-[1.05] font-bold uppercase",
              size === "lg" ? "text-[2rem]" : "text-[1.5rem]",
            )}
          >
            {title}
          </h1>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {children ? <div className="px-4 pb-3">{children}</div> : null}
    </header>
  );
}

/** Padded content column; reserves space for the bottom tab bar. */
export function PageBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("flex flex-col gap-4 px-4 pt-4 pb-tabbar", className)}>{children}</div>;
}

/** Section title inside a page. */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mt-2 flex items-end justify-between gap-2", className)}>
      <h2 className="font-display text-xl leading-none font-bold tracking-wide text-fg-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}
