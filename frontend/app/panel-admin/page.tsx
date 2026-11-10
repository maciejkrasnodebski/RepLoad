"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { trackingTypes, type TrackingType } from "@/components/dashboard/types";

type AdminExercise = {
  id: string;
  name: string;
  description: string | null;
  exerciseType: string;
  equipment: string | null;
  muscleGroup: string | null;
  userId: string | null;
};

type ExerciseForm = {
  name: string;
  description: string;
  muscleGroup: string;
  equipment: string;
  exerciseType: TrackingType;
};

type Stats = {
  exerciseCount: number;
  muscleGroupCount: number;
};

type PanelStatus = "checking" | "ready" | "forbidden" | "error";
type PanelSection = "dashboard" | "exercises" | "create";

const initialForm: ExerciseForm = {
  name: "",
  description: "",
  muscleGroup: "",
  equipment: "",
  exerciseType: "weight_reps",
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
];

const equipmentOptions = [
  "Sztanga",
  "Hantle",
  "Maszyna",
  "Wyciąg",
  "Masa własnego ciała",
  "Guma oporowa",
  "Kettlebell",
  "Inne",
];

async function responseError(response: Response) {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return body.message;
    }
  } catch {
    // Keep the HTTP status as the actionable fallback for non-JSON responses.
  }
  return `Błąd serwera (HTTP ${response.status}).`;
}

