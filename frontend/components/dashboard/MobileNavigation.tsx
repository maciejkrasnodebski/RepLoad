"use client";

import { useEffect, useState } from "react";
import {
  DumbbellIcon,
  HomeIcon,
  ReceiptIcon,
  UsersIcon,
  UserIcon,
} from "./icons";
import type { WorkoutTemplate } from "./types";

type Props = {
  todayTemplates: WorkoutTemplate[];
  hasActiveWorkout: boolean;
  workoutLoading: boolean;
  onCreateTemplate: () => void;
  onStartWorkout: (template: WorkoutTemplate) => void;
  onResumeWorkout: () => void;
  onProfile: () => void;
};

export default function MobileNavigation({
  todayTemplates,
  hasActiveWorkout,
  workoutLoading,
  onCreateTemplate,
  onStartWorkout,
  onResumeWorkout,
  onProfile,
}: Props) {
  const [active, setActive] = useState("home");
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  useEffect(() => {
    if (!quickActionsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuickActionsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [quickActionsOpen]);

  const navigate = (id: string, target: string) => {
    setActive(id);
    document.getElementById(target)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const start = (template: WorkoutTemplate) => {
    setQuickActionsOpen(false);
    onStartWorkout(template);
  };

  const openProfile = () => {
    setActive("profile");
    onProfile();
  };

  return (
    <>
      {quickActionsOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] backdrop-blur-sm sm:items-center sm:pb-3"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setQuickActionsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-actions-title"
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--surface)] p-4 shadow-2xl shadow-black/50 sm:p-5"
          >
            <header className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest text-lime-300 uppercase">
                  Szybkie akcje
                </p>
                <h2
                  id="quick-actions-title"
                  className="mt-1 text-xl font-bold text-white"
                >
                  Co robimy?
                </h2>
              </div>
              <button
                type="button"
                aria-label="Zamknij szybkie akcje"
                onClick={() => setQuickActionsOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                ×
              </button>
            </header>

            <button
              type="button"
              onClick={() => {
                setQuickActionsOpen(false);
                onCreateTemplate();
              }}
              className="mb-3 flex min-h-14 w-full items-center gap-3 rounded-2xl bg-lime-400 px-4 text-left text-neutral-950 transition hover:bg-lime-300 active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/10">
                <DumbbellIcon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-extrabold">Utwórz szablon</span>
                <span className="mt-0.5 block text-xs text-neutral-800">
                  Ułóż ćwiczenia i zapisz plan
                </span>
              </span>
            </button>

            {hasActiveWorkout ? (
              <button
                type="button"
                onClick={() => {
                  setQuickActionsOpen(false);
                  onResumeWorkout();
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white/[0.05] px-4 text-left text-white transition hover:bg-white/[0.08]"
              >
                <DumbbellIcon className="h-5 w-5 text-lime-300" />
                <span className="font-bold">Wróć do aktywnego treningu</span>
              </button>
            ) : todayTemplates.length > 0 ? (
              <div className="space-y-2">
                <p className="px-1 text-xs font-semibold text-neutral-500">
                  DZISIEJSZE SZABLONY
                </p>
                {todayTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    disabled={workoutLoading}
                    onClick={() => start(template)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-white/[0.05] px-4 text-left transition hover:bg-white/[0.08] disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-white">
                        {template.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {template.exercises.length} ćwiczeń
                      </span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-lime-400 px-3 py-2 text-xs font-extrabold text-neutral-950">
                      Start
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-neutral-400">
                Na dziś nie ma zaplanowanego treningu.
              </p>
            )}
          </section>
        </div>
      )}

      <nav
        aria-label="Nawigacja mobilna"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-neutral-950/95 px-1 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] shadow-[0_-12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end gap-0.5">
          <button
            type="button"
            onClick={openProfile}
            aria-current={active === "profile" ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${
              active === "profile" ? "text-lime-300" : "text-neutral-500"
            }`}
          >
            <UserIcon className="h-5 w-5" />
            Profil
          </button>
          <button
            type="button"
            onClick={() => navigate("history", "workout-history")}
            aria-current={active === "history" ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${
              active === "history" ? "text-lime-300" : "text-neutral-500"
            }`}
          >
            <ReceiptIcon className="h-5 w-5" />
            Historia
          </button>
          <button
            type="button"
            onClick={() => setQuickActionsOpen(true)}
            aria-label="Otwórz szybkie akcje treningowe"
            aria-expanded={quickActionsOpen}
            className="relative -mt-7 flex min-h-[4.25rem] flex-col items-center justify-center gap-1"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-neutral-950 bg-lime-400 text-neutral-950 shadow-lg shadow-lime-400/20 transition hover:bg-lime-300 active:scale-95">
              <DumbbellIcon className="h-7 w-7" />
            </span>
            <span className="text-[10px] font-bold text-lime-300">
              Trening
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate("community", "community")}
            aria-current={active === "community" ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${
              active === "community" ? "text-lime-300" : "text-neutral-500"
            }`}
          >
            <UsersIcon className="h-5 w-5" />
            Społeczność
          </button>
          <button
            type="button"
            onClick={() => navigate("home", "dashboard-top")}
            aria-current={active === "home" ? "page" : undefined}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${
              active === "home" ? "text-lime-300" : "text-neutral-500"
            }`}
          >
            <HomeIcon className="h-5 w-5" />
            Dom
          </button>
        </div>
      </nav>
    </>
  );
}
