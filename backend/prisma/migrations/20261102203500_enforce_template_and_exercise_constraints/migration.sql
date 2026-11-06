ALTER TABLE "exercises"
    DROP CONSTRAINT "exercises_userId_fkey";

ALTER TABLE "exercises"
    ADD CONSTRAINT "exercises_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Template"
    ADD CONSTRAINT "Template_dayOfWeek_check"
    CHECK ("dayOfWeek" IS NULL OR "dayOfWeek" BETWEEN 0 AND 6);
