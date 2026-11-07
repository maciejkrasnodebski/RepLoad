"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  WorkoutSeries,
  WorkoutSession,
  WorkoutSessionExercise,
} from "./types";
import { isWorkoutSession } from "./types";
import { API_URL } from "@/lib/api";

type Props = {
  session: WorkoutSession;
  onSessionChange: (session: WorkoutSession | null) => void;
  onClose: () => void;
};

type SeriesField =
  | "reps"
  | "weight"
  | "durationSeconds"
  | "distance"
  | "restSeconds";

type ExerciseResult = {
  id: string;
  name: string;
  exerciseType: string;
};

const trackingLabels: Record<string, string> = {
  weight_reps: "Ciężar + powtórzenia",
  bodyweight: "Masa ciała",
  bodyweight_load: "Dodatkowy ciężar",
  assisted: "Wspomaganie",
  time: "Czas",
  distance_time: "Dystans + czas",
  reps: "Powtórzenia",
};

function readDecimal(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (hours > 0 ? [hours, minutes, seconds] : [minutes, seconds])
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function ElapsedClock({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
      );
    update();
    const timer = window.setInterval(update, 500);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
    };
  }, [startedAt]);
  return <>{formatDuration(elapsed)}</>;
}

function RestClock({
  endsAt,
  pausedRemaining,
  onAdjust,
  onPause,
  onResume,
  onSkip,
}: {
  endsAt: number | null;
  pausedRemaining: number | null;
  onAdjust: (seconds: number) => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
}) {
  const [remaining, setRemaining] = useState(0);
  const expired = useRef(false);
  useEffect(() => {
    if (pausedRemaining === null && endsAt === null) return;
    const update = () => {
      const next =
        pausedRemaining ??
        Math.max(0, Math.ceil(((endsAt ?? Date.now()) - Date.now()) / 1000));
      setRemaining(next);
      if (pausedRemaining === null && next === 0 && !expired.current) {
        expired.current = true;
        if ("vibrate" in navigator) navigator.vibrate?.(150);
        onSkip();
      }
    };
    const timer = window.setInterval(update, 250);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
    };
  }, [endsAt, onSkip, pausedRemaining]);

  if (endsAt === null && pausedRemaining === null) return null;
  return (
    <section
      aria-label="Licznik przerwy"
      className="rounded-2xl bg-lime-400 p-4 text-neutral-950 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-extrabold tracking-[0.16em] uppercase">
          Przerwa
        </p>
        <span className="tabular-nums text-5xl font-extrabold tracking-tight sm:text-6xl">
          {formatDuration(remaining)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[-15, 15, 30].map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => onAdjust(seconds)}
            className="min-h-12 rounded-lg bg-black/10 text-sm font-bold transition hover:bg-black/15 active:scale-[0.98]"
          >
            {seconds < 0 ? "−" : "+"}
            {Math.abs(seconds)} s
          </button>
        ))}
        <button
          type="button"
          onClick={pausedRemaining === null ? onPause : onResume}
          className="min-h-12 rounded-lg bg-black/10 text-xs font-bold"
        >
          {pausedRemaining === null ? "Pauza" : "Wznów"}
        </button>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="mt-2 min-h-12 w-full rounded-lg bg-black/10 text-sm font-bold"
      >
        Pomiń przerwę
      </button>
    </section>
  );
}

function trackingFields(type: string | null): SeriesField[] {
  switch (type) {
    case "bodyweight":
    case "reps":
      return ["reps"];
    case "bodyweight_load":
    case "assisted":
      return ["weight", "reps"];
    case "time":
      return ["durationSeconds"];
    case "distance_time":
      return ["distance", "durationSeconds"];
    default:
      return ["weight", "reps"];
  }
}

function fieldLabel(field: SeriesField) {
  switch (field) {
    case "weight":
      return "kg";
    case "reps":
      return "powt.";
    case "durationSeconds":
      return "sek.";
    case "distance":
      return "km";
    case "restSeconds":
      return "przerwa (s)";
  }
}

function defaultSeries(type: string | null, order: number) {
  return {
    order,
    reps: type === "time" || type === "distance_time" ? null : 8,
    weight: null,
    durationSeconds: type === "time" ? 60 : type === "distance_time" ? 600 : null,
    distance: type === "distance_time" ? 1 : null,
    restSeconds: 90,
    isDone: false,
  };
}

