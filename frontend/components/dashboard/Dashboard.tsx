"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AddWorkoutModal, {
  type WorkoutTemplatePayload,
} from "./AddWorkoutModal";
import { DumbbellIcon, PlusIcon } from "./icons";
import AccountMenu from "./AccountMenu";
import MobileNavigation from "./MobileNavigation";
import TemplateCarousel from "./TemplateCarousel";
import ActiveWorkout from "./ActiveWorkout";
import WorkoutHistory from "./WorkoutHistory";
import {
  isWorkoutSession,
  type WorkoutSession,
  type WorkoutTemplate,
} from "./types";
import { API_URL } from "@/lib/api";
import DownloadAppButton from "@/components/DownloadAppButton";

function MiniWorkoutBar({
  session,
  onResume,
}: {
  session: WorkoutSession;
  onResume: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsed(
        Math.max(
          0,
          Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000),
        ),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [session.startedAt]);
  const formatted = new Date(elapsed * 1000).toISOString().slice(11, 19);

  return (
    <button
      type="button"
      onClick={onResume}
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex min-h-12 max-w-lg items-center justify-between gap-3 rounded-xl border border-lime-400/20 bg-neutral-900/95 px-4 shadow-xl backdrop-blur-xl md:hidden"
    >
      <span className="min-w-0 truncate text-sm font-semibold">
        {session.name || session.templateName || "Aktywny trening"}
      </span>
      <span className="tabular-nums shrink-0 text-sm font-bold text-lime-300">
        {formatted}
      </span>
      <span className="shrink-0 text-xs font-bold text-lime-300">Wróć</span>
    </button>
  );
}

type TemplatesStatus = "loading" | "ready" | "error";
type AuthStatus = "checking" | "authenticated";

type AddTemplateButtonProps = {
  className?: string;
  onClick: () => void;
};

