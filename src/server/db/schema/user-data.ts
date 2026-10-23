/**
 * Per-user data (PLAN §3.3). Every table carries (directly or through its
 * parent) the owning `user.id`; repositories must always filter by it.
 * The seed never touches these tables.
 */
import { relations, sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { exercises, prescriptions, programs, weakPoints, workoutDays } from "./catalog";
import { programRunStatusEnum, weightUnitEnum, workoutLogStatusEnum } from "./enums";

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  weightUnit: weightUnitEnum("weight_unit").notNull().default("lb"),
  weakPointId: integer("weak_point_id").references(() => weakPoints.id, {
    onDelete: "set null",
  }),
  roundingLb: numeric("rounding_lb", { precision: 5, scale: 2, mode: "number" })
    .notNull()
    .default(5),
  roundingKg: numeric("rounding_kg", { precision: 5, scale: 2, mode: "number" })
    .notNull()
    .default(2.5),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** One pass through the program; restarting creates a new run so history is kept. */
export const programRuns = pgTable(
  "program_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "restrict" }),
    startedOn: date("started_on", { mode: "string" }).notNull(),
    status: programRunStatusEnum("status").notNull().default("active"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    // Only one active run per user.
    uniqueIndex("program_runs_one_active_per_user_uq")
      .on(t.userId)
      .where(sql`${t.status} = 'active'`),
    index("program_runs_user_id_idx").on(t.userId),
  ],
);

export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programRunId: uuid("program_run_id")
      .notNull()
      .references(() => programRuns.id, { onDelete: "cascade" }),
    workoutDayId: integer("workout_day_id")
      .notNull()
      .references(() => workoutDays.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: workoutLogStatusEnum("status").notNull().default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique("workout_logs_run_day_uq").on(t.programRunId, t.workoutDayId),
    index("workout_logs_user_completed_idx").on(t.userId, t.completedAt),
  ],
);

export const exerciseLogs = pgTable(
  "exercise_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workoutLogId: uuid("workout_log_id")
      .notNull()
      .references(() => workoutLogs.id, { onDelete: "cascade" }),
    prescriptionId: integer("prescription_id")
      .notNull()
      .references(() => prescriptions.id, { onDelete: "restrict" }),
    /** Main, sub1, sub2 or a weak-point option. History is queried by this column. */
    performedExerciseId: integer("performed_exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique("exercise_logs_workout_prescription_uq").on(t.workoutLogId, t.prescriptionId),
    index("exercise_logs_performed_exercise_idx").on(t.performedExerciseId),
  ],
);

export const setLogs = pgTable(
  "set_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseLogId: uuid("exercise_log_id")
      .notNull()
      .references(() => exerciseLogs.id, { onDelete: "cascade" }),
    setNumber: smallint("set_number").notNull(),
    weight: numeric("weight", { precision: 6, scale: 2, mode: "number" }),
    weightUnit: weightUnitEnum("weight_unit").notNull(),
    reps: integer("reps"),
    rpe: numeric("rpe", { precision: 3, scale: 1, mode: "number" }),
    /** Per-segment reps for mechanical dropsets (5,4,3+) and compound sets (8-10 + 4-6). */
    segmentReps: integer("segment_reps").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [unique("set_logs_exercise_set_uq").on(t.exerciseLogId, t.setNumber)],
);

// ---------------------------------------------------------------- relations

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, { fields: [userSettings.userId], references: [user.id] }),
  weakPoint: one(weakPoints, {
    fields: [userSettings.weakPointId],
    references: [weakPoints.id],
  }),
}));

export const programRunsRelations = relations(programRuns, ({ one, many }) => ({
  user: one(user, { fields: [programRuns.userId], references: [user.id] }),
  program: one(programs, { fields: [programRuns.programId], references: [programs.id] }),
  workoutLogs: many(workoutLogs),
}));

export const workoutLogsRelations = relations(workoutLogs, ({ one, many }) => ({
  programRun: one(programRuns, {
    fields: [workoutLogs.programRunId],
    references: [programRuns.id],
  }),
  workoutDay: one(workoutDays, {
    fields: [workoutLogs.workoutDayId],
    references: [workoutDays.id],
  }),
  user: one(user, { fields: [workoutLogs.userId], references: [user.id] }),
  exerciseLogs: many(exerciseLogs),
}));

export const exerciseLogsRelations = relations(exerciseLogs, ({ one, many }) => ({
  workoutLog: one(workoutLogs, {
    fields: [exerciseLogs.workoutLogId],
    references: [workoutLogs.id],
  }),
  prescription: one(prescriptions, {
    fields: [exerciseLogs.prescriptionId],
    references: [prescriptions.id],
  }),
  performedExercise: one(exercises, {
    fields: [exerciseLogs.performedExerciseId],
    references: [exercises.id],
  }),
  setLogs: many(setLogs),
}));

export const setLogsRelations = relations(setLogs, ({ one }) => ({
  exerciseLog: one(exerciseLogs, {
    fields: [setLogs.exerciseLogId],
    references: [exerciseLogs.id],
  }),
}));
