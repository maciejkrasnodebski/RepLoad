"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BoltIcon,
  CloseIcon,
  CopyIcon,
  DumbbellIcon,
  FlameIcon,
  PlusIcon,
  TargetIcon,
  TrashIcon,
  TrophyIcon,
} from "./icons";
import {
  trackingLabel,
  trackingMetrics,
  trackingTypes,
  templateThemes,
  type Exercise,
  type ExerciseSettings,
  type TemplateExercise,
  type TrackingType,
  type WorkoutTemplate,
} from "./types";
import { API_URL } from "@/lib/api";

export type WorkoutTemplatePayload = {
  name: string;
  dayOfWeek: number | null;
  color: string;
  icon: string;
  exercises: Array<{ exerciseId: number } & Partial<ExerciseSettings>>;
};

type Props = {
  template?: WorkoutTemplate;
  onClose: () => void;
  onSave: (
    payload: WorkoutTemplatePayload,
    templateId?: string,
  ) => Promise<void>;
};

const muscleGroups = [
  "Klatka piersiowa",
  "Plecy",
  "Barki",
  "Biceps",
  "Triceps",
  "Nogi",
  "Brzuch",
  "Pośladki",
  "Łydki",
  "Całe ciało",
] as const;

const equipmentOptions = [
  "Sztanga",
  "Hantle",
  "Maszyna",
  "Wyciąg",
  "Masa własnego ciała",
  "Kettlebell",
  "Gumy oporowe",
  "Inne",
] as const;

function isTrackingType(value: string): value is TrackingType {
  return trackingTypes.some((type) => type.value === value);
}

function isExercise(value: unknown): value is Exercise {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value &&
    typeof value.id === "number" &&
    "name" in value &&
    typeof value.name === "string" &&
    (!("exerciseType" in value) ||
      typeof value.exerciseType === "string" ||
      value.exerciseType === null)
  );
}

function normalizeExercise(value: Exercise): Exercise {
  return {
    id: value.id,
    name: value.name,
    exerciseType:
      typeof value.exerciseType === "string" ? value.exerciseType : "Inne",
    equipment: typeof value.equipment === "string" ? value.equipment : null,
    muscleGroup:
      typeof value.muscleGroup === "string" ? value.muscleGroup : null,
    difficultyLevel:
      typeof value.difficultyLevel === "string" ? value.difficultyLevel : null,
  };
}

type EditableExercise = TemplateExercise & { slotKey: string };

function defaultSettings(exerciseType: string): ExerciseSettings {
  const isTimed = exerciseType === "time";
  const isDistance = exerciseType === "distance_time";
  return {
    sets: isDistance ? 1 : 3,
    reps: isTimed || isDistance ? null : 8,
    weight: null,
    durationSeconds: isTimed ? 60 : isDistance ? 600 : null,
    restSeconds: isDistance ? null : isTimed ? 60 : 90,
    distance: isDistance ? 1 : null,
  };
}

function nullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseSettingValue(key: keyof ExerciseSettings, value: string) {
  const parsed = nullableNumber(value);
  if (parsed === null) return null;
  if (
    (key === "sets" ||
      key === "reps" ||
      key === "durationSeconds" ||
      key === "restSeconds") &&
    !Number.isInteger(parsed)
  ) {
    return null;
  }
  if (
    (key === "weight" || key === "distance") &&
    Number(value.trim().replace(",", ".").split(".")[1]?.length ?? 0) > 2
  ) {
    return null;
  }
  if (key === "sets" && parsed < 1) return null;
  return parsed;
}

type SettingField = {
  key: keyof ExerciseSettings;
  label: string;
  step: string;
};

const trackingSettingFields: Record<TrackingType, SettingField[]> = {
  weight_reps: [
    { key: "weight", label: "Ciężar (kg)", step: "0.5" },
    { key: "reps", label: "Powtórzenia", step: "1" },
  ],
  bodyweight: [{ key: "reps", label: "Powtórzenia", step: "1" }],
  bodyweight_load: [
    { key: "weight", label: "Dodatkowy ciężar (kg)", step: "0.5" },
    { key: "reps", label: "Powtórzenia", step: "1" },
  ],
  assisted: [
    { key: "weight", label: "Wspomaganie (kg)", step: "0.5" },
    { key: "reps", label: "Powtórzenia", step: "1" },
  ],
  time: [{ key: "durationSeconds", label: "Czas (sek.)", step: "5" }],
  distance_time: [
    { key: "distance", label: "Dystans (km)", step: "0.1" },
    { key: "durationSeconds", label: "Czas (sek.)", step: "5" },
  ],
  reps: [{ key: "reps", label: "Powtórzenia", step: "1" }],
};

