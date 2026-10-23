/**
 * RPE (PLAN §2.2). Closed set: "~5","~5-6","~6","~6-7","~7","~7-8","~8","~8-9","~9","~9-10","8","10".
 */
import { DomainParseError, isNotApplicable, normalizeText } from "./text";

export interface Rpe {
  min: number;
  max: number;
  approx: boolean;
}

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const RPE_RE = new RegExp(`^(~)? ?(?:RPE ?)?${NUM}(?: ?- ?${NUM})?$`, "i");

/** Returns null for N/A or unknown formats. */
export function tryParseRpe(text: string): Rpe | null {
  if (isNotApplicable(text)) return null;
  const m = RPE_RE.exec(normalizeText(text));
  if (!m) return null;
  const min = Number(m[2]);
  const max = m[3] !== undefined ? Number(m[3]) : min;
  if (min < 0 || max > 10 || max < min) return null;
  return { min, max, approx: m[1] === "~" };
}

/** Parse the PDF RPE text. Throws {@link DomainParseError} on unknown formats (incl. N/A). */
export function parseRpe(text: string): Rpe {
  const rpe = tryParseRpe(text);
  if (!rpe) throw new DomainParseError("rpe", text);
  return rpe;
}

/** "~7-8", "8". */
export function formatRpe(rpe: Rpe): string {
  const core = rpe.min === rpe.max ? `${rpe.min}` : `${rpe.min}-${rpe.max}`;
  return rpe.approx ? `~${core}` : core;
}
