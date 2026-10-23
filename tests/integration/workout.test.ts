import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, sql } from "@/server/db/client";
import { exerciseLogs, setLogs, workoutLogs } from "@/server/db/schema";
import {
  chooseExercise,
  completeWorkout,
  getProgramOverview,
  getTodayOverview,
  getWorkoutDayDetail,
  getWorkoutSession,
  saveSet,
  skipWorkout,
  startWorkout,
} from "@/server/services/workout.service";
import { getExerciseHistory, getHistory } from "@/server/services/history.service";
import { completeOnboarding, restartProgram, updateSettings } from "@/server/services/onboarding.service";
import {
  cleanupUsers,
  createOnboardedUser,
  createTestUser,
  dayId,
  exerciseId,
  expectServiceError,
  prescriptionBySlot,
  prescriptionFor,
} from "./helpers";

afterAll(async () => {
  await cleanupUsers();
  await sql.end({ timeout: 5 });
});

/** Log `sets` (weight × reps) for one prescription. */
async function logSets(
  userId: string,
  workoutLogId: string,
  prescriptionId: number,
  sets: Array<[number, number]>,
  performedExerciseId?: number,
) {
  for (const [i, [weight, reps]] of sets.entries()) {
    await saveSet(userId, {
      workoutLogId,
      prescriptionId,
      performedExerciseId,
      setNumber: i + 1,
      weight,
      unit: "lb",
      reps,
    });
  }
}

describe("startWorkout", () => {
  it("is idempotent per (run, day)", async () => {
    const u = await createOnboardedUser("start");
    const d = await dayId(1, 1);
    const a = await startWorkout(u, { workoutDayId: d });
    const b = await startWorkout(u, { workoutDayId: d });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.workoutLogId).toBe(a.workoutLogId);
    expect(b.status).toBe("in_progress");
    const rows = await db
      .select()
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, u), eq(workoutLogs.workoutDayId, d)));
    expect(rows).toHaveLength(1);
  });

  it("concurrent starts still produce one log", async () => {
    const u = await createOnboardedUser("race");
    const d = await dayId(1, 2);
    const results = await Promise.all([1, 2, 3].map(() => startWorkout(u, { workoutDayId: d })));
    expect(new Set(results.map((r) => r.workoutLogId)).size).toBe(1);
  });

  it("reopens a skipped day and keeps completed ones completed", async () => {
    const u = await createOnboardedUser("reopen");
    const d1 = await dayId(1, 1);
    const d2 = await dayId(1, 2);
    const s1 = await startWorkout(u, { workoutDayId: d1 });
    await skipWorkout(u, { workoutLogId: s1.workoutLogId });
    expect((await startWorkout(u, { workoutDayId: d1 })).status).toBe("in_progress");
    const s2 = await startWorkout(u, { workoutDayId: d2 });
    await completeWorkout(u, { workoutLogId: s2.workoutLogId });
    expect((await startWorkout(u, { workoutDayId: d2 })).status).toBe("completed");
  });

  it("requires onboarding (active run) and a valid day", async () => {
    const u = await createTestUser("noonb");
    await expectServiceError(startWorkout(u, { workoutDayId: await dayId(1, 1) }), "NO_ACTIVE_RUN");
    const v = await createOnboardedUser("badday");
    await expectServiceError(startWorkout(v, { workoutDayId: 999_999 }), "NOT_FOUND");
    await expectServiceError(startWorkout(v, { workoutDayId: -1 }), "VALIDATION");
  });
});

