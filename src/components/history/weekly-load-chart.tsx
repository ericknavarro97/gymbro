"use client";
/**
 * Weekly load chart for /ejercicios/[slug]: top set per program week (heaviest
 * weight, in the user's unit). Bodyweight-only exercises chart reps instead.
 * Single series → no legend; the section title names it. Includes a
 * crosshair tooltip and a visually-available table (details) for a11y.
 */
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { WeeklyTopSet } from "@/server/domain/weekly-load";
import type { WeightUnit } from "@/server/domain/units";

export interface WeeklyLoadChartProps {
  weekly: WeeklyTopSet[];
  unit: WeightUnit;
  /** Total weeks in the program (x axis extent). */
  totalWeeks?: number;
  /** Deload week numbers (shown in the tooltip/table). */
  deloadWeeks?: number[];
}

interface Point {
  week: number;
  value: number;
  weight: number | null;
  reps: number | null;
}

/** Round y-axis bounds/ticks to a 1-2-2.5-5 step (≈4 intervals) with some headroom. */
function niceScale(values: number[]): { min: number; max: number; ticks: number[] } {
  if (values.length === 0) return { min: 0, max: 10, ticks: [0, 5, 10] };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) {
    lo -= Math.max(1, lo * 0.1);
    hi += Math.max(1, hi * 0.1);
  }
  const raw = (hi - lo) / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const min = Math.max(0, Math.floor(lo / step - 0.5) * step);
  const max = Math.ceil(hi / step + 0.25) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 1000; t += step) ticks.push(Number(t.toFixed(4)));
  return { min, max, ticks };
}

function fmt(n: number): string {
  return `${Number(n.toFixed(1))}`;
}

export function WeeklyLoadChart({ weekly, unit, totalWeeks = 10, deloadWeeks = [] }: WeeklyLoadChartProps) {
  const byWeight = weekly.some((w) => w.weight !== null);
  const points: Point[] = weekly
    .map((w) => ({ week: w.week, value: (byWeight ? w.weight : w.reps) ?? NaN, weight: w.weight, reps: w.reps }))
    .filter((p) => Number.isFinite(p.value));
  const metricLabel = byWeight ? `Peso (${unit})` : "Reps";
  const maxWeek = Math.max(totalWeeks, ...points.map((p) => p.week));
  const ticks = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const deload = new Set(deloadWeeks);
  const y = niceScale(points.map((p) => p.value));

  const describe = (p: Pick<Point, "weight" | "reps">) =>
    p.weight !== null ? `${fmt(p.weight)} ${unit}${p.reps !== null ? ` × ${p.reps}` : ""}` : `${p.reps ?? "—"} reps`;

  const summary =
    points.length > 0
      ? `Mejor serie por semana: ${points.map((p) => `semana ${p.week}, ${describe(p)}`).join("; ")}.`
      : "Sin datos.";

  return (
    <figure className="flex flex-col gap-2">
      <div role="img" aria-label={summary} className="w-full">
        <LineChart
          responsive
          data={points}
          margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
          style={{ width: "100%", aspectRatio: 1.7, maxHeight: 260 }}
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={false} stroke="var(--gb-line)" strokeDasharray="0" />
          <XAxis
            dataKey="week"
            type="number"
            domain={[1, maxWeek]}
            ticks={ticks}
            tickFormatter={(w: number) => `S${w}`}
            tick={{ fill: "var(--gb-fg-subtle)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--gb-line-strong)" }}
            interval={0}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            dataKey="value"
            width={40}
            tick={{ fill: "var(--gb-fg-subtle)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
            domain={[y.min, y.max]}
            ticks={y.ticks}
            allowDecimals
          />
          <Tooltip
            cursor={{ stroke: "var(--gb-fg-subtle)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={(props: TooltipContentProps<ValueType, NameType>) => {
              const p = props.active ? (props.payload?.[0]?.payload as Point | undefined) : undefined;
              if (!p) return null;
              return (
                <div className="rounded-md border border-line bg-raised px-3 py-2 text-sm shadow-card">
                  <p className="eyebrow text-fg-subtle">
                    Semana {p.week}
                    {deload.has(p.week) ? " · descarga" : ""}
                  </p>
                  <p className="nums font-semibold text-fg">{describe(p)}</p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={metricLabel}
            stroke="var(--gb-accent)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--gb-accent)", stroke: "var(--gb-surface)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "var(--gb-accent)", stroke: "var(--gb-surface)", strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </div>
      <figcaption className="flex items-center justify-between gap-2 text-xs text-fg-subtle">
        <span>{byWeight ? `Serie más pesada de cada semana, en ${unit}.` : "Más reps por semana (sin peso)."}</span>
      </figcaption>
      <details className="group rounded-md border border-line bg-surface-2/60">
        <summary className="tap flex cursor-pointer list-none items-center px-3 text-sm font-medium text-fg-muted [&::-webkit-details-marker]:hidden">
          <span className="flex-1">Ver como tabla</span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <table className="nums w-full text-sm">
          <caption className="sr-only">Mejor serie por semana</caption>
          <thead>
            <tr className="border-t border-line text-left text-xs text-fg-subtle uppercase">
              <th scope="col" className="px-3 py-2 font-medium">
                Semana
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Mejor serie
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.week} className="border-t border-line">
                <td className="px-3 py-2">
                  {p.week}
                  {deload.has(p.week) ? <span className="ml-1.5 text-xs text-fg-subtle">descarga</span> : null}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{describe(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