function isAdminExercise(value: unknown): value is AdminExercise {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "exerciseType" in value &&
    typeof value.exerciseType === "string" &&
    "userId" in value &&
    value.userId === null
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[var(--surface)] p-5 sm:p-6">
      <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-3 text-3xl font-extrabold tracking-tight ${accent}`}>
        {value}
      </p>
    </article>
  );
}

export default function AdminPanelPage() {
  const router = useRouter();
  const [status, setStatus] = useState<PanelStatus>("checking");
  const [authMessage, setAuthMessage] = useState("");
  const [username, setUsername] = useState("");
  const [section, setSection] = useState<PanelSection>("dashboard");
  const [exercises, setExercises] = useState<AdminExercise[]>([]);
  const [stats, setStats] = useState<Stats>({
    exerciseCount: 0,
    muscleGroupCount: 0,
  });
  const [search, setSearch] = useState("");
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [dataError, setDataError] = useState("");
  const [form, setForm] = useState<ExerciseForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const verifyAdmin = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 401) {
          router.replace("/login?next=%2Fpanel-admin");
          return;
        }
        if (!response.ok) {
          throw new Error(`Nie udało się sprawdzić sesji (HTTP ${response.status}).`);
        }
        const result: unknown = await response.json();
        if (
          typeof result !== "object" ||
          result === null ||
          !("user" in result) ||
          typeof result.user !== "object" ||
          result.user === null ||
          !("username" in result.user) ||
          typeof result.user.username !== "string"
        ) {
          throw new Error("Serwer zwrócił nieprawidłowe dane sesji.");
        }
        setUsername(result.user.username);

        const authorization = await fetch(
          `${API_URL}/admin/exercises/stats`,
          {
            credentials: "include",
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (authorization.status === 401) {
          router.replace("/login?next=%2Fpanel-admin");
          return;
        }
        if (authorization.status === 403) {
          setStatus("forbidden");
          return;
        }
        if (!authorization.ok) {
          throw new Error(
            "Nie można teraz zweryfikować uprawnień. Spróbuj ponownie później.",
          );
        }
        setStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setAuthMessage(
          error instanceof Error ? error.message : "Nie udało się sprawdzić sesji.",
        );
        setStatus("error");
      }
    };
    void verifyAdmin();
    return () => controller.abort();
  }, [router]);

  const loadExercises = useCallback(async (signal?: AbortSignal) => {
    setLoadingExercises(true);
    setDataError("");
    try {
      const query = search.trim()
        ? `?q=${encodeURIComponent(search.trim())}`
        : "";
      const [listResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/admin/exercises${query}`, {
          credentials: "include",
          signal,
          cache: "no-store",
        }),
        fetch(`${API_URL}/admin/exercises/stats`, {
          credentials: "include",
          signal,
          cache: "no-store",
        }),
      ]);
      if (!listResponse.ok) throw new Error(await responseError(listResponse));
      if (!statsResponse.ok) throw new Error(await responseError(statsResponse));
      const [listResult, statsResult]: [unknown, unknown] = await Promise.all([
        listResponse.json(),
        statsResponse.json(),
      ]);
      if (!Array.isArray(listResult) || !listResult.every(isAdminExercise)) {
        throw new Error("Serwer zwrócił nieprawidłową listę ćwiczeń.");
      }
      if (
        typeof statsResult !== "object" ||
        statsResult === null ||
        !("exerciseCount" in statsResult) ||
        typeof statsResult.exerciseCount !== "number" ||
        !("muscleGroupCount" in statsResult) ||
        typeof statsResult.muscleGroupCount !== "number"
      ) {
        throw new Error("Serwer zwrócił nieprawidłowe statystyki.");
      }
      setExercises(listResult);
      setStats({
        exerciseCount: statsResult.exerciseCount,
        muscleGroupCount: statsResult.muscleGroupCount,
      });
    } catch (error) {
      if (signal?.aborted) return;
      setDataError(
        error instanceof Error ? error.message : "Nie udało się pobrać ćwiczeń.",
      );
    } finally {
      if (!signal?.aborted) setLoadingExercises(false);
    }
  }, [search]);

  useEffect(() => {
    if (status !== "ready") return;
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void loadExercises(controller.signal),
      search ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadExercises, search, status]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setFormMessage("");
  };

  const startEditing = (exercise: AdminExercise) => {
    const validType = trackingTypes.some(
      (type) => type.value === exercise.exerciseType,
    )
      ? (exercise.exerciseType as TrackingType)
      : "weight_reps";
    setForm({
      name: exercise.name,
      description: exercise.description ?? "",
      muscleGroup: exercise.muscleGroup ?? "",
      equipment: exercise.equipment ?? "",
      exerciseType: validType,
    });
    setEditingId(exercise.id);
    setFormMessage("");
    setSection("create");
  };

  const saveExercise = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormMessage("");
    try {
      const response = await fetch(
        `${API_URL}/admin/exercises${editingId ? `/${encodeURIComponent(editingId)}` : ""}`,
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            muscleGroup: form.muscleGroup,
            equipment: form.equipment,
            exerciseType: form.exerciseType,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      resetForm();
      setSection("exercises");
      await loadExercises();
    } catch (error) {
      setFormMessage(
        error instanceof Error ? error.message : "Nie udało się zapisać ćwiczenia.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteExercise = async (exercise: AdminExercise) => {
    if (!window.confirm(`Usunąć „${exercise.name}” z globalnej biblioteki?`)) {
      return;
    }
    setDataError("");
    try {
      const response = await fetch(
        `${API_URL}/admin/exercises/${encodeURIComponent(exercise.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) throw new Error(await responseError(response));
      await loadExercises();
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : "Nie udało się usunąć ćwiczenia.",
      );
    }
  };

  if (status === "checking") {
    return (
      <main
        aria-label="Sprawdzanie dostępu administratora"
        className="flex min-h-dvh items-center justify-center bg-[var(--app-bg)]"
      >
        <div className="h-2 w-24 animate-pulse rounded-full bg-lime-400/70" />
      </main>
    );
  }

  if (status === "forbidden" || status === "error") {
    const forbidden = status === "forbidden";
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--app-bg)] px-4 py-10">
        <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[var(--surface)] p-7 text-center shadow-2xl sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-400/10 text-2xl text-rose-300">
            {forbidden ? "!" : "↻"}
          </div>
          <h1 className="mt-5 text-2xl font-bold text-white">
            {forbidden ? "Brak uprawnień" : "Nie udało się sprawdzić dostępu"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            {forbidden
              ? "Ta część aplikacji jest dostępna wyłącznie dla administratorów."
              : authMessage}
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-lime-400 px-5 font-bold text-neutral-950 transition hover:bg-lime-300"
          >
            Wróć do aplikacji
          </Link>
        </section>
      </main>
    );
  }

  const navigation: { id: PanelSection; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "⌂" },
    { id: "exercises", label: "Globalna baza ćwiczeń", icon: "▤" },
    { id: "create", label: "Dodaj ćwiczenie", icon: "+" },
  ];

  return (
    <main className="min-h-dvh bg-[var(--app-bg)] pb-12">
      <header className="border-b border-white/[0.07] bg-neutral-950/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-xl font-black text-neutral-950">
              R
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.16em] text-lime-300 uppercase">
                RepLoad · Admin
              </p>
              <h1 className="mt-0.5 truncate text-lg font-bold text-white sm:text-xl">
                Panel administratora
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-400 sm:inline">
              Administrator: <strong className="text-white">{username}</strong>
            </span>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/40 hover:text-lime-300 sm:px-4"
            >
              <span className="sm:hidden">Aplikacja</span>
              <span className="hidden sm:inline">Wróć do aplikacji</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8">
        <nav
          aria-label="Menu panelu administratora"
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
        >
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => {
                if (item.id === "create" && editingId) resetForm();
                setSection(item.id);
              }}
              className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold transition lg:w-full ${
                section === item.id
                  ? "bg-lime-400 text-neutral-950"
                  : "border border-white/[0.07] bg-[var(--surface)] text-neutral-300 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <span aria-hidden="true" className="w-5 text-center text-lg">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
          <div className="hidden rounded-2xl border border-white/[0.07] bg-[var(--surface)] p-4 lg:mt-4 lg:block">
            <p className="text-xs font-bold tracking-wider text-neutral-500 uppercase">
              Zalogowano jako
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-white">
              {username}
            </p>
            <span className="mt-3 inline-flex rounded-full bg-lime-400/10 px-2.5 py-1 text-xs font-bold text-lime-300">
              Administrator
            </span>
          </div>
        </nav>

        <div className="min-w-0">
          {dataError && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
            >
              <p>{dataError}</p>
              <button
                type="button"
                onClick={() => void loadExercises()}
                className="rounded-lg border border-rose-200/20 px-3 py-2 font-semibold hover:bg-rose-200/10"
              >
                Spróbuj ponownie
              </button>
            </div>
          )}

          {section === "dashboard" && (
            <section aria-labelledby="dashboard-title">
              <div className="mb-7">
                <p className="text-xs font-bold tracking-[0.16em] text-lime-300 uppercase">
                  Przegląd systemu
                </p>
                <h2 id="dashboard-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
                  Witaj, {username}
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  Zarządzaj wspólną biblioteką ćwiczeń RepLoad.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard
                  label="Ćwiczenia w bazie globalnej"
                  value={loadingExercises ? "…" : stats.exerciseCount}
                  accent="text-lime-300"
                />
                <StatCard
                  label="Dostępne partie mięśniowe"
                  value={loadingExercises ? "…" : stats.muscleGroupCount}
                  accent="text-sky-300"
                />
              </div>
              <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[var(--surface)] p-5 sm:p-7">
                <p className="text-xs font-bold tracking-[0.14em] text-neutral-500 uppercase">
                  Szybkie działania
                </p>
                <h3 className="mt-2 text-xl font-bold">Biblioteka ćwiczeń</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-400">
                  Dodaj ćwiczenie do wspólnej bazy lub przejrzyj pozycje, z których
                  korzystają wszyscy użytkownicy aplikacji.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setSection("create");
                    }}
                    className="min-h-12 rounded-xl bg-lime-400 px-5 font-bold text-neutral-950 transition hover:bg-lime-300"
                  >
                    Dodaj nowe ćwiczenie
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection("exercises")}
                    className="min-h-12 rounded-xl border border-white/10 px-5 font-semibold text-white transition hover:border-lime-400/40 hover:text-lime-300"
                  >
                    Zarządzaj ćwiczeniami
                  </button>
                </div>
              </div>
            </section>
          )}

          {section === "exercises" && (
            <section aria-labelledby="exercises-title">
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-lime-300 uppercase">
                    Biblioteka RepLoad
                  </p>
                  <h2 id="exercises-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
                    Globalna baza ćwiczeń
                  </h2>
                  <p className="mt-2 text-sm text-neutral-400">
                    {stats.exerciseCount} aktywnych ćwiczeń dostępnych dla wszystkich.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setSection("create");
                  }}
                  className="min-h-11 shrink-0 rounded-xl bg-lime-400 px-4 text-sm font-bold text-neutral-950 transition hover:bg-lime-300"
                >
                  + Dodaj ćwiczenie
                </button>
              </div>
              <label className="mb-4 block">
                <span className="sr-only">Szukaj ćwiczenia</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Szukaj po nazwie ćwiczenia…"
                  className="min-h-12 w-full rounded-xl border border-white/10 bg-[var(--surface)] px-4 text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:outline-none"
                />
              </label>
              {loadingExercises ? (
                <div className="rounded-2xl border border-white/[0.07] bg-[var(--surface)] p-8 text-center text-sm text-neutral-400">
                  Wczytywanie ćwiczeń…
                </div>
              ) : exercises.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[var(--surface)] px-5 py-12 text-center">
                  <p className="text-lg font-bold text-white">Brak ćwiczeń</p>
                  <p className="mt-2 text-sm text-neutral-400">
                    {search
                      ? "Nie znaleziono ćwiczeń pasujących do wyszukiwania."
                      : "Dodaj pierwsze ćwiczenie do globalnej biblioteki."}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--surface)]">
                  <ul className="divide-y divide-white/[0.07]">
                    {exercises.map((exercise) => (
                      <li
                        key={exercise.id}
                        className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                      >
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-white">
                            {exercise.name}
                          </h3>
                          <p className="mt-1 text-xs text-neutral-400">
                            {[exercise.muscleGroup, exercise.equipment]
                              .filter(Boolean)
                              .join(" · ") || "Brak partii i sprzętu"}
                          </p>
                          <p className="mt-1 text-xs text-lime-300">
                            {trackingTypes.find(
                              (type) => type.value === exercise.exerciseType,
                            )?.label ?? exercise.exerciseType}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(exercise)}
                            className="min-h-10 rounded-lg border border-white/10 px-3 text-sm font-semibold text-neutral-200 transition hover:border-lime-400/30 hover:text-lime-300"
                          >
                            Edytuj
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteExercise(exercise)}
                            className="min-h-10 rounded-lg border border-rose-300/15 px-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/10"
                          >
                            Usuń
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {section === "create" && (
            <section aria-labelledby="form-title" className="mx-auto max-w-3xl">
              <div className="mb-6">
                <p className="text-xs font-bold tracking-[0.16em] text-lime-300 uppercase">
                  Globalna biblioteka
                </p>
                <h2 id="form-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">
                  {editingId ? "Edytuj ćwiczenie" : "Dodaj ćwiczenie"}
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  {editingId
                    ? "Zmiany będą widoczne w bibliotece wszystkich użytkowników."
                    : "Nowa pozycja zostanie zapisana w globalnej bazie RepLoad."}
                </p>
              </div>
              <form
                onSubmit={saveExercise}
                className="space-y-5 rounded-2xl border border-white/[0.08] bg-[var(--surface)] p-5 sm:p-7"
              >
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-neutral-200">
                    Nazwa ćwiczenia <span className="text-rose-300">*</span>
                  </span>
                  <input
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="np. Wyciskanie sztangi leżąc"
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-neutral-950/60 px-4 text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-neutral-200">
                    Opis
                  </span>
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Wskazówki dotyczące techniki lub wykonania…"
                    className="w-full resize-y rounded-xl border border-white/10 bg-neutral-950/60 px-4 py-3 text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:outline-none"
                  />
                </label>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-neutral-200">
                      Partia mięśniowa
                    </span>
                    <input
                      list="muscle-groups"
                      maxLength={80}
                      value={form.muscleGroup}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          muscleGroup: event.target.value,
                        }))
                      }
                      placeholder="Wybierz lub wpisz"
                      className="min-h-12 w-full rounded-xl border border-white/10 bg-neutral-950/60 px-4 text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:outline-none"
                    />
                    <datalist id="muscle-groups">
                      {muscleGroups.map((group) => (
                        <option key={group} value={group} />
                      ))}
                    </datalist>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-neutral-200">
                      Rodzaj sprzętu
                    </span>
                    <input
                      list="equipment-options"
                      maxLength={80}
                      value={form.equipment}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          equipment: event.target.value,
                        }))
                      }
                      placeholder="Wybierz lub wpisz"
                      className="min-h-12 w-full rounded-xl border border-white/10 bg-neutral-950/60 px-4 text-white placeholder:text-neutral-500 focus:border-lime-400/50 focus:outline-none"
                    />
                    <datalist id="equipment-options">
                      {equipmentOptions.map((equipment) => (
                        <option key={equipment} value={equipment} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-neutral-200">
                    Typ ćwiczenia
                  </span>
                  <select
                    value={form.exerciseType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        exerciseType: event.target.value as TrackingType,
                      }))
                    }
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-neutral-950/60 px-4 text-white focus:border-lime-400/50 focus:outline-none"
                  >
                    {trackingTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                {formMessage && (
                  <p
                    role="alert"
                    className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
                  >
                    {formMessage}
                  </p>
                )}
                <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setSection("exercises");
                    }}
                    className="min-h-12 rounded-xl border border-white/10 px-5 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.05]"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-12 rounded-xl bg-lime-400 px-6 font-bold text-neutral-950 transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-60"
                  >
                    {saving
                      ? "Zapisywanie…"
                      : editingId
                        ? "Zapisz zmiany"
                        : "Dodaj do globalnej bazy"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
