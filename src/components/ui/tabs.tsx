"use client";
/**
 * Tabs (WAI-ARIA tabs pattern, automatic activation, arrow/Home/End keys).
 * Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
 *
 * <Tabs defaultValue="grafica" label="Historial del ejercicio"
 *   items={[{ value: "grafica", label: "Gráfica", content: <Chart/> },
 *           { value: "tabla", label: "Tabla", content: <Table/> }]} />
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: ReadonlyArray<TabItem>;
  /** Accessible name of the tablist. */
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** "underline" (default) or "pill". */
  variant?: "underline" | "pill";
  /** Make the tab list sticky under a sticky header (pass a top offset class, e.g. "top-14"). */
  stickyClassName?: string;
  className?: string;
}

export function Tabs({
  items,
  label,
  value,
  defaultValue,
  onValueChange,
  variant = "underline",
  stickyClassName,
  className,
}: TabsProps) {
  const baseId = useId();
  const [inner, setInner] = useState(defaultValue ?? items[0]?.value);
  const current = value ?? inner;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (v: string) => {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };

  const enabled = items.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0);
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const pos = enabled.indexOf(index);
    let target: number | undefined;
    if (e.key === "ArrowRight") target = enabled[(pos + 1) % enabled.length];
    else if (e.key === "ArrowLeft") target = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") target = enabled[0];
    else if (e.key === "End") target = enabled[enabled.length - 1];
    if (target === undefined) return;
    e.preventDefault();
    select(items[target].value);
    refs.current[target]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className={cx(
          "scrollbar-none flex overflow-x-auto",
          variant === "underline" ? "gap-1 border-b border-line" : "gap-1 rounded-lg bg-surface-2 p-1",
          stickyClassName && cx("sticky z-10 bg-bg/90 backdrop-blur", stickyClassName),
        )}
      >
        {items.map((t, i) => {
          const selected = t.value === current;
          return (
            <button
              key={t.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${baseId}-tab-${t.value}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.value}`}
              tabIndex={selected ? 0 : -1}
              disabled={t.disabled}
              onClick={() => select(t.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cx(
                "relative min-h-11 shrink-0 px-4 text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-40",
                variant === "underline" &&
                  (selected
                    ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.75 after:rounded-full after:bg-accent"
                    : "text-fg-muted hover:text-fg"),
                variant === "pill" && "flex-1 rounded-md",
                variant === "pill" && (selected ? "bg-raised text-fg shadow-sm" : "text-fg-muted"),
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {items.map((t) => (
        <div
          key={t.value}
          id={`${baseId}-panel-${t.value}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${t.value}`}
          hidden={t.value !== current}
          tabIndex={0}
          className="pt-4 outline-none"
        >
          {t.value === current ? t.content : null}
        </div>
      ))}
    </div>
  );
}
