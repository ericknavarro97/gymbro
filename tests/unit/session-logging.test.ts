import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SessionStore,
  isGuidanceOnlyItem,
  isLoggableItem,
  rowKey,
  type SaveSetFn,
} from "@/components/session/session-store";
import { repsText, weightPlaceholder, weightToInput } from "@/components/session/format";
import type { SessionItem, SetView } from "@/server/services/views";
import type { SaveSetInput } from "@/server/services/validation";

const sv = (over: Partial<SetView> & { setNumber: number }): SetView => ({
  weight: null,
  unit: "lb",
  reps: null,
  rpe: null,
  segmentReps: null,
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...over,
});

function makeItem(overrides: Partial<SessionItem> = {}): SessionItem {
  return {
    id: 1,
    slot: "exercise",
    workingSets: 3,
    isOptional: false,
    reps: { text: "10-12", scheme: { type: "range", min: 10, max: 12 }, segmented: false, targets: [] },
    rest: { text: "~1-2 min", minSec: 60, maxSec: 120 },
    choices: [],
    exercise: { id: 1, slug: "leg-press", name: "Leg Press" },
    performedExercise: null,
    performedIsDefault: true,
    exerciseLogId: null,
    sets: [],
    lastPerformance: null,
    suggestion: null,
    warmupPlan: null,
    ...overrides,
  } as unknown as SessionItem;
}

const dropset = () =>
  makeItem({
    reps: {
      text: "5,4,3+",
      scheme: { type: "mechanical_dropset", segments: [5, 4, 3], lastOpen: true },
      segmented: true,
      targets: [],
    },
  } as Partial<SessionItem>);

/** Fake saveSet that mimics the server: echoes the input, rounding nothing itself. */
function makeStore(item: SessionItem, saves: SaveSetInput[]) {
  const save: SaveSetFn = async (input) => {
    saves.push(input);
    const segs = (input.segmentReps as number[] | null | undefined) ?? null;
    return {
      ok: true,
      data: {
        exerciseLogId: "log-1",
        performedExerciseId: 1,
        set: sv({
          setNumber: Number(input.setNumber),
          weight: (input.weight as number | null) ?? null,
          unit: input.unit,
          reps: (input.reps as number | null) ?? (segs ? segs[0] : null),
          rpe: (input.rpe as number | null | undefined) ?? null,
          segmentReps: segs,
        }),
      },
    };
  };
  return new SessionStore({ workoutLogId: "w-1", unit: "lb", items: [item] }, save);
}

describe("RPE normalisation (R1-5)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the stored 0.5-step RPE after saving", async () => {
    const saves: SaveSetInput[] = [];
    const store = makeStore(makeItem(), saves);
    store.setValues(1, 1, { weight: "30", reps: "10", rpe: "8.3" });
    store.setValues(1, 2, { weight: "30", reps: "10", rpe: "7,2" });
    await vi.runAllTimersAsync();
    expect(saves.map((s) => s.rpe)).toEqual([8.5, 7]);
    expect(store.getRow(rowKey(1, 1))?.values.rpe).toBe("8.5");
    expect(store.getRow(rowKey(1, 2))?.values.rpe).toBe("7");
    expect(store.getRow(rowKey(1, 1))?.state).toBe("saved");
  });

  it("keeps the typed text when it already matches (e.g. '8.' while typing)", async () => {
    const saves: SaveSetInput[] = [];
    const store = makeStore(makeItem(), saves);
    store.setValues(1, 1, { reps: "10", rpe: "8." });
    await vi.runAllTimersAsync();
    expect(store.getRow(rowKey(1, 1))?.values.rpe).toBe("8.");
  });
});

describe("segmented sets with blank phases (R1-6)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves only the filled phases, never 0 for a blank one", async () => {
    const saves: SaveSetInput[] = [];
    const store = makeStore(dropset(), saves);
    store.setValues(1, 1, { weight: "30", segments: ["5", "3", ""] });
    store.setValues(1, 2, { weight: "25", segments: ["6", "", ""] });
    await vi.runAllTimersAsync();
    expect(saves.map((s) => s.segmentReps)).toEqual([[5, 3], [6]]);
    expect(store.getRow(rowKey(1, 1))?.values.segments).toEqual(["5", "3", ""]);
    expect(store.getRow(rowKey(1, 2))?.values.segments).toEqual(["6", "", ""]);
  });

  it("reloads saved prefixes with blank inputs for the missing phases", () => {
    const item = dropset();
    (item as { sets: SetView[] }).sets = [sv({ setNumber: 1, weight: 30, reps: 5, segmentReps: [5, 3] })];
    const store = makeStore(item, []);
    expect(store.getRow(rowKey(1, 1))?.values.segments).toEqual(["5", "3", ""]);
  });

  it("does not save a blank phase before a filled one", async () => {
    const saves: SaveSetInput[] = [];
    const store = makeStore(dropset(), saves);
    store.setValues(1, 1, { weight: "30", segments: ["5", "", "2"] });
    await vi.runAllTimersAsync();
    expect(saves).toHaveLength(0);
    expect(store.getRow(rowKey(1, 1))).toMatchObject({ state: "error", message: "Completa la fase 2" });
  });

  it("repsText shows only logged phases", () => {
    expect(repsText({ reps: 5, segmentReps: [5, 3] })).toBe("5+3");
    expect(repsText({ reps: 6, segmentReps: [6] })).toBe("6");
  });
});

describe("weight display rounding (R1-7)", () => {
  it("placeholders use 1 decimal like 'Semana pasada'", () => {
    expect(weightPlaceholder(200, "lb", "kg")).toBe("90.7");
    expect(weightPlaceholder(92.5, "kg", "lb")).toBe("203.9");
    expect(weightPlaceholder(null, "kg", "lb")).toBe("—");
  });

  it("input values keep the stored number in the same unit and round converted ones", () => {
    expect(weightToInput(22.75, "kg", "kg")).toBe("22.75");
    expect(weightToInput(200, "lb", "kg")).toBe("90.7");
  });
});

describe("weak point slot with sets logged under a previous weak point (R1-4)", () => {
  const weakNoOptions = (over: Partial<SessionItem> = {}) =>
    makeItem({
      slot: "weak_point_1",
      choices: [],
      exercise: null,
      performedExercise: { id: 9, slug: "low-to-high-cable-crossover", name: "Low-To-High Cable Crossover" },
      ...over,
    } as Partial<SessionItem>);

  it("is guidance-only when nothing was logged", () => {
    const item = weakNoOptions({ performedExercise: null } as Partial<SessionItem>);
    expect(isGuidanceOnlyItem(item)).toBe(true);
    expect(isLoggableItem(item)).toBe(false);
  });

  it("stays loggable and counted when sets exist", () => {
    const item = weakNoOptions({
      exerciseLogId: "log-1",
      sets: [sv({ setNumber: 1, weight: 25, reps: 12 })],
    } as Partial<SessionItem>);
    expect(isGuidanceOnlyItem(item)).toBe(false);
    expect(isLoggableItem(item)).toBe(true);
    const store = makeStore(item, []);
    expect(store.getProgress()).toBe("0/1");
    expect(store.getRow(rowKey(1, 1))?.values).toMatchObject({ weight: "25", reps: "12" });
  });
});
