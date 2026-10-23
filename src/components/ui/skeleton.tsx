/** Loading placeholders. Server-safe. Wrap groups in an element with aria-busy / sr-only text. */
import { cx } from "./cx";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-shimmer rounded-md bg-surface-2", className)} />;
}

/** N text-like lines (last one shorter). */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Generic page skeleton for loading.tsx / Suspense fallbacks. */
export function PageSkeleton({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-5" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