describe("saveSet", () => {
  it("upserts by (exercise log, set number) and clears with empty values", async () => {
    const u = await createOnboardedUser("save");
    const d = await dayId(1, 1);
    const { workoutLogId } = await startWorkout(u, { workoutDayId: d });
    const p = await prescriptionFor(d, "leg-press");

    const first = await saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 1, weight: 35, unit: "lb", reps: 12 });
    expect(first.performedExerciseId).toBe(await exerciseId("leg-press"));
    expect(first.set).toMatchObject({ setNumber: 1, weight: 35, reps: 12, unit: "lb", rpe: null });

    const second = await saveSet(u, {
      workoutLogId,
      prescriptionId: p.id,
      setNumber: 1,
      weight: 40,
      unit: "kg",
      reps: 10,
      rpe: 8.5,
    });
    expect(second.exerciseLogId).toBe(first.exerciseLogId);
    const rows = await db.select().from(setLogs).where(eq(setLogs.exerciseLogId, first.exerciseLogId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ weight: 40, weightUnit: "kg", reps: 10, rpe: 8.5 });

    const el = await db.select().from(exerciseLogs).where(eq(exerciseLogs.workoutLogId, workoutLogId));
    expect(el).toHaveLength(1);

    const cleared = await saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 1, weight: null, unit: "lb", reps: null });
    expect(cleared.set).toBeNull();
    expect(await db.select().from(setLogs).where(eq(setLogs.exerciseLogId, first.exerciseLogId))).toHaveLength(0);

    const session = await getWorkoutSession(u, workoutLogId);
    const item = session.items.find((i) => i.id === p.id)!;
    expect(item.sets).toEqual([]);
    expect(item.exerciseLogId).toBe(first.exerciseLogId);
  });

  it("validates input, set range and segment reps", async () => {
    const u = await createOnboardedUser("savebad");
    const d = await dayId(1, 1);
    const { workoutLogId } = await startWorkout(u, { workoutDayId: d });
    const p = await prescriptionFor(d, "leg-press"); // 3 working sets, "8"
    await expectServiceError(
      saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 6, weight: 10, unit: "lb", reps: 8 }),
      "VALIDATION",
    );
    await expectServiceError(
      saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 1, weight: -5, unit: "lb", reps: 8 }),
      "VALIDATION",
    );
    await expectServiceError(
      saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 1, weight: 5, unit: "lb", reps: 8, rpe: 8.3 }),
      "VALIDATION",
    );
    await expectServiceError(
      saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 1, weight: 5, unit: "lb", reps: 8, segmentReps: [5, 4] }),
      "VALIDATION",
    );
    // Prescription from another day.
    const other = await prescriptionFor(await dayId(1, 2), "paused-barbell-rdl");
    await expectServiceError(
      saveSet(u, { workoutLogId, prescriptionId: other.id, setNumber: 1, weight: 5, unit: "lb", reps: 8 }),
      "NOT_FOUND",
    );
  });

  it("stores segment reps for a mechanical dropset (5,4,3+)", async () => {
    const u = await createOnboardedUser("drop");
    const d = await dayId(1, 4);
    const { workoutLogId } = await startWorkout(u, { workoutDayId: d });
    const p = await prescriptionFor(d, "cable-reverse-flye-mechanical-dropset");
    const r = await saveSet(u, {
      workoutLogId,
      prescriptionId: p.id,
      setNumber: 1,
      weight: 20,
      unit: "lb",
      reps: null,
      segmentReps: [5, 4, 6],
    });
    expect(r.set).toMatchObject({ reps: 5, segmentReps: [5, 4, 6] });
    const session = await getWorkoutSession(u, workoutLogId);
    const item = session.items.find((i) => i.id === p.id)!;
    expect(item.reps.segmented).toBe(true);
    expect(item.reps.targets[0].label).toBe("5 / 4 / 3+");

    // Only the phases done: a shorter prefix is stored as is (no 0 for missing phases).
    const partial = await saveSet(u, {
      workoutLogId,
      prescriptionId: p.id,
      setNumber: 2,
      weight: 20,
      unit: "lb",
      reps: null,
      segmentReps: [5, 3],
    });
    expect(partial.set).toMatchObject({ reps: 5, segmentReps: [5, 3] });
    await expectServiceError(
      saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 3, weight: 20, unit: "lb", reps: null, segmentReps: [5, 4, 3, 2] }),
      "VALIDATION",
    );
  });
});

