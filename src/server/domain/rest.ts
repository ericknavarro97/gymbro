/**
 * Rest periods (PLAN §2.2). Closed set:
 * "~0.5-1 min","~1 min","~1-2 min","~1-3 min","~2-3 min","~3-4 min","~3-5 min","N/A".
 */
import { DomainParseError, isNotApplicable, normalizeText } from "./text";

export interface Rest {
  minSec: number;
  maxSec: number;
}

const NUM = String.raw`(\d+(?:\.\d+)?|\.\d+)`;
const REST_RE = new RegExp(`^~? ?${NUM}(?: ?- ?${NUM})? ?(min|mins|minutes?|s|sec|secs|seconds?)$`, "i");

/**
 * Parse the PDF rest text. Returns null for "N/A". Throws {@link DomainParseError}
 * on unknown formats.
 */
export function parseRest(text: string): Rest | null {
  if (isNotApplicable(text)) return null;
  const m = REST_RE.exec(normalizeText(text));
  if (!m) throw new DomainParseError("rest", text);
  const factor = m[3].toLowerCase().startsWith("m") ? 60 : 1;
  const minSec = Math.round(Number(m[1]) * factor);
  const maxSec = Math.round(Number(m[2] ?? m[1]) * factor);
  if (maxSec < minSec || minSec <= 0) throw new DomainParseError("rest", text);
  return { minSec, maxSec };
}

function formatMinutes(sec: number): string {
  return `${Number((sec / 60).toFixed(2))}`;
}

/**
 * Human text for a rest period: "~1-2 min", "~1 min", "~30 s"; null → "N/A".
 */
export function formatRest(rest: Rest | null): string {
  if (!rest) return "N/A";
  const useSeconds = rest.maxSec < 60 || rest.minSec % 30 !== 0 || rest.maxSec % 30 !== 0;
  if (useSeconds) {
    return rest.minSec === rest.maxSec ? `~${rest.minSec} s` : `~${rest.minSec}-${rest.maxSec} s`;
  }
  return rest.minSec === rest.maxSec
    ? `~${formatMinutes(rest.minSec)} min`
    : `~${formatMinutes(rest.minSec)}-${formatMinutes(rest.maxSec)} min`;
}

/** Countdown format "m:ss" (e.g. 90 → "1:30"). Negative values clamp to 0. */
export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
