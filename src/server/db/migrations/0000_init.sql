CREATE TYPE "public"."exercise_match" AS ENUM('exact', 'approx', 'none');--> statement-breakpoint
CREATE TYPE "public"."prescription_slot" AS ENUM('exercise', 'weak_point_1', 'weak_point_2');--> statement-breakpoint
CREATE TYPE "public"."program_run_status" AS ENUM('active', 'finished', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."technique_scope" AS ENUM('last_set', 'all_sets', 'between_sets');--> statement-breakpoint
CREATE TYPE "public"."weight_unit" AS ENUM('lb', 'kg');--> statement-breakpoint
CREATE TYPE "public"."workout_day_kind" AS ENUM('full_body', 'arms_weak_points');--> statement-breakpoint
CREATE TYPE "public"."workout_log_status" AS ENUM('in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blocks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"program_id" integer NOT NULL,
	"number" smallint NOT NULL,
	"name" text NOT NULL,
	"name_es" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_program_number_uq" UNIQUE("program_id","number")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exercises_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"youtube_id" text,
	"dataset_id" text,
	"match" "exercise_match" DEFAULT 'none' NOT NULL,
	"match_note" text,
	"gif_path" text,
	"thumb_path" text,
	"target" text,
	"secondary_muscles" text[] DEFAULT '{}' NOT NULL,
	"equipment" text,
	"body_part" text,
	"instructions_es" text[] DEFAULT '{}' NOT NULL,
	"instructions_en" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "general_warmup" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "general_warmup_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"position" smallint NOT NULL,
	"item" text NOT NULL,
	"item_es" text,
	"dose" text,
	"dose_es" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "general_warmup_position_unique" UNIQUE("position")
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prescriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workout_day_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"slot" "prescription_slot" DEFAULT 'exercise' NOT NULL,
	"exercise_id" integer,
	"sub1_exercise_id" integer,
	"sub2_exercise_id" integer,
	"superset_group" text,
	"superset_order" smallint,
	"technique_id" integer,
	"warmup_text" text,
	"warmup_sets_min" smallint,
	"warmup_sets_max" smallint,
	"working_sets" smallint NOT NULL,
	"reps_text" text NOT NULL,
	"reps_scheme" jsonb,
	"early_rpe_text" text,
	"early_rpe_min" numeric(3, 1),
	"early_rpe_max" numeric(3, 1),
	"last_rpe_text" text,
	"last_rpe_min" numeric(3, 1),
	"last_rpe_max" numeric(3, 1),
	"rest_text" text,
	"rest_min_sec" integer,
	"rest_max_sec" integer,
	"notes_en" text,
	"notes_es" text,
	"is_optional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prescriptions_day_position_uq" UNIQUE("workout_day_id","position")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "programs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"author" text,
	"description" text,
	"notes_es" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "techniques" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "techniques_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"name" text NOT NULL,
	"name_es" text,
	"scope" "technique_scope" NOT NULL,
	"description_es" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "techniques_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "warmup_protocol" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "warmup_protocol_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sets_count" smallint NOT NULL,
	"set_number" smallint NOT NULL,
	"pct_of_working" numeric(5, 2) NOT NULL,
	"reps_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warmup_protocol_count_set_uq" UNIQUE("sets_count","set_number")
);
--> statement-breakpoint
CREATE TABLE "weak_point_options" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weak_point_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"weak_point_id" integer NOT NULL,
	"slot" smallint NOT NULL,
	"position" smallint NOT NULL,
	"exercise_id" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weak_point_options_wp_slot_position_uq" UNIQUE("weak_point_id","slot","position")
);
--> statement-breakpoint
CREATE TABLE "weak_points" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weak_points_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"name_en" text NOT NULL,
	"name_es" text NOT NULL,
	"guidance_en" text,
	"guidance_es" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weak_points_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weeks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"block_id" integer NOT NULL,
	"number" smallint NOT NULL,
	"is_deload" boolean DEFAULT false NOT NULL,
	"banner" text,
	"banner_es" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weeks_block_number_uq" UNIQUE("block_id","number")
);
--> statement-breakpoint
CREATE TABLE "workout_days" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workout_days_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"week_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	"kind" "workout_day_kind" NOT NULL,
	"rest_after" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_days_week_position_uq" UNIQUE("week_id","position")
);
--> statement-breakpoint
CREATE TABLE "exercise_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_log_id" uuid NOT NULL,
	"prescription_id" integer NOT NULL,
	"performed_exercise_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_logs_workout_prescription_uq" UNIQUE("workout_log_id","prescription_id")
);
--> statement-breakpoint
CREATE TABLE "program_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"program_id" integer NOT NULL,
	"started_on" date NOT NULL,
	"status" "program_run_status" DEFAULT 'active' NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_log_id" uuid NOT NULL,
	"set_number" smallint NOT NULL,
	"weight" numeric(6, 2),
	"weight_unit" "weight_unit" NOT NULL,
	"reps" integer,
	"rpe" numeric(3, 1),
	"segment_reps" integer[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "set_logs_exercise_set_uq" UNIQUE("exercise_log_id","set_number")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"weight_unit" "weight_unit" DEFAULT 'lb' NOT NULL,
	"weak_point_id" integer,
	"rounding_lb" numeric(5, 2) DEFAULT 5 NOT NULL,
	"rounding_kg" numeric(5, 2) DEFAULT 2.5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_run_id" uuid NOT NULL,
	"workout_day_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"status" "workout_log_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_logs_run_day_uq" UNIQUE("program_run_id","workout_day_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_workout_day_id_workout_days_id_fk" FOREIGN KEY ("workout_day_id") REFERENCES "public"."workout_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_sub1_exercise_id_exercises_id_fk" FOREIGN KEY ("sub1_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_sub2_exercise_id_exercises_id_fk" FOREIGN KEY ("sub2_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_technique_id_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."techniques"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weak_point_options" ADD CONSTRAINT "weak_point_options_weak_point_id_weak_points_id_fk" FOREIGN KEY ("weak_point_id") REFERENCES "public"."weak_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weak_point_options" ADD CONSTRAINT "weak_point_options_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_days" ADD CONSTRAINT "workout_days_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_prescription_id_prescriptions_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_performed_exercise_id_exercises_id_fk" FOREIGN KEY ("performed_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_runs" ADD CONSTRAINT "program_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_runs" ADD CONSTRAINT "program_runs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_logs" ADD CONSTRAINT "set_logs_exercise_log_id_exercise_logs_id_fk" FOREIGN KEY ("exercise_log_id") REFERENCES "public"."exercise_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_weak_point_id_weak_points_id_fk" FOREIGN KEY ("weak_point_id") REFERENCES "public"."weak_points"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_program_run_id_program_runs_id_fk" FOREIGN KEY ("program_run_id") REFERENCES "public"."program_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workout_day_id_workout_days_id_fk" FOREIGN KEY ("workout_day_id") REFERENCES "public"."workout_days"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "exercises_dataset_id_idx" ON "exercises" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "prescriptions_exercise_id_idx" ON "prescriptions" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "exercise_logs_performed_exercise_idx" ON "exercise_logs" USING btree ("performed_exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_runs_one_active_per_user_uq" ON "program_runs" USING btree ("user_id") WHERE "program_runs"."status" = 'active';--> statement-breakpoint
CREATE INDEX "program_runs_user_id_idx" ON "program_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workout_logs_user_completed_idx" ON "workout_logs" USING btree ("user_id","completed_at");