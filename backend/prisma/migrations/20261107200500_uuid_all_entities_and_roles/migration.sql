BEGIN;

ALTER TABLE "user"
  ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

CREATE TEMP TABLE "_exercise_uuid_map" ON COMMIT DROP AS
SELECT "id"::TEXT AS "old_id", gen_random_uuid() AS "new_id"
FROM "exercises";
CREATE UNIQUE INDEX ON "_exercise_uuid_map" ("old_id");

CREATE TEMP TABLE "_template_uuid_map" ON COMMIT DROP AS
SELECT "id"::TEXT AS "old_id", gen_random_uuid() AS "new_id"
FROM "Template";
CREATE UNIQUE INDEX ON "_template_uuid_map" ("old_id");

CREATE TEMP TABLE "_template_exercise_uuid_map" ON COMMIT DROP AS
SELECT "id"::TEXT AS "old_id", gen_random_uuid() AS "new_id"
FROM "TemplateExercise";
CREATE UNIQUE INDEX ON "_template_exercise_uuid_map" ("old_id");

CREATE TEMP TABLE "_weekly_plan_uuid_map" ON COMMIT DROP AS
SELECT "id"::TEXT AS "old_id", gen_random_uuid() AS "new_id"
FROM "weekly_plans";
CREATE UNIQUE INDEX ON "_weekly_plan_uuid_map" ("old_id");

CREATE TEMP TABLE "_weekly_plan_day_uuid_map" ON COMMIT DROP AS
SELECT "id"::TEXT AS "old_id", gen_random_uuid() AS "new_id"
FROM "weekly_plan_days";
CREATE UNIQUE INDEX ON "_weekly_plan_day_uuid_map" ("old_id");

CREATE TEMP TABLE "_workout_session_uuid_map" ON COMMIT DROP AS
SELECT "id"::TEXT AS "old_id", gen_random_uuid() AS "new_id"
FROM "workout_sessions";
CREATE UNIQUE INDEX ON "_workout_session_uuid_map" ("old_id");

CREATE TEMP TABLE "_workout_session_exercise_uuid_map" ON COMMIT DROP AS
SELECT "id"::TEXT AS "old_id", gen_random_uuid() AS "new_id"
FROM "workout_session_exercises";
CREATE UNIQUE INDEX ON "_workout_session_exercise_uuid_map" ("old_id");

CREATE TEMP TABLE "_workout_series_uuid_map" ON COMMIT DROP AS
SELECT "id"::TEXT AS "old_id", gen_random_uuid() AS "new_id"
FROM "workout_series";
CREATE UNIQUE INDEX ON "_workout_series_uuid_map" ("old_id");

ALTER TABLE "exercises" ADD COLUMN "id_uuid" UUID;
UPDATE "exercises" AS current_row
SET "id_uuid" = mapping."new_id"
FROM "_exercise_uuid_map" AS mapping
WHERE current_row."id"::TEXT = mapping."old_id";

ALTER TABLE "Template" ADD COLUMN "id_uuid" UUID;
UPDATE "Template" AS current_row
SET "id_uuid" = mapping."new_id"
FROM "_template_uuid_map" AS mapping
WHERE current_row."id"::TEXT = mapping."old_id";

ALTER TABLE "TemplateExercise"
  ADD COLUMN "id_uuid" UUID,
  ADD COLUMN "templateId_uuid" UUID,
  ADD COLUMN "exerciseId_uuid" UUID;
UPDATE "TemplateExercise" AS current_row
SET "id_uuid" = own."new_id",
    "templateId_uuid" = template_map."new_id",
    "exerciseId_uuid" = exercise_map."new_id"
FROM "_template_exercise_uuid_map" AS own,
     "_template_uuid_map" AS template_map,
     "_exercise_uuid_map" AS exercise_map
WHERE current_row."id"::TEXT = own."old_id"
  AND current_row."templateId"::TEXT = template_map."old_id"
  AND current_row."exerciseId"::TEXT = exercise_map."old_id";

ALTER TABLE "weekly_plans" ADD COLUMN "id_uuid" UUID;
UPDATE "weekly_plans" AS current_row
SET "id_uuid" = mapping."new_id"
FROM "_weekly_plan_uuid_map" AS mapping
WHERE current_row."id"::TEXT = mapping."old_id";

ALTER TABLE "weekly_plan_days"
  ADD COLUMN "id_uuid" UUID,
  ADD COLUMN "weeklyPlanId_uuid" UUID,
  ADD COLUMN "templateId_uuid" UUID;
