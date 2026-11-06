"use client";

import { useState } from "react";
import {
  CalendarIcon,
  DumbbellIcon,
  TrophyIcon,
  UserIcon,
} from "./icons";

type Props = {
  onStartWorkout: () => void;
  hasActiveWorkout: boolean;
};

const items = [
  { id: "home", label: "Główna", target: "dashboard-top" },
  { id: "plan", label: "Plan", target: "weekly-plan" },
  { id: "history", label: "Historia", target: "workout-history" },
  { id: "profile", label: "Profil", target: "profile" },
] as const;

export default function MobileNavigation({
  onStartWorkout,
  hasActiveWorkout,
}: Props) {
  const [active, setActive] = useState("home");

  const navigate = (id: string, target: string) => {
    setActive(id);
    document.getElementById(target)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <nav
      aria-label="Nawigacja mobilna"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-neutral-950/95 px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] shadow-[0_-12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end gap-1">
        <button
          type="button"
          onClick={() => navigate(items[0].id, items[0].target)}
          aria-current={active === "home" ? "page" : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition ${
            active === "home" ? "text-lime-300" : "text-neutral-500"
          }`}
        >
          <DumbbellIcon className="h-5 w-5" />
          Główna
        </button>
        <button
          type="button"
          onClick={() => navigate(items[1].id, items[1].target)}
          aria-current={active === "plan" ? "page" : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition ${
            active === "plan" ? "text-lime-300" : "text-neutral-500"
          }`}
        >
          <CalendarIcon className="h-5 w-5" />
          Plan
        </button>
        <button
          type="button"
          onClick={onStartWorkout}
          aria-current={hasActiveWorkout ? "page" : undefined}
          className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition active:scale-[0.98] ${
            hasActiveWorkout ? "text-lime-300" : "text-neutral-500"
          }`}
          aria-label={hasActiveWorkout ? "Wróć do aktywnego treningu" : "Rozpocznij trening"}
        >
          <span className="relative">
            <DumbbellIcon className="h-5 w-5" />
            {hasActiveWorkout && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-neutral-950 bg-lime-300" />
            )}
          </span>
          Trening
        </button>
        <button
          type="button"
          onClick={() => navigate(items[2].id, items[2].target)}
          aria-current={active === "history" ? "page" : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition ${
            active === "history" ? "text-lime-300" : "text-neutral-500"
          }`}
        >
          <TrophyIcon className="h-5 w-5" />
          Historia
        </button>
        <button
          type="button"
          onClick={() => navigate(items[3].id, items[3].target)}
          aria-current={active === "profile" ? "page" : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition ${
            active === "profile" ? "text-lime-300" : "text-neutral-500"
          }`}
        >
          <UserIcon className="h-5 w-5" />
          Profil
        </button>
      </div>
    </nav>
  );
}
