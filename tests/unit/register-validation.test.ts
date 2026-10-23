import { describe, expect, it } from "vitest";
import { validateRegistration, type RegisterValues } from "@/components/auth/register-form";

const ok: RegisterValues = { name: "Ana", username: "ana_1", password: "password-123", confirm: "password-123", signupCode: "" };

describe("validateRegistration — invite code", () => {
  it("does not ask for a code when SIGNUP_CODE is not set", () => {
    expect(validateRegistration(ok, false)).toEqual({});
  });
  it("requires the code when SIGNUP_CODE is set", () => {
    expect(validateRegistration(ok, true)).toEqual({ signupCode: "Escribe tu código de invitación." });
    expect(validateRegistration({ ...ok, signupCode: "   " }, true).signupCode).toBe("Escribe tu código de invitación.");
  });
  it("accepts a non-empty code when required", () => {
    expect(validateRegistration({ ...ok, signupCode: "abc" }, true)).toEqual({});
  });
  it("keeps the other field checks", () => {
    const errs = validateRegistration({ ...ok, name: " ", confirm: "x" }, false);
    expect(errs.name).toBe("Escribe tu nombre.");
    expect(errs.confirm).toBe("Las contraseñas no coinciden.");
  });
});
