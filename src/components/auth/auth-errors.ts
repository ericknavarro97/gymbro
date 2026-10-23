/** Spanish messages for Better Auth error codes (docs/API.md → Auth). */
export type AuthField = "name" | "username" | "password" | "confirm" | "signupCode" | "form";

const MESSAGES: Record<string, { field: AuthField; message: string }> = {
  INVALID_SIGNUP_CODE: { field: "signupCode", message: "El código de invitación no es válido." },
  USERNAME_REQUIRED: { field: "username", message: "Escribe un nombre de usuario." },
  INVALID_USERNAME: {
    field: "username",
    message: "Usa solo letras, números, punto o guion bajo (3 a 30 caracteres).",
  },
  USERNAME_TOO_SHORT: { field: "username", message: "El usuario debe tener al menos 3 caracteres." },
  USERNAME_TOO_LONG: { field: "username", message: "El usuario puede tener máximo 30 caracteres." },
  USERNAME_IS_ALREADY_TAKEN: { field: "username", message: "Ese usuario ya está ocupado. Prueba con otro." },
  USERNAME_IS_ALREADY_TAKEN_PLEASE_TRY_ANOTHER: {
    field: "username",
    message: "Ese usuario ya está ocupado. Prueba con otro.",
  },
  PASSWORD_TOO_SHORT: { field: "password", message: "La contraseña debe tener al menos 8 caracteres." },
  PASSWORD_TOO_LONG: { field: "password", message: "La contraseña puede tener máximo 128 caracteres." },
  INVALID_USERNAME_OR_PASSWORD: { field: "form", message: "Usuario o contraseña incorrectos." },
};

export function authErrorMessage(err: { code?: string; status?: number; message?: string } | null | undefined): {
  field: AuthField;
  message: string;
} {
  if (err?.code && MESSAGES[err.code]) return MESSAGES[err.code];
  if (err?.status === 429) return { field: "form", message: "Demasiados intentos. Espera un momento e inténtalo de nuevo." };
  if (err?.status === 401) return MESSAGES.INVALID_USERNAME_OR_PASSWORD;
  if (!err?.status) return { field: "form", message: "Sin conexión con el servidor. Revisa tu internet." };
  return { field: "form", message: "Algo salió mal. Inténtalo de nuevo." };
}

export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
