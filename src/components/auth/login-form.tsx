"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { signInWithUsername } from "@/lib/auth-client";
import { safeNextPath } from "@/server/auth/public-paths";
import { Button } from "../ui/button";
import { Input, PasswordInput } from "../ui/input";
import { authErrorMessage } from "./auth-errors";
import { FormAlert } from "./form-alert";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string; form?: string }>({});
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!username.trim()) errs.username = "Escribe tu usuario.";
    if (!password) errs.password = "Escribe tu contraseña.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    startTransition(async () => {
      let res: Awaited<ReturnType<typeof signInWithUsername>> | null = null;
      try {
        res = await signInWithUsername(username, password);
      } catch {
        res = null;
      }
      if (!res || res.error) {
        const { field, message } = authErrorMessage(res?.error ?? null);
        setErrors(field === "username" || field === "password" ? { [field]: message } : { form: message });
        return;
      }
      router.replace(next);
      router.refresh();
    });
  };

  const signupHref = next !== "/" ? `/registro?next=${encodeURIComponent(next)}` : "/registro";

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={errors.form ?? null} />
      <Input
        label="Usuario"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={errors.username}
        required
      />
      <PasswordInput
        label="Contraseña"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        required
      />
      <Button type="submit" size="lg" block loading={pending} className="mt-2">
        Entrar
      </Button>
      <p className="text-center text-sm text-fg-muted">
        ¿No tienes cuenta?{" "}
        <Link href={signupHref} className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-4 hover:underline">
          Crea una
        </Link>
      </p>
    </form>
  );
}
