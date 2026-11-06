BEGIN;

-- Build a stable one-to-one mapping so every existing FK follows its account.
CREATE TEMP TABLE "_user_uuid_map" ON COMMIT DROP AS
SELECT "id" AS "oldId", gen_random_uuid() AS "newId"
FROM "user";

ALTER TABLE "exercises" DROP CONSTRAINT "exercises_userId_fkey";
ALTER TABLE "Template" DROP CONSTRAINT "Template_userId_fkey";
ALTER TABLE "weekly_plans" DROP CONSTRAINT "weekly_plans_userId_fkey";
ALTER TABLE "user" DROP CONSTRAINT "user_pkey";

ALTER TABLE "user" ADD COLUMN "id_uuid" UUID;
UPDATE "user" AS u
SET "id_uuid" = mapping."newId"
FROM "_user_uuid_map" AS mapping
WHERE u."id" = mapping."oldId";

ALTER TABLE "exercises" ADD COLUMN "userId_uuid" UUID;
UPDATE "exercises" AS e
SET "userId_uuid" = mapping."newId"
FROM "_user_uuid_map" AS mapping
WHERE e."userId" = mapping."oldId";

ALTER TABLE "Template" ADD COLUMN "userId_uuid" UUID;
UPDATE "Template" AS t
SET "userId_uuid" = mapping."newId"
FROM "_user_uuid_map" AS mapping
WHERE t."userId" = mapping."oldId";

ALTER TABLE "weekly_plans" ADD COLUMN "userId_uuid" UUID;
UPDATE "weekly_plans" AS p
SET "userId_uuid" = mapping."newId"
FROM "_user_uuid_map" AS mapping
WHERE p."userId" = mapping."oldId";

ALTER TABLE "exercises" DROP COLUMN "userId";
ALTER TABLE "Template" DROP COLUMN "userId";
ALTER TABLE "weekly_plans" DROP COLUMN "userId";
ALTER TABLE "user" DROP COLUMN "id";

ALTER TABLE "user" RENAME COLUMN "id_uuid" TO "id";
ALTER TABLE "exercises" RENAME COLUMN "userId_uuid" TO "userId";
ALTER TABLE "Template" RENAME COLUMN "userId_uuid" TO "userId";
ALTER TABLE "weekly_plans" RENAME COLUMN "userId_uuid" TO "userId";

ALTER TABLE "user"
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "id" SET NOT NULL,
    ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");
ALTER TABLE "exercises"
    ADD CONSTRAINT "exercises_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Template"
    ADD CONSTRAINT "Template_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weekly_plans"
    ADD CONSTRAINT "weekly_plans_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "exercises_userId_idx" ON "exercises"("userId");
CREATE INDEX "weekly_plans_userId_idx" ON "weekly_plans"("userId");

CREATE TYPE "WorkoutSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TABLE "workout_sessions" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "templateId" TEXT,
    "name" TEXT,
    "templateName" TEXT,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_session_exercises" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" INTEGER,
    "name" TEXT NOT NULL,
    "exerciseType" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workout_session_exercises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_series" (
    "id" SERIAL NOT NULL,
    "sessionExerciseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "reps" INTEGER,
    "weight" DECIMAL(10,2),
    "durationSeconds" INTEGER,
    "distance" DECIMAL(10,2),
    "restSeconds" INTEGER,
    "rpe" DECIMAL(3,1),
    "rir" INTEGER,
    "notes" TEXT,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workout_series_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workout_series_reps_check" CHECK ("reps" IS NULL OR "reps" > 0),
    CONSTRAINT "workout_series_weight_check" CHECK ("weight" IS NULL OR "weight" >= 0),
    CONSTRAINT "workout_series_duration_check"
        CHECK ("durationSeconds" IS NULL OR "durationSeconds" > 0),
    CONSTRAINT "workout_series_distance_check"
        CHECK ("distance" IS NULL OR "distance" >= 0),
    CONSTRAINT "workout_series_rest_check" CHECK ("restSeconds" IS NULL OR "restSeconds" >= 0),
    CONSTRAINT "workout_series_rpe_check" CHECK ("rpe" IS NULL OR ("rpe" >= 0 AND "rpe" <= 10)),
    CONSTRAINT "workout_series_rir_check" CHECK ("rir" IS NULL OR "rir" >= 0)
);

CREATE INDEX "workout_sessions_userId_startedAt_idx"
    ON "workout_sessions"("userId", "startedAt");
CREATE INDEX "workout_sessions_userId_status_idx"
    ON "workout_sessions"("userId", "status");
CREATE INDEX "workout_sessions_templateId_idx"
    ON "workout_sessions"("templateId");
CREATE INDEX "workout_session_exercises_sessionId_order_idx"
    ON "workout_session_exercises"("sessionId", "order");
CREATE INDEX "workout_session_exercises_exerciseId_idx"
    ON "workout_session_exercises"("exerciseId");
CREATE INDEX "workout_series_sessionExerciseId_order_idx"
    ON "workout_series"("sessionExerciseId", "order");
CREATE UNIQUE INDEX "workout_sessions_one_active_per_user"
    ON "workout_sessions"("userId") WHERE "status" = 'ACTIVE';

ALTER TABLE "workout_sessions"
    ADD CONSTRAINT "workout_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
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

COMMIT;
