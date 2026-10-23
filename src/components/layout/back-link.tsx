"use client";
/**
 * Back chevron for detail screens. When the user got here through an in-app
 * navigation it behaves like the browser back button (so /ejercicios/x opened
 * from Historial or a session returns there); on a cold load (deep link,
 * reload, new tab) it falls back to `href`.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/**
 * In-app path stack (approximation of the history entries this tab created
 * since the app loaded). A navigation to the previous entry's path counts as
 * a "back" (pop); anything else is a push. Using a plain counter here would
 * keep growing on back navigations and eventually call router.back() on the
 * first in-app entry, which leaves the app (or closes nothing on a new tab).
 */
const stack: string[] = [];

/** Rendered once in the (app) shell; tracks client-side pathname changes. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const top = stack[stack.length - 1];
    if (top === pathname) return;
    if (stack.length > 1 && stack[stack.length - 2] === pathname) stack.pop();
    else stack.push(pathname);
  }, [pathname]);
  return null;
}

const canGoBack = () => stack.length > 1;

export function BackLink({
  href,
  label,
  history = true,
  className,
  children,
}: {
  href: string;
  label: string;
  /** false = always go to `href` (e.g. the session screen → Hoy). */
  history?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(e) => {
        if (!history || !canGoBack()) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        router.back();
      }}
    >
      {children}
    </Link>
  );
}
