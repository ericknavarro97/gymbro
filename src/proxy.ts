/**
 * Next 16 Proxy (formerly middleware; Node.js runtime by default).
 *
 * Protects every app route and /media/* (licensed GIFs, PLAN §2.4): without
 * a valid session, pages and media redirect to /login (pages carry ?next=),
 * and /api/* answers 401 JSON. Public: /login, /registro, /api/auth/*, Next
 * internals, favicon/manifest/icons and other root static files.
 *
 * This is the coarse gate only: every server action / handler still calls
 * requireUser()/getUserOrNull() and scopes data by user id (proxy matchers
 * can silently stop covering a route; see the Data Security guide).
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth/auth";
import { AUTH_PAGES, isPublicPath } from "@/server/auth/public-paths";

async function hasValidSession(request: NextRequest): Promise<boolean> {
  // Cheap pre-check: no session cookie → no need to hit the DB.
  if (!getSessionCookie(request)) return false;
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
      // disableCookieCache: check the `session` row, so sign-out revokes at once.
      query: { disableRefresh: true, disableCookieCache: true },
    });
    return session !== null;
  } catch (err) {
    // Fail closed: a forged cookie must never unlock /media/* while the DB is down.
    console.error("[proxy] session check failed", err);
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  if (isPublic && !AUTH_PAGES.has(pathname)) return NextResponse.next();

  const authed = await hasValidSession(request);

  if (AUTH_PAGES.has(pathname)) {
    // Already signed in → skip login/registro.
    if (authed && request.method === "GET") return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Inicia sesión" } }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  if (!pathname.startsWith("/media/") && pathname !== "/") {
    login.searchParams.set("next", pathname + search);
  }
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Everything except Next internals (static chunks, image optimizer, data).
    "/((?!_next/static|_next/image|_next/data).*)",
  ],
};
