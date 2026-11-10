"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoutIcon, UserIcon } from "./icons";

type Props = {
  username: string;
  role: string;
  profileOpen: boolean;
  onLogout: () => void;
  onOpenProfile: () => void;
  onCloseProfile: () => void;
};

export default function AccountMenu({
  username,
  role,
  profileOpen,
  onLogout,
  onOpenProfile,
  onCloseProfile,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <div
        ref={rootRef}
        className="fixed right-5 bottom-5 z-40 hidden md:block"
      >
        {menuOpen && (
          <div
            role="menu"
            aria-label="Menu konta"
            className="absolute right-0 bottom-full mb-3 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)] p-2 shadow-2xl shadow-black/40"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onOpenProfile();
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-white/[0.05]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-400/10 text-lime-300">
                <UserIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">
                  Profil i konto
                </span>
                <span className="mt-0.5 block truncate text-xs text-neutral-500">
                  {username}
                </span>
              </span>
            </button>
            {role === "admin" && (
              <Link
                href="/panel-admin"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-lime-300 transition hover:bg-lime-400/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-400/10">
                  ⚙
                </span>
                Panel administratora
              </Link>
            )}
            <div className="my-1 border-t border-white/[0.07]" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-neutral-300 transition hover:bg-rose-400/10 hover:text-rose-300"
            >
              <LogoutIcon className="h-4 w-4" />
              Wyloguj się
            </button>
          </div>
        )}
        <button
          type="button"
          aria-label="Otwórz menu profilu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-lime-300/30 bg-[var(--surface-raised)] text-sm font-extrabold text-lime-300 shadow-xl shadow-black/30 transition hover:border-lime-300/60 hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
        >
          {(username[0] ?? "U").toLocaleUpperCase("pl-PL")}
        </button>
      </div>

      {profileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCloseProfile();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-dialog-title"
            className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-[var(--surface)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-5"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                id="account-dialog-title"
                className="text-lg font-bold text-white"
              >
                Profil i konto
              </h2>
              <button
                type="button"
                aria-label="Zamknij profil"
                onClick={onCloseProfile}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-neutral-950/50 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-400/10 text-lime-300">
                <UserIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-neutral-500">Nazwa użytkownika</p>
                <p className="mt-1 truncate font-semibold text-white">
                  {username}
                </p>
              </div>
            </div>
            {role === "admin" && (
              <Link
                href="/panel-admin"
                onClick={onCloseProfile}
                className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-lime-400/15 px-4 text-sm font-semibold text-lime-300 transition hover:bg-lime-400/10"
              >
                <span aria-hidden="true">⚙</span>
                Panel administratora
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                onCloseProfile();
                onLogout();
              }}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-sm font-semibold text-neutral-300 transition hover:border-rose-300/30 hover:text-rose-300"
            >
              <LogoutIcon className="h-4 w-4" />
              Wyloguj się
            </button>
          </section>
        </div>
      )}
    </>
  );
}
