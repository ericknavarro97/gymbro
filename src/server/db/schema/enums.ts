import { pgEnum } from "drizzle-orm/pg-core";

export const exerciseMatchEnum = pgEnum("exercise_match", ["exact", "approx", "none"]);
export const techniqueScopeEnum = pgEnum("technique_scope", [
  "last_set",
  "all_sets",
  "between_sets",
]);
export const workoutDayKindEnum = pgEnum("workout_day_kind", ["full_body", "arms_weak_points"]);
export const prescriptionSlotEnum = pgEnum("prescription_slot", [
  "exercise",
  "weak_point_1",
  "weak_point_2",
]);
export const weightUnitEnum = pgEnum("weight_unit", ["lb", "kg"]);
export const programRunStatusEnum = pgEnum("program_run_status", [
  "active",
  "finished",
  "abandoned",
]);
export const workoutLogStatusEnum = pgEnum("workout_log_status", [
  "in_progress",
  "completed",
  "skipped",
]);

export type ExerciseMatch = (typeof exerciseMatchEnum.enumValues)[number];
export type TechniqueScope = (typeof techniqueScopeEnum.enumValues)[number];
export type WorkoutDayKind = (typeof workoutDayKindEnum.enumValues)[number];
export type PrescriptionSlot = (typeof prescriptionSlotEnum.enumValues)[number];
export type WeightUnit = (typeof weightUnitEnum.enumValues)[number];
export type ProgramRunStatus = (typeof programRunStatusEnum.enumValues)[number];
export type WorkoutLogStatus = (typeof workoutLogStatusEnum.enumValues)[number];
