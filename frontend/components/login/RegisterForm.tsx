"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSafeReturnPath } from "@/lib/return-to";
import { API_URL } from "@/lib/api";

/* ---------- Pole hasła z podglądem ---------- */
type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  status?: "default" | "valid" | "invalid";
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••",
  status = "default",
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  const borderClass =
    status === "invalid"
      ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/10"
      : status === "valid"
        ? "border-lime-400/60 focus:border-lime-400 focus:ring-lime-400/10"
        : "border-white/10 focus:border-lime-400/70 focus:ring-lime-400/10";

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-neutral-300"
      >
        {label}
      </label>
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-neutral-500"
        >
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border bg-neutral-950/60 py-3 pr-12 pl-12 text-white placeholder-neutral-600 transition outline-none focus:ring-4 ${borderClass}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ukryj hasło" : "Pokaż hasło"}
          className="absolute top-1/2 right-4 -translate-y-1/2 text-neutral-500 transition hover:text-neutral-300"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            {show ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3.2 3.7M6.2 7.8A15 15 0 0 0 3 12s4 6 9 6c1.3 0 2.5-.3 3.6-.8" />
                <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              </>
            ) : (
              <>
                <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ---------- Checkbox ---------- */
type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
};

function Checkbox({ checked, onChange, children }: CheckboxProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-4 peer-focus-visible:ring-lime-400/20 ${
          checked
            ? "border-lime-400 bg-lime-400"
            : "border-white/20 bg-neutral-950/60"
        }`}
      >
        {checked && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 text-neutral-950"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
      <span className="text-sm leading-5 text-neutral-400">{children}</span>
    </label>
  );
}

/* ---------- Formularz rejestracji ---------- */
export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptCookies, setAcceptCookies] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordsFilled = confirmPassword.length > 0;
  const passwordsMatch = password === confirmPassword;

  const confirmStatus = !passwordsFilled
    ? "default"
    : passwordsMatch
      ? "valid"
      : "invalid";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (username.trim().length < 3) {
      setError("Nazwa użytkownika musi mieć co najmniej 3 znaki.");
      return;
    }
    if (password.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    if (!passwordsMatch) {
      setError("Hasła nie są takie same.");
      return;
    }
    if (!acceptTerms || !acceptCookies) {
      setError("Zaakceptuj regulamin oraz politykę cookies, aby kontynuować.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = Array.isArray(data?.message)
          ? data.message[0]
          : data?.message;
        setError(msg ?? "Coś poszło nie tak. Spróbuj ponownie.");
        return;
      }

      router.replace(getSafeReturnPath(returnTo, window.location.origin));
    } catch {
      setError("Nie można połączyć się z serwerem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4 py-10">
      {/* Tło: poświaty */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-lime-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-400 shadow-lg shadow-lime-400/30">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-neutral-950"
            >
              <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Dołącz do Rep<span className="text-lime-400">Load</span>
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Załóż konto i zacznij śledzić swój progres.
          </p>
        </div>

        {/* Karta */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-3xl border border-white/10 bg-neutral-900/70 p-8 shadow-2xl backdrop-blur-xl"
        >
          {/* Nazwa użytkownika */}
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-neutral-300"
            >
              Nazwa użytkownika
            </label>
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-neutral-500"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
              </svg>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="np. jan_kowalski"
                className="w-full rounded-xl border border-white/10 bg-neutral-950/60 py-3 pr-4 pl-12 text-white placeholder-neutral-600 transition outline-none focus:border-lime-400/70 focus:ring-4 focus:ring-lime-400/10"
              />
            </div>
          </div>

          {/* Hasło */}
          <PasswordField
            id="password"
            label="Hasło"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="Min. 8 znaków"
          />

          {/* Powtórz hasło */}
          <div>
            <PasswordField
              id="confirmPassword"
              label="Powtórz hasło"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              status={confirmStatus}
            />
            {passwordsFilled && (
              <p
                className={`mt-2 text-xs ${
                  passwordsMatch ? "text-lime-400" : "text-red-400"
                }`}
              >
                {passwordsMatch
                  ? "Hasła są takie same"
                  : "Hasła nie są takie same"}
              </p>
            )}
          </div>

          {/* Zgody */}
          <div className="space-y-3 pt-1">
            <Checkbox checked={acceptTerms} onChange={setAcceptTerms}>
              Akceptuję{" "}
              <span className="font-semibold text-lime-400">regulamin</span>{" "}
              serwisu
            </Checkbox>

            <Checkbox checked={acceptCookies} onChange={setAcceptCookies}>
              Akceptuję{" "}
              <span className="font-semibold text-lime-400">
                politykę cookies
              </span>
            </Checkbox>
          </div>

          {/* Błąd */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          {/* Przycisk */}
          <button
            type="submit"
            disabled={loading}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3.5 font-bold text-neutral-950 shadow-lg shadow-lime-400/20 transition hover:bg-lime-300 hover:shadow-lime-400/40 focus:ring-4 focus:ring-lime-400/30 focus:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950" />
                Tworzenie konta...
              </>
            ) : (
              <>
                Załóż konto
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 transition group-hover:translate-x-1"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Powrót do logowania */}
        <div className="mt-6 text-center">
          <p className="mb-3 text-sm text-neutral-500">Masz już konto?</p>
          <Link
            href={
              returnTo
                ? `/login?next=${encodeURIComponent(returnTo)}`
                : "/login"
            }
            className="block w-full rounded-xl border border-lime-400/40 bg-lime-400/10 py-3.5 text-center text-base font-bold text-lime-400 transition hover:border-lime-400 hover:bg-lime-400/20 active:scale-[0.98]"
          >
            Zaloguj się
          </Link>
        </div>
      </div>
    </div>
  );
}