/** Required attribution for Gym visual media (PLAN §11). Server-safe. */
import { cx } from "../ui/cx";

export const MEDIA_CREDIT = "© Gym visual — gymvisual.com";

export function MediaCredit({ className }: { className?: string }) {
  return (
    <p className={cx("text-[0.6875rem] leading-4 text-fg-subtle", className)}>
      <a href="https://www.gymvisual.com" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        {MEDIA_CREDIT}
      </a>
    </p>
  );
}