function AddTemplateButton({
  className = "",
  onClick,
}: AddTemplateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-lime-400 px-6 py-3.5 font-bold text-neutral-950 shadow-lg shadow-lime-400/20 transition hover:bg-lime-300 hover:shadow-lime-400/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 active:scale-[0.98] ${className}`}
    >
      <PlusIcon className="h-5 w-5 transition group-hover:rotate-90" />
      Dodaj nowy szablon
    </button>
  );
}

function isWorkoutTemplate(value: unknown): value is WorkoutTemplate {
  if (typeof value !== "object" || value === null) return false;
  if (!("id" in value) || typeof value.id !== "string") return false;
  if (!("name" in value) || typeof value.name !== "string") return false;
  if (
    !("color" in value) ||
    (value.color !== null && typeof value.color !== "string")
  ) {
    return false;
  }
  if (
    !("icon" in value) ||
    (value.icon !== null && typeof value.icon !== "string")
  ) {
    return false;
  }
  if (
    !("dayOfWeek" in value) ||
    (value.dayOfWeek !== null &&
      (typeof value.dayOfWeek !== "number" ||
        !Number.isInteger(value.dayOfWeek) ||
        value.dayOfWeek < 0 ||
        value.dayOfWeek > 6)) ||
    ("daysOfWeek" in value &&
      (!Array.isArray(value.daysOfWeek) ||
        !value.daysOfWeek.every(
          (day: unknown) =>
            typeof day === "number" &&
            Number.isInteger(day) &&
            day >= 0 &&
            day <= 6,
        )))
  ) {
    return false;
  }
  if (!("exercises" in value) || !Array.isArray(value.exercises)) return false;
  return value.exercises.every((exercise: unknown) => {
    if (
      typeof exercise !== "object" ||
      exercise === null ||
      !("id" in exercise) ||
      typeof exercise.id !== "string" ||
      !("name" in exercise) ||
      typeof exercise.name !== "string" ||
      !("exerciseType" in exercise) ||
      typeof exercise.exerciseType !== "string" ||
      !("equipment" in exercise) ||
      (exercise.equipment !== null && typeof exercise.equipment !== "string") ||
      !("muscleGroup" in exercise) ||
      (exercise.muscleGroup !== null &&
        typeof exercise.muscleGroup !== "string") ||
      !("difficultyLevel" in exercise) ||
      (exercise.difficultyLevel !== null &&
        typeof exercise.difficultyLevel !== "string") ||
      !("settings" in exercise) ||
      typeof exercise.settings !== "object" ||
      exercise.settings === null
    ) {
      return false;
    }

    const settings = exercise.settings;
    return (
      "sets" in settings &&
      (settings.sets === null || typeof settings.sets === "number") &&
      "reps" in settings &&
      (settings.reps === null || typeof settings.reps === "number") &&
      "weight" in settings &&
      (settings.weight === null || typeof settings.weight === "number") &&
      "durationSeconds" in settings &&
      (settings.durationSeconds === null ||
        typeof settings.durationSeconds === "number") &&
      "restSeconds" in settings &&
      (settings.restSeconds === null ||
        typeof settings.restSeconds === "number") &&
      "distance" in settings &&
      (settings.distance === null || typeof settings.distance === "number")
    );
  });
}

async function logout(onLogout: () => void) {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Nawet bez połączenia z API użytkownik powinien móc opuścić panel.
  }
  onLogout();
}

export default function Dashboard() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [username, setUsername] = useState("");
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templatesStatus, setTemplatesStatus] =
    useState<TemplatesStatus>("loading");
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<WorkoutTemplate | null>(null);
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutSession | null>(
    null,
  );
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [workoutLoading, setWorkoutLoading] = useState(true);
  const [workoutError, setWorkoutError] = useState<string | null>(null);
  const [workoutRetryKey, setWorkoutRetryKey] = useState(0);
  const [todayInfo, setTodayInfo] = useState<{
    dayIndex: number;
    dateLabel: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = new Date();
      setTodayInfo({
        dayIndex: (now.getDay() + 6) % 7,
        dateLabel: new Intl.DateTimeFormat("pl-PL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(now),
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadUser = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (res.status === 401) {
          await logout(() => router.replace("/login?session=expired"));
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (typeof data?.user?.username === "string") {
          setUsername(data.user.username);
        }
        setAuthStatus("authenticated");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Nie udało się pobrać danych użytkownika:", error);
        setTemplatesError(
          "Nie udało się zweryfikować sesji. Sprawdź połączenie i spróbuj ponownie.",
        );
        setTemplatesStatus("error");
      }
    };

    void loadUser();
    return () => controller.abort();
  }, [router]);

  const fetchTemplates = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch(`${API_URL}/templates`, {
      credentials: "include",
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: unknown = await res.json();
    const list: unknown[] | null = Array.isArray(data)
      ? data
      : typeof data === "object" &&
          data !== null &&
          "templates" in data &&
          Array.isArray(data.templates)
        ? data.templates
        : null;
    if (!list) {
      throw new Error("Nieprawidłowy format odpowiedzi API.");
    }
    const validList = list
      .filter(isWorkoutTemplate)
      .map((template) => ({
        ...template,
        daysOfWeek:
          "daysOfWeek" in template && Array.isArray(template.daysOfWeek)
            ? template.daysOfWeek
            : template.dayOfWeek === null
              ? []
              : [template.dayOfWeek],
      }));
    if (validList.length !== list.length) {
      throw new Error("Nieprawidłowy format odpowiedzi API.");
    }
    return validList;
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const controller = new AbortController();
    const loadTemplates = async () => {
      try {
        const list = await fetchTemplates(controller.signal);
        setTemplates(list);
        setTemplatesStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.message === "HTTP 401") {
          await logout(() => router.replace("/login?session=expired"));
          return;
        }
        console.error("Nie udało się pobrać szablonów:", error);
        setTemplatesError(
          "Nie udało się wczytać szablonów. Sprawdź połączenie i spróbuj ponownie.",
        );
        setTemplatesStatus("error");
      }
    };

    void loadTemplates();
    return () => controller.abort();
  }, [authStatus, fetchTemplates, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const controller = new AbortController();
    const loadCurrentWorkout = async () => {
      setWorkoutLoading(true);
      setWorkoutError(null);
      try {
        const response = await fetch(`${API_URL}/workouts/current`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (response.status === 401) {
          await logout(() => router.replace("/login?session=expired"));
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (data !== null && !isWorkoutSession(data)) {
          throw new Error("Nieprawidłowy format aktywnego treningu.");
        }
        setCurrentWorkout(data);
        setWorkoutError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Nie udało się odzyskać aktywnego treningu:", error);
        setWorkoutError(
          "Nie udało się sprawdzić aktywnego treningu. Spróbuj ponownie.",
        );
      } finally {
        if (!controller.signal.aborted) setWorkoutLoading(false);
      }
    };
    void loadCurrentWorkout();
    return () => controller.abort();
  }, [authStatus, router, workoutRetryKey]);

  const startWorkout = async (template: WorkoutTemplate) => {
    if (currentWorkout) {
      setWorkoutOpen(true);
      return;
    }
    setWorkoutLoading(true);
    setWorkoutError(null);
    try {
      const response = await fetch(`${API_URL}/workouts/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      if (response.status === 401) {
        await logout(() => router.replace("/login?session=expired"));
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!isWorkoutSession(data)) {
        throw new Error("Nieprawidłowy format utworzonego treningu.");
      }
      setCurrentWorkout(data);
      setWorkoutOpen(true);
    } catch (error) {
      console.error("Nie udało się rozpocząć treningu:", error);
      setWorkoutError("Nie udało się rozpocząć treningu. Spróbuj ponownie.");
    } finally {
      setWorkoutLoading(false);
    }
  };

  const retryTemplates = async () => {
    if (authStatus !== "authenticated") {
      window.location.reload();
      return;
    }
    setTemplatesError(null);
    setTemplatesStatus("loading");
    try {
      setTemplates(await fetchTemplates());
      setTemplatesStatus("ready");
    } catch (error) {
      if (error instanceof Error && error.message === "HTTP 401") {
        await logout(() => router.replace("/login"));
        return;
      }
      console.error("Nie udało się ponownie pobrać szablonów:", error);
      setTemplatesError(
        "Nie udało się wczytać szablonów. Sprawdź połączenie i spróbuj ponownie.",
      );
      setTemplatesStatus("error");
    }
  };

  const sorted = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name, "pl")),
    [templates],
  );
  const mondayFirstToday = todayInfo?.dayIndex ?? -1;
  const todayTemplates = useMemo(
    () =>
      mondayFirstToday < 0
        ? []
        : templates.filter((template) =>
            template.daysOfWeek.length > 0
              ? template.daysOfWeek.includes(mondayFirstToday)
              : template.dayOfWeek === mondayFirstToday,
          ),
    [mondayFirstToday, templates],
  );
  const todayTemplate = todayTemplates[0];
  const formattedDate = todayInfo?.dateLabel ?? "";

  const saveTemplate = async (
    payload: WorkoutTemplatePayload,
    templateId?: string,
  ) => {
    const res = await fetch(
      templateId
        ? `${API_URL}/templates/${encodeURIComponent(templateId)}`
        : `${API_URL}/templates`,
      {
        method: templateId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      if (res.status === 401) {
        await logout(() => router.replace("/login?session=expired"));
      }
      throw new Error(`HTTP ${res.status}`);
    }

    setEditingTemplate(null);
    setModalOpen(false);
    setTemplatesStatus("loading");
    try {
      setTemplates(await fetchTemplates());
      setTemplatesStatus("ready");
      setTemplatesError(null);
    } catch (error) {
      console.error(
        "Szablon zapisano, ale nie udało się odświeżyć listy:",
        error,
      );
      setTemplatesError(
        "Szablon został zapisany, ale nie udało się odświeżyć listy.",
      );
      setTemplatesStatus("error");
    }
  };

  const deleteTemplate = async (id: string) => {
    setActionError(null);
    setDeletingTemplateId(id);
    try {
      const res = await fetch(
        `${API_URL}/templates/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) {
        if (res.status === 401) {
          await logout(() => router.replace("/login?session=expired"));
        }
        throw new Error(`HTTP ${res.status}`);
      }
      setTemplates((prev) => prev.filter((template) => template.id !== id));
    } catch (error) {
      console.error("Nie udało się usunąć szablonu:", error);
      setActionError("Nie udało się usunąć szablonu. Spróbuj ponownie.");
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const duplicateTemplate = async (template: WorkoutTemplate) => {
    setActionError(null);
    const duplicateName = `Kopia — ${template.name}`.slice(0, 100);
    try {
      await saveTemplate({
        name: duplicateName,
        daysOfWeek: [],
        color: template.color ?? "#A3E635",
        icon: template.icon ?? "dumbbell",
        exercises: template.exercises.map(({ id, settings }) => ({
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
      });
    } catch (error) {
      console.error("Nie udało się skopiować szablonu:", error);
      setActionError("Nie udało się skopiować szablonu. Spróbuj ponownie.");
    }
  };

  return (
    <div className="min-h-dvh overflow-x-clip bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div
        id="dashboard-top"
        className="mx-auto max-w-3xl scroll-mt-5 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-44 sm:px-6"
      >
        <header className="mb-7 flex min-h-11 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-neutral-950">
              <DumbbellIcon className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">
              Rep<span className="text-lime-400">Load</span>
            </span>
          </div>
          <DownloadAppButton className="min-h-10 px-3 text-xs sm:text-sm" />
        </header>

        <section className="mb-6">
          <p className="text-2xl font-bold tracking-tight">
            Cześć{username ? `, ${username}` : ""}
          </p>
          <p className="mt-1 text-sm capitalize text-[var(--text-secondary)]">
            {formattedDate}
          </p>
        </section>

        <section className="mb-7 overflow-hidden rounded-2xl bg-[var(--surface)] p-4 shadow-xl shadow-black/10 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-11 w-1 shrink-0 rounded-full bg-lime-400"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold tracking-[0.14em] text-lime-300 uppercase">
                {currentWorkout
                  ? "Trening w toku"
                  : todayTemplates.length > 0
                    ? "Dzisiejszy trening"
                    : "Dziś"}
              </p>
              <h1 className="mt-1 truncate text-xl font-bold">
                {currentWorkout
                  ? currentWorkout.name ||
                    currentWorkout.templateName ||
                    "Trening własny"
                  : todayTemplate?.name ??
                    (templatesStatus === "ready"
                      ? "Dzień odpoczynku"
                      : "Twój trening")}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {currentWorkout
                  ? "Wróć do zapisanych serii"
                  : todayTemplate
                    ? `${todayTemplates.length} ${todayTemplates.length === 1 ? "szablon" : todayTemplates.length < 5 ? "szablony" : "szablonów"} · ${todayTemplate.exercises.length} ćwiczeń`
                    : templatesStatus === "ready"
                      ? "Brak zaplanowanego treningu. Odpocznij lub ustaw dzień w szablonie."
                      : templatesStatus === "loading"
                        ? "Sprawdzam plan dnia…"
                        : "Nie udało się pobrać planu dnia."}
              </p>
            </div>
          </div>
          {currentWorkout ? (
            <button
              type="button"
              onClick={() => setWorkoutOpen(true)}
              className="min-h-[52px] w-full rounded-xl bg-lime-400 px-4 text-base font-extrabold text-neutral-950 transition hover:bg-lime-300 active:scale-[0.99]"
            >
              Wróć do treningu
            </button>
          ) : todayTemplates.length > 0 ? (
            <div className="flex flex-col gap-2">
              {todayTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => void startWorkout(template)}
                  disabled={workoutLoading}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl bg-lime-400 px-4 text-left text-neutral-950 transition hover:bg-lime-300 active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-extrabold">
                      {todayTemplates.length > 1
                        ? template.name
                        : "Rozpocznij trening"}
                    </span>
                    <span className="block text-xs text-neutral-800">
                      {template.name} · {template.exercises.length} ćwiczeń
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">Start</span>
                </button>
              ))}
            </div>
          ) : templatesStatus === "loading" ? (
            <div className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
          ) : null}
        </section>

        {workoutError && !currentWorkout && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
          >
            <p>{workoutError}</p>
            <button
              type="button"
              onClick={() => setWorkoutRetryKey((current) => current + 1)}
              className="min-h-10 rounded-lg border border-red-300/20 px-3 font-semibold transition hover:bg-red-300/10"
            >
              Spróbuj ponownie
            </button>
          </div>
        )}

        <section
          id="community"
          aria-labelledby="community-heading"
          className="mt-10 scroll-mt-6"
        >
          <div className="mb-4">
            <p className="mb-2 text-xs font-bold tracking-[0.18em] text-lime-400 uppercase">
              RAZEM SILNIEJ
            </p>
            <h2 id="community-heading" className="text-2xl font-bold">
              Społeczność
            </h2>
          </div>
          <div className="rounded-2xl border border-dashed border-white/10 bg-[var(--surface)] px-5 py-8 text-center">
            <h3 className="font-bold text-white">Społeczność w przygotowaniu</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-400">
              Nie ma jeszcze aktywności społecznościowej do wyświetlenia.
            </p>
          </div>
        </section>

        <section aria-labelledby="templates-heading" className="min-w-0">
          <div className="mb-6 flex flex-col items-center text-center">
            <h2 id="templates-heading" className="text-2xl font-bold">
              Moje szablony
            </h2>
            <AddTemplateButton
              className="mt-4 min-h-11 rounded-xl px-5 py-2.5 text-sm"
              onClick={() => {
                setEditingTemplate(null);
                setModalOpen(true);
              }}
            />
            {templatesStatus === "ready" && sorted.length > 0 && (
              <span className="mt-3 text-xs text-neutral-500">
                {sorted.length}{" "}
                {sorted.length === 1 ? "zapisany szablon" : "zapisane szablony"}
              </span>
            )}
          </div>

          {actionError && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
            >
              {actionError}
            </p>
          )}

          {templatesStatus === "loading" && (
            <div
              aria-label="Wczytywanie szablonów"
              className="flex gap-4 overflow-hidden px-1 pb-3"
            >
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-64 w-[84%] max-w-[23rem] shrink-0 animate-pulse rounded-2xl border border-white/10 bg-neutral-900/70 sm:w-[min(70%,23rem)] md:w-[min(48%,23rem)]"
                />
              ))}
            </div>
          )}

          {templatesStatus === "error" && (
            <div
              role="alert"
              className="rounded-2xl border border-red-400/20 bg-neutral-900/70 p-6 text-center"
            >
              <p className="text-sm text-red-200">{templatesError}</p>
              <button
                type="button"
                onClick={() => void retryTemplates()}
                className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/40 hover:text-lime-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
              >
                Spróbuj ponownie
              </button>
            </div>
          )}

          {templatesStatus === "ready" && sorted.length === 0 && (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-neutral-900/40 px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400/10 text-lime-400">
                <DumbbellIcon className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold">Jeszcze tu pusto</h3>
              <p className="mt-2 max-w-sm text-sm text-neutral-400">
                Utwórz pierwszy szablon, aby szybko przygotować się do treningu.
              </p>
            </div>
          )}

          {templatesStatus === "ready" && sorted.length > 0 && (
            <TemplateCarousel
              templates={sorted}
              deletingTemplateId={deletingTemplateId}
              onStart={(selectedTemplate) =>
                void startWorkout(selectedTemplate)
              }
              onEdit={(selectedTemplate) => {
                setEditingTemplate(selectedTemplate);
                setModalOpen(true);
              }}
              onDuplicate={duplicateTemplate}
              onDelete={deleteTemplate}
            />
          )}
        </section>

        {authStatus === "authenticated" && <WorkoutHistory />}
      </div>

      {modalOpen && (
        <AddWorkoutModal
          key={editingTemplate?.id ?? "new"}
          template={editingTemplate ?? undefined}
          onClose={() => {
            setModalOpen(false);
            setEditingTemplate(null);
          }}
          onSave={saveTemplate}
        />
      )}
      {authStatus === "authenticated" && (
        <>
          <AccountMenu
            username={username || "Użytkownik"}
            profileOpen={profileOpen}
            onLogout={() => void logout(() => router.replace("/login"))}
            onOpenProfile={() => setProfileOpen(true)}
            onCloseProfile={() => setProfileOpen(false)}
          />
          <MobileNavigation
            todayTemplates={todayTemplates}
            workoutLoading={workoutLoading}
            onCreateTemplate={() => {
              setEditingTemplate(null);
              setModalOpen(true);
            }}
            onStartWorkout={(template) => void startWorkout(template)}
            onResumeWorkout={() => setWorkoutOpen(true)}
            onProfile={() => setProfileOpen(true)}
            hasActiveWorkout={currentWorkout !== null}
          />
          {currentWorkout && !workoutOpen && (
            <MiniWorkoutBar
              session={currentWorkout}
              onResume={() => setWorkoutOpen(true)}
            />
          )}
        </>
      )}
      {authStatus === "authenticated" && workoutOpen && currentWorkout && (
        <ActiveWorkout
          session={currentWorkout}
          onSessionChange={setCurrentWorkout}
          onClose={() => setWorkoutOpen(false)}
        />
      )}
    </div>
  );
}
