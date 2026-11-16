DROP INDEX IF EXISTS "exercises_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "exercises_name_userId_key"
ON "exercises" ("name", "userId");
