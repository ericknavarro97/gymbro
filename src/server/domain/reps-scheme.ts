/**
 * Reps schemes (PLAN §4.2). Closed set from the PDF:
 * "8","10","8-10","10-12","10-15","12-15","8-12","10-20","4, 6, 8","4, 6","5,4,3+","8-10 + 4-6".
 */
import { DomainParseError, normalizeText } from "./text";

export interface Range {
  min: number;
  max: number;
}

export type RepsScheme =
  | { type: "fixed"; reps: number }
  | { type: "range"; min: number; max: number }
  | { type: "per_set"; targets: number[] }
  | { type: "mechanical_dropset"; segments: number[]; lastOpen: true }
  | { type: "compound"; main: Range; finisher: Range; finisherLabel: string };

export type RepsSchemeType = RepsScheme["type"];

/** One rep target inside a set. `max: null` means open-ended ("3+"). */
export interface SegmentTarget {
  min: number;
  max: number | null;
  label?: string;
}

/** What the UI should ask for on a given set. */
export interface SetTarget {
  setNumber: number;
  /** true when the set must be logged per segment (`segment_reps`). */
  segmented: boolean;
  segments: SegmentTarget[];
}

export const DEFAULT_FINISHER_LABEL = "finisher";

export interface ParseRepsOptions {
  finisherLabel?: string;
}

const INT = /^\d+$/;
const RANGE = /^(\d+) ?- ?(\d+)$/;

function toInt(s: string): number {
  return Number.parseInt(s, 10);
}

function parseRange(text: string): Range | null {
  const t = text.trim();
  if (INT.test(t)) {
    const n = toInt(t);
    return n > 0 ? { min: n, max: n } : null;
  }
  const m = RANGE.exec(t);
  if (!m) return null;
  const min = toInt(m[1]);
  const max = toInt(m[2]);
  if (min <= 0 || max < min) return null;
  return { min, max };
}

/** Like {@link parseReps} but returns null instead of throwing. */
export function tryParseReps(text: string, options: ParseRepsOptions = {}): RepsScheme | null {
  const t = normalizeText(text);
  if (t === "") return null;

  // compound: "8-10 + 4-6"
  if (t.includes("+") && !t.includes(",")) {
    const parts = t.split("+").map((p) => p.trim());
    if (parts.length !== 2 || parts[1] === "") return null;
    const main = parseRange(parts[0]);
    const finisher = parseRange(parts[1]);
    if (!main || !finisher) return null;
    return {
      type: "compound",
      main,
      finisher,
      finisherLabel: options.finisherLabel ?? DEFAULT_FINISHER_LABEL,
    };
  }

  // lists: "4, 6, 8" (per set) or "5,4,3+" (mechanical dropset)
  if (t.includes(",")) {
    const parts = t.split(",").map((p) => p.trim());
    if (parts.length < 2 || parts.some((p) => p === "")) return null;
    const last = parts[parts.length - 1];
    if (last.endsWith("+")) {
      const raw = [...parts.slice(0, -1), last.slice(0, -1).trim()];
      if (!raw.every((p) => INT.test(p))) return null;
      const segments = raw.map(toInt);
      if (segments.some((n) => n <= 0)) return null;
      return { type: "mechanical_dropset", segments, lastOpen: true };
    }
    if (!parts.every((p) => INT.test(p))) return null;
    const targets = parts.map(toInt);
    if (targets.some((n) => n <= 0)) return null;
    return { type: "per_set", targets };
  }

  if (INT.test(t)) {
    const reps = toInt(t);
    return reps > 0 ? { type: "fixed", reps } : null;
  }

  const range = parseRange(t);
  if (range) return { type: "range", min: range.min, max: range.max };
  return null;
}

/** Parse the PDF reps text. Throws {@link DomainParseError} on unknown formats. */
export function parseReps(text: string, options: ParseRepsOptions = {}): RepsScheme {
  const scheme = tryParseReps(text, options);
  if (!scheme) throw new DomainParseError("reps", text);
  return scheme;
}

/** True when sets of this scheme are logged per segment (`segment_reps`). */
export function isSegmented(scheme: RepsScheme): boolean {
  return scheme.type === "mechanical_dropset" || scheme.type === "compound";
}

/** Number of rep segments per set (1 for non-segmented schemes). */
export function segmentCount(scheme: RepsScheme): number {
  switch (scheme.type) {
    case "mechanical_dropset":
      return scheme.segments.length;
    case "compound":
      return 2;
    default:
      return 1;
  }
}

/**
 * Rep target for a given working set (1-based). For `per_set`, sets beyond the
 * listed targets reuse the last target.
 */
export function targetForSet(scheme: RepsScheme, setNumber: number): SetTarget {
  if (!Number.isInteger(setNumber) || setNumber < 1) {
    throw new RangeError(`setNumber must be a positive integer, got ${setNumber}`);
  }
  switch (scheme.type) {
    case "fixed":
      return { setNumber, segmented: false, segments: [{ min: scheme.reps, max: scheme.reps }] };
    case "range":
      return { setNumber, segmented: false, segments: [{ min: scheme.min, max: scheme.max }] };
    case "per_set": {
      const t = scheme.targets[Math.min(setNumber, scheme.targets.length) - 1];
      return { setNumber, segmented: false, segments: [{ min: t, max: t }] };
    }
    case "mechanical_dropset":
      return {
        setNumber,
        segmented: true,
        segments: scheme.segments.map((n, i) => {
          const isLast = i === scheme.segments.length - 1;
          return { min: n, max: isLast ? null : n };
        }),
      };
    case "compound":
      return {
        setNumber,
        segmented: true,
        segments: [
          { min: scheme.main.min, max: scheme.main.max },
          { min: scheme.finisher.min, max: scheme.finisher.max, label: scheme.finisherLabel },
        ],
      };
  }
}

/** Highest rep count that counts as "top of the range" per segment (open → min). */
export function topRepsForSegment(segment: SegmentTarget): number {
  return segment.max ?? segment.min;
}

export function formatSegmentTarget(segment: SegmentTarget): string {
  if (segment.max === null) return `${segment.min}+`;
  if (segment.min === segment.max) return `${segment.min}`;
  return `${segment.min}-${segment.max}`;
}

/** "10-12", "6", "5 / 4 / 3+", "8-10 + 4-6". */
export function formatSetTarget(target: SetTarget): string {
  const parts = target.segments.map(formatSegmentTarget);
  if (!target.segmented) return parts[0];
  return target.segments.length === 2 && target.segments[1].label !== undefined
    ? parts.join(" + ")
    : parts.join(" / ");
}

function formatRange(r: Range): string {
  return r.min === r.max ? `${r.min}` : `${r.min}-${r.max}`;
}

/** Canonical text for a scheme (round-trips with {@link parseReps}). */
export function formatRepsScheme(scheme: RepsScheme): string {
  switch (scheme.type) {
    case "fixed":
      return `${scheme.reps}`;
    case "range":
      return formatRange(scheme);
    case "per_set":
      return scheme.targets.join(", ");
    case "mechanical_dropset":
      return `${scheme.segments.join(",")}+`;
    case "compound":
      return `${formatRange(scheme.main)} + ${formatRange(scheme.finisher)}`;
  }
}
