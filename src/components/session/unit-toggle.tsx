"use client";
/**
 * Quick lb/kg switch for one exercise's weights (gyms mix lb and kg equipment).
 * Sits in the "Peso" column header; one tap switches the unit of the whole card.
 */
import type { KeyboardEvent } from "react";
import { cx } from "@/components/ui/cx";
import type { WeightUnit } from "@/server/domain";

const UNITS: readonly WeightUnit[] = ["lb", "kg"];

export function UnitToggle({
  value,
  onChange,
  exerciseName,
}: {
  value: WeightUnit;
  onChange: (unit: WeightUnit) => void;
  exerciseName: string;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    onChange(value === "lb" ? "kg" : "lb");
  };

  return (
    <div
      role="radiogroup"
      aria-label={`Unidad del peso · ${exerciseName}`}
      className="mx-auto inline-flex rounded-full border border-line-strong bg-surface-2 p-0.5"
    >
      {UNITS.map((u) => {
        const selected = u === value;
        return (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={u === "lb" ? "Libras" : "Kilogramos"}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(u)}
            onKeyDown={onKeyDown}
            className={cx(
              // Visual pill is compact; the ::before extends the tap target to ≥44px tall.
              "relative h-7 min-w-9 rounded-full px-2 text-[0.75rem] font-bold tracking-wide uppercase transition-colors",
              "before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              selected ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {u}
          </button>
        );
      })}
    </div>
  );
}
