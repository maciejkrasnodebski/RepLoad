"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AuthPageGate({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready">("checking");
  const [verificationError, setVerificationError] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const verifySession = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!active) return;
        if (response.ok) {
          router.replace("/");
          return;
        }
        if (response.status !== 401) {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (!active) return;
        console.error("Nie udało się zweryfikować sesji:", error);
        setVerificationError(true);
      }
      if (active) setStatus("ready");
    };
    void verifySession();
    return () => {
      active = false;
      controller.abort();
    };
  }, [router]);

  if (status === "checking") {
    return (
      <main
        aria-label="Sprawdzanie sesji"
        className="flex min-h-dvh items-center justify-center bg-[var(--app-bg)]"
      >
        <div className="h-2 w-24 animate-pulse rounded-full bg-lime-400/70" />
      </main>
    );
  }

  return (
    <>
      {verificationError && (
        <p
          role="status"
          className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-xl border border-amber-300/20 bg-[var(--surface)] px-4 py-3 text-center text-sm text-amber-100"
        >
          Nie udało się sprawdzić poprzedniej sesji. Możesz spróbować się
          zalogować.
        </p>
      )}
      {children}
    </>
  );
}