describe("lastPerformance", () => {
  it("shows the previous week's sets for the same exercise, with a progression suggestion", async () => {
    const u = await createOnboardedUser("weeks");
    const w1 = await dayId(1, 1);
    const w2 = await dayId(2, 1);
    const p1 = await prescriptionFor(w1, "leg-press");
    const p2 = await prescriptionFor(w2, "leg-press");

    const s1 = await startWorkout(u, { workoutDayId: w1 });
    await logSets(u, s1.workoutLogId, p1.id, [[35, 8], [35, 8], [35, 8]]);
    await completeWorkout(u, { workoutLogId: s1.workoutLogId });

    const s2 = await startWorkout(u, { workoutDayId: w2 });
    const session = await getWorkoutSession(u, s2.workoutLogId);
    const item = session.items.find((i) => i.id === p2.id)!;
    expect(item.performedIsDefault).toBe(true);
    expect(item.lastPerformance).not.toBeNull();
    expect(item.lastPerformance!.weekNumber).toBe(1);
    expect(item.lastPerformance!.workoutLogId).toBe(s1.workoutLogId);
    expect(item.lastPerformance!.sets.map((s) => [s.weight, s.reps])).toEqual([
      [35, 8],
      [35, 8],
      [35, 8],
    ]);
    expect(item.suggestion).toBe("increase");
    // Warm-up based on last week's set 1 (35 lb), "1-2" or similar → computed weights.
    if (item.warmupPlan) expect(item.warmupPlan.sets.every((s) => s.weight !== null)).toBe(true);

    // Current log is excluded from its own lastPerformance.
    await logSets(u, s2.workoutLogId, p2.id, [[40, 7]]);
    const again = (await getWorkoutSession(u, s2.workoutLogId)).items.find((i) => i.id === p2.id)!;
    expect(again.lastPerformance!.workoutLogId).toBe(s1.workoutLogId);
    expect(again.sets.map((s) => s.weight)).toEqual([40]);

    // Viewing week 1 again does not show week 2 (a later session) as "previous".
    const back = (await getWorkoutSession(u, s1.workoutLogId)).items.find((i) => i.id === p1.id)!;
    expect(back.lastPerformance).toBeNull();
  });

  it("holds when not every set reached the top of the range", async () => {
    const u = await createOnboardedUser("hold");
    const w1 = await dayId(1, 1);
    const w2 = await dayId(2, 1);
    const p1 = await prescriptionFor(w1, "cable-crunch"); // 10-12
    const p2 = await prescriptionFor(w2, "cable-crunch");
    const s1 = await startWorkout(u, { workoutDayId: w1 });
    await logSets(u, s1.workoutLogId, p1.id, [[50, 12], [50, 11], [50, 10]]);
    const s2 = await startWorkout(u, { workoutDayId: w2 });
    const item = (await getWorkoutSession(u, s2.workoutLogId)).items.find((i) => i.id === p2.id)!;
    expect(item.suggestion).toBe("hold");
  });

  it("is shared across different days that use the same exercise", async () => {
    const u = await createOnboardedUser("days");
    const fb3w1 = await dayId(1, 3); // Seated Leg Curl is FB3 in block 1
    const fb4w6 = await dayId(6, 4); // …and FB4 in block 2
    const pA = await prescriptionFor(fb3w1, "seated-leg-curl");
    const pB = await prescriptionFor(fb4w6, "seated-leg-curl");
    expect(pA.workoutDayId).not.toBe(pB.workoutDayId);

    const s1 = await startWorkout(u, { workoutDayId: fb3w1 });
    await logSets(u, s1.workoutLogId, pA.id, [[90, 11], [90, 10], [85, 10]]);
    await completeWorkout(u, { workoutLogId: s1.workoutLogId });

    const s2 = await startWorkout(u, { workoutDayId: fb4w6 });
    const item = (await getWorkoutSession(u, s2.workoutLogId)).items.find((i) => i.id === pB.id)!;
    expect(item.lastPerformance).toMatchObject({
      workoutLogId: s1.workoutLogId,
      weekNumber: 1,
      dayPosition: 3,
      prescriptionId: pA.id,
    });
    expect(item.lastPerformance!.sets.map((s) => s.weight)).toEqual([90, 90, 85]);
  });

  it("keeps substitutions in their own history", async () => {
    const u = await createOnboardedUser("subs");
    const legPress = await exerciseId("leg-press");
    const beltSquat = await exerciseId("belt-squat");
    const [w1, w2, w3] = await Promise.all([dayId(1, 1), dayId(2, 1), dayId(3, 1)]);
    const [p1, p2, p3] = await Promise.all([
      prescriptionFor(w1, "leg-press"),
      prescriptionFor(w2, "leg-press"),
      prescriptionFor(w3, "leg-press"),
    ]);
    expect(p2.sub1ExerciseId).toBe(beltSquat);

    const s1 = await startWorkout(u, { workoutDayId: w1 });
    await logSets(u, s1.workoutLogId, p1.id, [[100, 8], [100, 8], [100, 8]]);
    await completeWorkout(u, { workoutLogId: s1.workoutLogId });

    const s2 = await startWorkout(u, { workoutDayId: w2 });
    const chosen = await chooseExercise(u, { workoutLogId: s2.workoutLogId, prescriptionId: p2.id, exerciseId: beltSquat });
    expect(chosen.performedExercise?.slug).toBe("belt-squat");
    expect(chosen.performedIsDefault).toBe(false);
    expect(chosen.lastPerformance).toBeNull(); // belt squat never done before
    await logSets(u, s2.workoutLogId, p2.id, [[50, 8], [50, 8]]);
    await completeWorkout(u, { workoutLogId: s2.workoutLogId });

    const s3 = await startWorkout(u, { workoutDayId: w3 });
    const def = (await getWorkoutSession(u, s3.workoutLogId)).items.find((i) => i.id === p3.id)!;
    expect(def.performedExercise?.id).toBe(legPress);
    expect(def.lastPerformance!.workoutLogId).toBe(s1.workoutLogId);
    expect(def.lastPerformance!.sets.map((s) => s.weight)).toEqual([100, 100, 100]);

    const sub = await chooseExercise(u, { workoutLogId: s3.workoutLogId, prescriptionId: p3.id, exerciseId: beltSquat });
    expect(sub.lastPerformance!.workoutLogId).toBe(s2.workoutLogId);
    expect(sub.lastPerformance!.sets.map((s) => s.weight)).toEqual([50, 50]);

    const lpHistory = await getExerciseHistory(u, "leg-press");
    expect(lpHistory.sessions.map((s) => s.workoutLogId)).toEqual([s1.workoutLogId]);
    const bsHistory = await getExerciseHistory(u, "belt-squat");
    expect(bsHistory.sessions.map((s) => s.workoutLogId)).toEqual([s2.workoutLogId]);
    expect(bsHistory.weekly).toEqual([{ week: 2, weight: 50, unit: "lb", reps: 8 }]);
  });
});

