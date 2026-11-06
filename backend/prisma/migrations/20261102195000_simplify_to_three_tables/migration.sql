/*
  Warnings:

  - You are about to drop the `_EquipmentToExercise` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ExerciseToExerciseType` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ExerciseToMuscularGroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `equipment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `exercise_types` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `muscular_groups` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `exerciseType` to the `exercises` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_EquipmentToExercise" DROP CONSTRAINT "_EquipmentToExercise_A_fkey";

-- DropForeignKey
ALTER TABLE "_EquipmentToExercise" DROP CONSTRAINT "_EquipmentToExercise_B_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToExerciseType" DROP CONSTRAINT "_ExerciseToExerciseType_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToExerciseType" DROP CONSTRAINT "_ExerciseToExerciseType_B_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToMuscularGroup" DROP CONSTRAINT "_ExerciseToMuscularGroup_A_fkey";

-- DropForeignKey
ALTER TABLE "_ExerciseToMuscularGroup" DROP CONSTRAINT "_ExerciseToMuscularGroup_B_fkey";

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "difficultyLevel" TEXT,
ADD COLUMN     "equipment" TEXT,
ADD COLUMN     "exerciseType" TEXT NOT NULL,
ADD COLUMN     "muscleGroup" TEXT;

-- DropTable
DROP TABLE "_EquipmentToExercise";

-- DropTable
DROP TABLE "_ExerciseToExerciseType";

-- DropTable
DROP TABLE "_ExerciseToMuscularGroup";

-- DropTable
DROP TABLE "equipment";

-- DropTable
DROP TABLE "exercise_types";

-- DropTable
DROP TABLE "muscular_groups";
