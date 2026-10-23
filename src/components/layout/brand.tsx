/** GymBros mark + wordmark. Server-safe. */
import { cx } from "../ui/cx";

/** Square app mark: a weight plate in safety orange. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cx("size-10", className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--gb-accent)" />
      <circle cx="32" cy="32" r="19" fill="none" stroke="var(--gb-accent-fg)" strokeWidth="5" />
      <circle cx="32" cy="32" r="5.5" fill="var(--gb-accent-fg)" />
      <path d="M32 13v6M32 45v6M13 32h6M45 32h6" stroke="var(--gb-accent-fg)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <BrandMark className="size-9" />
      <span className="font-display text-[1.9rem] leading-none font-extrabold tracking-wide uppercase">
        Gym<span className="text-accent">Bros</span>
      </span>
    </span>
  );
}
