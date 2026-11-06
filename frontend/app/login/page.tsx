import { Suspense } from "react";
import AuthPageGate from "@/components/login/AuthPageGate";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <AuthPageGate>
      <Suspense fallback={<div className="min-h-dvh bg-neutral-950" />}>
        <LoginForm />
      </Suspense>
    </AuthPageGate>
  );
}