UPDATE "weekly_plan_days" AS current_row
SET "id_uuid" = own."new_id",
    "weeklyPlanId_uuid" = plan_map."new_id",
    "templateId_uuid" = (
      SELECT template_map."new_id"
      FROM "_template_uuid_map" AS template_map
      WHERE template_map."old_id" = current_row."templateId"::TEXT
    )
FROM "_weekly_plan_day_uuid_map" AS own,
     "_weekly_plan_uuid_map" AS plan_map
WHERE current_row."id"::TEXT = own."old_id"
  AND current_row."weeklyPlanId"::TEXT = plan_map."old_id";

ALTER TABLE "workout_sessions"
  ADD COLUMN "id_uuid" UUID,
  ADD COLUMN "templateId_uuid" UUID;
UPDATE "workout_sessions" AS current_row
SET "id_uuid" = own."new_id",
    "templateId_uuid" = (
      SELECT template_map."new_id"
      FROM "_template_uuid_map" AS template_map
      WHERE template_map."old_id" = current_row."templateId"::TEXT
    )
FROM "_workout_session_uuid_map" AS own
WHERE current_row."id"::TEXT = own."old_id";

ALTER TABLE "workout_session_exercises"
  ADD COLUMN "id_uuid" UUID,
  ADD COLUMN "sessionId_uuid" UUID,
  ADD COLUMN "exerciseId_uuid" UUID;
UPDATE "workout_session_exercises" AS current_row
SET "id_uuid" = own."new_id",
    "sessionId_uuid" = session_map."new_id",
    "exerciseId_uuid" = (
      SELECT exercise_map."new_id"
      FROM "_exercise_uuid_map" AS exercise_map
      WHERE exercise_map."old_id" = current_row."exerciseId"::TEXT
    )
FROM "_workout_session_exercise_uuid_map" AS own,
     "_workout_session_uuid_map" AS session_map
WHERE current_row."id"::TEXT = own."old_id"
  AND current_row."sessionId"::TEXT = session_map."old_id";

ALTER TABLE "workout_series"
  ADD COLUMN "id_uuid" UUID,
  ADD COLUMN "sessionExerciseId_uuid" UUID;
UPDATE "workout_series" AS current_row
SET "id_uuid" = own."new_id",
    "sessionExerciseId_uuid" = exercise_map."new_id"
FROM "_workout_series_uuid_map" AS own,
     "_workout_session_exercise_uuid_map" AS exercise_map
WHERE current_row."id"::TEXT = own."old_id"
  AND current_row."sessionExerciseId"::TEXT = exercise_map."old_id";

DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT table_name.relname AS table_name, constraint_name.conname AS constraint_name
    FROM pg_constraint AS constraint_name
    JOIN pg_class AS table_name ON table_name.oid = constraint_name.conrelid
    JOIN pg_namespace AS table_schema ON table_schema.oid = table_name.relnamespace
    WHERE constraint_name.contype = 'f'
      AND table_schema.nspname = current_schema()
      AND table_name.relname IN (
        'TemplateExercise',
        'weekly_plan_days',
        'workout_sessions',
        'workout_session_exercises',
        'workout_series'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT %I',
      constraint_row.table_name,
      constraint_row.constraint_name
    );
  END LOOP;

  FOR constraint_row IN
    SELECT table_name.relname AS table_name, constraint_name.conname AS constraint_name
    FROM pg_constraint AS constraint_name
    JOIN pg_class AS table_name ON table_name.oid = constraint_name.conrelid
    JOIN pg_namespace AS table_schema ON table_schema.oid = table_name.relnamespace
    WHERE constraint_name.contype = 'p'
      AND table_schema.nspname = current_schema()
      AND table_name.relname IN (
        'exercises',
        'Template',
        'TemplateExercise',
        'weekly_plans',
        'weekly_plan_days',
        'workout_sessions',
        'workout_session_exercises',
        'workout_series'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT %I',
      constraint_row.table_name,
      constraint_row.constraint_name
    );
  END LOOP;
END $$;

ALTER TABLE "exercises" DROP COLUMN "id";
ALTER TABLE "exercises" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "exercises"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");

ALTER TABLE "Template" DROP COLUMN "id";
ALTER TABLE "Template" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "Template"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ADD CONSTRAINT "Template_pkey" PRIMARY KEY ("id");

ALTER TABLE "TemplateExercise"
  DROP COLUMN "id",
  DROP COLUMN "templateId",
  DROP COLUMN "exerciseId";
ALTER TABLE "TemplateExercise"
  RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "TemplateExercise"
  RENAME COLUMN "templateId_uuid" TO "templateId";
ALTER TABLE "TemplateExercise"
  RENAME COLUMN "exerciseId_uuid" TO "exerciseId";