describe("chooseExercise with logged sets", () => {
  it("refuses to switch an exercise that already has sets, and allows it once they're cleared", async () => {
    const u = await createOnboardedUser("swaplocked");
    const d = await dayId(1, 1);
    const { workoutLogId } = await startWorkout(u, { workoutDayId: d });
    const p = await prescriptionFor(d, "leg-press");

    await logSets(u, workoutLogId, p.id, [[100, 8]]);
    await expectServiceError(
      chooseExercise(u, { workoutLogId, prescriptionId: p.id, exerciseId: p.sub1ExerciseId! }),
      "CONFLICT",
    );
    // Re-choosing the same exercise is fine.
    const same = await chooseExercise(u, { workoutLogId, prescriptionId: p.id, exerciseId: p.exerciseId! });
    expect(same.sets).toHaveLength(1);

    await saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 1, weight: null, unit: "lb", reps: null });
    const switched = await chooseExercise(u, { workoutLogId, prescriptionId: p.id, exerciseId: p.sub1ExerciseId! });
    expect(switched.performedExercise?.id).toBe(p.sub1ExerciseId);
  });
});

describe("saveSet with only RPE", () => {
  it("keeps a set that has only an RPE, and deletes it only when everything is cleared", async () => {
    const u = await createOnboardedUser("rpeonly");
    const d = await dayId(1, 1);
    const { workoutLogId } = await startWorkout(u, { workoutDayId: d });
    const p = await prescriptionFor(d, "leg-press");

    const r1 = await saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 1, weight: null, unit: "lb", reps: null, rpe: 8 });
    expect(r1.set).toMatchObject({ weight: null, reps: null, rpe: 8 });

    const r2 = await saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 1, weight: null, unit: "lb", reps: null, rpe: null });
    expect(r2.set).toBeNull();
  });
});

