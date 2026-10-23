"use client";

import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Same-origin client: talks to /api/auth/* on the current host. */
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

export const { signIn, signOut, useSession } = authClient;

/** Mirrors src/server/auth/synthetic-email.ts (the server overrides it anyway). */
const SYNTHETIC_EMAIL_DOMAIN = "gymbros.local";

export type SignUpInput = {
  name: string;
  username: string;
  password: string;
  /** Invite code; required by the server only when SIGNUP_CODE is set. */
  signupCode?: string;
};

/**
 * Register with name + username + password. Better Auth needs an email, so a
 * placeholder `<username>@gymbros.local` is sent; the server re-derives it.
 */
export function signUpWithUsername({ name, username, password, signupCode }: SignUpInput) {
  const normalized = username.trim().toLowerCase();
  return authClient.signUp.email({
    name: name.trim(),
    username: normalized,
    displayUsername: username.trim(),
    email: `${normalized}@${SYNTHETIC_EMAIL_DOMAIN}`,
    password,
    ...(signupCode ? { signupCode } : {}),
  } as Parameters<typeof authClient.signUp.email>[0]);
}

/** Sign in with username + password (username plugin endpoint). */
export function signInWithUsername(username: string, password: string) {
  return authClient.signIn.username({ username: username.trim(), password });
}
