/** /historial list: sessions grouped by month, newest first. Server-safe. */
import Link from "next/link";
import type { HistoryEntry } from "@/server/services/history.service";
import { Badge } from "../ui/badge";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";
import { formatMonth } from "./format";

const DEFAULT_TZ = "America/Mexico_City";

function dateParts(iso: string, timeZone: string) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("es-MX", { day: "numeric", timeZone }).format(d);
  const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone }).format(d).replace(".", "");
  return { day, weekday };
}

export function HistoryList({ items, timeZone = DEFAULT_TZ }: { items: HistoryEntry[]; timeZone?: string }) {
  const groups: { month: string; items: HistoryEntry[] }[] = [];
  for (const it of items) {
    const month = formatMonth(it.completedAt ?? it.startedAt, timeZone);
    const g = groups.at(-1);
    if (g && g.month === month) g.items.push(it);
    else groups.push({ month, items: [it] });
  }
  const completed = items.filter((i) => i.status === "completed").length;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-fg-muted">
        <span className="nums font-semibold text-fg">{completed}</span>{" "}
        {completed === 1 ? "sesión completada" : "sesiones completadas"}
      </p>
      {groups.map((g, gi) => (
        <section key={g.month} className="flex flex-col gap-2" aria-labelledby={`m-${gi}`}>
          <h2 id={`m-${gi}`} className="eyebrow text-fg-subtle first-letter:uppercase">
            {g.month}
          </h2>
          <ul className="flex flex-col gap-2">
            {g.items.map((it, i) => {
              const skipped = it.status === "skipped";
              const { day, weekday } = dateParts(it.completedAt ?? it.startedAt, timeZone);
              return (
                <li key={it.workoutLogId} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <Link
                    href={`/historial/${it.workoutLogId}`}
                    className={cx(
                      "flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors hover:border-line-strong",
                      // Skipped state is conveyed by the dashed border, transparent background, badge and
                      // muted text tokens. Never dim with opacity: it drops text below WCAG AA (4.5:1).
                      skipped && "border-dashed bg-transparent",
                    )}
                  >
                    <div
                      className={cx(
                        "flex w-12 shrink-0 flex-col items-center rounded-md py-1",
                        skipped ? "bg-surface-2" : "bg-accent-soft",
                      )}
                    >
                      <span className="eyebrow text-[0.625rem] text-fg-muted">{weekday}</span>
                      <span
                        className={cx(
                          "nums font-display text-2xl leading-none font-bold",
                          skipped ? "text-fg-muted" : "text-accent-text",
                        )}
                      >
                        {day}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cx("truncate font-semibold", skipped && "text-fg-muted line-through decoration-fg-subtle")}>
                        {it.dayName}
                      </p>
                      <p className="nums truncate text-sm text-fg-muted">
                        Semana {it.weekNumber}
                        {skipped
                          ? ""
                          : ` · ${it.exerciseCount} ${it.exerciseCount === 1 ? "ejercicio" : "ejercicios"} · ${it.setCount} ${it.setCount === 1 ? "serie" : "series"}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {skipped ? (
                        <Badge tone="neutral" size="sm">
                          Saltada
                        </Badge>
                      ) : it.isDeload ? (
                        <Badge tone="warning" size="sm">
                          Descarga
                        </Badge>
                      ) : null}
                      <Icon.ChevronRight className="size-4 text-fg-subtle" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