describe("chooseExercise validation", () => {
  it("accepts main/sub1/sub2 and rejects anything else", async () => {
    const u = await createOnboardedUser("choose");
    const d = await dayId(1, 1);
    const { workoutLogId } = await startWorkout(u, { workoutDayId: d });
    const p = await prescriptionFor(d, "leg-press");

    for (const id of [p.sub2ExerciseId!, p.sub1ExerciseId!, p.exerciseId!]) {
      const item = await chooseExercise(u, { workoutLogId, prescriptionId: p.id, exerciseId: id });
      expect(item.performedExercise?.id).toBe(id);
    }
    await expectServiceError(
      chooseExercise(u, { workoutLogId, prescriptionId: p.id, exerciseId: await exerciseId("cable-crunch") }),
      "EXERCISE_NOT_ALLOWED",
    );
    await expectServiceError(
      saveSet(u, {
        workoutLogId,
        prescriptionId: p.id,
        performedExerciseId: await exerciseId("cable-crunch"),
        setNumber: 1,
        weight: 1,
        unit: "lb",
        reps: 1,
      }),
      "EXERCISE_NOT_ALLOWED",
    );
    await expectServiceError(
      chooseExercise(u, { workoutLogId, prescriptionId: 999_999, exerciseId: p.exerciseId! }),
      "NOT_FOUND",
    );
    await expectServiceError(
      chooseExercise(u, { workoutLogId: "not-a-uuid", prescriptionId: p.id, exerciseId: p.exerciseId! }),
      "VALIDATION",
    );
  });

  it("weak point slots: requires a weak point, then only its options for that slot", async () => {
    const u = await createOnboardedUser("weak");
    const arms = await dayId(1, 5);
    const { workoutLogId } = await startWorkout(u, { workoutDayId: arms });
    const wp1 = await prescriptionBySlot(arms, "weak_point_1");
    const wp2 = await prescriptionBySlot(arms, "weak_point_2");
    const flye = await exerciseId("low-incline-db-flye"); // chest slot 1
    const chestPress = await exerciseId("chest-press-machine"); // chest slot 2

    let session = await getWorkoutSession(u, workoutLogId);
    expect(session.needsWeakPoint).toBe(true);
    await expectServiceError(
      chooseExercise(u, { workoutLogId, prescriptionId: wp1.id, exerciseId: flye }),
      "WEAK_POINT_NOT_SET",
    );
    await expectServiceError(
      saveSet(u, { workoutLogId, prescriptionId: wp1.id, setNumber: 1, weight: 20, unit: "lb", reps: 10 }),
      "WEAK_POINT_NOT_SET",
    );

    await updateSettings(u, { weakPointKey: "chest" });
    session = await getWorkoutSession(u, workoutLogId);
    expect(session.needsWeakPoint).toBe(false);
    const item1 = session.items.find((i) => i.id === wp1.id)!;
    expect(item1.choices.map((c) => c.exercise.slug)).toEqual(["low-incline-db-flye", "low-to-high-cable-crossover"]);
    expect(item1.performedExercise?.id).toBe(flye); // default = first option
    expect(session.items.find((i) => i.id === wp2.id)!.isOptional).toBe(true);

    await expectServiceError(
      chooseExercise(u, { workoutLogId, prescriptionId: wp1.id, exerciseId: chestPress }),
      "EXERCISE_NOT_ALLOWED",
    );
    const ok = await chooseExercise(u, { workoutLogId, prescriptionId: wp2.id, exerciseId: chestPress });
    expect(ok.performedExercise?.id).toBe(chestPress);
    const saved = await saveSet(u, { workoutLogId, prescriptionId: wp1.id, setNumber: 1, weight: 20, unit: "lb", reps: 10 });
    expect(saved.performedExerciseId).toBe(flye);
  });
});

