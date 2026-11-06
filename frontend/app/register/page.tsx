import { Suspense } from "react";
import RegisterForm from "@/components/login/RegisterForm";
import AuthPageGate from "@/components/login/AuthPageGate";

export default function RegisterPage() {
  return (
    <AuthPageGate>
      <Suspense fallback={<div className="min-h-dvh bg-neutral-950" />}>
        <RegisterForm />
      </Suspense>
    </AuthPageGate>
  );
}