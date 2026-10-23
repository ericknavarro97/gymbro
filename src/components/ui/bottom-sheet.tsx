"use client";
/**
 * BottomSheet: modal sheet built on the native <dialog> (top layer, inert
 * background, focus returns to the opener on close). Adds: Tab focus wrap,
 * Esc / overlay tap / close button / drag-down-on-handle to close, body scroll
 * lock, enter/exit animation and safe-area padding.
 *
 * const sheet = useDisclosure();
 * <Button onClick={sheet.onOpen}>Ver</Button>
 * <BottomSheet open={sheet.open} onOpenChange={sheet.setOpen} title="Press de banca">…</BottomSheet>
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  return { open, setOpen, onOpen, onClose, toggle };
}

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible title (rendered as the sheet heading). */
  title: ReactNode;
  /** Visually hide the title (still labels the dialog). */
  hideTitle?: boolean;
  /** Small text above the title. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Sticky footer (actions). */
  footer?: ReactNode;
  /** "auto" grows with content up to 92dvh; "full" always 92dvh. */
  size?: "auto" | "full";
  /** Extra classes for the scrollable body. */
  bodyClassName?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';

const EXIT_MS = 180;

export function BottomSheet({
  open,
  onOpenChange,
  title,
  hideTitle,
  eyebrow,
  description,
  children,
  footer,
  size = "auto",
  bodyClassName,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // Keep children mounted while the exit animation runs.
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; startT: number } | null>(null);

  if (open && (!mounted || closing)) {
    setMounted(true);
    setClosing(false);
  }
  if (!open && mounted && !closing) {
    setClosing(true);
  }

  // Open/close the native dialog.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal() runs the dialog focusing steps, which scroll the focused
      // control into view while the panel is still translated below the
      // viewport by the enter animation. The dialog is overflow:clip (not a
      // scroll container), but reset defensively for engines without clip.
      d.scrollTop = 0;
      panelRef.current?.focus({ preventScroll: true });
    }
  }, [open, mounted]);

  // Next.js keeps visited routes alive inside <Activity> (hidden, effects
  // cleaned up). A modal <dialog> left open in the top layer would keep the
  // next page inert (e.g. Android back while a sheet is open), so close it
  // when the route is hidden/unmounted and report it as closed.
  const onOpenChangeRef = useRef(onOpenChange);
  useLayoutEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });
  useLayoutEffect(() => {
    if (!mounted) return;
    const d = dialogRef.current;
    return () => {
      if (d?.open) {
        d.close();
        onOpenChangeRef.current(false);
      }
    };
  }, [mounted]);

  // Exit animation, then close + unmount.
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      dialogRef.current?.close();
      setMounted(false);
      setClosing(false);
      setDragY(0);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [closing]);

  // Scroll lock while open.
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [mounted]);

  const requestClose = () => onOpenChange(false);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (n) => n.offsetParent !== null || n === document.activeElement,
    );
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { startY: e.clientY, startT: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setDragY(Math.max(0, e.clientY - drag.current.startY));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    const v = dy / Math.max(1, performance.now() - drag.current.startT);
    drag.current = null;
    if (dy > 96 || v > 0.6) requestClose();
    else setDragY(0);
  };

  if (!mounted) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      onKeyDown={onKeyDown}
      onAnimationEnd={(e) => {
        if (e.target === panelRef.current) e.currentTarget.scrollTop = 0;
      }}
      className={cx(
        "fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0",
        // overflow-clip (not hidden): an overflow:hidden box is still a scroll
        // container that focus()/scrollIntoView can scroll, and the panel
        // overflows it while animate-sheet-in translates it down. With clip it
        // can never scroll, so the sheet always sits flush at the bottom.
        "flex items-end justify-center overflow-clip overscroll-none backdrop:bg-overlay",
        closing && "backdrop:opacity-0 backdrop:transition-opacity backdrop:duration-200",
      )}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
        className={cx(
          "relative flex w-full max-w-app flex-col rounded-t-2xl border border-b-0 border-line bg-surface text-fg shadow-card outline-none",
          "max-h-[92dvh] transition-transform duration-200 ease-out",
          size === "full" && "h-[92dvh]",
          closing ? "translate-y-full" : "animate-sheet-in",
        )}
      >
        {/* Drag handle */}
        <div
          className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden="true"
        >
          <span className="h-1.5 w-11 rounded-full bg-line-strong" />
        </div>

        <header className="flex shrink-0 items-start gap-3 px-4 pb-3">
          <div className={cx("min-w-0 flex-1 pt-1", hideTitle && "sr-only")}>
            {eyebrow ? <p className="eyebrow text-accent-text">{eyebrow}</p> : null}
            <h2 id={titleId} className="font-display text-[1.65rem] leading-[1.05] font-bold uppercase">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-sm text-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar"
            className="-mt-1 -mr-1 ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-raised"
          >
            <Icon.Close />
          </button>
        </header>

        <div className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4", footer ? "pb-4" : "pb-[calc(1rem+env(safe-area-inset-bottom))]", bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
