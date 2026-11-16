"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoutIcon, UserIcon } from "./icons";

type Props = {
  username: string;
  role: string;
  accountMenuOpen: boolean;
  profileOpen: boolean;
  onLogout: () => Promise<void>;
  onOpenProfile: () => void;
  onCloseAccountMenu: () => void;
  onCloseProfile: () => void;
};

function LogoutConfirmation({
  onCancel,
  onConfirm,
  error,
  pending,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  error: string;
  pending: boolean;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onCancel();
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, pending]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[var(--surface)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/50 [animation:account-dialog-enter_180ms_ease-out] sm:rounded-3xl sm:p-6"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-400/10 text-rose-300">
          <LogoutIcon className="h-5 w-5" />
        </div>
        <h2
          id="logout-dialog-title"
          className="text-center text-xl font-bold text-white"
        >
          Czy na pewno chcesz się wylogować?
        </h2>
        <p
          id="logout-dialog-description"
          className="mt-3 text-center text-sm leading-6 text-neutral-400"
        >
          Czy na pewno chcesz zakończyć bieżącą sesję i wylogować się ze swojego
          konta?
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200"
          >
            {error}
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-white/10 px-4 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="min-h-12 rounded-xl bg-rose-500 px-4 text-sm font-bold text-white transition hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Wylogowywanie…" : "Wyloguj się"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AccountMenu({
  username,
  role,
  accountMenuOpen,
  profileOpen,
  onLogout,
  onOpenProfile,
  onCloseAccountMenu,
  onCloseProfile,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const confirmationWasOpenRef = useRef(false);
  const cancelLogoutConfirmation = useCallback(
    () => setLogoutConfirmOpen(false),
    [],
  );

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

  useEffect(() => {
    if (logoutConfirmOpen) {
      confirmationWasOpenRef.current = true;
      return;
    }
    if (!confirmationWasOpenRef.current) return;
    confirmationWasOpenRef.current = false;

    const previousFocus = returnFocusRef.current;
    if (previousFocus?.isConnected) {
      previousFocus.focus();
    } else {
      const mobileTrigger = document.querySelector<HTMLElement>(
        "[data-account-menu-trigger]",
      );
      if (mobileTrigger?.getClientRects().length) {
        mobileTrigger.focus();
      } else {
        menuButtonRef.current?.focus();
      }
    }
    returnFocusRef.current = null;
  }, [logoutConfirmOpen]);

  const openLogoutConfirmation = () => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setLogoutError("");
    setLogoutConfirmOpen(true);
    setMenuOpen(false);
    onCloseAccountMenu();
  };

  const confirmLogout = async () => {
    setLogoutPending(true);
    setLogoutError("");
    try {
      await onLogout();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Nie udało się wylogować. Spróbuj ponownie.",
      );
      setLogoutPending(false);
    }
  };

  const accountActions = (
    <>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setMenuOpen(false);
          onCloseAccountMenu();
          onOpenProfile();
        }}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-400/10 text-lime-300">
          <UserIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">
            Profil i konto
          </span>
          <span className="mt-0.5 block truncate text-xs text-neutral-500">
            Ustawienia konta
          </span>
        </span>
      </button>
      {role === "admin" && (
        <Link
          href="/panel-admin"
          role="menuitem"
          onClick={() => {
            setMenuOpen(false);
            onCloseAccountMenu();
          }}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-lime-300 transition hover:bg-lime-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
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
        onClick={openLogoutConfirmation}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rose-300 transition hover:bg-rose-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
      >
        <LogoutIcon className="h-4 w-4" />
        Wyloguj się
      </button>
    </>
  );

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
            <div className="mb-1 flex items-center gap-3 border-b border-white/[0.07] px-3 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-400/10 text-sm font-bold text-lime-300">
                {(username[0] ?? "U").toLocaleUpperCase("pl-PL")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">
                  {username}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">
                  Konto {role === "admin" ? "administratora" : "użytkownika"}
                </span>
              </span>
            </div>
            {accountActions}
          </div>
        )}
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Otwórz menu profilu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-lime-300/30 bg-[var(--surface-raised)] text-sm font-extrabold text-lime-300 shadow-xl shadow-black/30 transition duration-200 hover:scale-105 hover:border-lime-300/70 hover:bg-[var(--surface)] hover:text-lime-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
        >
          {(username[0] ?? "U").toLocaleUpperCase("pl-PL")}
        </button>
      </div>

      {accountMenuOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-sm sm:items-center sm:pb-3 md:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCloseAccountMenu();
          }}
        >
          <section
            role="menu"
            aria-label="Menu konta"
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--surface)] p-3 shadow-2xl shadow-black/50"
          >
            <div className="mb-1 flex items-center gap-3 border-b border-white/[0.07] px-3 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-400/10 text-sm font-bold text-lime-300">
                {(username[0] ?? "U").toLocaleUpperCase("pl-PL")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">
                  {username}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">
                  Konto {role === "admin" ? "administratora" : "użytkownika"}
                </span>
              </span>
              <button
                type="button"
                aria-label="Zamknij menu konta"
                onClick={onCloseAccountMenu}
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl text-xl text-neutral-400 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
              >
                ×
              </button>
            </div>
            {accountActions}
          </section>
        </div>
      )}

      {profileOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-sm sm:items-center sm:pb-3"
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
          </section>
        </div>
      )}

      {logoutConfirmOpen && (
        <LogoutConfirmation
          onCancel={cancelLogoutConfirmation}
          onConfirm={() => void confirmLogout()}
          error={logoutError}
          pending={logoutPending}
        />
      )}
    </>
  );
}
