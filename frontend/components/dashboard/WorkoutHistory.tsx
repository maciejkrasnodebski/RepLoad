"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon, TrashIcon } from "./icons";
import { isWorkoutSession, type WorkoutSession } from "./types";
import { API_URL } from "@/lib/api";

type Metric = "weight" | "reps" | "durationSeconds" | "distance";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours} godz. ${minutes} min`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function durationBetween(session: WorkoutSession) {
  if (!session.endedAt) return null;
  const seconds = Math.max(
    0,
    Math.floor(
      (new Date(session.endedAt).getTime() -
        new Date(session.startedAt).getTime()) /
        1000,
    ),
  );
  return seconds;
}

function exerciseMetrics(type: string | null, session: WorkoutSession["exercises"][number]): Metric[] {
  switch (type) {
    case "weight_reps":
      return ["weight", "reps"];
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
    default: {
      const available = new Set<Metric>();
      for (const series of session.series) {
        if (series.weight !== null) available.add("weight");
        if (series.reps !== null) available.add("reps");
        if (series.durationSeconds !== null) available.add("durationSeconds");
        if (series.distance !== null) available.add("distance");
      }
      const metrics: Metric[] = [
        "weight",
        "reps",
        "distance",
        "durationSeconds",
      ];
      return metrics.filter(
        (metric) => available.has(metric),
      );
    }
  }
}

function metricLabel(metric: Metric, exerciseType: string | null) {
  if (metric === "weight") {
    if (exerciseType === "assisted") return "Wspomaganie";
    if (exerciseType === "bodyweight_load") return "Dodatkowy ciężar";
    return "Ciężar";
  }
  if (metric === "reps") return "Powtórzenia";
  if (metric === "distance") return "Dystans";
  return "Czas";
}

function metricValue(
  metric: Metric,
  series: WorkoutSession["exercises"][number]["series"][number],
) {
  if (metric === "weight") {
    return series.weight === null ? "—" : `${series.weight} kg`;
  }
  if (metric === "reps") {
    return series.reps === null ? "—" : String(series.reps);
  }
  if (metric === "distance") {
    return series.distance === null ? "—" : `${series.distance} km`;
  }
  return series.durationSeconds === null
    ? "—"
    : formatDuration(series.durationSeconds);
}

function dateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function volumeFor(session: WorkoutSession) {
  return session.exercises.reduce((total, exercise) => {
    if (
      exercise.exerciseType !== "weight_reps" &&
      exercise.exerciseType !== "bodyweight_load"
    ) {
      return total;
    }
    return (
      total +
      exercise.series.reduce((exerciseTotal, series) => {
        if (!series.isDone || series.weight === null || series.reps === null) {
          return exerciseTotal;
        }
        return exerciseTotal + Number(series.weight) * series.reps;
      }, 0)
    );
  }, 0);
}

export default function WorkoutHistory() {
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<WorkoutSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const loadHistory = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/workouts/history?limit=30`, {
        credentials: "include",
        signal: controller.signal,
      });
      if (response.status === 401) {
        router.replace("/login?session=expired");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!Array.isArray(data) || !data.every(isWorkoutSession)) {
        throw new Error("Nieprawidłowy format historii treningów.");
      }
      setSessions(data);
    } catch (loadError) {
      if (controller.signal.aborted) return;
      console.error("Nie udało się pobrać historii treningów:", loadError);
      setError(
        "Nie udało się wczytać historii. Sprawdź połączenie i spróbuj ponownie.",
      );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [router]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadHistory(), 0);
    const refresh = () => void loadHistory();
    window.addEventListener("workout-history-updated", refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("workout-history-updated", refresh);
      requestRef.current?.abort();
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, [loadHistory]);

  useEffect(() => {
    if (openMenuId === null) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenuId]);

  const dialogOpen = selectedSession !== null || deleteTarget !== null;
  useEffect(() => {
    if (!dialogOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) {
        setSelectedSession(null);
        setDeleteTarget(null);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [dialogOpen, deleting]);

  const deleteHistoryEntry = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/workouts/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (response.status === 401) {
        router.replace("/login?session=expired");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setSessions((current) =>
        current.filter((session) => session.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      setNotice("Trening został usunięty z historii.");
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3500);
    } catch (deleteError) {
      console.error("Nie udało się usunąć treningu z historii:", deleteError);
      setError("Nie udało się usunąć treningu. Spróbuj ponownie.");
    } finally {
      setDeleting(false);
    }
  };

  const groupedSessions = sessions.reduce<
    Array<{ key: string; sessions: WorkoutSession[] }>
  >((groups, session) => {
    const key = dateKey(session.startedAt);
    const group = groups.find((item) => item.key === key);
    if (group) group.sessions.push(session);
    else groups.push({ key, sessions: [session] });
    return groups;
  }, []);

  return (
    <section
      id="workout-history"
      aria-labelledby="workout-history-heading"
      className="mt-12 scroll-mt-8"
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-lime-400 uppercase">
            TWOJE POSTĘPY
          </p>
          <h2
            id="workout-history-heading"
            className="text-2xl font-bold tracking-tight"
          >
            Historia treningów
          </h2>
        </div>
        {!loading && sessions.length > 0 && (
          <span className="text-sm text-neutral-500">
            {sessions.length} ostatnich
          </span>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-lime-300/20 bg-lime-300/[0.08] px-4 py-3 text-sm text-lime-200"
        >
          {notice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-red-400/20 bg-neutral-900/60 p-5 text-sm text-red-200"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="mt-3 min-h-10 rounded-lg border border-white/10 px-3 font-semibold text-neutral-200"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {loading && sessions.length === 0 ? (
        <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-neutral-900/60" />
      ) : sessions.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-900/40 px-6 py-10 text-center">
          <h3 className="font-bold">Tu pojawią się Twoje treningi</h3>
          <p className="mt-2 text-sm text-neutral-400">
            Zakończony trening zapisze ćwiczenia, serie i wyniki.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedSessions.map((group) => (
            <section key={group.key}>
              <h3 className="mb-2 px-1 text-xs font-bold tracking-wide text-neutral-500 uppercase">
                {new Date(group.sessions[0].startedAt).toLocaleDateString(
                  "pl-PL",
                  { weekday: "long", day: "numeric", month: "long" },
                )}
              </h3>
              <div className="space-y-2">
                {group.sessions.map((session) => {
                  const duration = durationBetween(session);
                  const completedSets = session.exercises.reduce(
                    (total, exercise) =>
                      total +
                      exercise.series.filter((series) => series.isDone).length,
                    0,
                  );
                  const volume = volumeFor(session);
                  return (
                    <article
                      key={session.id}
                      className="relative flex items-center gap-2 rounded-2xl bg-[var(--surface)] p-2"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedSession(session)}
                        aria-label={`Pokaż szczegóły treningu ${
                          session.name || session.templateName || "własnego"
                        }`}
                        className="flex min-h-[76px] min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-left transition hover:bg-white/[0.03] sm:p-4"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-white">
                            {session.name ||
                              session.templateName ||
                              "Trening własny"}
                          </span>
                          <span className="mt-1 block text-xs text-neutral-500">
                            {new Date(session.startedAt).toLocaleTimeString(
                              "pl-PL",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
                          <span>{session.exercises.length} ćw.</span>
                          <span>{completedSets} ser.</span>
                          {duration !== null && (
                            <span>{Math.floor(duration / 60)} min</span>
                          )}
                          {volume > 0 && (
                            <span>{Math.round(volume)} kg obj.</span>
                          )}
                          <span
                            className={
                              session.status === "COMPLETED"
                                ? "text-lime-300"
                                : "text-neutral-500"
                            }
                          >
                            {session.status === "COMPLETED"
                              ? "Ukończony"
                              : "Anulowany"}
                          </span>
                        </span>
                      </button>
                      <div ref={openMenuId === session.id ? menuRef : null}>
                        <button
                          type="button"
                          aria-label={`Menu treningu ${
                            session.name || session.templateName || "własnego"
                          }`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === session.id}
                          onClick={() =>
                            setOpenMenuId((current) =>
                              current === session.id ? null : session.id,
                            )
                          }
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          ⋮
                        </button>
                        {openMenuId === session.id && (
                          <div
                            role="menu"
                            className="absolute top-14 right-2 z-20 w-[min(14rem,calc(100vw-2.5rem))] rounded-xl border border-white/10 bg-neutral-900 p-1.5 shadow-2xl shadow-black/40"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeleteTarget(session);
                              }}
                              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-rose-300 transition hover:bg-rose-400/10"
                            >
                              <TrashIcon className="h-4 w-4" />
                              Usuń trening z historii
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedSession && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedSession(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-detail-title"
            className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[var(--surface)] shadow-2xl sm:max-h-[88dvh] sm:rounded-3xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:p-6">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-[0.16em] text-lime-300 uppercase">
                  {selectedSession.status === "COMPLETED"
                    ? "TRENING UKOŃCZONY"
                    : "TRENING ANULOWANY"}
                </p>
                <h2
                  id="workout-detail-title"
                  className="mt-2 truncate text-xl font-extrabold text-white sm:text-2xl"
                >
                  {selectedSession.name ||
                    selectedSession.templateName ||
                    "Trening własny"}
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  {new Date(selectedSession.startedAt).toLocaleDateString(
                    "pl-PL",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                  {" · "}
                  {new Date(selectedSession.startedAt).toLocaleTimeString(
                    "pl-PL",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                  {selectedSession.endedAt &&
                    ` – ${new Date(selectedSession.endedAt).toLocaleTimeString(
                      "pl-PL",
                      { hour: "2-digit", minute: "2-digit" },
                    )}`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Zamknij szczegóły treningu"
                onClick={() => setSelectedSession(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">
              {(() => {
                const duration = durationBetween(selectedSession);
                const setCount = selectedSession.exercises.reduce(
                  (total, exercise) =>
                    total +
                    exercise.series.filter((series) => series.isDone).length,
                  0,
                );
                const volume = volumeFor(selectedSession);
                return (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      {
                        label: "Czas",
                        value:
                          duration === null ? "—" : formatDuration(duration),
                      },
                      {
                        label: "Ćwiczenia",
                        value: String(selectedSession.exercises.length),
                      },
                      { label: "Wykonane serie", value: String(setCount) },
                      {
                        label: "Objętość",
                        value: volume > 0 ? `${Math.round(volume)} kg` : "—",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl bg-neutral-950/60 p-3"
                      >
                        <p className="text-[11px] text-neutral-500">
                          {item.label}
                        </p>
                        <p className="mt-1 font-bold tabular-nums text-white">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {selectedSession.exercises.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-neutral-400">
                  Ten trening nie ma zapisanych ćwiczeń.
                </p>
              ) : (
                selectedSession.exercises
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((exercise, exerciseIndex) => {
                    const metrics = exerciseMetrics(
                      exercise.exerciseType,
                      exercise,
                    );
                    return (
                      <article
                        key={exercise.id}
                        className="rounded-2xl border border-white/[0.07] bg-neutral-950/40 p-4"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-300/10 text-xs font-bold text-lime-300">
                            {String(exerciseIndex + 1).padStart(2, "0")}
                          </span>
                          <h3 className="min-w-0 truncate font-bold text-white">
                            {exercise.name}
                          </h3>
                        </div>
                        {exercise.series.length === 0 ? (
                          <p className="text-sm text-neutral-500">
                            Brak zapisanych serii.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[16rem] text-left text-sm">
                              <thead>
                                <tr className="border-b border-white/[0.07] text-[11px] text-neutral-500">
                                  <th className="py-2 pr-3 font-medium">
                                    Seria
                                  </th>
                                  {metrics.map((metric) => (
                                    <th
                                      key={metric}
                                      className="px-2 py-2 text-right font-medium"
                                    >
                                      {metricLabel(
                                        metric,
                                        exercise.exerciseType,
                                      )}
                                    </th>
                                  ))}
                                  <th className="py-2 pl-2 text-right font-medium">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {exercise.series
                                  .slice()
                                  .sort((a, b) => a.order - b.order)
                                  .map((series, seriesIndex) => (
                                    <tr
                                      key={series.id}
                                      className="border-b border-white/[0.04] last:border-0"
                                    >
                                      <td className="py-2.5 pr-3 font-semibold text-neutral-300">
                                        {seriesIndex + 1}
                                      </td>
                                      {metrics.map((metric) => (
                                        <td
                                          key={metric}
                                          className="px-2 py-2.5 text-right font-semibold tabular-nums text-white"
                                        >
                                          {metricValue(metric, series)}
                                        </td>
                                      ))}
                                      <td className="py-2.5 pl-2 text-right text-xs">
                                        {series.isDone ? (
                                          <span className="text-lime-300">
                                            Gotowa
                                          </span>
                                        ) : (
                                          <span className="text-neutral-500">
                                            Pominięta
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </article>
                    );
                  })
              )}
            </div>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteTarget(null);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-history-title"
            aria-describedby="delete-history-description"
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--surface)] p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-300">
              <TrashIcon className="h-5 w-5" />
            </div>
            <h2 id="delete-history-title" className="text-lg font-bold text-white">
              Czy na pewno chcesz usunąć ten trening z historii?
            </h2>
            <p
              id="delete-history-description"
              className="mt-2 text-sm leading-6 text-neutral-400"
            >
              Tej operacji nie można cofnąć. Usunięty trening zniknie z Twojej
              historii.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="min-h-12 rounded-xl border border-white/10 px-4 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteHistoryEntry()}
                className="min-h-12 rounded-xl bg-rose-500 px-4 text-sm font-extrabold text-white transition hover:bg-rose-400 disabled:cursor-wait disabled:opacity-60"
              >
                {deleting ? "Usuwanie…" : "Usuń trening"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
