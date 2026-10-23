/** Zod schemas shared by services and server actions. */
import { z } from "zod";
import { ServiceError } from "./errors";

export const weightUnitSchema = z.enum(["lb", "kg"]);
export const uuidSchema = z.uuid();
export const idSchema = z.coerce.number().int().positive();
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
/** YYYY-MM-DD calendar date. */
export const isoDateSchema = z.iso.date();
export const weakPointKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9_]+$/);

export const startWorkoutSchema = z.object({ workoutDayId: idSchema });
export const workoutLogIdSchema = z.object({ workoutLogId: uuidSchema });

export const saveSetSchema = z.object({
  workoutLogId: uuidSchema,
  prescriptionId: idSchema,
  performedExerciseId: idSchema.optional(),
  setNumber: z.coerce.number().int().min(1).max(12),
  weight: z.coerce.number().min(0).max(2000).nullable(),
  unit: weightUnitSchema,
  reps: z.coerce.number().int().min(0).max(200).nullable(),
  rpe: z.coerce
    .number()
    .min(0)
    .max(10)
    .refine((v) => Number.isInteger(v * 2), "RPE en pasos de 0.5")
    .nullable()
    .optional(),
  segmentReps: z.array(z.coerce.number().int().min(0).max(200)).max(6).nullable().optional(),
});
export type SaveSetInput = z.input<typeof saveSetSchema>;

export const chooseExerciseSchema = z.object({
  workoutLogId: uuidSchema,
  prescriptionId: idSchema,
  exerciseId: idSchema,
});
export type ChooseExerciseInput = z.input<typeof chooseExerciseSchema>;

export const completeOnboardingSchema = z.object({
  unit: weightUnitSchema,
  weakPointKey: weakPointKeySchema.nullable().optional(),
  startedOn: isoDateSchema.optional(),
});
export type CompleteOnboardingInput = z.input<typeof completeOnboardingSchema>;

export const updateSettingsSchema = z
  .object({
    unit: weightUnitSchema.optional(),
    weakPointKey: weakPointKeySchema.nullable().optional(),
    roundingLb: z.coerce.number().positive().max(50).optional(),
    roundingKg: z.coerce.number().positive().max(25).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nada que actualizar");
export type UpdateSettingsInput = z.input<typeof updateSettingsSchema>;

export const restartProgramSchema = z.object({ startedOn: isoDateSchema.optional() });
export type RestartProgramInput = z.input<typeof restartProgramSchema>;

export const exerciseHistoryOptionsSchema = z.object({
  runId: uuidSchema.optional(),
  displayUnit: weightUnitSchema.optional(),
});
export type ExerciseHistoryOptions = z.input<typeof exerciseHistoryOptionsSchema>;

/** Parse or throw a VALIDATION ServiceError carrying zod's flattened field errors. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const flat = z.flattenError(r.error);
    const fieldErrors = flat.fieldErrors as Record<string, string[]>;
    throw new ServiceError(
      "VALIDATION",
      flat.formErrors[0] ?? "Datos inválidos",
      Object.keys(fieldErrors).length ? fieldErrors : undefined,
    );
  }
  return r.data;
}
