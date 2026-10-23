/**
 * Programa: block → weeks (native <details> accordion) → days with status.
 * Server-safe; the block switcher is the shared <Tabs/> (client) receiving
 * these server-rendered nodes as content.
 */
import Link from "next/link";
import type { ProgramOverview } from "@/server/services/workout.service";
import { Badge } from "../ui/badge";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";
import { DAY_STATUS, bannerSentence, blockName, dayHref } from "./format";

type Block = ProgramOverview["blocks"][number];
type Week = Block["weeks"][number];
type Day = Week["days"][number];

export function BlockPanel({ block, currentWeek }: { block: Block; currentWeek: number | null }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-2xl leading-tight font-bold uppercase">{blockName(block)}</h2>
        {block.description ? <p className="mt-1 text-sm leading-relaxed text-fg-muted">{block.description}</p> : null}
      </div>
      <ol className="flex flex-col gap-2.5">
        {block.weeks.map((w) => (
          <li key={w.id}>
            <WeekAccordion week={w} current={w.number === currentWeek} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function WeekAccordion({ week, current }: { week: Week; current: boolean }) {
  const closed = week.days.filter((d) => d.status === "completed" || d.status === "skipped").length;
  const allDone = closed === week.days.length && week.days.length > 0;
  const banner = week.isDeload ? bannerSentence(week.bannerEs ?? week.banner) : null;
  return (
    <details
      open={current}
      className={cx(
        "group overflow-hidden rounded-xl border bg-surface",
        current ? "border-accent shadow-card" : "border-line",
      )}
    >
      <summary
        className={cx(
          "flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden",
          week.isDeload && "hazard",
        )}
      >
        <span
          className={cx(
            "flex size-11 shrink-0 flex-col items-center justify-center rounded-md font-display leading-none font-bold",
            current ? "bg-accent text-accent-fg" : allDone ? "bg-success-soft text-success" : "bg-surface-2 text-fg",
          )}
          aria-hidden
        >
          <span className="text-[0.625rem] tracking-wider uppercase opacity-80">Sem</span>
          <span className="nums text-xl">{week.number}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-xl leading-none font-bold uppercase">Semana {week.number}</span>
            {current ? (
              <Badge tone="accent" size="sm">
                Actual
              </Badge>
            ) : null}
            {week.isDeload ? (
              <Badge tone="warning" size="sm">
                Descarga
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <DayDots days={week.days} />
            <span className="nums text-xs font-semibold text-fg-muted">
              {closed}/{week.days.length}
            </span>
          </span>
        </span>
        <Icon.ChevronDown className="size-5 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
      </summary>
      {banner ? <p className="border-t border-line bg-warning-soft px-4 py-2 text-sm text-fg">{banner}</p> : null}
      <ul className="divide-y divide-line border-t border-line">
        {week.days.map((d) => (
          <li key={d.id}>
            <DayRow day={d} week={week.number} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function DayDots({ days }: { days: Day[] }) {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {days.map((d) => (
        <span
          key={d.id}
          className={cx(
            "size-2 rounded-full",
            d.status === "completed" && "bg-success",
            d.status === "in_progress" && "bg-accent",
            d.status === "skipped" && "bg-warning",
            d.status === "pending" && (d.isNext ? "bg-accent/50 ring-1 ring-accent" : "bg-line-strong"),
          )}
        />
      ))}
    </span>
  );
}

function DayRow({ day, week }: { day: Day; week: number }) {
  const s = DAY_STATUS[day.status];
  return (
    <Link
      href={dayHref(week, day.position)}
      className={cx(
        "flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2",
        day.isNext && "bg-accent-soft/60",
      )}
      aria-label={`Semana ${week}, ${day.name}: ${s.label}${day.isNext ? ", siguiente sesión" : ""}`}
    >
      <span className="nums w-5 shrink-0 text-center font-display text-lg leading-none font-bold text-fg-subtle">
        {day.position}
      </span>
      {/* Name gets the full row width (wrapping, never truncated); the status badges sit on
          their own wrapping line below so "Siguiente" + "En curso" can't squeeze it at 360px. */}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug break-words">
          {day.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {day.isNext ? (
            <Badge tone="accent" size="sm" icon={<Icon.Play className="size-3" />}>
              Siguiente
            </Badge>
          ) : null}
          {day.status !== "pending" || !day.isNext ? (
            <Badge
              tone={s.tone}
              size="sm"
              icon={day.status === "completed" ? <Icon.Check className="size-3" /> : undefined}
            >
              {s.label}
            </Badge>
          ) : null}
          {day.restAfter ? <span className="text-xs text-fg-subtle">Descanso después</span> : null}
        </span>
      </span>
      <Icon.ChevronRight className="size-4 shrink-0 text-fg-subtle" />
    </Link>
  );
}
