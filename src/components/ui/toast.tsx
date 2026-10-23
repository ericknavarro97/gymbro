"use client";
/**
 * Toast system. <ToastProvider> is mounted once in the root layout; any
 * Client Component can call:
 *
 *   const toast = useToast();
 *   toast.success("Sesión terminada");
 *   toast.error("No se pudo guardar", { description: "Revisa tu conexión" });
 *   toast.show({ title: "Serie borrada", action: { label: "Deshacer", onClick: undo } });
 *   toast.result(r, "Guardado");   // ActionResult: error → error toast; ok → success (if a message is given)
 *
 * Toasts stack at the top (clear of the tab bar and the keyboard), announce
 * via aria-live (errors assertively), auto-dismiss (4 s; errors 6 s) and pause
 * while touched/hovered.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

export type ToastTone = "neutral" | "success" | "error" | "warning";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** ms; 0 = sticky until dismissed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
  /** Replace an existing toast with the same id (e.g. "save-status"). */
  id?: string;
}

interface ToastItem extends Required<Pick<ToastOptions, "tone" | "duration">> {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ToastOptions["action"];
}

type ResultLike = { ok: true } | { ok: false; error: { message: string } };

export interface ToastApi {
  show: (opts: ToastOptions) => string;
  success: (title: ReactNode, opts?: Omit<ToastOptions, "title" | "tone">) => string;
  error: (title: ReactNode, opts?: Omit<ToastOptions, "title" | "tone">) => string;
  warning: (title: ReactNode, opts?: Omit<ToastOptions, "title" | "tone">) => string;
  /** Error toast for a failed ActionResult; success toast when ok and `successTitle` is given. Returns r.ok. */
  result: (r: ResultLike, successTitle?: ReactNode) => boolean;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Keep the toast viewport in the top layer, above any open <dialog> sheet:
  // re-showing a popover moves it to the top of the top-layer stack.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (items.length > 0) el.showPopover();
    } catch {
      /* popover unsupported: falls back to fixed positioning */
    }
  }, [items]);

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((opts: ToastOptions) => {
    const id = opts.id ?? `t${++counter}`;
    const tone = opts.tone ?? "neutral";
    const item: ToastItem = {
      id,
      title: opts.title,
      description: opts.description,
      tone,
      duration: opts.duration ?? (tone === "error" ? 6000 : 4000),
      action: opts.action,
    };
    setItems((list) => [...list.filter((t) => t.id !== id), item].slice(-3));
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, o) => show({ ...o, title, tone: "success" }),
      error: (title, o) => show({ ...o, title, tone: "error" }),
      warning: (title, o) => show({ ...o, title, tone: "warning" }),
      result: (r, successTitle) => {
        if (!r.ok) {
          show({ title: r.error.message || "Algo salió mal", tone: "error" });
          return false;
        }
        if (successTitle) show({ title: successTitle, tone: "success" });
        return true;
      },
    }),
    [show, dismiss],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div
        ref={viewportRef}
        popover="manual"
        className="pointer-events-none fixed inset-x-0 top-0 bottom-auto z-[60] m-0 flex h-auto w-full max-w-none flex-col items-center gap-2 overflow-visible border-0 bg-transparent px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-fg [&:not(:popover-open)]:hidden"
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}

const toneStyles: Record<ToastTone, { box: string; icon: ReactNode }> = {
  neutral: { box: "border-line", icon: <Icon.Info className="size-5 text-fg-muted" /> },
  success: { box: "border-success/40", icon: <Icon.Check className="size-5 text-success" /> },
  error: { box: "border-danger/50", icon: <Icon.Alert className="size-5 text-danger" /> },
  warning: { box: "border-warning/50", icon: <Icon.Alert className="size-5 text-warning" /> },
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (item.duration === 0 || paused) return;
    startedAt.current = Date.now();
    const t = window.setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, item.id, item.duration, onDismiss]);

  const s = toneStyles[item.tone];
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className={cx(
        "pointer-events-auto flex w-full max-w-app animate-toast-in items-start gap-3 rounded-lg border bg-raised py-2.5 pr-1.5 pl-3.5 text-fg shadow-card",
        s.box,
      )}
    >
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-sm text-fg-muted">{item.description}</p> : null}
      </div>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className="min-h-11 shrink-0 rounded-md px-3 text-sm font-bold text-accent-text hover:bg-surface-2"
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Cerrar aviso"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:text-fg"
      >
        <Icon.Close className="size-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