describe("cross-user isolation", () => {
  let a: string;
  let b: string;
  let aLog: string;
  let aPrescription: number;
  let aDay: number;

  beforeAll(async () => {
    a = await createOnboardedUser("iso_a");
    b = await createOnboardedUser("iso_b");
    aDay = await dayId(1, 1);
    aPrescription = (await prescriptionFor(aDay, "leg-press")).id;
    aLog = (await startWorkout(a, { workoutDayId: aDay })).workoutLogId;
    await logSets(a, aLog, aPrescription, [[200, 8]]);
    await completeWorkout(a, { workoutLogId: aLog });
  });

  it("user B cannot read A's workout log", async () => {
    await expectServiceError(getWorkoutSession(b, aLog), "NOT_FOUND");
  });

  it("user B cannot write to A's workout log", async () => {
    await expectServiceError(
      saveSet(b, { workoutLogId: aLog, prescriptionId: aPrescription, setNumber: 1, weight: 1, unit: "lb", reps: 1 }),
      "NOT_FOUND",
    );
    await expectServiceError(
      chooseExercise(b, {
        workoutLogId: aLog,
        prescriptionId: aPrescription,
        exerciseId: await exerciseId("belt-squat"),
      }),
      "NOT_FOUND",
    );
    await expectServiceError(skipWorkout(b, { workoutLogId: aLog }), "NOT_FOUND");
    await expectServiceError(completeWorkout(b, { workoutLogId: aLog }), "NOT_FOUND");

    const session = await getWorkoutSession(a, aLog);
    expect(session.workoutLog.status).toBe("completed");
    const item = session.items.find((i) => i.id === aPrescription)!;
    expect(item.performedExercise?.slug).toBe("leg-press");
    expect(item.sets.map((s) => [s.weight, s.reps])).toEqual([[200, 8]]);
  });

  it("B's sessions, history and last performance never include A's data", async () => {
    const bLog = (await startWorkout(b, { workoutDayId: aDay })).workoutLogId;
    expect(bLog).not.toBe(aLog);
    const item = (await getWorkoutSession(b, bLog)).items.find((i) => i.id === aPrescription)!;
    expect(item.lastPerformance).toBeNull();
    expect(item.sets).toEqual([]);
    expect(await getHistory(b)).toEqual([]);
    const h = await getExerciseHistory(b, "leg-press");
    expect(h.sessions).toEqual([]);
    expect(h.weekly).toEqual([]);
    expect(h.weeklyFromPreviousRun).toBe(false);
    expect((await getHistory(a)).map((x) => x.workoutLogId)).toEqual([aLog]);
    const overview = await getProgramOverview(b);
    const day = overview.blocks[0].weeks[0].days[0];
    expect(day.workoutLogId).toBe(bLog);
    expect(day.status).toBe("in_progress");
  });
});

describe("overviews", () => {
  it("today/program overview track progress and the next day", async () => {
    const fresh = await createTestUser("fresh");
    expect((await getTodayOverview(fresh)).needsOnboarding).toBe(true);

    const u = await createOnboardedUser("today");
    let today = await getTodayOverview(u);
    expect(today.needsOnboarding).toBe(false);
    expect(today.progress).toMatchObject({ done: 0, total: 50 });
    expect(today.next).toMatchObject({ week: { number: 1 }, day: { position: 1 }, workoutLog: null });

    const d1 = await dayId(1, 1);
    const d2 = await dayId(1, 2);
    const s1 = await startWorkout(u, { workoutDayId: d1 });
    today = await getTodayOverview(u);
    expect(today.next?.workoutLog).toEqual({ id: s1.workoutLogId, status: "in_progress" });
    expect(today.inProgress?.workoutLogId).toBe(s1.workoutLogId);

    await completeWorkout(u, { workoutLogId: s1.workoutLogId });
    const s2 = await startWorkout(u, { workoutDayId: d2 });
    const closed = await completeWorkout(u, { workoutLogId: s2.workoutLogId });
    expect(closed.nextDayId).toBe(await dayId(1, 3));
    today = await getTodayOverview(u);
    expect(today.progress.done).toBe(2);
    expect(today.next?.day.position).toBe(3);
    expect(today.restDay).toBe(true); // Full Body #2 has rest_after and was completed just now
    expect(today.lastCompleted?.workoutLogId).toBe(s2.workoutLogId);

    const prog = await getProgramOverview(u);
    expect(prog.blocks).toHaveLength(2);
    expect(prog.blocks.flatMap((bl) => bl.weeks)).toHaveLength(10);
    const w1 = prog.blocks[0].weeks[0];
    expect(w1.days.map((d) => d.status)).toEqual(["completed", "completed", "pending", "pending", "pending"]);
    expect(w1.days[2].isNext).toBe(true);
    expect(prog.nextDayId).toBe(await dayId(1, 3));
    expect((await getHistory(u)).map((h) => h.workoutLogId)).toEqual([s2.workoutLogId, s1.workoutLogId]);
  });

  it("day detail exposes parsed prescriptions; restart starts a fresh run keeping history", async () => {
    const u = await createOnboardedUser("detail");
    const d = await dayId(1, 4);
    const detail = await getWorkoutDayDetail(u, d);
    expect(detail.prescriptions).toHaveLength(6);
    const hack = detail.prescriptions.find((p) => p.exercise?.slug === "hack-squat")!;
    expect(hack.reps.scheme).toEqual({ type: "per_set", targets: [4, 6, 8] });
    expect(hack.reps.targets.map((t) => t.label)).toEqual(["4", "6", "8"]);
    expect(hack.choices.map((c) => c.kind)).toEqual(["main", "sub1", "sub2"]);
    expect(hack.rest.minSec).toBeGreaterThan(0);

    const s = await startWorkout(u, { workoutDayId: d });
    const p = await prescriptionFor(d, "hack-squat");
    await logSets(u, s.workoutLogId, p.id, [[150, 4]]);
    await completeWorkout(u, { workoutLogId: s.workoutLogId });

    const r = await restartProgram(u, {});
    expect(r.previousRun?.closedAs).toBe("abandoned");
    expect(r.run.id).not.toBe(r.previousRun?.id);
    const today = await getTodayOverview(u);
    expect(today.run?.id).toBe(r.run.id);
    expect(today.progress.done).toBe(0);

    // New run: history still available, last performance crosses runs.
    const s2 = await startWorkout(u, { workoutDayId: d });
    expect(s2.workoutLogId).not.toBe(s.workoutLogId);
    const item = (await getWorkoutSession(u, s2.workoutLogId)).items.find((i) => i.id === p.id)!;
    expect(item.lastPerformance?.workoutLogId).toBe(s.workoutLogId);
    // Active run has no hack-squat data yet → chart falls back to the previous run (R1-8).
    const h = await getExerciseHistory(u, "hack-squat");
    expect(h.runId).toBe(r.previousRun!.id);
    expect(h.weeklyFromPreviousRun).toBe(true);
    expect(h.weekly).toEqual([{ week: 1, weight: 150, unit: "lb", reps: 4 }]);
    expect(h.sessions).toHaveLength(1);
    const old = await getExerciseHistory(u, "hack-squat", { runId: r.previousRun!.id });
    expect(old.weeklyFromPreviousRun).toBe(false);
    expect(old.weekly).toEqual([{ week: 1, weight: 150, unit: "lb", reps: 4 }]);
    // An explicitly requested run never falls back.
    const cur = await getExerciseHistory(u, "hack-squat", { runId: r.run.id });
    expect(cur.runId).toBe(r.run.id);
    expect(cur.weeklyFromPreviousRun).toBe(false);
    expect(cur.weekly).toEqual([]);

    // Once the new run has data, the chart switches back to it.
    await logSets(u, s2.workoutLogId, p.id, [[160, 5]]);
    const h2 = await getExerciseHistory(u, "hack-squat");
    expect(h2.runId).toBe(r.run.id);
    expect(h2.weeklyFromPreviousRun).toBe(false);
    expect(h2.weekly).toEqual([{ week: 1, weight: 160, unit: "lb", reps: 5 }]);
  });
});

