/**
 * Double-progression suggestion (PLAN §4.4 — app's own rule, flagged as such in the UI).
 * - All sets of the last performance reached the top of the range → "increase".
 * - Otherwise → "hold" (keep the weight, chase reps).
 * - per_set (reverse pyramid): only set 1 is evaluated.
 * - Deload week: never "increase".
 * - No usable data → null.
 */
import { targetForSet, topRepsForSegment, type RepsScheme } from "./reps-scheme";

export type ProgressionSuggestion = "increase" | "hold";

export interface PerformedSet {
  setNumber: number;
  reps: number | null;
  /** Per-segment reps for mechanical dropsets / compound sets. */
  segmentReps?: readonly number[] | null;
}

export interface ProgressionInput {
  scheme: RepsScheme;
  /** Sets from the last performance of this exercise. */
  lastSets: readonly PerformedSet[];
  /** true when the week being trained now is a deload week. */
  isDeload?: boolean;
  /** Prescribed working sets; when given, logging fewer sets means "hold". */
  workingSets?: number;
}

function isLogged(s: PerformedSet): boolean {
  return s.reps !== null || (s.segmentReps != null && s.segmentReps.length > 0);
}

/** Did this performed set hit the top of its target (every segment)? */
export function setReachedTop(scheme: RepsScheme, set: PerformedSet): boolean {
  const target = targetForSet(scheme, set.setNumber);
  if (!target.segmented) {
    return set.reps !== null && set.reps >= topRepsForSegment(target.segments[0]);
  }
  const segs = set.segmentReps ?? [];
  return target.segments.every((seg, i) => {
    // Fall back to `reps` for the first segment when segments were not logged.
    const done = segs[i] ?? (i === 0 && segs.length === 0 ? set.reps : null);
    return done !== null && done !== undefined && done >= topRepsForSegment(seg);
  });
}

export function suggestProgression(input: ProgressionInput): ProgressionSuggestion | null {
  const logged = [...input.lastSets].filter(isLogged).sort((a, b) => a.setNumber - b.setNumber);
  if (logged.length === 0) return null;

  let reachedTop: boolean;
  if (input.scheme.type === "per_set") {
    const first = logged.find((s) => s.setNumber === 1);
    if (!first) return null;
    reachedTop = setReachedTop(input.scheme, first);
  } else {
    const enoughSets = input.workingSets === undefined || logged.length >= input.workingSets;
    reachedTop = enoughSets && logged.every((s) => setReachedTop(input.scheme, s));
  }

  if (reachedTop && !input.isDeload) return "increase";
  return "hold";
}
