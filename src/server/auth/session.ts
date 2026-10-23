/**
 * Session helpers for Server Components, Server Actions and Route Handlers.
 *
 * Next 16 + Cache Components: `headers()` is request-time data, so callers
 * must NOT use these inside a `"use cache"` scope, and Server Components that
 * call them must render inside a <Suspense> boundary (or a route with
 * `export const instant = false`). To cache session-derived data, resolve the
 * user here and pass `user.id` into a cached function.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, type AuthSession, type AuthUser } from "./auth";

/**
 * Deduplicated per request via React `cache`. Returns null when signed out.
 * Always validated against the DB (`disableCookieCache`) so a revoked session
 * is rejected immediately, never trusted from a signed `session_data` cookie.
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
});

/** Returns the signed-in user or redirects to /login (throws, never returns null). */
export async function requireUser(): Promise<AuthUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session.user;
}

/** Like requireUser but returns null instead of redirecting (for JSON route handlers). */
export async function getUserOrNull(): Promise<AuthUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export type { AuthSession, AuthUser };