ALTER TABLE "TemplateExercise"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "templateId" SET NOT NULL,
  ALTER COLUMN "exerciseId" SET NOT NULL,
  ADD CONSTRAINT "TemplateExercise_pkey" PRIMARY KEY ("id");

ALTER TABLE "weekly_plans" DROP COLUMN "id";
ALTER TABLE "weekly_plans" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "weekly_plans"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ADD CONSTRAINT "weekly_plans_pkey" PRIMARY KEY ("id");

ALTER TABLE "weekly_plan_days"
DROP CONSTRAINT "weekly_plan_days_rest_assignment_check";

ALTER TABLE "weekly_plan_days"
DROP COLUMN "id",
  DROP COLUMN "weeklyPlanId",
  DROP COLUMN "templateId";
ALTER TABLE "weekly_plan_days" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "weekly_plan_days" RENAME COLUMN "weeklyPlanId_uuid" TO "weeklyPlanId";
ALTER TABLE "weekly_plan_days" RENAME COLUMN "templateId_uuid" TO "templateId";
ALTER TABLE "weekly_plan_days"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "weeklyPlanId" SET NOT NULL,
  ADD CONSTRAINT "weekly_plan_days_pkey" PRIMARY KEY ("id");

ALTER TABLE "workout_sessions"
  DROP COLUMN "id",
  DROP COLUMN "templateId";
ALTER TABLE "workout_sessions" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "workout_sessions" RENAME COLUMN "templateId_uuid" TO "templateId";
ALTER TABLE "workout_sessions"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ADD CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id");

ALTER TABLE "workout_session_exercises"
  DROP COLUMN "id",
  DROP COLUMN "sessionId",
  DROP COLUMN "exerciseId";
ALTER TABLE "workout_session_exercises" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "workout_session_exercises" RENAME COLUMN "sessionId_uuid" TO "sessionId";
ALTER TABLE "workout_session_exercises" RENAME COLUMN "exerciseId_uuid" TO "exerciseId";
ALTER TABLE "workout_session_exercises"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "sessionId" SET NOT NULL,
  ADD CONSTRAINT "workout_session_exercises_pkey" PRIMARY KEY ("id");

ALTER TABLE "workout_series"
  DROP COLUMN "id",
  DROP COLUMN "sessionExerciseId";
ALTER TABLE "workout_series" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "workout_series" RENAME COLUMN "sessionExerciseId_uuid" TO "sessionExerciseId";
ALTER TABLE "workout_series"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "sessionExerciseId" SET NOT NULL,
  ADD CONSTRAINT "workout_series_pkey" PRIMARY KEY ("id");

ALTER TABLE "TemplateExercise"
  ADD CONSTRAINT "TemplateExercise_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TemplateExercise_exerciseId_fkey"
  FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_plan_days"
  ADD CONSTRAINT "weekly_plan_days_weeklyPlanId_fkey"
  FOREIGN KEY ("weeklyPlanId") REFERENCES "weekly_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "weekly_plan_days_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workout_sessions"
  ADD CONSTRAINT "workout_sessions_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workout_session_exercises"
  ADD CONSTRAINT "workout_session_exercises_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "workout_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "workout_session_exercises_exerciseId_fkey"
  FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workout_series"
  ADD CONSTRAINT "workout_series_sessionExerciseId_fkey"
  FOREIGN KEY ("sessionExerciseId") REFERENCES "workout_session_exercises"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TemplateExercise_templateId_order_idx"
  ON "TemplateExercise"("templateId", "order");
CREATE INDEX "TemplateExercise_exerciseId_idx"
  ON "TemplateExercise"("exerciseId");
CREATE UNIQUE INDEX "weekly_plan_days_weeklyPlanId_dayOfWeek_key"
  ON "weekly_plan_days"("weeklyPlanId", "dayOfWeek");
ALTER TABLE "weekly_plan_days"
  ADD CONSTRAINT "weekly_plan_days_rest_assignment_check"
  CHECK (NOT "isRestDay" OR "templateId" IS NULL);
CREATE INDEX "weekly_plan_days_templateId_idx"
  ON "weekly_plan_days"("templateId");
CREATE INDEX "workout_sessions_templateId_idx"
  ON "workout_sessions"("templateId");
CREATE INDEX "workout_session_exercises_sessionId_order_idx"
  ON "workout_session_exercises"("sessionId", "order");
CREATE INDEX "workout_session_exercises_exerciseId_idx"
  ON "workout_session_exercises"("exerciseId");
CREATE INDEX "workout_series_sessionExerciseId_order_idx"
  ON "workout_series"("sessionExerciseId", "order");

COMMIT;
