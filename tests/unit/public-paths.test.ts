import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "@/server/auth/public-paths";

describe("isPublicPath (proxy)", () => {
  it.each(["/login", "/registro", "/api/auth/sign-in/username", "/api/auth/get-session", "/favicon.ico", "/manifest.webmanifest", "/icons/icon-192.png", "/next.svg", "/apple-icon.png", "/icon.png"])(
    "%s is public",
    (p) => expect(isPublicPath(p)).toBe(true),
  );
  it.each(["/", "/programa", "/sesion/abc", "/media/exercises/0739.gif", "/media/exercises/0739.jpg", "/api/exercises/leg-press/history", "/historial"])(
    "%s is protected",
    (p) => expect(isPublicPath(p)).toBe(false),
  );
  it.each([
    "/%6Dedia/exercises/0739.gif",
    "/media%2Fexercises%2F0739.gif",
    "/%256Dedia/exercises/0739.gif",
    "//media/exercises/0739.gif",
    "/MEDIA/exercises/0739.gif",
    "/_next/%2E%2E/media/exercises/0739.gif",
    "/icons/../media/exercises/0739.gif",
    "/bad%E0%A4%A.gif",
  ])("encoded / traversal path %s is protected", (p) => expect(isPublicPath(p)).toBe(false));
});

describe("safeNextPath", () => {
  it("only allows same-origin relative paths", () => {
    expect(safeNextPath("/programa?x=1")).toBe("/programa?x=1");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });

  it.each(["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\r\n/evil.com", "/\u0000/evil.com", "/\u007f/evil.com", "/\t\t/evil.com/pwn"])(
    "rejects control characters (%j) that the URL parser strips into //evil.com",
    (p) => expect(safeNextPath(p)).toBe("/"),
  );

  it.each(["//evil", "/\\evil", "/a\\..\\\\evil.com", "/..//evil.com", "/.//evil.com", "/a/../..//evil.com", "", undefined, "programa", " /programa"])(
    "rejects off-site or malformed %j",
    (p) => expect(safeNextPath(p)).toBe("/"),
  );

  it("keeps percent-encoded control chars as a literal same-origin path", () => {
    expect(safeNextPath("/%09/evil.com")).toBe("/%09/evil.com");
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
  });

  it("preserves normal paths with query and hash", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/programa?x=1")).toBe("/programa?x=1");
    expect(safeNextPath("/sesion/abc?semana=2#ejercicio-3")).toBe("/sesion/abc?semana=2#ejercicio-3");
  });

  it("never returns a protocol-relative or absolute URL", () => {
    for (const raw of ["/\t/evil.com", "/..//evil.com", "/%09/evil.com", "/programa"]) {
      const out = safeNextPath(raw);
      expect(out.startsWith("/")).toBe(true);
      expect(out.startsWith("//")).toBe(false);
      expect(new URL(out, "https://app.test").origin).toBe("https://app.test");
    }
  });
});
