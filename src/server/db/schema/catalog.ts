/**
 * Read-only catalog (PLAN §3.2). Populated exclusively by `pnpm db:seed`
 * (idempotent upserts keyed by the natural keys declared as unique below).
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import {
  exerciseMatchEnum,
  prescriptionSlotEnum,
  techniqueScopeEnum,
  workoutDayKindEnum,
} from "./enums";

/** Mirrors `RepsScheme` in src/server/domain (PLAN §4.2). Kept structural so the schema has no runtime deps. */
type RepsRange = { min: number; max: number };
export type RepsSchemeJson =
  | { type: "fixed"; reps: number }
  | { type: "range"; min: number; max: number }
  | { type: "per_set"; targets: number[] }
  | { type: "mechanical_dropset"; segments: number[]; lastOpen: true }
  | { type: "compound"; main: RepsRange; finisher: RepsRange; finisherLabel: string };

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const exercises = pgTable(
  "exercises",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    /** Name as written in the PDF (English). */
    name: text("name").notNull(),
    youtubeId: text("youtube_id"),
    // --- denormalized from hasaneyldrm/exercises-dataset via data/mapping/exercise-map.json
    datasetId: text("dataset_id"),
    match: exerciseMatchEnum("match").notNull().default("none"),
    matchNote: text("match_note"),
    gifPath: text("gif_path"),
    thumbPath: text("thumb_path"),
    target: text("target"),
    secondaryMuscles: text("secondary_muscles").array().notNull().default([]),
    equipment: text("equipment"),
    bodyPart: text("body_part"),
    instructionsEs: text("instructions_es").array().notNull().default([]),
    instructionsEn: text("instructions_en").array().notNull().default([]),
    ...timestamps,
  },
  (t) => [index("exercises_dataset_id_idx").on(t.datasetId)],
);

export const techniques = pgTable("techniques", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  nameEs: text("name_es"),
  scope: techniqueScopeEnum("scope").notNull(),
  descriptionEs: text("description_es"),
  ...timestamps,
});

export const programs = pgTable("programs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  author: text("author"),
  description: text("description"),
  /** General program notes in Spanish (warmup.json → programNotesEs). */
  notesEs: text("notes_es").array().notNull().default([]),
  ...timestamps,
});

export const blocks = pgTable(
  "blocks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    number: smallint("number").notNull(),
    name: text("name").notNull(),
    nameEs: text("name_es"),
    description: text("description"),
    ...timestamps,
  },
  (t) => [unique("blocks_program_number_uq").on(t.programId, t.number)],
);

export const weeks = pgTable(
  "weeks",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    blockId: integer("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "cascade" }),
    /** Global week number within the program (1..10). */
    number: smallint("number").notNull(),
    isDeload: boolean("is_deload").notNull().default(false),
    banner: text("banner"),
    bannerEs: text("banner_es"),
    ...timestamps,
  },
  (t) => [unique("weeks_block_number_uq").on(t.blockId, t.number)],
);

export const workoutDays = pgTable(
  "workout_days",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    weekId: integer("week_id")
      .notNull()
      .references(() => weeks.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    name: text("name").notNull(),
    kind: workoutDayKindEnum("kind").notNull(),
    restAfter: boolean("rest_after").notNull().default(false),
    ...timestamps,
  },
  (t) => [unique("workout_days_week_position_uq").on(t.weekId, t.position)],
);

export const prescriptions = pgTable(
  "prescriptions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workoutDayId: integer("workout_day_id")
      .notNull()
      .references(() => workoutDays.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    slot: prescriptionSlotEnum("slot").notNull().default("exercise"),
    /** NULL for weak-point slots (the option comes from weak_point_options). */
    exerciseId: integer("exercise_id").references(() => exercises.id, { onDelete: "restrict" }),
    sub1ExerciseId: integer("sub1_exercise_id").references(() => exercises.id, {
      onDelete: "restrict",
    }),
    sub2ExerciseId: integer("sub2_exercise_id").references(() => exercises.id, {
      onDelete: "restrict",
    }),
    supersetGroup: text("superset_group"),
    supersetOrder: smallint("superset_order"),
    techniqueId: integer("technique_id").references(() => techniques.id, {
      onDelete: "set null",
    }),
    warmupText: text("warmup_text"),
    warmupSetsMin: smallint("warmup_sets_min"),
    warmupSetsMax: smallint("warmup_sets_max"),
    workingSets: smallint("working_sets").notNull(),
    repsText: text("reps_text").notNull(),
    repsScheme: jsonb("reps_scheme").$type<RepsSchemeJson>(),
    earlyRpeText: text("early_rpe_text"),
    earlyRpeMin: numeric("early_rpe_min", { precision: 3, scale: 1, mode: "number" }),
    earlyRpeMax: numeric("early_rpe_max", { precision: 3, scale: 1, mode: "number" }),
    lastRpeText: text("last_rpe_text"),
    lastRpeMin: numeric("last_rpe_min", { precision: 3, scale: 1, mode: "number" }),
    lastRpeMax: numeric("last_rpe_max", { precision: 3, scale: 1, mode: "number" }),
    restText: text("rest_text"),
    restMinSec: integer("rest_min_sec"),
    restMaxSec: integer("rest_max_sec"),
    notesEn: text("notes_en"),
    notesEs: text("notes_es"),
    isOptional: boolean("is_optional").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("prescriptions_day_position_uq").on(t.workoutDayId, t.position),
    index("prescriptions_exercise_id_idx").on(t.exerciseId),
  ],
);

