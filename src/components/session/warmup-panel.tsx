"use client";
/** Calculated warm-up (PLAN §4.3): from set-1 weight being typed, else last week's set 1. */
import { parseDecimal } from "@/components/ui/number";
import { computeWarmupSets, convertWeight, formatWeight } from "@/server/domain";
import type { SessionItem } from "@/server/services/views";
import { lastSetFor } from "./format";
import { useSession, useStore } from "./session-context";
import { rowKey } from "./session-store";

export function WarmupPanel({ item }: { item: SessionItem }) {
  const { rounding, protocol } = useSession();
  const unit = useStore((s) => s.getItemUnit(item.id));
  const typed = useStore((s) => s.getRow(rowKey(item.id, 1))?.values.weight ?? "");
  const count = item.warmup.max ?? 0;
  if (count <= 0) return null;

  const current = parseDecimal(typed);
  const last = lastSetFor(item.lastPerformance, 1);
  const lastWeight = last && last.weight !== null ? convertWeight(last.weight, last.unit, unit) : null;
  const base = current !== null && current > 0 ? current : lastWeight;
  const source = current !== null && current > 0 ? "tu serie 1" : lastWeight !== null ? "la semana pasada" : null;
  const plan = computeWarmupSets(base, count, unit, rounding[unit], protocol);

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          Calentamiento{item.warmup.text ? <span className="text-fg-muted"> · {item.warmup.text} {item.warmup.text === "1" ? "serie" : "series"}</span> : null}
        </p>
        {source ? <p className="text-xs text-fg-subtle">Según {source}</p> : null}
      </div>
      <ol className="mt-2 flex flex-col divide-y divide-line">
        {plan.sets.map((s) => (
          <li key={s.setNumber} className="flex items-center gap-3 py-1.5 nums">
            <span className="w-5 font-display text-lg font-bold text-fg-subtle">{s.setNumber}</span>
            <span className="w-12 text-sm text-fg-muted">{s.pctOfWorking}%</span>
            <span className="flex-1 text-sm">{s.repsText} reps</span>
            <span className="font-display text-xl font-bold">
              {s.weight !== null ? formatWeight(s.weight, unit) : "—"}
            </span>
          </li>
        ))}
      </ol>
      {plan.extraSetSuggested ? (
        <p className="mt-1.5 text-xs text-fg-muted">+1 serie libre si la necesitas.</p>
      ) : null}
      {base === null ? (
        <p className="mt-1.5 text-xs text-fg-muted">Escribe el peso de la serie 1 para calcular los pesos.</p>
      ) : null}
      <p className="mt-1.5 text-xs text-fg-subtle">Las series de calentamiento no se registran.</p>
    </div>
  );
}