export default function ActiveWorkout({
  session,
  onSessionChange,
  onClose,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseResult[]>([]);
  const [previous, setPrevious] = useState<Record<string, string>>({});
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [pausedRestRemaining, setPausedRestRemaining] = useState<number | null>(
    null,
  );
  const [restHydrated, setRestHydrated] = useState(false);
  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);
  const [finishedWorkout, setFinishedWorkout] = useState<WorkoutSession | null>(
    null,
  );

  useEffect(() => {
    const key = `repload:active-rest:${session.id}`;
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "endsAt" in parsed &&
            (parsed.endsAt === null ||
              (typeof parsed.endsAt === "number" &&
                Number.isFinite(parsed.endsAt))) &&
            "pausedRemaining" in parsed &&
            (parsed.pausedRemaining === null ||
              (typeof parsed.pausedRemaining === "number" &&
                Number.isFinite(parsed.pausedRemaining)))
          ) {
            setRestUntil(parsed.endsAt);
            setPausedRestRemaining(parsed.pausedRemaining);
          }
        }
      } catch (storageError) {
        console.error("Nie udało się odzyskać timera przerwy:", storageError);
      } finally {
        setRestHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session.id]);

  useEffect(() => {
    if (!restHydrated) return;
    const key = `repload:active-rest:${session.id}`;
    try {
      if (restUntil === null && pausedRestRemaining === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(
          key,
          JSON.stringify({ endsAt: restUntil, pausedRemaining: pausedRestRemaining }),
        );
      }
    } catch (storageError) {
      console.error("Nie udało się zapisać timera przerwy:", storageError);
    }
  }, [pausedRestRemaining, restHydrated, restUntil, session.id]);

  const clearRest = useCallback(() => {
    setRestUntil(null);
    setPausedRestRemaining(null);
  }, []);

  const startRest = useCallback((seconds: number) => {
    setRestUntil(Date.now() + Math.max(1, seconds) * 1000);
    setPausedRestRemaining(null);
  }, []);

  const adjustRest = useCallback((seconds: number) => {
    setPausedRestRemaining((paused) => {
      if (paused !== null) return Math.max(0, paused + seconds);
      setRestUntil((endsAt) =>
        endsAt === null
          ? null
          : Date.now() + Math.max(0, endsAt - Date.now() + seconds * 1000),
      );
      return null;
    });
  }, []);

  const pauseRest = useCallback(() => {
    setRestUntil((endsAt) => {
      setPausedRestRemaining(
        endsAt === null ? null : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
      );
      return null;
    });
  }, []);

  const resumeRest = useCallback(() => {
    setPausedRestRemaining((remaining) => {
      if (remaining !== null) setRestUntil(Date.now() + remaining * 1000);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let active = true;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || lock) return;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (!active) {
          await acquired.release();
          return;
        }
        lock = acquired;
      } catch {
        if (active) lock = null;
      }
    };
    const release = () => {
      if (lock) void lock.release();
      lock = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
      else release();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      if (!exerciseQuery.trim()) {
        setExerciseResults([]);
        return;
      }
      try {
        const response = await fetch(
          `${API_URL}/exercises?q=${encodeURIComponent(exerciseQuery.trim())}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        const items: unknown[] = Array.isArray(data)
          ? data
          : typeof data === "object" &&
              data !== null &&
              "exercises" in data &&
              Array.isArray(data.exercises)
            ? data.exercises
            : [];
        setExerciseResults(
          items.filter(
            (item): item is ExerciseResult =>
              typeof item === "object" &&
              item !== null &&
              "id" in item &&
              typeof item.id === "string" &&
              "name" in item &&
              typeof item.name === "string" &&
              "exerciseType" in item &&
              typeof item.exerciseType === "string",
          ),
        );
      } catch (loadError) {
        if (!controller.signal.aborted) {
          console.error("Nie udało się wyszukać ćwiczeń:", loadError);
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [exerciseQuery]);

  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    if (response.status === 401) {
      router.replace("/login?session=expired");
      throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  };

  const refreshSession = async () => {
    const response = await request("/workouts/current");
    const data: unknown = await response.json();
    if (data === null) {
      onSessionChange(null);
      return;
    }
    if (!isWorkoutSession(data)) {
      throw new Error("Nieprawidłowy format aktywnego treningu.");
    }
    onSessionChange(data);
  };

  const saveSeries = async (
    seriesId: string,
    field: SeriesField | "isDone",
    value: number | boolean | null,
  ): Promise<boolean> => {
    setError(null);
    try {
      await request(
        `/workouts/${encodeURIComponent(session.id)}/series/${seriesId}`,
        { method: "PATCH", body: JSON.stringify({ [field]: value }) },
      );
      await refreshSession();
      if (field === "isDone" && typeof value === "boolean") {
        if (value) {
          const series = session.exercises
            .flatMap((exercise) => exercise.series)
            .find((item) => item.id === seriesId);
          startRest(series?.restSeconds ?? 90);
          if ("vibrate" in navigator) navigator.vibrate?.(35);
        } else {
          clearRest();
        }
      }
      return true;
    } catch (saveError) {
      console.error("Nie udało się zapisać serii:", saveError);
      setError("Nie udało się zapisać zmian. Sprawdź połączenie i spróbuj ponownie.");
      return false;
    }
  };

  const addExercise = async (exercise?: ExerciseResult) => {
    const name = exercise?.name ?? exerciseName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/workouts/${encodeURIComponent(session.id)}/exercises`, {
        method: "POST",
        body: JSON.stringify(
          exercise ? { exerciseId: exercise.id } : { name },
        ),
      });
      setExerciseName("");
      setExerciseQuery("");
      setExerciseResults([]);
      await refreshSession();
    } catch (addError) {
      console.error("Nie udało się dodać ćwiczenia:", addError);
      setError("Nie udało się dodać ćwiczenia.");
    } finally {
      setBusy(false);
    }
  };

  const removeExercise = async (exercise: WorkoutSessionExercise) => {
    if (!window.confirm(`Usunąć ćwiczenie „${exercise.name}” z treningu?`)) {
      return;
    }
    try {
      await request(
        `/workouts/${encodeURIComponent(session.id)}/exercises/${exercise.id}`,
        { method: "DELETE" },
      );
      await refreshSession();
    } catch (removeError) {
      console.error("Nie udało się usunąć ćwiczenia:", removeError);
      setError("Nie udało się usunąć ćwiczenia.");
    }
  };

  const addSeries = async (exercise: WorkoutSessionExercise) => {
    const last = exercise.series[exercise.series.length - 1];
    const values = last
      ? {
          reps: last.reps,
          weight: readDecimal(last.weight ?? ""),
          durationSeconds: last.durationSeconds,
          distance: readDecimal(last.distance ?? ""),
          restSeconds: last.restSeconds,
        }
      : defaultSeries(exercise.exerciseType, exercise.series.length);
    try {
      await request(
        `/workouts/${encodeURIComponent(session.id)}/exercises/${exercise.id}/series`,
        {
          method: "POST",
          body: JSON.stringify({ ...values, order: exercise.series.length }),
        },
      );
      await refreshSession();
    } catch (addError) {
      console.error("Nie udało się dodać serii:", addError);
      setError("Nie udało się dodać serii.");
    }
  };

  const removeSeries = async (series: WorkoutSeries) => {
    try {
      await request(
        `/workouts/${encodeURIComponent(session.id)}/series/${series.id}`,
        { method: "DELETE" },
      );
      await refreshSession();
    } catch (removeError) {
      console.error("Nie udało się usunąć serii:", removeError);
      setError("Nie udało się usunąć serii.");
    }
  };

  const moveExercise = async (
    exercise: WorkoutSessionExercise,
    direction: -1 | 1,
  ) => {
    const ordered = [...session.exercises].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
    const index = ordered.findIndex((item) => item.id === exercise.id);
    const other = ordered[index + direction];
    if (!other) return;
    try {
      await Promise.all([
        request(
          `/workouts/${encodeURIComponent(session.id)}/exercises/${exercise.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ order: other.order }),
          },
        ),
        request(
          `/workouts/${encodeURIComponent(session.id)}/exercises/${other.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ order: exercise.order }),
          },
        ),
      ]);
      await refreshSession();
    } catch (moveError) {
      console.error("Nie udało się zmienić kolejności ćwiczeń:", moveError);
      setError("Nie udało się zmienić kolejności ćwiczeń.");
    }
  };

  const togglePrevious = async (exerciseId: string) => {
    if (previous[exerciseId] !== undefined) {
      setPrevious((items) => {
        const next = { ...items };
        delete next[exerciseId];
        return next;
      });
      return;
    }
    try {
      const response = await request(
        `/workouts/exercises/${encodeURIComponent(exerciseId)}/previous`,
      );
      const data = (await response.json()) as {
        sessions?: Array<{
          startedAt: string;
          series: WorkoutSeries[];
        }>;
      };
      const latest = data.sessions?.[0];
      setPrevious((items) => ({
        ...items,
        [exerciseId]: latest
          ? `${new Date(latest.startedAt).toLocaleDateString("pl-PL")}: ${latest.series
              .map((series) =>
                [series.weight && `${series.weight} kg`, series.reps && `${series.reps} powt.`]
                  .filter(Boolean)
                  .join(" × "),
              )
              .filter(Boolean)
              .join(", ") || "bez zapisanych parametrów"}`
          : "Brak wcześniejszych wyników",
      }));
    } catch (previousError) {
      console.error("Nie udało się pobrać poprzedniego wyniku:", previousError);
      setPrevious((items) => ({
        ...items,
        [exerciseId]: "Nie udało się pobrać poprzedniego wyniku",
      }));
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await request(
        `/workouts/${encodeURIComponent(session.id)}/finish`,
        {
        method: "POST",
        },
      );
      const completed: unknown = await response.json();
      if (!isWorkoutSession(completed)) {
        throw new Error("Nieprawidłowa odpowiedź po zakończeniu treningu.");
      }
      setFinishedWorkout(completed);
      onSessionChange(completed);
      clearRest();
      window.dispatchEvent(new Event("workout-history-updated"));
    } catch (finishError) {
      console.error("Nie udało się zakończyć treningu:", finishError);
      setError("Nie udało się zapisać treningu. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm("Anulować trening? Zapisane serie pozostaną w historii jako anulowane.")) {
      return;
    }
    setBusy(true);
    try {
      await request(`/workouts/${encodeURIComponent(session.id)}/cancel`, {
        method: "POST",
      });
      clearRest();
      onSessionChange(null);
      onClose();
      window.dispatchEvent(new Event("workout-history-updated"));
    } catch (cancelError) {
      console.error("Nie udało się anulować treningu:", cancelError);
      setError("Nie udało się anulować treningu.");
    } finally {
      setBusy(false);
    }
  };

  const allSeries = session.exercises.flatMap((exercise) => exercise.series);
  const completedSeries = allSeries.filter((series) => series.isDone);
  const workoutVolume = completedSeries.reduce(
    (total, series) =>
      total + Number(series.weight ?? 0) * Number(series.reps ?? 0),
    0,
  );
  const completedExerciseCount = session.exercises.filter(
    (exercise) => exercise.series.length > 0 && exercise.series.every((item) => item.isDone),
  ).length;

  if (finishedWorkout) {
    const endTime = finishedWorkout.endedAt
      ? new Date(finishedWorkout.endedAt).getTime()
      : new Date(finishedWorkout.startedAt).getTime();
    const duration = Math.max(
      0,
      Math.floor((endTime - new Date(finishedWorkout.startedAt).getTime()) / 1000),
    );
    const savedSeries = finishedWorkout.exercises.flatMap((exercise) =>
      exercise.series.filter((series) => series.isDone),
    );
    const volume = savedSeries.reduce(
      (total, series) =>
        total + Number(series.weight ?? 0) * Number(series.reps ?? 0),
      0,
    );
    const closeSummary = () => {
      onSessionChange(null);
      onClose();
    };
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="workout-summary-heading"
          className="flex max-h-[100dvh] w-full max-w-xl flex-col overflow-y-auto rounded-t-3xl bg-[var(--app-bg)] p-5 text-white sm:max-h-[90dvh] sm:rounded-3xl sm:p-7"
        >
          <p className="text-xs font-bold tracking-[0.16em] text-lime-300 uppercase">
            TRENING ZAPISANY
          </p>
          <h2 id="workout-summary-heading" className="mt-2 text-2xl font-extrabold">
            Dobra robota!
          </h2>
          <p className="mt-1 text-[var(--text-secondary)]">
            {finishedWorkout.name ||
              finishedWorkout.templateName ||
              "Trening własny"}
          </p>
          <p className="tabular-nums mt-6 text-5xl font-extrabold">
            {formatDuration(duration)}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              ["Ćwiczenia", finishedWorkout.exercises.length],
              ["Wykonane serie", savedSeries.length],
              ["Objętość", `${volume.toFixed(1)} kg`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[var(--surface)] p-3">
                <p className="text-xs text-[var(--text-secondary)]">{label}</p>
                <p className="mt-1 font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex-1 space-y-2">
            {finishedWorkout.exercises.map((exercise) => {
              const best = exercise.series
                .filter((series) => series.isDone)
                .sort(
                  (a, b) =>
                    Number(b.weight ?? 0) * Number(b.reps ?? 0) -
                    Number(a.weight ?? 0) * Number(a.reps ?? 0),
                )[0];
              return (
                <div
                  key={exercise.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface)] px-4 py-3"
                >
                  <span className="truncate text-sm font-semibold">
                    {exercise.name}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--text-secondary)]">
                    {best
                      ? [
                          best.weight !== null ? `${best.weight} kg` : null,
                          best.reps !== null ? `${best.reps} powt.` : null,
                          best.durationSeconds !== null
                            ? `${best.durationSeconds} s`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" × ")
                      : "bez wykonanych serii"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                closeSummary();
                window.setTimeout(
                  () =>
                    document
                      .getElementById("workout-history")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  0,
                );
              }}
              className="min-h-[52px] rounded-xl bg-[var(--surface-raised)] px-3 text-sm font-bold"
            >
              Zobacz historię
            </button>
            <button
              type="button"
              onClick={closeSummary}
              className="min-h-[52px] rounded-xl bg-lime-400 px-3 text-sm font-extrabold text-neutral-950"
            >
              Gotowe
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-workout-heading"
        className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-[var(--app-bg)] text-white shadow-2xl sm:h-auto sm:max-h-[94dvh] sm:rounded-3xl sm:border sm:border-white/10"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 sm:px-7 sm:pt-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-widest text-lime-300 uppercase">
              TRENING W TOKU
            </p>
            <h2 id="active-workout-heading" className="mt-1 truncate text-xl font-bold">
              {session.name || session.templateName || "Trening własny"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-white/5"
          >
            Minimalizuj
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:p-6">
          <div className="sticky top-0 z-10 rounded-2xl bg-[var(--app-bg)]/95 px-3 py-2 backdrop-blur sm:px-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                  Czas treningu
                </p>
                <p className="tabular-nums mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">
                  <ElapsedClock startedAt={session.startedAt} />
                </p>
              </div>
              <div className="pb-1 text-right text-xs text-[var(--text-secondary)]">
                <p>{completedSeries.length} / {allSeries.length} serii</p>
                <p className="mt-1">{completedExerciseCount} ukończonych ćwiczeń</p>
                {workoutVolume > 0 && <p className="mt-1">{workoutVolume.toFixed(1)} kg objętości</p>}
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-lime-400 transition-[width] duration-200"
                style={{
                  width: `${allSeries.length ? (completedSeries.length / allSeries.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <RestClock
            endsAt={restUntil}
            pausedRemaining={pausedRestRemaining}
            onAdjust={adjustRest}
            onPause={pauseRest}
            onResume={resumeRest}
            onSkip={clearRest}
          />
          {error && (
            <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          {session.exercises.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
              <p className="font-semibold">Zacznij od dodania ćwiczenia</p>
              <p className="mt-1 text-sm text-neutral-400">Wyszukaj w bazie albo wpisz własną nazwę.</p>
            </div>
          )}

          {[...session.exercises]
            .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
            .map((exercise, exerciseIndex) => {
              const fields: SeriesField[] = [
                ...trackingFields(exercise.exerciseType),
                "restSeconds",
              ];
              const linkedExerciseId = exercise.exerciseId;
              return (
                <article key={exercise.id} className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-lime-300">
                        {trackingLabels[exercise.exerciseType ?? ""] ?? "Ćwiczenie"} · ĆWICZENIE {exerciseIndex + 1}
                      </p>
                      <h3 className="mt-1 truncate text-lg font-bold">{exercise.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => void moveExercise(exercise, -1)} disabled={exerciseIndex === 0} aria-label="Przenieś ćwiczenie wyżej" className="rounded-lg border border-white/10 px-3 py-2 text-neutral-300 disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => void moveExercise(exercise, 1)} disabled={exerciseIndex === session.exercises.length - 1} aria-label="Przenieś ćwiczenie niżej" className="rounded-lg border border-white/10 px-3 py-2 text-neutral-300 disabled:opacity-30">↓</button>
                      <button type="button" onClick={() => void removeExercise(exercise)} aria-label={`Usuń ${exercise.name}`} className="rounded-lg border border-white/10 px-3 py-2 text-red-300">Usuń</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {exercise.series.map((series, seriesIndex) => (
                      <div data-series-row key={series.id} className={`grid grid-cols-[auto_repeat(3,minmax(0,1fr))_auto] items-end gap-2 rounded-xl p-2 ${series.isDone ? "bg-lime-400/10" : "bg-black/20"}`}>
                        <label className="flex h-11 items-center gap-2 px-1 text-xs text-neutral-400">
                          <input
                            type="checkbox"
                            checked={series.isDone}
                            onChange={(event) => {
                              const done = event.currentTarget.checked;
                              if (done) {
                                const missing = trackingFields(
                                  exercise.exerciseType,
                                ).some((field) => {
                                  const input = event.currentTarget
                                    .closest("[data-series-row]")
                                    ?.querySelector<HTMLInputElement>(
                                      `[data-series-field="${field}"]`,
                                    );
                                  const raw = input?.value.trim() ?? "";
                                  const parsed = readDecimal(raw);
                                  return (
                                    parsed === null ||
                                    ((field === "reps" ||
                                      field === "durationSeconds") &&
                                      (!Number.isInteger(parsed) || parsed < 1))
                                  );
                                });
                                if (missing) {
                                  setError(
                                    "Uzupełnij wymagane wyniki serii, zanim oznaczysz ją jako wykonaną.",
                                  );
                                  event.currentTarget.checked = false;
                                  return;
                                }
                              }
                              void saveSeries(series.id, "isDone", done);
                            }}
                            className="h-4 w-4 accent-lime-400"
                            aria-label={`Seria ${seriesIndex + 1} wykonana`}
                          />
                          {seriesIndex + 1}
                        </label>
                        {fields.map((field) => {
                          const currentValue = series[field];
                          return (
                            <label key={field} className="min-w-0 text-[10px] font-semibold text-neutral-500">
                              {fieldLabel(field)}
                              <input
                                type="text"
                                inputMode={field === "weight" || field === "distance" ? "decimal" : "numeric"}
                                data-series-field={field}
                                defaultValue={currentValue ?? ""}
                                key={`${series.id}-${field}-${currentValue ?? ""}`}
                                onBlur={(event) => {
                                  const raw = event.currentTarget.value;
                                  const normalized = raw.trim().replace(",", ".");
                                  const parsed = raw.trim() === "" ? null : readDecimal(raw);
                                  const value = field === "reps" || field === "durationSeconds" || field === "restSeconds"
                                    ? parsed !== null && Number.isInteger(parsed) ? parsed : null
                                    : parsed;
                                  if (
                                    value !== null &&
                                    (field === "reps" ||
                                      field === "durationSeconds") &&
                                    value < 1
                                  ) {
                                    setError(
                                      `${fieldLabel(field)} musi wynosić co najmniej 1.`,
                                    );
                                    return;
                                  }
                                  if (
                                    (field === "weight" || field === "distance") &&
                                    (normalized.split(".")[1]?.length ?? 0) > 2
                                  ) {
                                    setError("Ciężar i dystans mogą mieć maksymalnie dwa miejsca po przecinku.");
                                    return;
                                  }
                                  if (raw.trim() && value === null) {
                                    setError(`Wpisz poprawną wartość dla pola ${fieldLabel(field)}.`);
                                    return;
                                  }
                                  setError(null);
                                  void saveSeries(series.id, field, value);
                                }}
                                className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-neutral-950 px-2 text-sm font-semibold text-white focus:border-lime-400/50 focus:outline-none"
                              />
                            </label>
                          );
                        })}
                        <button type="button" onClick={() => void removeSeries(series)} aria-label={`Usuń serię ${seriesIndex + 1}`} className="h-10 rounded-lg px-2 text-neutral-500 hover:bg-red-400/10 hover:text-red-300">×</button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={() => void addSeries(exercise)} className="rounded-lg border border-lime-400/20 px-3 py-2 text-sm font-semibold text-lime-300 hover:bg-lime-400/10">
                      + Dodaj serię
                    </button>
                    {linkedExerciseId !== null && (
                      <button type="button" onClick={() => void togglePrevious(linkedExerciseId)} className="text-xs font-semibold text-neutral-400 underline decoration-white/20 underline-offset-4 hover:text-white">
                        Poprzedni wynik
                      </button>
                    )}
                  </div>
                  {linkedExerciseId !== null && previous[linkedExerciseId] && (
                    <p className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-xs text-neutral-300">
                      {previous[linkedExerciseId]}
                    </p>
                  )}
                </article>
              );
            })}

          <section id="add-workout-exercise" className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
            <h3 className="font-bold">Dodaj ćwiczenie</h3>
            <label className="mt-3 block text-xs font-semibold text-neutral-400">
              Szukaj w bazie
              <input value={exerciseQuery} onChange={(event) => setExerciseQuery(event.target.value)} placeholder="np. Wyciskanie sztangi" className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 text-sm text-white placeholder:text-neutral-600 focus:border-lime-400/50 focus:outline-none" />
            </label>
            {exerciseResults.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {exerciseResults.map((exercise) => (
                  <li key={exercise.id}>
                    <button type="button" disabled={busy} onClick={() => void addExercise(exercise)} className="flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5">
                      <span>{exercise.name}</span><span className="text-xs text-neutral-500">{trackingLabels[exercise.exerciseType] ?? exercise.exerciseType}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void addExercise();
              }}
            >
              <input value={exerciseName} onChange={(event) => setExerciseName(event.target.value)} placeholder="Własne ćwiczenie" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-neutral-950 px-3 text-sm text-white placeholder:text-neutral-600 focus:border-lime-400/50 focus:outline-none" />
              <button disabled={busy || !exerciseName.trim()} className="rounded-xl bg-lime-400 px-4 text-sm font-bold text-neutral-950 disabled:opacity-50">Dodaj</button>
            </form>
          </section>
        </div>

        <footer className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-t border-white/10 bg-neutral-950/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:px-6">
          <div className="min-w-12 text-center">
            <p className="tabular-nums text-sm font-bold">
              {completedSeries.length}/{allSeries.length}
            </p>
            <p className="text-[10px] text-neutral-500">serii</p>
          </div>
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("add-workout-exercise")
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
            className="min-h-[52px] rounded-xl bg-[var(--surface-raised)] px-3 text-sm font-bold text-white"
          >
            + Ćwiczenie
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setFinishConfirmationOpen(true)}
            className="min-h-[52px] rounded-xl bg-lime-400 px-4 text-sm font-extrabold text-neutral-950 disabled:opacity-50"
          >
            Zakończ
          </button>
        </footer>
      </section>
      {finishConfirmationOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-confirmation-heading"
            className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-5 shadow-2xl"
          >
            <h2 id="finish-confirmation-heading" className="text-lg font-bold">
              Zakończyć trening?
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Zapisano {completedSeries.length} z {allSeries.length} serii.
              {completedSeries.length < allSeries.length
                ? " Niewykonane serie nie będą zapisane jako wykonane."
                : ""}
            </p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setFinishConfirmationOpen(false);
                  void finish();
                }}
                className="min-h-[52px] rounded-xl bg-lime-400 px-4 font-extrabold text-neutral-950 disabled:opacity-50"
              >
                {busy ? "Zapisywanie…" : "Zakończ i zapisz"}
              </button>
              <button
                type="button"
                onClick={() => setFinishConfirmationOpen(false)}
                className="min-h-[48px] rounded-xl bg-[var(--surface-raised)] px-4 font-semibold"
              >
                Wróć do treningu
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setFinishConfirmationOpen(false);
                  void cancel();
                }}
                className="min-h-[48px] rounded-xl text-sm font-semibold text-rose-300"
              >
                Odrzuć trening
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
