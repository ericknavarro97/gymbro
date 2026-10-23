"use client";
/**
 * One working-set row: weight + reps (or per-segment reps for mechanical
 * dropsets / compound sets) + optional RPE, with a fixed-size save indicator
 * (no layout shift while typing). Values live in the SessionStore.
 */
import { memo } from "react";
import { NumberInput } from "@/components/ui/input";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import type { SessionItem } from "@/server/services/views";
import { formatSegmentTarget } from "@/server/domain";
import { lastSetFor, rpePlaceholder, segmentsOf, targetFor, weightPlaceholder } from "./format";
import { useSession, useStore } from "./session-context";
import { rowKey, type RowSnapshot, type RowState } from "./session-store";

export const SET_GRID = "grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem]";
export const SET_GRID_RPE = "grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_1.75rem]";
export const SEG_GRID = "grid-cols-[2.25rem_minmax(0,1fr)_1.75rem]";
export const SEG_GRID_RPE = "grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,0.8fr)_1.75rem]";

/** Dim placeholders (last week / target) so they never read as typed values. */
const PH = "[&_input]:placeholder:opacity-45";

const STATE_LABEL: Record<RowState, string> = {
  idle: "Sin registrar",
  pending: "Cambios por guardar",
  saving: "Guardando…",
  saved: "Guardado",
  error: "Error al guardar",
  offline: "Sin guardar: se reintentará",
};

export function SaveIndicator({ row }: { row: RowSnapshot }) {
  const label = row.message && row.state === "error" ? `${STATE_LABEL.error}: ${row.message}` : STATE_LABEL[row.state];
  return (
    <span className="flex size-7 items-center justify-center" role="status" aria-label={label} title={label}>
      {row.state === "saving" ? (
        <Spinner className="size-4 text-fg-muted" />
      ) : row.state === "saved" ? (
        <Icon.Check className="size-5 text-success" />
      ) : row.state === "pending" ? (
        <span className="size-2 rounded-full bg-fg-subtle" />
      ) : row.state === "error" ? (
        <Icon.Alert className="size-5 text-danger" />
      ) : row.state === "offline" ? (
        <Icon.Alert className="size-5 text-warning" />
      ) : null}
    </span>
  );
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export const SetRow = memo(function SetRow({
  item,
  setNumber,
  showRpe,
}: {
  item: SessionItem;
  setNumber: number;
  showRpe: boolean;
}) {
  const { store } = useSession();
  const key = rowKey(item.id, setNumber);
  const row = useStore((s) => s.getRow(key));
  const unit = useStore((s) => s.getItemUnit(item.id));
  if (!row) return null;

  const isExtra = setNumber > item.workingSets;
  // The last working set and any extra set after it use the "last set" RPE.
  const isLast = setNumber >= item.workingSets;
  const target = targetFor(item, setNumber);
  const last = lastSetFor(item.lastPerformance, setNumber);
  const segs = segmentsOf(item);
  const weightPh = last ? weightPlaceholder(last.weight, last.unit, unit) : "—";
  const repsPh = last?.reps !== null && last?.reps !== undefined ? String(last.reps) : (target?.label ?? "");
  const rpePh = rpePlaceholder(isLast ? item.lastRpe.text : item.earlyRpe.text);
  const size = showRpe ? "md" : "lg";

  const set = (patch: Parameters<typeof store.setValues>[2]) => store.setValues(item.id, setNumber, patch);
  const blur = () => store.flush(item.id, setNumber);
  const name = `Serie ${setNumber}`;

  const numberCell = (
    <div className="flex flex-col items-center justify-center self-stretch leading-none">
      <span className={cx("font-display text-2xl font-bold nums", isExtra ? "text-fg-subtle" : "text-fg")}>
        {setNumber}
      </span>
      {isExtra ? (
        <span className="mt-0.5 text-[0.625rem] font-semibold text-fg-subtle uppercase">Extra</span>
      ) : item.reps.scheme?.type === "per_set" && target ? (
        <span className="mt-0.5 text-[0.6875rem] font-semibold text-accent-text nums">×{target.label}</span>
      ) : null}
    </div>
  );

  const weightInput = (
    <NumberInput
      label={`${name}: peso (${unit})`}
      hideLabel
      mode="decimal"
      size={size}
      value={row.values.weight}
      onValueChange={(v) => set({ weight: v })}
      onBlur={blur}
      placeholder={weightPh}
      maxLength={6}
      className={PH}
    />
  );

  const rpeInput = showRpe ? (
    <NumberInput
      label={`${name}: RPE`}
      hideLabel
      mode="decimal"
      size="md"
      value={row.values.rpe}
      onValueChange={(v) => set({ rpe: v })}
      onBlur={blur}
      placeholder={rpePh}
      maxLength={4}
      className={PH}
    />
  ) : null;

  if (segs > 1 && target) {
    const lastSeg = last?.segmentReps ?? null;
    return (
      <li className="flex flex-col gap-1.5">
        <div className={cx("grid items-center gap-1.5", showRpe ? SEG_GRID_RPE : SEG_GRID)}>
          {numberCell}
          {weightInput}
          {rpeInput}
          <SaveIndicator row={row} />
        </div>
        <div className="grid gap-1.5 pr-[2.125rem] pl-[2.625rem]" style={{ gridTemplateColumns: `repeat(${segs}, minmax(0, 1fr))` }}>
          {target.segments.map((seg, i) => {
            const segLabel =
              item.reps.scheme?.type === "compound"
                ? i === 0
                  ? "Principal"
                  : capitalize(seg.label ?? "Final")
                : `Fase ${i + 1}`;
            return (
              <div key={i} className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-center text-[0.6875rem] font-semibold text-fg-subtle uppercase">
                  {segLabel} · {formatSegmentTarget(seg)}
                </span>
                <NumberInput
                  label={`${name}: reps ${segLabel}`}
                  hideLabel
                  mode="numeric"
                  size="md"
                  value={row.values.segments[i] ?? ""}
                  onValueChange={(v) => {
                    const next = [...row.values.segments];
                    next[i] = v;
                    set({ segments: next });
                  }}
                  onBlur={blur}
                  placeholder={lastSeg?.[i] !== undefined ? String(lastSeg[i]) : formatSegmentTarget(seg)}
                  maxLength={3}
                  className={PH}
                />
              </div>
            );
          })}
        </div>
        <RowMessage row={row} />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1">
      <div className={cx("grid items-center gap-1.5", showRpe ? SET_GRID_RPE : SET_GRID)}>
        {numberCell}
        {weightInput}
        <NumberInput
          label={`${name}: reps`}
          hideLabel
          mode="numeric"
          size={size}
          value={row.values.reps}
          onValueChange={(v) => set({ reps: v })}
          onBlur={blur}
          placeholder={repsPh}
          maxLength={3}
          className={PH}
        />
        {rpeInput}
        <SaveIndicator row={row} />
      </div>
      <RowMessage row={row} />
    </li>
  );
});

/** Error text under a row (only for errors, so typing never shifts layout). */
function RowMessage({ row }: { row: RowSnapshot }) {
  if (row.state !== "error" || !row.message) return null;
  return (
    <p className="pl-[2.625rem] text-xs font-medium text-danger" role="alert">
      {row.message}
    </p>
  );
}
