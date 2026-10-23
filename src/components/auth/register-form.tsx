"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { signUpWithUsername } from "@/lib/auth-client";
import { safeNextPath } from "@/server/auth/public-paths";
import { Button } from "../ui/button";
import { Input, PasswordInput } from "../ui/input";
import { authErrorMessage, USERNAME_RE, type AuthField } from "./auth-errors";
import { FormAlert } from "./form-alert";

type Errors = Partial<Record<AuthField, string>>;

export type RegisterValues = { name: string; username: string; password: string; confirm: string; signupCode: string };

/** Client-side checks; `requireCode` mirrors the server's SIGNUP_CODE gate (auth.ts before-hook). */
export function validateRegistration(values: RegisterValues, requireCode: boolean): Errors {
  const errs: Errors = {};
  if (!values.name.trim()) errs.name = "Escribe tu nombre.";
  const u = values.username.trim();
  if (!u) errs.username = "Escribe un nombre de usuario.";
  else if (!USERNAME_RE.test(u)) errs.username = "Usa solo letras, números, punto o guion bajo (3 a 30 caracteres).";
  if (values.password.length < 8) errs.password = "La contraseña debe tener al menos 8 caracteres.";
  else if (values.password.length > 128) errs.password = "La contraseña puede tener máximo 128 caracteres.";
  if (values.confirm !== values.password) errs.confirm = "Las contraseñas no coinciden.";
  if (requireCode && !values.signupCode.trim()) errs.signupCode = "Escribe tu código de invitación.";
  return errs;
}

/**
 * `requireCode` is computed on the server (registro/page.tsx) from SIGNUP_CODE:
 * the invite-code field only exists, and is required, when the server enforces it.
 */
export function RegisterForm({ requireCode }: { requireCode: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [values, setValues] = useState<RegisterValues>({ name: "", username: "", password: "", confirm: "", signupCode: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  const set = (k: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateRegistration(values, requireCode);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    startTransition(async () => {
      let res: Awaited<ReturnType<typeof signUpWithUsername>> | null = null;
      try {
        res = await signUpWithUsername({
          name: values.name,
          username: values.username,
          password: values.password,
          signupCode: requireCode ? values.signupCode.trim() : undefined,
        });
      } catch {
        res = null;
      }
      if (!res || res.error) {
        const { field, message } = authErrorMessage(res?.error ?? null);
        setErrors({ [field]: message });
        return;
      }
      // autoSignIn: the session cookie is set; onboarding comes next unless a deep link was requested.
      router.replace(next === "/" ? "/bienvenida" : next);
      router.refresh();
    });
  };

  const loginHref = next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={errors.form ?? null} />
      <Input label="Nombre" name="name" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name} required />
      <Input
        label="Usuario"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={values.username}
        onChange={set("username")}
        error={errors.username}
        hint="3 a 30 caracteres: letras, números, punto o guion bajo."
        required
      />
      <PasswordInput
        label="Contraseña"
        name="password"
        autoComplete="new-password"
        value={values.password}
        onChange={set("password")}
        error={errors.password}
        hint="Mínimo 8 caracteres."
        required
      />
      <PasswordInput
        label="Confirma tu contraseña"
        name="confirm"
        autoComplete="new-password"
        value={values.confirm}
        onChange={set("confirm")}
        error={errors.confirm}
        required
      />
      {requireCode ? (
        <Input
          label="Código de invitación"
          name="signupCode"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={values.signupCode}
          onChange={set("signupCode")}
          error={errors.signupCode}
          hint="Escribe el código que te compartieron."
          required
        />
      ) : null}
      <Button type="submit" size="lg" block loading={pending} className="mt-2">
        Crear cuenta
      </Button>
      <p className="text-center text-sm text-fg-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href={loginHref} className="inline-flex min-h-11 items-center font-semibold text-accent-text underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
