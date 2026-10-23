/**
 * Public-path rules for src/proxy.ts (kept separate so they can be unit tested
 * and because the proxy file should only export `proxy` + `config`).
 */
const PUBLIC_PAGES = new Set(["/login", "/registro"]);
/** Pages that bounce signed-in users back to "/". */
export const AUTH_PAGES: ReadonlySet<string> = PUBLIC_PAGES;
const PUBLIC_PREFIXES = ["/api/auth/", "/icons/", "/_next/"];
const PUBLIC_FILES = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
  "/sw.js",
]);
/** Root-level static assets from public/ (outside /media) and metadata icons. */
const STATIC_FILE = /\.(?:svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest|woff2?|ttf|css|js|map)$/i;
const ICON_ROUTE = /^\/(?:icon|apple-icon)(?:[-\w]*)?(?:\.\w+)?$/;

/**
 * Decode percent-escapes (repeatedly, for double encoding) and collapse
 * duplicate slashes, so `/%6Dedia/x.gif` or `/media%2Fx.gif` are judged as the
 * file the static server will actually serve. Returns null when the path
 * cannot be decoded (treated as protected).
 */
export function normalizePathname(pathname: string): string | null {
  let p = pathname;
  try {
    for (let i = 0; i < 3 && p.includes("%"); i++) {
      const d = decodeURIComponent(p);
      if (d === p) break;
      p = d;
    }
  } catch {
    return null;
  }
  if (p.includes("%")) return null;
  return p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

export function isPublicPath(rawPathname: string): boolean {
  const pathname = normalizePathname(rawPathname);
  if (pathname === null) return false;
  // Dot segments ("/_next/%2E%2E/media/…") never reach a public file legitimately.
  if (/(?:^|\/)\.{1,2}(?:\/|$)/.test(pathname)) return false;
  if (/^\/media(?:\/|$)/i.test(pathname)) return false;
  if (PUBLIC_PAGES.has(pathname) || PUBLIC_FILES.has(pathname)) return true;
  if (pathname === "/api/auth") return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (ICON_ROUTE.test(pathname)) return true;
  // Static files from public/ (e.g. /next.svg); /media/* was excluded above.
  if (!pathname.startsWith("/api/") && STATIC_FILE.test(pathname)) return true;
  return false;
}

const NEXT_BASE = "http://next.invalid";

/**
 * Same-origin relative path safe to redirect to after login (prevents open redirects).
 *
 * The browser's URL parser strips tab/CR/LF and treats `\\` like `/`, so a value
 * such as "/\t/evil.com" would become the protocol-relative "//evil.com" once
 * handed to router.replace(). We therefore reject control chars and backslashes
 * outright, resolve against a sentinel origin, require that origin to survive,
 * and re-check the normalized result (dot segments like "/..//evil.com" resolve
 * to "//evil.com").
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (/[\x00-\x1f\x7f\\]/.test(next)) return "/";
  let url: URL;
  try {
    url = new URL(next, NEXT_BASE);
  } catch {
    return "/";
  }
  if (url.origin !== NEXT_BASE) return "/";
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}
