"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, PlusIcon, TrashIcon } from "./icons";
import type { WorkoutTemplate } from "./types";
import { API_URL } from "@/lib/api";

const days = [
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
  "Niedziela",
] as const;

type DayAssignment = {
  dayOfWeek: number;
  templateId: string | null;
  isRestDay: boolean;
};

export type WeeklyPlanSnapshot = {
  name: string;
  days: DayAssignment[];
};

type WeeklyPlan = {
  id: string;
  name: string;
  days: DayAssignment[];
};

type Props = {
  templates: WorkoutTemplate[];
  onStartWorkout: (template: WorkoutTemplate) => void;
  onActivePlanChange?: (snapshot: WeeklyPlanSnapshot | null) => void;
};

function isDayAssignment(value: unknown): value is DayAssignment {
  return (
    typeof value === "object" &&
    value !== null &&
    "dayOfWeek" in value &&
    typeof value.dayOfWeek === "number" &&
    Number.isInteger(value.dayOfWeek) &&
    value.dayOfWeek >= 0 &&
    value.dayOfWeek <= 6 &&
    "templateId" in value &&
    (value.templateId === null || typeof value.templateId === "string") &&
    "isRestDay" in value &&
    typeof value.isRestDay === "boolean"
  );
}

function normalizePlan(value: unknown): WeeklyPlan | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !("days" in value) ||
    !Array.isArray(value.days) ||
    !value.days.every(isDayAssignment)
  ) {
    return null;
  }
  return { id: value.id, name: value.name, days: value.days };
}

function assignmentFor(plan: WeeklyPlan, dayOfWeek: number) {
  return (
    plan.days.find((assignment) => assignment.dayOfWeek === dayOfWeek) ?? {
      dayOfWeek,
      templateId: null,
      isRestDay: false,
    }
  );
}

