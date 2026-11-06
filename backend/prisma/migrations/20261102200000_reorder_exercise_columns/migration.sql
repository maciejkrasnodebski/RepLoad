CREATE TABLE "_exercises_reordered" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "exerciseType" TEXT NOT NULL,
    "equipment" TEXT,
    "muscleGroup" TEXT,
    "difficultyLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "_exercises_reordered_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "_exercises_reordered_name_key" ON "_exercises_reordered"("name");

INSERT INTO "_exercises_reordered" (
    "id",
    "name",
    "description",
    "exerciseType",
    "equipment",
    "muscleGroup",
    "difficultyLevel",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "description",
    "exerciseType",
    "equipment",
    "muscleGroup",
    "difficultyLevel",
    "createdAt",
    "updatedAt"
FROM "exercises";

SELECT setval(
    pg_get_serial_sequence('_exercises_reordered', 'id'),
    COALESCE(MAX("id"), 1),
    COUNT(*) > 0
)
FROM "_exercises_reordered";

DROP TABLE "exercises";

ALTER TABLE "_exercises_reordered" RENAME TO "exercises";
ALTER TABLE "exercises" RENAME CONSTRAINT "_exercises_reordered_pkey" TO "exercises_pkey";
ALTER INDEX "_exercises_reordered_name_key" RENAME TO "exercises_name_key";
ALTER SEQUENCE "_exercises_reordered_id_seq" RENAME TO "exercises_id_seq";