export const weakPoints = pgTable("weak_points", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameEs: text("name_es").notNull(),
  guidanceEn: text("guidance_en"),
  guidanceEs: text("guidance_es"),
  ...timestamps,
});

export const weakPointOptions = pgTable(
  "weak_point_options",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    weakPointId: integer("weak_point_id")
      .notNull()
      .references(() => weakPoints.id, { onDelete: "cascade" }),
    slot: smallint("slot").notNull(),
    position: smallint("position").notNull(),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    note: text("note"),
    ...timestamps,
  },
  (t) => [unique("weak_point_options_wp_slot_position_uq").on(t.weakPointId, t.slot, t.position)],
);

/** Specific warm-up protocol: % of working weight per warm-up set (PLAN §4.3). */
export const warmupProtocol = pgTable(
  "warmup_protocol",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    setsCount: smallint("sets_count").notNull(),
    setNumber: smallint("set_number").notNull(),
    /** Percent of the working weight (e.g. 45, 65, 85). */
    pctOfWorking: numeric("pct_of_working", { precision: 5, scale: 2, mode: "number" }).notNull(),
    repsText: text("reps_text").notNull(),
    ...timestamps,
  },
  (t) => [unique("warmup_protocol_count_set_uq").on(t.setsCount, t.setNumber)],
);

export const generalWarmup = pgTable("general_warmup", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  position: smallint("position").notNull().unique(),
  item: text("item").notNull(),
  itemEs: text("item_es"),
  dose: text("dose"),
  doseEs: text("dose_es"),
  ...timestamps,
});

// ---------------------------------------------------------------- relations

export const programsRelations = relations(programs, ({ many }) => ({
  blocks: many(blocks),
}));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
  program: one(programs, { fields: [blocks.programId], references: [programs.id] }),
  weeks: many(weeks),
}));

export const weeksRelations = relations(weeks, ({ one, many }) => ({
  block: one(blocks, { fields: [weeks.blockId], references: [blocks.id] }),
  days: many(workoutDays),
}));

export const workoutDaysRelations = relations(workoutDays, ({ one, many }) => ({
  week: one(weeks, { fields: [workoutDays.weekId], references: [weeks.id] }),
  prescriptions: many(prescriptions),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  workoutDay: one(workoutDays, {
    fields: [prescriptions.workoutDayId],
    references: [workoutDays.id],
  }),
  exercise: one(exercises, {
    fields: [prescriptions.exerciseId],
    references: [exercises.id],
    relationName: "prescription_exercise",
  }),
  sub1: one(exercises, {
    fields: [prescriptions.sub1ExerciseId],
    references: [exercises.id],
    relationName: "prescription_sub1",
  }),
  sub2: one(exercises, {
    fields: [prescriptions.sub2ExerciseId],
    references: [exercises.id],
    relationName: "prescription_sub2",
  }),
  technique: one(techniques, {
    fields: [prescriptions.techniqueId],
    references: [techniques.id],
  }),
}));

export const exercisesRelations = relations(exercises, ({ many }) => ({
  asMain: many(prescriptions, { relationName: "prescription_exercise" }),
  asSub1: many(prescriptions, { relationName: "prescription_sub1" }),
  asSub2: many(prescriptions, { relationName: "prescription_sub2" }),
  weakPointOptions: many(weakPointOptions),
}));

export const techniquesRelations = relations(techniques, ({ many }) => ({
  prescriptions: many(prescriptions),
}));

export const weakPointsRelations = relations(weakPoints, ({ many }) => ({
  options: many(weakPointOptions),
}));

export const weakPointOptionsRelations = relations(weakPointOptions, ({ one }) => ({
  weakPoint: one(weakPoints, {
    fields: [weakPointOptions.weakPointId],
    references: [weakPoints.id],
  }),
  exercise: one(exercises, {
    fields: [weakPointOptions.exerciseId],
    references: [exercises.id],
  }),
}));
