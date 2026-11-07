export type Exercise = {
  id: number;
  name: string;
  exerciseType: string;
  equipment: string | null;
  muscleGroup: string | null;
  difficultyLevel: string | null;
};

export type ExerciseSettings = {
  sets: number | null;
  reps: number | null;
  weight: number | null;
  durationSeconds: number | null;
  restSeconds: number | null;
  distance: number | null;
};

export type TemplateExercise = Exercise & {
  settings: ExerciseSettings;
};

export const trackingTypes = [
  { value: "weight_reps", label: "Ciężar + powtórzenia" },
  { value: "bodyweight", label: "Masa własnego ciała" },
  { value: "bodyweight_load", label: "Masa ciała + dodatkowy ciężar" },
  { value: "assisted", label: "Masa ciała + wspomaganie" },
  { value: "time", label: "Czas" },
  { value: "distance_time", label: "Dystans + czas" },
  { value: "reps", label: "Same powtórzenia" },
] as const;

export type TrackingType = (typeof trackingTypes)[number]["value"];

export const trackingMetrics: Record<TrackingType, string[]> = {
  weight_reps: ["Ciężar", "Powtórzenia"],
  bodyweight: ["Powtórzenia"],
  bodyweight_load: ["Dodatkowy ciężar", "Powtórzenia"],
  assisted: ["Wspomaganie", "Powtórzenia"],
  time: ["Czas"],
  distance_time: ["Dystans", "Czas"],
  reps: ["Powtórzenia"],
};

export function trackingLabel(value: string) {
  return (
    trackingTypes.find((type) => type.value === value)?.label ??
    (value === "Inne" ? "Typ nieustawiony" : value)
  );
}

export const templateThemes = [
  { color: "#A3E635", icon: "dumbbell", label: "Limonkowy" },
  { color: "#38BDF8", icon: "bolt", label: "Błękitny" },
  { color: "#A78BFA", icon: "target", label: "Fioletowy" },
  { color: "#FB7185", icon: "flame", label: "Koralowy" },
  { color: "#FBBF24", icon: "trophy", label: "Bursztynowy" },
] as const;

export function getTemplateTheme(color: string | null, icon: string | null) {
  const colorTheme =
    templateThemes.find((theme) => theme.color === color) ?? templateThemes[0];
  const iconTheme =
    templateThemes.find((theme) => theme.icon === icon) ?? templateThemes[0];
  return { color: colorTheme.color, icon: iconTheme.icon };
}

export type WorkoutTemplate = {
  id: string;
  name: string;
  dayOfWeek: number | null;
  daysOfWeek: number[];
  color: string | null;
  icon: string | null;
  exercises: TemplateExercise[];
};

export type WorkoutSeries = {
  id: number;
  order: number;
  reps: number | null;
  weight: string | null;
  durationSeconds: number | null;
  distance: string | null;
  restSeconds: number | null;
  rpe: string | null;
  rir: number | null;
  notes: string | null;
  isDone: boolean;
};

export type WorkoutSessionExercise = {
  id: number;
  exerciseId: number | null;
  name: string;
  exerciseType: string | null;
  order: number;
  series: WorkoutSeries[];
};

export type WorkoutSession = {
  id: string;
  name: string | null;
  templateId: string | null;
  templateName: string | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  startedAt: string;
  endedAt: string | null;
  exercises: WorkoutSessionExercise[];
};

function isNullableNumberOrString(value: unknown): boolean {
  return value === null || typeof value === "number" || typeof value === "string";
}

export function isWorkoutSession(value: unknown): value is WorkoutSession {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("name" in value) ||
    (value.name !== null && typeof value.name !== "string") ||
    !("templateId" in value) ||
    (value.templateId !== null && typeof value.templateId !== "string") ||
    !("templateName" in value) ||
    (value.templateName !== null && typeof value.templateName !== "string") ||
    !("status" in value) ||
    !["ACTIVE", "COMPLETED", "CANCELLED"].includes(String(value.status)) ||
    !("startedAt" in value) ||
    typeof value.startedAt !== "string" ||
    !("endedAt" in value) ||
    (value.endedAt !== null && typeof value.endedAt !== "string") ||
    !("exercises" in value) ||
    !Array.isArray(value.exercises)
  ) {
    return false;
  }

  return value.exercises.every(
    (exercise: unknown) =>
      typeof exercise === "object" &&
      exercise !== null &&
      "id" in exercise &&
      typeof exercise.id === "number" &&
      "exerciseId" in exercise &&
      (exercise.exerciseId === null || typeof exercise.exerciseId === "number") &&
      "name" in exercise &&
      typeof exercise.name === "string" &&
      "exerciseType" in exercise &&
      (exercise.exerciseType === null || typeof exercise.exerciseType === "string") &&
      "order" in exercise &&
      typeof exercise.order === "number" &&
      "series" in exercise &&
      Array.isArray(exercise.series) &&
      exercise.series.every(
        (series: unknown) =>
          typeof series === "object" &&
          series !== null &&
          "id" in series &&
          typeof series.id === "number" &&
          "order" in series &&
          typeof series.order === "number" &&
          "reps" in series &&
          (series.reps === null || typeof series.reps === "number") &&
          "weight" in series &&
          isNullableNumberOrString(series.weight) &&
          "durationSeconds" in series &&
          (series.durationSeconds === null ||
            typeof series.durationSeconds === "number") &&
          "distance" in series &&
          isNullableNumberOrString(series.distance) &&
          "restSeconds" in series &&
          (series.restSeconds === null ||
            typeof series.restSeconds === "number") &&
          "rpe" in series &&
          isNullableNumberOrString(series.rpe) &&
          "rir" in series &&
          (series.rir === null || typeof series.rir === "number") &&
          "notes" in series &&
          (series.notes === null || typeof series.notes === "string") &&
          "isDone" in series &&
          typeof series.isDone === "boolean",
      ),
  );
}
