-- Rename the existing table and its indexes without dropping its data.
ALTER TABLE "User" RENAME TO "user";
ALTER TABLE "user" RENAME CONSTRAINT "User_pkey" TO "user_pkey";
ALTER INDEX "User_username_key" RENAME TO "user_username_key";

CREATE TABLE "exercises" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exercise_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "exercise_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "equipment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "muscular_groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "muscular_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_EquipmentToExercise" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE TABLE "_ExerciseToExerciseType" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE TABLE "_ExerciseToMuscularGroup" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "exercises_name_key" ON "exercises"("name");
CREATE UNIQUE INDEX "exercise_types_name_key" ON "exercise_types"("name");
CREATE UNIQUE INDEX "equipment_name_key" ON "equipment"("name");
CREATE UNIQUE INDEX "muscular_groups_name_key" ON "muscular_groups"("name");

CREATE UNIQUE INDEX "_EquipmentToExercise_AB_unique" ON "_EquipmentToExercise"("A", "B");
CREATE INDEX "_EquipmentToExercise_B_index" ON "_EquipmentToExercise"("B");
CREATE UNIQUE INDEX "_ExerciseToExerciseType_AB_unique" ON "_ExerciseToExerciseType"("A", "B");
CREATE INDEX "_ExerciseToExerciseType_B_index" ON "_ExerciseToExerciseType"("B");
CREATE UNIQUE INDEX "_ExerciseToMuscularGroup_AB_unique" ON "_ExerciseToMuscularGroup"("A", "B");
CREATE INDEX "_ExerciseToMuscularGroup_B_index" ON "_ExerciseToMuscularGroup"("B");

ALTER TABLE "_EquipmentToExercise"
    ADD CONSTRAINT "_EquipmentToExercise_A_fkey"
    FOREIGN KEY ("A") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_EquipmentToExercise"
    ADD CONSTRAINT "_EquipmentToExercise_B_fkey"
    FOREIGN KEY ("B") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ExerciseToExerciseType"
    ADD CONSTRAINT "_ExerciseToExerciseType_A_fkey"
    FOREIGN KEY ("A") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ExerciseToExerciseType"
    ADD CONSTRAINT "_ExerciseToExerciseType_B_fkey"
    FOREIGN KEY ("B") REFERENCES "exercise_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ExerciseToMuscularGroup"
    ADD CONSTRAINT "_ExerciseToMuscularGroup_A_fkey"
    FOREIGN KEY ("A") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ExerciseToMuscularGroup"
    ADD CONSTRAINT "_ExerciseToMuscularGroup_B_fkey"
    FOREIGN KEY ("B") REFERENCES "muscular_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
