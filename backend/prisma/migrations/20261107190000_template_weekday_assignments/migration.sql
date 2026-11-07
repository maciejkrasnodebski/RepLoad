ALTER TABLE "Template"
ADD COLUMN "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

UPDATE "Template" AS template
SET "daysOfWeek" = ARRAY(
  SELECT DISTINCT assigned.day
  FROM (
    SELECT template."dayOfWeek" AS day
    WHERE template."dayOfWeek" BETWEEN 0 AND 6

    UNION

    SELECT plan_day."dayOfWeek" AS day
    FROM "weekly_plan_days" AS plan_day
    WHERE plan_day."templateId" = template.id
      AND plan_day."dayOfWeek" BETWEEN 0 AND 6
  ) AS assigned
  ORDER BY assigned.day
);
