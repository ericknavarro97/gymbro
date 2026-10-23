/**
 * Inline SVG icon set (stroke icons, 24px grid, currentColor).
 * Decorative by default (aria-hidden); pass `title` to make one meaningful.
 * Usage: <Icon.Play className="size-5" />
 */
import type { ReactNode, SVGProps } from "react";
import { cx } from "./cx";

export type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function make(paths: ReactNode, displayName: string) {
  function I({ title, className, ...rest }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cx("size-5 shrink-0", className)}
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
        focusable="false"
        {...rest}
      >
        {title ? <title>{title}</title> : null}
        {paths}
      </svg>
    );
  }
  I.displayName = displayName;
  return I;
}

export const Icon = {
  Today: make(
    <>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </>,
    "Today",
  ),
  Program: make(
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M8 13.5h2M14 13.5h2M8 17h2" />
    </>,
    "Program",
  ),
  History: make(
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5v4h4M12 7.5V12l3 2" />
    </>,
    "History",
  ),
  User: make(
    <>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </>,
    "User",
  ),
  Play: make(<path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7Z" />, "Play"),
  Close: make(<path d="M6 6l12 12M18 6 6 18" />, "Close"),
  Check: make(<path d="m4.5 12.5 5 5 10-11" />, "Check"),
  ChevronRight: make(<path d="m9 5 7 7-7 7" />, "ChevronRight"),
  ChevronLeft: make(<path d="m15 5-7 7 7 7" />, "ChevronLeft"),
  ChevronDown: make(<path d="m5 9 7 7 7-7" />, "ChevronDown"),
  Plus: make(<path d="M12 5v14M5 12h14" />, "Plus"),
  Minus: make(<path d="M5 12h14" />, "Minus"),
  Info: make(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </>,
    "Info",
  ),
  Alert: make(
    <>
      <path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17v.1" />
    </>,
    "Alert",
  ),
  Video: make(
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3" />
      <path d="m10 9.2 5 2.8-5 2.8Z" fill="currentColor" />
    </>,
    "Video",
  ),
  External: make(<path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" />, "External"),
  Swap: make(<path d="M7 4.5 3.5 8 7 11.5M3.5 8h13M17 12.5l3.5 3.5-3.5 3.5M20.5 16h-13" />, "Swap"),
  Timer: make(
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 1.5M9.5 2.5h5M19 6.5l1.5-1.5" />
    </>,
    "Timer",
  ),
  Flame: make(
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.3-5.4 3.6-7.6.4 1.6 1.3 2.8 2.5 3.3.2-2.9 1.5-5.6 3.9-7.5-.2 2.6.7 4.6 2 6.4 1.2 1.7 1.9 3.3 1.9 5.4 0 3.6-2.9 6.2-7.4 6.2Z" />,
    "Flame",
  ),
  Gauge: make(
    <>
      <path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0" />
      <path d="m12 13.5 4-4.5" />
      <circle cx="12" cy="13.5" r="1.3" fill="currentColor" />
    </>,
    "Gauge",
  ),
  Dumbbell: make(
    <>
      <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
    </>,
    "Dumbbell",
  ),
  Expand: make(<path d="M4.5 9.5v-5h5M19.5 9.5v-5h-5M4.5 14.5v5h5M19.5 14.5v5h-5" />, "Expand"),
  Logout: make(<path d="M14.5 4.5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4M10 16.5 5.5 12 10 7.5M5.5 12h10" />, "Logout"),
  Eye: make(
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
    "Eye",
  ),
  EyeOff: make(
    <>
      <path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 5-1.5" />
      <path d="m3.5 3.5 17 17M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>,
    "EyeOff",
  ),
  Note: make(<path d="M5.5 3.5h9l4 4v13h-13ZM14.5 3.5v4h4M8.5 12h7M8.5 15.5h7" />, "Note"),
  Construction: make(
    <>
      <rect x="2.5" y="7.5" width="19" height="7" rx="1.5" />
      <path d="m6 7.5-3.5 7M11.5 7.5 8 14.5M17 7.5l-3.5 7M21.5 9 19 14.5M5.5 14.5v6M18.5 14.5v6" />
    </>,
    "Construction",
  ),
} as const;

export type IconName = keyof typeof Icon;
