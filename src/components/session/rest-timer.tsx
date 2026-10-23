"use client";
/**
 * Floating rest timer pill. Starts after a set is logged (uses the
 * prescription's max rest). Time is computed from an end timestamp, so it
 * stays correct when the phone sleeps or the tab is in the background.
 */
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icons";
import { formatDuration } from "@/server/domain";
import { useSession, useStore } from "./session-context";

export function RestTimer() {
  const { store } = useSession();
  const timer = useStore((s) => s.getTimer());
  const [now, setNow] = useState(() => Date.now());
  const buzzed = useRef<number | null>(null);

  useEffect(() => {
    if (!timer) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 250);
    const raf = requestAnimationFrame(tick);
    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, [timer]);

  const remaining = timer ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : 0;
  const finished = Boolean(timer) && remaining === 0;

  useEffect(() => {
    if (!timer || !finished || buzzed.current === timer.endsAt) return;
    buzzed.current = timer.endsAt;
    try {
      navigator.vibrate?.([180, 90, 180]);
    } catch {
      /* not supported */
    }
    const id = setTimeout(() => store.stopRest(), 6000);
    return () => clearTimeout(id);
  }, [finished, timer, store]);

  if (!timer) return null;
  const ratio = timer.totalSec > 0 ? Math.min(1, Math.max(0, remaining / timer.totalSec)) : 0;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
    >
      <div
        className={cx(
          "pointer-events-auto flex animate-toast-in items-center gap-1 overflow-hidden rounded-full border p-1 pl-4 shadow-card",
          finished ? "border-success/50 bg-success-soft" : "border-line-strong bg-raised",
        )}
        role="timer"
        aria-live={finished ? "assertive" : "off"}
        aria-label={finished ? "Descanso terminado" : `Descanso: ${formatDuration(remaining)}`}
      >
        <span
          className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--gb-accent) ${ratio * 360}deg, color-mix(in oklab, var(--gb-accent) 18%, transparent) 0)`,
          }}
          aria-hidden
        >
          <span className="size-4 rounded-full bg-raised" />
        </span>
        <span className="ml-1.5 min-w-14 font-display text-2xl leading-none font-bold nums">
          {finished ? "¡Va!" : formatDuration(remaining)}
        </span>
        <span className="hidden max-w-32 truncate text-xs text-fg-muted min-[400px]:inline">
          {finished ? "Siguiente serie" : "Descanso"}
        </span>
        {!finished ? (
          <button
            type="button"
            onClick={() => store.addRestTime(30)}
            className="inline-flex size-11 items-center justify-center rounded-full text-sm font-bold text-fg hover:bg-surface-2"
            aria-label="Sumar 30 segundos"
          >
            +30
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => store.stopRest()}
          className="inline-flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2"
          aria-label="Cerrar temporizador"
        >
          <Icon.Close className="size-5" />
        </button>
      </div>
    </div>
  );
}