function getTrackingSettingFields(exerciseType: string) {
  const type = trackingTypes.find((item) => item.value === exerciseType);
  return trackingSettingFields[type?.value ?? "weight_reps"];
}

function ThemeIcon({ icon, className }: { icon: string; className?: string }) {
  if (icon === "bolt") return <BoltIcon className={className} />;
  if (icon === "target") return <TargetIcon className={className} />;
  if (icon === "flame") return <FlameIcon className={className} />;
  if (icon === "trophy") return <TrophyIcon className={className} />;
  return <DumbbellIcon className={className} />;
}

export default function AddWorkoutModal({ template, onClose, onSave }: Props) {
  const router = useRouter();
  const nextSlotId = useRef(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(template?.name ?? "");
  const [color, setColor] = useState(
    template?.color ?? templateThemes[0].color,
  );
  const [icon, setIcon] = useState(template?.icon ?? templateThemes[0].icon);
  const makeSlot = (
    exercise: Exercise,
    settings = defaultSettings(exercise.exerciseType),
  ): EditableExercise => ({
    ...normalizeExercise(exercise),
    settings,
    slotKey: `new-${exercise.id}-${nextSlotId.current++}`,
  });
  const [exercises, setExercises] = useState<EditableExercise[]>(
    () =>
      template?.exercises.map((exercise, index) => ({
        ...exercise,
        slotKey: `existing-${exercise.id}-${index}`,
      })) ?? [],
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [searchLoading, setSearchLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [customExerciseOpen, setCustomExerciseOpen] = useState(false);
  const [customMuscleGroup, setCustomMuscleGroup] = useState<string>(
    muscleGroups[0],
  );
  const [customEquipment, setCustomEquipment] = useState<string>(
    equipmentOptions[0],
  );
  const [customTrackingType, setCustomTrackingType] =
    useState<TrackingType>("weight_reps");
  const [customDescription, setCustomDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !creatingExercise) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving, creatingExercise]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const res = await fetch(
          `${API_URL}/exercises?q=${encodeURIComponent(query.trim())}`,
          { credentials: "include", signal: controller.signal },
        );
        if (res.status === 401) {
          router.replace("/login?session=expired");
          throw new Error("Sesja wygasła.");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: unknown = await res.json();
        const list: unknown[] = Array.isArray(data)
          ? data
          : typeof data === "object" &&
              data !== null &&
              "exercises" in data &&
              Array.isArray(data.exercises)
            ? data.exercises
            : [];
        setResults(
          list
            .filter(isExercise)
            .map((exercise) => normalizeExercise(exercise)),
        );
      } catch {
        if (!controller.signal.aborted) {
          setSearchError("Nie udało się wczytać ćwiczeń z bazy.");
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, router]);

  const addExercise = (exercise: Exercise) => {
    setExercises((current) => [...current, makeSlot(exercise)]);
    setError(null);
  };

  const createCustomExercise = async () => {
    const exerciseName = query.trim();
    if (!exerciseName) return;

    setCreatingExercise(true);
    setSearchError(null);
    try {
      const res = await fetch(`${API_URL}/exercises`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: exerciseName,
          description: customDescription.trim() || undefined,
          exerciseType: customTrackingType,
          equipment: customEquipment,
          muscleGroup: customMuscleGroup,
        }),
      });
      if (res.status === 401) {
        router.replace("/login?session=expired");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (!isExercise(data)) throw new Error("Nieprawidłowa odpowiedź API.");
      addExercise(normalizeExercise(data));
      setQuery("");
      setResults([]);
      setCustomExerciseOpen(false);
      setCustomDescription("");
    } catch {
      setSearchError(
        "Nie udało się dodać własnego ćwiczenia. Spróbuj ponownie.",
      );
    } finally {
      setCreatingExercise(false);
    }
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    setExercises((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [
        reordered[destination],
        reordered[index],
      ];
      return reordered;
    });
  };

  const duplicateExercise = (index: number) => {
    setExercises((current) => {
      const source = current[index];
      if (!source) return current;
      const duplicated = makeSlot(source, { ...source.settings });
      return [
        ...current.slice(0, index + 1),
        duplicated,
        ...current.slice(index + 1),
      ];
    });
  };

  const updateSetting = (
    index: number,
    key: keyof ExerciseSettings,
    value: number | null,
  ) => {
    setExercises((current) =>
      current.map((exercise, exerciseIndex) =>
        exerciseIndex === index
          ? {
              ...exercise,
              settings: { ...exercise.settings, [key]: value },
            }
          : exercise,
      ),
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Podaj nazwę szablonu.");
      setStep(1);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          name: name.trim(),
          dayOfWeek: template?.dayOfWeek ?? null,
          color,
          icon,
          exercises: exercises.map(({ id, settings }) => ({
            exerciseId: id,
            ...(settings.sets === null ? {} : { sets: settings.sets }),
            ...(settings.reps === null ? {} : { reps: settings.reps }),
            ...(settings.weight === null ? {} : { weight: settings.weight }),
            ...(settings.durationSeconds === null
              ? {}
              : { durationSeconds: settings.durationSeconds }),
            ...(settings.restSeconds === null
              ? {}
              : { restSeconds: settings.restSeconds }),
            ...(settings.distance === null
              ? {}
              : { distance: settings.distance }),
          })),
        },
        template?.id,
      );
    } catch {
      setError("Nie udało się zapisać szablonu. Spróbuj ponownie.");
    } finally {
      setSaving(false);
    }
  };

  const exactResult = results.find(
    (exercise) =>
      exercise.name.toLocaleLowerCase() === query.trim().toLocaleLowerCase(),
  );
  const canCreateCustom = query.trim().length > 0 && !exactResult;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving &&
          !creatingExercise
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-neutral-950 text-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-lime-400 uppercase">
              Krok {step} z 2
            </p>
            <h2 className="truncate text-lg font-bold">
              {step === 1
                ? template
                  ? "Edytuj szablon"
                  : "Nowy szablon treningu"
                : name || "Szablon"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || creatingExercise}
            className="cursor-pointer rounded-xl p-2 text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-50"
            aria-label="Zamknij"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="h-1 w-full bg-white/5">
          <div
            className="h-full bg-lime-400 transition-all duration-300"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          {step === 1 ? (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-neutral-300">
                Nazwa szablonu
                <input
                  autoFocus
                  value={name}
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setStep(2);
                  }}
                  placeholder="np. Poniedziałek – klatka i triceps"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/20 focus:outline-none"
                />
              </label>
              <div className="grid gap-4 rounded-2xl border border-white/[0.07] bg-neutral-900/50 p-4 sm:grid-cols-2">
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-neutral-300">
                    Kolor szablonu
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {templateThemes.map((theme) => (
                      <button
                        key={theme.color}
                        type="button"
                        onClick={() => setColor(theme.color)}
                        aria-label={`Kolor ${theme.label}`}
                        aria-pressed={color === theme.color}
                        title={theme.label}
                        className={`h-9 w-9 cursor-pointer rounded-xl border-2 transition ${
                          color === theme.color
                            ? "scale-105 border-white"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: theme.color }}
                      />
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-neutral-300">
                    Ikona
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {templateThemes.map((theme) => (
                      <button
                        key={theme.icon}
                        type="button"
                        onClick={() => setIcon(theme.icon)}
                        aria-label={`Ikona ${theme.label}`}
                        aria-pressed={icon === theme.icon}
                        title={theme.label}
                        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition ${
                          icon === theme.icon
                            ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                            : "border-white/10 text-neutral-500 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        <ThemeIcon icon={theme.icon} className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="rounded-2xl border border-lime-400/15 bg-lime-400/[0.04] p-4">
                <p className="text-sm font-semibold text-lime-200">
                  Jeden szablon, wiele dni
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  Dni treningowe ustawisz w planie tygodnia. Ten sam szablon
                  możesz przypisać na przykład do poniedziałku i piątku.
                </p>
              </div>
              <p className="text-xs text-neutral-500">
                W kolejnym kroku wybierzesz ćwiczenia i ustawisz ich kolejność.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <label
                  htmlFor="exercise-search"
                  className="mb-2 block text-sm font-medium text-neutral-300"
                >
                  Dodaj ćwiczenie
                </label>
                <input
                  id="exercise-search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setResults([]);
                    setSearchLoading(true);
                    setSearchError(null);
                  }}
                  placeholder="Szukaj w bazie ćwiczeń…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/20 focus:outline-none"
                />
                <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/70">
                  {searchLoading ? (
                    <p className="px-4 py-3 text-sm text-neutral-500">
                      Wyszukiwanie ćwiczeń…
                    </p>
                  ) : searchError ? (
                    <div
                      className="px-4 py-3 text-sm text-red-300"
                      role="alert"
                    >
                      {searchError}
                    </div>
                  ) : results.length > 0 ? (
                    <ul className="max-h-56 overflow-y-auto py-1">
                      {results.map((exercise) => {
                        const added = exercises.some(
                          (item) => item.id === exercise.id,
                        );
                        return (
                          <li key={exercise.id}>
                            <button
                              type="button"
                              disabled={added}
                              onClick={() => addExercise(exercise)}
                              className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-neutral-200 transition hover:bg-lime-400/10 disabled:cursor-default disabled:text-neutral-500"
                            >
                              <span className="truncate">{exercise.name}</span>
                              <span className="shrink-0 text-right text-xs text-neutral-500">
                                {added ? (
                                  "Dodano"
                                ) : (
                                  <>
                                    <span className="block">
                                      {exercise.muscleGroup ??
                                        "Partia nieustawiona"}
                                    </span>
                                    <span className="block text-neutral-600">
                                      {trackingLabel(exercise.exerciseType)}
                                    </span>
                                  </>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : query.trim() ? (
                    <p className="px-4 py-3 text-sm text-neutral-500">
                      Brak wyników dla „{query.trim()}”.
                    </p>
                  ) : (
                    <p className="px-4 py-3 text-sm text-neutral-500">
                      Wpisz nazwę, aby wyszukać ćwiczenia.
                    </p>
                  )}
                  {canCreateCustom && !searchLoading && !customExerciseOpen && (
                    <button
                      type="button"
                      onClick={() => setCustomExerciseOpen(true)}
                      className="flex w-full cursor-pointer items-center gap-2 border-t border-white/10 px-4 py-3 text-left text-sm font-semibold text-lime-400 transition hover:bg-lime-400/10"
                    >
                      <PlusIcon className="h-4 w-4" />
                      Utwórz własne ćwiczenie „{query.trim()}”
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Własne ćwiczenie zostanie zapisane na Twoim koncie.
                </p>
                {customExerciseOpen && (
                  <div className="mt-3 space-y-3 rounded-2xl border border-lime-400/20 bg-lime-400/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Nowe ćwiczenie
                        </p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {query.trim()} · zapisze się tylko na Twoim koncie
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomExerciseOpen(false)}
                        className="rounded-lg px-2 py-1 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-white"
                      >
                        Anuluj
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-neutral-300">
                        Partia mięśniowa
                        <select
                          value={customMuscleGroup}
                          onChange={(event) =>
                            setCustomMuscleGroup(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-lime-400/60 focus:outline-none"
                        >
                          {muscleGroups.map((group) => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-neutral-300">
                        Sprzęt
                        <select
                          value={customEquipment}
                          onChange={(event) =>
                            setCustomEquipment(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-lime-400/60 focus:outline-none"
                        >
                          {equipmentOptions.map((equipment) => (
                            <option key={equipment} value={equipment}>
                              {equipment}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block text-xs font-medium text-neutral-300">
                      Sposób mierzenia
                      <select
                        value={customTrackingType}
                        onChange={(event) => {
                          if (isTrackingType(event.target.value)) {
                            setCustomTrackingType(event.target.value);
                          }
                        }}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-lime-400/60 focus:outline-none"
                      >
                        {trackingTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div
                      aria-live="polite"
                      className="rounded-xl border border-white/[0.07] bg-neutral-950/60 p-3"
                    >
                      <p className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                        Pola wyniku w treningu
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {trackingMetrics[customTrackingType].map((metric) => (
                          <span
                            key={metric}
                            className="rounded-lg border border-lime-400/15 bg-lime-400/[0.06] px-2.5 py-1 text-xs font-medium text-lime-200"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    </div>
                    <label className="block text-xs font-medium text-neutral-300">
                      Opis{" "}
                      <span className="text-neutral-500">(opcjonalnie)</span>
                      <textarea
                        value={customDescription}
                        maxLength={1000}
                        onChange={(event) =>
                          setCustomDescription(event.target.value)
                        }
                        rows={2}
                        className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-lime-400/60 focus:outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void createCustomExercise()}
                      disabled={creatingExercise}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-60"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {creatingExercise
                        ? "Zapisywanie…"
                        : "Zapisz i dodaj ćwiczenie"}
                    </button>
                  </div>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-300">
                    Ćwiczenia w szablonie
                  </h3>
                  <span className="text-xs text-neutral-500">
                    {exercises.length}{" "}
                    {exercises.length === 1 ? "ćwiczenie" : "ćwiczeń"}
                  </span>
                </div>
                {exercises.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-neutral-900/40 px-4 py-8 text-center">
                    <p className="text-sm text-neutral-400">
                      Nie dodano jeszcze żadnego ćwiczenia.
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-3">
                    {exercises.map((exercise, index) => {
                      const fields: SettingField[] = [
                        { key: "sets", label: "Serie", step: "1" },
                        ...getTrackingSettingFields(exercise.exerciseType),
                        {
                          key: "restSeconds",
                          label: "Przerwa (sek.)",
                          step: "15",
                        },
                      ];
                      return (
                        <li
                          key={exercise.slotKey}
                          className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4 transition hover:border-white/15"
                        >
                          <div className="mb-4 flex items-start gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-xs font-bold text-lime-300">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-white">
                                {exercise.name}
                              </p>
                              <p className="mt-1 truncate text-xs text-neutral-500">
                                {exercise.muscleGroup ?? "Partia nieustawiona"}
                                {" · "}
                                {trackingLabel(exercise.exerciseType)}
                                {exercise.equipment
                                  ? ` · ${exercise.equipment}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => moveExercise(index, -1)}
                                disabled={index === 0}
                                aria-label={`Przenieś ${exercise.name} wyżej`}
                                className="cursor-pointer rounded-lg px-2 py-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:cursor-default disabled:opacity-30"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveExercise(index, 1)}
                                disabled={index === exercises.length - 1}
                                aria-label={`Przenieś ${exercise.name} niżej`}
                                className="cursor-pointer rounded-lg px-2 py-1.5 text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:cursor-default disabled:opacity-30"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => duplicateExercise(index)}
                                aria-label={`Skopiuj ${exercise.name}`}
                                title="Skopiuj ćwiczenie"
                                className="cursor-pointer rounded-lg p-2 text-neutral-500 transition hover:bg-lime-400/10 hover:text-lime-300"
                              >
                                <CopyIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExercises((current) =>
                                    current.filter(
                                      (_, itemIndex) => itemIndex !== index,
                                    ),
                                  )
                                }
                                aria-label={`Usuń ${exercise.name} z szablonu`}
                                className="cursor-pointer rounded-lg p-2 text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {fields.map((field) => (
                              <label
                                key={`${exercise.slotKey}-${field.key}`}
                                className="block text-[11px] font-medium text-neutral-500"
                              >
                                {field.label}
                                <input
                                  type="number"
                                  min={field.key === "sets" ? 1 : 0}
                                  step={field.step}
                                  value={exercise.settings[field.key] ?? ""}
                                  onChange={(event) =>
                                    updateSetting(
                                      index,
                                      field.key,
                                      parseSettingValue(
                                        field.key,
                                        event.target.value,
                                      ),
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-white/[0.08] bg-neutral-950/80 px-2.5 py-2 text-sm text-white focus:border-lime-400/50 focus:outline-none"
                                />
                              </label>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-neutral-950/80 px-5 py-4">
          {step === 1 ? (
            <>
              <span />
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    setError("Podaj nazwę szablonu.");
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                className="cursor-pointer rounded-xl bg-lime-400 px-5 py-2.5 font-semibold text-neutral-950 transition hover:bg-lime-300 focus:ring-4 focus:ring-lime-400/30 focus:outline-none"
              >
                Dalej
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="cursor-pointer rounded-xl px-4 py-2.5 font-medium text-neutral-400 transition hover:bg-white/5 hover:text-white"
              >
                Wstecz
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="cursor-pointer rounded-xl bg-lime-400 px-5 py-2.5 font-semibold text-neutral-950 transition hover:bg-lime-300 focus:ring-4 focus:ring-lime-400/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Zapisywanie…"
                  : template
                    ? "Zapisz zmiany"
                    : "Zapisz szablon"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
