/**
 * Warm-up sets (PLAN §4.3). Closed set for the count: "0","1","1-2","1-3","2","2-3","2-4".
 * Protocol: 1 → 60%×6-10; 2 → 50%×6-10, 70%×4-6; 3 → 45%×6-10, 65%×4-6, 85%×3-4.
 * The PDF defines no 4-set protocol: "2-4" uses the 3-set one plus an "extra set" hint.
 */
import { DomainParseError, normalizeText } from "./text";
import { DEFAULT_ROUNDING, roundToStep, type WeightUnit } from "./units";

export interface WarmupRange {
  min: number;
  max: number;
}

export interface WarmupProtocolStep {
  setNumber: number;
  pctOfWorking: number;
  repsText: string;
}

export type WarmupProtocol = Readonly<Record<1 | 2 | 3, readonly WarmupProtocolStep[]>>;

export const MAX_PROTOCOL_SETS = 3;

export const DEFAULT_WARMUP_PROTOCOL: WarmupProtocol = {
  1: [{ setNumber: 1, pctOfWorking: 60, repsText: "6-10" }],
  2: [
    { setNumber: 1, pctOfWorking: 50, repsText: "6-10" },
    { setNumber: 2, pctOfWorking: 70, repsText: "4-6" },
  ],
  3: [
    { setNumber: 1, pctOfWorking: 45, repsText: "6-10" },
    { setNumber: 2, pctOfWorking: 65, repsText: "4-6" },
    { setNumber: 3, pctOfWorking: 85, repsText: "3-4" },
  ],
};

export interface WarmupSet {
  setNumber: number;
  pctOfWorking: number;
  repsText: string;
  /** Rounded weight, or null when there is no working weight yet. */
  weight: number | null;
  unit: WeightUnit;
}

export interface WarmupPlan {
  sets: WarmupSet[];
  /** true when the prescription asked for more sets than the protocol defines (e.g. "2-4"). */
  extraSetSuggested: boolean;
}

/** Parse "0", "1-2", "2-4"… → {min, max}. Throws {@link DomainParseError}. */
export function parseWarmupSets(text: string): WarmupRange {
  const t = normalizeText(text);
  const m = /^(\d+)(?: ?- ?(\d+))?$/.exec(t);
  if (!m) throw new DomainParseError("warmup", text);
  const min = Number.parseInt(m[1], 10);
  const max = m[2] !== undefined ? Number.parseInt(m[2], 10) : min;
  if (max < min) throw new DomainParseError("warmup", text);
  return { min, max };
}

/** How many protocol sets to show for a range: max capped at 3, plus the extra-set flag. */
export function warmupSetsToPerform(range: WarmupRange): { count: number; extraSetSuggested: boolean } {
  return {
    count: Math.min(Math.max(range.max, 0), MAX_PROTOCOL_SETS),
    extraSetSuggested: range.max > MAX_PROTOCOL_SETS,
  };
}

/**
 * Compute the warm-up sets for a working weight.
 * @param workingWeight weight of working set 1 (or last week's); null/<=0 → weights null.
 * @param setsCount requested warm-up sets (typically the range max); >3 is capped with a flag.
 * @param rounding step to round to; defaults to 5 lb / 2.5 kg.
 */
export function computeWarmupSets(
  workingWeight: number | null,
  setsCount: number,
  unit: WeightUnit,
  rounding: number = DEFAULT_ROUNDING[unit],
  protocol: WarmupProtocol = DEFAULT_WARMUP_PROTOCOL,
): WarmupPlan {
  const n = Number.isFinite(setsCount) ? Math.floor(setsCount) : 0;
  const { count, extraSetSuggested } = warmupSetsToPerform({ min: n, max: n });
  if (count <= 0) return { sets: [], extraSetSuggested: false };
  const steps = protocol[count as 1 | 2 | 3];
  const base =
    workingWeight !== null && Number.isFinite(workingWeight) && workingWeight > 0 ? workingWeight : null;
  return {
    extraSetSuggested,
    sets: steps.map((s) => ({
      setNumber: s.setNumber,
      pctOfWorking: s.pctOfWorking,
      repsText: s.repsText,
      unit,
      weight: base === null ? null : roundToStep((base * s.pctOfWorking) / 100, rounding),
    })),
  };
}
