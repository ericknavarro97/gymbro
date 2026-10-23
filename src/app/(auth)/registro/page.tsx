import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6 animate-rise">
      <div>
        <p className="eyebrow text-accent-text">10 semanas · 5 días</p>
        <h1 className="mt-1 font-display text-[2.75rem] leading-[0.95] font-extrabold uppercase">Crea tu cuenta</h1>
        <p className="mt-2 text-fg-muted">Tus cargas quedan guardadas semana a semana.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-[34rem] w-full rounded-xl" />}>
        <RegisterFormWithGate />
      </Suspense>
    </div>
  );
}

/**
 * Reads SIGNUP_CODE at request time (not at build/prerender, since cacheComponents
 * would otherwise bake it into the static shell). Only a boolean reaches the client.
 */
async function RegisterFormWithGate() {
  await connection();
  const requireCode = Boolean(process.env.SIGNUP_CODE?.trim());
  return <RegisterForm requireCode={requireCode} />;
}
