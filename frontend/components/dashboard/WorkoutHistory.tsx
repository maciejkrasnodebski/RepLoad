"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isWorkoutSession,
  type WorkoutSession,
} from "./types";
import { API_URL } from "@/lib/api";

function seriesSummary(
  series: WorkoutSession["exercises"][number]["series"][number],
) {
  return [
    series.weight !== null ? `${series.weight} kg` : null,
    series.distance !== null ? `${series.distance} km` : null,
    series.reps !== null ? `${series.reps} powt.` : null,
    series.durationSeconds !== null
      ? `${Math.floor(series.durationSeconds / 60)}:${String(
          series.durationSeconds % 60,
        ).padStart(2, "0")}`
      : null,
    series.isDone ? "wykonana" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function dateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function WorkoutHistory() {
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/workouts/history?limit=30`, {
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/login?session=expired");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!Array.isArray(data) || !data.every(isWorkoutSession)) {
        throw new Error("Nieprawidłowy format historii treningów.");
      }
      setSessions(data);
    } catch (loadError) {
      console.error("Nie udało się pobrać historii treningów:", loadError);
      setError("Nie udało się wczytać historii. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadHistory(), 0);
    const refresh = () => void loadHistory();
    window.addEventListener("workout-history-updated", refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("workout-history-updated", refresh);
    };
  }, [loadHistory]);

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
          <h2 id="workout-history-heading" className="text-2xl font-bold tracking-tight">
            Historia treningów
          </h2>
        </div>
        {!loading && sessions.length > 0 && (
          <span className="text-sm text-neutral-500">{sessions.length} ostatnich</span>
        )}
      </div>

      {loading ? (
        <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-neutral-900/60" />
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-red-400/20 bg-neutral-900/60 p-5 text-sm text-red-200">
          <p>{error}</p>
          <button type="button" onClick={() => void loadHistory()} className="mt-3 rounded-lg border border-white/10 px-3 py-2 font-semibold text-neutral-200">
            Spróbuj ponownie
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-900/40 px-6 py-10 text-center">
          <h3 className="font-bold">Tu pojawią się Twoje treningi</h3>
          <p className="mt-2 text-sm text-neutral-400">
            Zakończony trening zapisze ćwiczenia, serie i wyniki.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.reduce<Array<{ key: string; sessions: WorkoutSession[] }>>(
            (groups, session) => {
              const key = dateKey(session.startedAt);
              const group = groups.find((item) => item.key === key);
              if (group) group.sessions.push(session);
              else groups.push({ key, sessions: [session] });
              return groups;
            },
            [],
          ).map((group) => (
            <section key={group.key}>
              <h3 className="mb-2 px-1 text-xs font-bold tracking-wide text-neutral-500 uppercase">
                {new Date(group.sessions[0].startedAt).toLocaleDateString(
                  "pl-PL",
                  { weekday: "long", day: "numeric", month: "long" },
                )}
              </h3>
              <div className="space-y-2">
                {group.sessions.map((session) => {
                  const isExpanded = expanded === session.id;
                  const exerciseCount = session.exercises.length;
                  const setCount = session.exercises.reduce(
                    (total, exercise) =>
                      total + exercise.series.filter((series) => series.isDone).length,
                    0,
                  );
                  const durationSeconds =
                    session.endedAt === null
                      ? null
                      : Math.max(
                          0,
                          Math.floor(
                            (new Date(session.endedAt).getTime() -
                              new Date(session.startedAt).getTime()) /
                              1000,
                          ),
                        );
                  const volume = session.exercises
                    .flatMap((exercise) => exercise.series)
                    .filter((series) => series.isDone)
                    .reduce(
                      (total, series) =>
                        total +
                        Number(series.weight ?? 0) * Number(series.reps ?? 0),
                      0,
                    );
                  return (
                    <article
                      key={session.id}
                      className="overflow-hidden rounded-2xl bg-[var(--surface)]"
                    >
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpanded(isExpanded ? null : session.id)
                        }
                        className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition hover:bg-white/[0.03] sm:p-5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold">
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
                          <span>{exerciseCount} ćw.</span>
                          <span>{setCount} ser.</span>
                          {durationSeconds !== null && (
                            <span>{Math.floor(durationSeconds / 60)} min</span>
                          )}
                          {volume > 0 && <span>{volume.toFixed(0)} kg</span>}
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
                          <span aria-hidden="true" className="text-neutral-500">
                            {isExpanded ? "−" : "+"}
                          </span>
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="space-y-3 border-t border-white/[0.06] px-4 py-4 sm:px-5">
                          {session.exercises.length === 0 ? (
                            <p className="text-sm text-neutral-500">
                              Bez zapisanych ćwiczeń.
                            </p>
                          ) : (
                            session.exercises
                              .slice()
                              .sort((a, b) => a.order - b.order)
                              .map((exercise) => (
                                <div
                                  key={exercise.id}
                                  className="rounded-xl bg-black/20 p-3"
                                >
                                  <h3 className="text-sm font-semibold text-white">
                                    {exercise.name}
                                  </h3>
                                  {exercise.series.length > 0 && (
                                    <ul className="mt-2 flex flex-wrap gap-2">
                                      {exercise.series
                                        .slice()
                                        .sort((a, b) => a.order - b.order)
                                        .map((series, index) => (
                                          <li
                                            key={series.id}
                                            className="rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-xs text-neutral-400"
                                          >
                                            {index + 1}.{" "}
                                            {seriesSummary(series) || "bez wyniku"}
                                          </li>
                                        ))}
                                    </ul>
                                  )}
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