export default function WeeklyPlanner({
  templates,
  onStartWorkout,
  onActivePlanChange,
}: Props) {
  const router = useRouter();
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedId) ?? null,
    [plans, selectedId],
  );

  useEffect(() => {
    onActivePlanChange?.(
      selectedPlan
        ? { name: selectedPlan.name, days: selectedPlan.days }
        : null,
    );
  }, [onActivePlanChange, selectedPlan]);

  const handleResponse = useCallback(
    async (response: Response) => {
      if (response.status === 401) {
        router.replace("/login?session=expired");
        throw new Error("Sesja wygasła. Zaloguj się ponownie.");
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    },
    [router],
  );

  const refreshPlans = useCallback(async () => {
    const response = await handleResponse(
      await fetch(`${API_URL}/weekly-plans`, { credentials: "include" }),
    );
    const data: unknown = await response.json();
    const list: unknown[] = Array.isArray(data)
      ? data
      : typeof data === "object" &&
          data !== null &&
          "plans" in data &&
          Array.isArray(data.plans)
        ? data.plans
        : [];
    const normalized = list.map(normalizePlan);
    if (normalized.some((plan) => plan === null)) {
      throw new Error("Nieprawidłowy format planu tygodnia.");
    }
    const nextPlans = normalized.filter(
      (plan): plan is WeeklyPlan => plan !== null,
    );
    setPlans(nextPlans);
    setSelectedId((current) =>
      nextPlans.some((plan) => plan.id === current)
        ? current
        : (nextPlans[0]?.id ?? ""),
    );
    return nextPlans;
  }, [handleResponse]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        await refreshPlans();
      } catch (loadError) {
        if (!active) return;
        if (
          loadError instanceof Error &&
          loadError.message.startsWith("HTTP")
        ) {
          console.error("Nie udało się pobrać planów tygodnia:", loadError);
          setError("Nie udało się wczytać planów tygodnia. Spróbuj ponownie.");
        } else if (
          loadError instanceof Error &&
          !loadError.message.startsWith("Sesja wygasła")
        ) {
          console.error("Nie udało się pobrać planów tygodnia:", loadError);
          setError(loadError.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [refreshPlans]);

  const createPlan = async () => {
    const name = newPlanName.trim();
    if (!name) {
      setError("Wpisz nazwę nowego planu tygodnia.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await handleResponse(
        await fetch(`${API_URL}/weekly-plans`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      );
      const updatedPlans = await refreshPlans();
      const createdPlan = updatedPlans.find((plan) => plan.name === name);
      if (createdPlan) setSelectedId(createdPlan.id);
      setNewPlanName("");
      setCreateOpen(false);
    } catch (createError) {
      console.error("Nie udało się utworzyć planu tygodnia:", createError);
      setError("Nie udało się utworzyć planu tygodnia. Spróbuj ponownie.");
    } finally {
      setCreating(false);
    }
  };

  const updateDay = async (dayOfWeek: number, value: string) => {
    if (!selectedPlan) return;
    const selection =
      value === "rest"
        ? { templateId: null, isRestDay: true }
        : {
            templateId: value || null,
            isRestDay: false,
          };
    const assignments = days.map((_, index) =>
      index === dayOfWeek
        ? { dayOfWeek, ...selection }
        : assignmentFor(selectedPlan, index),
    );
    setSavingDay(dayOfWeek);
    setError(null);
    try {
      await handleResponse(
        await fetch(
          `${API_URL}/weekly-plans/${encodeURIComponent(selectedPlan.id)}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignments }),
          },
        ),
      );
      await refreshPlans();
    } catch (saveError) {
      console.error("Nie udało się zapisać dnia w planie:", saveError);
      setError("Nie udało się zapisać zmian. Spróbuj ponownie.");
    } finally {
      setSavingDay(null);
    }
  };

  const deletePlan = async () => {
    if (!selectedPlan) return;
    setDeleting(true);
    setError(null);
    try {
      await handleResponse(
        await fetch(
          `${API_URL}/weekly-plans/${encodeURIComponent(selectedPlan.id)}`,
          { method: "DELETE", credentials: "include" },
        ),
      );
      await refreshPlans();
    } catch (deleteError) {
      console.error("Nie udało się usunąć planu tygodnia:", deleteError);
      setError("Nie udało się usunąć planu tygodnia. Spróbuj ponownie.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section
      id="weekly-plan"
      aria-labelledby="weekly-plan-heading"
      className="mb-12 scroll-mt-8"
    >
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-lime-400 uppercase">
            RYTM TYGODNIA
          </p>
          <h2
            id="weekly-plan-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Twój tydzień treningowy
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-400">
            Przypisuj te same szablony do wielu dni, układaj różne plany i
            oznaczaj dni odpoczynku.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedPlan && (
            <button
              type="button"
              onClick={() => void deletePlan()}
              disabled={deleting}
              className="rounded-xl border border-white/10 p-3 text-neutral-500 transition hover:border-red-400/30 hover:text-red-300 disabled:opacity-50"
              aria-label={`Usuń plan ${selectedPlan.name}`}
              title="Usuń plan"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-lime-300"
          >
            <PlusIcon className="h-4 w-4" />
            Nowy plan
          </button>
        </div>
      </div>

      {createOpen && (
        <form
          className="mb-4 flex flex-col gap-2 rounded-2xl border border-lime-400/20 bg-lime-400/[0.04] p-4 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void createPlan();
          }}
        >
          <label htmlFor="weekly-plan-name" className="sr-only">
            Nazwa planu tygodnia
          </label>
          <input
            id="weekly-plan-name"
            value={newPlanName}
            maxLength={100}
            onChange={(event) => setNewPlanName(event.target.value)}
            placeholder="np. Plan siłowy · 4 dni"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-lime-400/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-lime-300 disabled:opacity-50"
          >
            {creating ? "Tworzenie…" : "Utwórz plan"}
          </button>
        </form>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              void refreshPlans()
                .catch((refreshError: unknown) => {
                  console.error(
                    "Nie udało się odświeżyć planów:",
                    refreshError,
                  );
                  setError("Nie udało się wczytać planów tygodnia.");
                })
                .finally(() => setLoading(false));
            }}
            className="rounded-lg border border-red-300/20 px-3 py-1.5 font-semibold text-red-100 transition hover:bg-red-300/10"
          >
            Odśwież
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-neutral-900/60" />
      ) : error && plans.length === 0 ? (
        <div className="rounded-3xl border border-white/[0.08] bg-neutral-900/50 px-6 py-10 text-center">
          <h3 className="text-base font-bold text-white">
            Nie można wczytać planu
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-400">
            Połącz się z serwerem i odśwież widok, aby zobaczyć zapisane plany.
          </p>
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-neutral-900/40 px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-400/10 text-lime-300">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">
            Zaplanuj swój pierwszy tydzień
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-400">
            Utwórz plan, a następnie przypisz szablony do poszczególnych dni.
            Ten sam trening możesz powtarzać kilka razy w tygodniu.
          </p>
          {!createOpen && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-lime-300"
            >
              Utwórz plan tygodnia
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-sm text-neutral-400">
              <span className="hidden sm:inline">Aktywny plan</span>
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="min-w-48 rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 font-semibold text-white focus:border-lime-400/50 focus:outline-none"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-neutral-500">
              Zmiany zapisują się automatycznie
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {days.map((day, dayOfWeek) => {
              const assignment = selectedPlan
                ? assignmentFor(selectedPlan, dayOfWeek)
                : null;
              const activeTemplate = templates.find(
                (template) => template.id === assignment?.templateId,
              );
              return (
                <article
                  key={day}
                  className={`min-h-40 rounded-2xl border p-4 transition ${
                    activeTemplate
                      ? "border-lime-400/20 bg-[var(--surface)]"
                      : assignment?.isRestDay
                        ? "border-sky-300/15 bg-sky-300/[0.04]"
                        : "border-white/[0.08] bg-neutral-900/60"
                  }`}
                >
                  <div className="mb-5 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white">{day}</h3>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        activeTemplate
                          ? "bg-lime-300 shadow-[0_0_10px_rgba(163,230,53,0.65)]"
                          : assignment?.isRestDay
                            ? "bg-sky-300"
                            : "bg-neutral-700"
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  {activeTemplate ? (
                    <div className="mb-4">
                      <p className="truncate font-semibold text-lime-200">
                        {activeTemplate.name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {activeTemplate.exercises.length}{" "}
                        {activeTemplate.exercises.length === 1
                          ? "ćwiczenie"
                          : "ćwiczeń"}
                      </p>
                    </div>
                  ) : assignment?.isRestDay ? (
                    <div className="mb-4">
                      <p className="font-semibold text-sky-200">Odpoczynek</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Regeneracja też jest częścią planu.
                      </p>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <p className="font-medium text-neutral-400">
                        Bez treningu
                      </p>
                      <p className="mt-1 text-xs text-neutral-600">
                        Wybierz szablon lub odpoczynek.
                      </p>
                    </div>
                  )}
                  <label className="block">
                    <span className="sr-only">Plan dnia: {day}</span>
                    <select
                      value={
                        assignment?.isRestDay
                          ? "rest"
                          : (assignment?.templateId ?? "")
                      }
                      disabled={savingDay === dayOfWeek || !selectedPlan}
                      onChange={(event) =>
                        void updateDay(dayOfWeek, event.target.value)
                      }
                      className="w-full rounded-lg border border-white/10 bg-neutral-950/70 px-3 py-2 text-xs text-neutral-300 focus:border-lime-400/50 focus:outline-none disabled:opacity-60"
                    >
                      <option value="">Nie zaplanowano</option>
                      <option value="rest">Dzień odpoczynku</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {activeTemplate && (
                    <button
                      type="button"
                      onClick={() => onStartWorkout(activeTemplate)}
                      className="mt-2 flex min-h-10 w-full items-center justify-center rounded-lg bg-lime-400 px-3 py-2 text-xs font-bold text-neutral-950 transition hover:bg-lime-300"
                    >
                      Rozpocznij trening
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
