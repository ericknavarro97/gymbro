import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionStore, rowKey, type SaveSetFn } from "@/components/session/session-store";
import type { SessionItem, SetView } from "@/server/services/views";
import type { SaveSetInput } from "@/server/services/validation";

const set = (setNumber: number, weight: number | null, unit: "lb" | "kg", reps = 10): SetView => ({
  setNumber,
  weight,
  unit,
  reps,
  rpe: null,
  segmentReps: null,
  updatedAt: "2026-10-01T00:00:00.000Z",
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

function makeStore(item: SessionItem, saves: SaveSetInput[], unit: "lb" | "kg" = "lb") {
  const save: SaveSetFn = async (input) => {
    saves.push(input);
    return {
      ok: true,
      data: {
        exerciseLogId: "log-1",
        performedExerciseId: 1,
        set: set(Number(input.setNumber), (input.weight as number | null) ?? null, input.unit, (input.reps as number | null) ?? 10),
      },
    };
  };
  return new SessionStore({ workoutLogId: "w-1", unit, items: [item] }, save);
}

describe("SessionStore per-exercise weight unit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("defaults to the user's unit when the exercise has no history", () => {
    const store = makeStore(makeItem(), []);
    expect(store.getItemUnit(1)).toBe("lb");
  });

  it("defaults to the unit of last performance", () => {
    const item = makeItem({
      lastPerformance: {
        workoutLogId: "old",
        runId: "r",
        date: "2026-10-01",
        weekNumber: 1,
        dayPosition: 1,
        dayName: "Full Body #1",
        prescriptionId: 1,
        sets: [set(1, 20, "kg")],
      },
    });
    expect(makeStore(item, []).getItemUnit(1)).toBe("kg");
  });

  it("prefers this session's saved sets over last performance and shows their weight unconverted", () => {
    const item = makeItem({ sets: [set(1, 35, "lb")] });
    const store = makeStore(item, [], "kg");
    expect(store.getItemUnit(1)).toBe("lb");
    expect(store.getRow(rowKey(1, 1))?.values.weight).toBe("35");
  });

  it("saves new sets with the exercise's unit", async () => {
    const saves: SaveSetInput[] = [];
    const store = makeStore(makeItem(), saves);
    store.setItemUnit(1, "kg");
    store.setValues(1, 1, { weight: "20", reps: "10" });
    await vi.runAllTimersAsync();
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ weight: 20, unit: "kg" });
  });

  it("relabels (does not convert) typed weights and re-saves them in the new unit", async () => {
    const saves: SaveSetInput[] = [];
    const store = makeStore(makeItem(), saves);
    store.setValues(1, 1, { weight: "35", reps: "12" });
    store.setValues(1, 2, { reps: "12" }); // no weight → nothing to relabel
    await vi.runAllTimersAsync();
    expect(saves.map((s) => s.unit)).toEqual(["lb", "lb"]);

    store.setItemUnit(1, "kg");
    await vi.runAllTimersAsync();
    expect(saves).toHaveLength(3);
    expect(saves[2]).toMatchObject({ setNumber: 1, weight: 35, unit: "kg" });
    expect(store.getRow(rowKey(1, 1))?.values.weight).toBe("35");
    expect(store.getRow(rowKey(1, 1))?.state).toBe("saved");
  });

  it("re-sends with the new unit when the switch happens while a save is in flight", async () => {
    const saves: SaveSetInput[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const save: SaveSetFn = async (input) => {
      saves.push(input);
      if (saves.length === 1) await gate;
      return {
        ok: true,
        data: { exerciseLogId: "log-1", performedExerciseId: 1, set: set(Number(input.setNumber), (input.weight as number | null) ?? null, input.unit) },
      };
    };
    const store = new SessionStore({ workoutLogId: "w-1", unit: "lb", items: [makeItem()] }, save);
    store.setValues(1, 1, { weight: "50", reps: "10" });
    store.flush(1, 1);
    await vi.advanceTimersByTimeAsync(0); // first save now in flight (lb)
    store.setItemUnit(1, "kg");
    await vi.advanceTimersByTimeAsync(0);
    release();
    await vi.runAllTimersAsync();
    expect(saves.map((s) => s.unit)).toEqual(["lb", "kg"]);
  });

  it("is a no-op when selecting the current unit", async () => {
    const saves: SaveSetInput[] = [];
    const store = makeStore(makeItem(), saves);
    store.setValues(1, 1, { weight: "35", reps: "12" });
    await vi.runAllTimersAsync();
    store.setItemUnit(1, "lb");
    await vi.runAllTimersAsync();
    expect(saves).toHaveLength(1);
  });
});
