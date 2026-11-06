-- Persist exercise prescription values without changing existing template data.
ALTER TABLE "TemplateExercise"
    ADD COLUMN "sets" INTEGER,
    ADD COLUMN "reps" INTEGER,
    ADD COLUMN "weight" DOUBLE PRECISION,
    ADD COLUMN "durationSeconds" INTEGER,
    ADD COLUMN "restSeconds" INTEGER,
    ADD COLUMN "distance" DOUBLE PRECISION;

ALTER TABLE "Template"
    ADD COLUMN "color" TEXT,
    ADD COLUMN "icon" TEXT;

ALTER TABLE "TemplateExercise"
    ADD CONSTRAINT "TemplateExercise_sets_check" CHECK ("sets" IS NULL OR "sets" > 0),
    ADD CONSTRAINT "TemplateExercise_reps_check" CHECK ("reps" IS NULL OR "reps" > 0),
    ADD CONSTRAINT "TemplateExercise_weight_check" CHECK ("weight" IS NULL OR "weight" >= 0),
    ADD CONSTRAINT "TemplateExercise_durationSeconds_check"
        CHECK ("durationSeconds" IS NULL OR "durationSeconds" > 0),
    ADD CONSTRAINT "TemplateExercise_restSeconds_check"
        CHECK ("restSeconds" IS NULL OR "restSeconds" >= 0),
    ADD CONSTRAINT "TemplateExercise_distance_check"
        CHECK ("distance" IS NULL OR "distance" >= 0);

CREATE TABLE "weekly_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "weekly_plan_days" (
    "id" SERIAL NOT NULL,
    "weeklyPlanId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "templateId" TEXT,
    "isRestDay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "weekly_plan_days_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "weekly_plan_days_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6),
    CONSTRAINT "weekly_plan_days_rest_assignment_check"
        CHECK (NOT "isRestDay" OR "templateId" IS NULL)
);

CREATE INDEX "weekly_plans_userId_idx" ON "weekly_plans"("userId");
CREATE INDEX "weekly_plan_days_templateId_idx" ON "weekly_plan_days"("templateId");
CREATE UNIQUE INDEX "weekly_plan_days_weeklyPlanId_dayOfWeek_key"
    ON "weekly_plan_days"("weeklyPlanId", "dayOfWeek");

ALTER TABLE "weekly_plans"
    ADD CONSTRAINT "weekly_plans_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_plan_days"
    ADD CONSTRAINT "weekly_plan_days_weeklyPlanId_fkey"
    FOREIGN KEY ("weeklyPlanId") REFERENCES "weekly_plans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "weekly_plan_days_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "Template"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Import one deterministic legacy template for each occupied weekday. All
-- Template.dayOfWeek values remain untouched; additional templates on the
-- same day remain available and can be assigned through the new API.
INSERT INTO "weekly_plans" ("id", "name", "userId")
SELECT 'legacy_weekly_plan_user_' || t."userId"::TEXT,
       'Imported weekly plan',
       t."userId"
FROM "Template" AS t
WHERE t."dayOfWeek" IS NOT NULL
GROUP BY t."userId"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "weekly_plan_days" ("weeklyPlanId", "dayOfWeek")
SELECT p."id", weekday
FROM "weekly_plans" AS p
CROSS JOIN generate_series(0, 6) AS weekday
WHERE left(p."id", 24) = 'legacy_weekly_plan_user_'
ON CONFLICT ("weeklyPlanId", "dayOfWeek") DO NOTHING;

WITH chosen_legacy_template AS (
    SELECT DISTINCT ON (t."userId", t."dayOfWeek")
           t."userId", t."dayOfWeek", t."id"
    FROM "Template" AS t
    WHERE t."dayOfWeek" IS NOT NULL
    ORDER BY t."userId", t."dayOfWeek", t."createdAt", t."id"
)
UPDATE "weekly_plan_days" AS d
SET "templateId" = t."id"
FROM "weekly_plans" AS p
JOIN chosen_legacy_template AS t ON t."userId" = p."userId"
WHERE d."weeklyPlanId" = p."id"
  AND left(p."id", 24) = 'legacy_weekly_plan_user_'
  AND d."dayOfWeek" = t."dayOfWeek";