describe("close / skip semantics (review fixes)", () => {
  it("re-completing keeps completedAt; skipping a completed session is a CONFLICT", async () => {
    const u = await createOnboardedUser("reclose");
    const d = await dayId(1, 3);
    const { workoutLogId } = await startWorkout(u, { workoutDayId: d });
    const first = await completeWorkout(u, { workoutLogId });
    await new Promise((r) => setTimeout(r, 20));
    const again = await completeWorkout(u, { workoutLogId });
    expect(again.completedAt).toBe(first.completedAt);
    await expectServiceError(skipWorkout(u, { workoutLogId }), "CONFLICT");
    expect((await getWorkoutSession(u, workoutLogId)).workoutLog.status).toBe("completed");
  });

  it("saving a set into a skipped session reopens it", async () => {
    const u = await createOnboardedUser("skipsave");
    const d = await dayId(1, 1);
    const { workoutLogId } = await startWorkout(u, { workoutDayId: d });
    await skipWorkout(u, { workoutLogId });
    const p = await prescriptionFor(d, "leg-press");
    await saveSet(u, { workoutLogId, prescriptionId: p.id, setNumber: 1, weight: 50, unit: "lb", reps: 10 });
    expect((await getWorkoutSession(u, workoutLogId)).workoutLog.status).toBe("in_progress");
  });

  it("completeOnboarding without weakPointKey keeps the existing weak point", async () => {
    const u = await createOnboardedUser("keepwp", "chest");
    const again = await completeOnboarding(u, { unit: "kg" });
    expect(again.settings.weakPoint?.key).toBe("chest");
    expect(again.settings.unit).toBe("kg");
    expect(again.createdRun).toBe(false);
    const cleared = await completeOnboarding(u, { unit: "kg", weakPointKey: null });
    expect(cleared.settings.weakPoint).toBeNull();
  });
});
