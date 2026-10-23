import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6 animate-rise">
      <div>
        <p className="eyebrow text-accent-text">Pure Bodybuilding · Full Body</p>
        <h1 className="mt-1 font-display text-[2.75rem] leading-[0.95] font-extrabold uppercase">De vuelta al fierro</h1>
        <p className="mt-2 text-fg-muted">Entra para ver tu sesión de hoy.</p>
      </div>
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

function FormSkeleton({ fields }: { fields: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="mt-2 h-14 w-full rounded-xl" />
    </div>
  );
}
