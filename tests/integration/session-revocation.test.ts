/**
 * Regression (R2-1): after sign-out, replaying the old cookies (session_token
 * + a signed session_data cache cookie) must be rejected right away by the
 * proxy (pages, /media, /api) and by the server getSession helper path.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username as usernamePlugin } from "better-auth/plugins";
import { NextRequest } from "next/server";
import { db } from "@/server/db/client";
import * as authSchema from "@/server/db/schema/auth";
import { session as sessionTable, user } from "@/server/db/schema";
import { auth } from "@/server/auth/auth";
import { proxy } from "@/proxy";

const PASSWORD = "revocation-password-123";
const uname = `t_rev_${randomUUID().slice(0, 8)}`;

// Same DB + secret as the app, but WITH the cookie cache: mints a valid signed
// `session_data` cookie, as an older/compromised config or browser would hold.
const cachingAuth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  plugins: [usernamePlugin()],
});

function cookieHeader(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
}

let cookies = "";

beforeAll(async () => {
  await auth.api.signUpEmail({
    body: {
      name: "Revocation Test",
      username: uname,
      password: PASSWORD,
      email: "ignored@example.com",
      signupCode: process.env.SIGNUP_CODE,
    } as never,
  });
  const res = await cachingAuth.api.signInUsername({
    body: { username: uname, password: PASSWORD },
    returnHeaders: true,
  });
  cookies = cookieHeader(res.headers);
});

afterAll(async () => {
  await db.delete(user).where(inArray(user.username, [uname]));
});

describe("session revocation", () => {
  it("app auth does not use the session_data cookie cache", () => {
    expect(auth.options.session?.cookieCache?.enabled).toBe(false);
  });

  it("rejects replayed cookies immediately after sign-out", async () => {
    expect(cookies).toContain("session_token=");
    expect(cookies).toContain("session_data=");

    const before = await proxy(new NextRequest("http://localhost/perfil", { headers: { cookie: cookies } }));
    expect(before.headers.get("location")).toBeNull();

    await auth.api.signOut({ headers: new Headers({ cookie: cookies }) });
    const signed = decodeURIComponent(/session_token=([^;]+)/.exec(cookies)![1]);
    const token = signed.slice(0, signed.lastIndexOf("."));
    const rows = await db.select().from(sessionTable).where(eq(sessionTable.token, token));
    expect(rows).toHaveLength(0);

    // Sanity: a cookie-cache-trusting instance would still accept them.
    expect(await cachingAuth.api.getSession({ headers: new Headers({ cookie: cookies }) })).not.toBeNull();

    const page = await proxy(new NextRequest("http://localhost/perfil", { headers: { cookie: cookies } }));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/login");

    const media = await proxy(
      new NextRequest("http://localhost/media/exercises/0009.gif", { headers: { cookie: cookies } }),
    );
    expect(media.status).toBe(307);

    const api = await proxy(
      new NextRequest("http://localhost/api/exercises/x/history", { headers: { cookie: cookies } }),
    );
    expect(api.status).toBe(401);

    // Same call the server helper (requireUser/getUserOrNull) makes.
    const s = await auth.api.getSession({
      headers: new Headers({ cookie: cookies }),
      query: { disableCookieCache: true },
    });
    expect(s).toBeNull();
  });
});
