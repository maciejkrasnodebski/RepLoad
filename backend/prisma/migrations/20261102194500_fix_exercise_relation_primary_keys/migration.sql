ALTER TABLE "_EquipmentToExercise"
    ADD CONSTRAINT "_EquipmentToExercise_AB_pkey" PRIMARY KEY ("A", "B");
DROP INDEX "_EquipmentToExercise_AB_unique";

ALTER TABLE "_ExerciseToExerciseType"
    ADD CONSTRAINT "_ExerciseToExerciseType_AB_pkey" PRIMARY KEY ("A", "B");
DROP INDEX "_ExerciseToExerciseType_AB_unique";

ALTER TABLE "_ExerciseToMuscularGroup"
    ADD CONSTRAINT "_ExerciseToMuscularGroup_AB_pkey" PRIMARY KEY ("A", "B");
DROP INDEX "_ExerciseToMuscularGroup_AB_unique";
