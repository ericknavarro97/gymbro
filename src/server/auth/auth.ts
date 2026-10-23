/**
 * Better Auth server instance.
 *
 * Users sign up with name + username + password only. Better Auth's
 * email/password flow requires an email, so the server ALWAYS synthesizes
 * `<normalized-username>@gymbros.local` in a before-hook on `/sign-up/email`,
 * overriding whatever the client sent (see `syntheticEmail`). These addresses
 * are never mailed; there is no password recovery in v1 (PLAN §7).
 *
 * Invite code: when `SIGNUP_CODE` is set, `/sign-up/email` requires the body
 * field `signupCode` to match it (the extra field is ignored by Better Auth's
 * own user-input parsing, so it is never persisted).
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { timingSafeEqual } from "node:crypto";
import { db } from "../db/client";
import * as authSchema from "../db/schema/auth";
import { normalizeUsername, syntheticEmail } from "./synthetic-email";

export { SYNTHETIC_EMAIL_DOMAIN, normalizeUsername, syntheticEmail } from "./synthetic-email";

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const ONE_DAY = 60 * 60 * 24;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined,
  // Dev only: allow `next dev --port N` on any local port without editing BETTER_AUTH_URL
  // (otherwise cookie-bearing POSTs like sign-out fail with INVALID_ORIGIN).
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:*", "http://127.0.0.1:*"] : []),
  // Extra origins (e.g. a tunnel like https://xyz.ngrok-free.app), comma-separated.
  ...(process.env.TRUSTED_ORIGINS ?? "").split(",").map((o) => o.trim()),
].filter((o): o is string => Boolean(o));

export const auth = betterAuth({
  appName: "GymBros",
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: THIRTY_DAYS,
    // Sliding renewal: refresh the expiry at most once a day while in use.
    updateAge: ONE_DAY,
    // No cookie cache: a signed `session_data` cookie would let a revoked
    // session (sign-out elsewhere, deleted row) keep working until it expires.
    // Every getSession hits the `session` table instead (cheap at this scale).
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const body = (ctx.body ?? {}) as Record<string, unknown>;

      const expected = process.env.SIGNUP_CODE?.trim();
      if (expected) {
        const provided = typeof body.signupCode === "string" ? body.signupCode.trim() : "";
        if (!provided || !safeEqual(provided, expected)) {
          throw new APIError("FORBIDDEN", {
            message: "Código de invitación inválido",
            code: "INVALID_SIGNUP_CODE",
          });
        }
      }

      const rawUsername = typeof body.username === "string" ? body.username : "";
      const normalized = normalizeUsername(rawUsername);
      if (!normalized) {
        throw new APIError("BAD_REQUEST", {
          message: "El usuario es obligatorio",
          code: "USERNAME_REQUIRED",
        });
      }

      const rest = { ...body };
      delete rest.signupCode;
      return {
        context: {
          body: { ...rest, email: syntheticEmail(normalized) },
        },
      };
    }),
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    // Must be last: lets server actions set auth cookies via next/headers.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];
