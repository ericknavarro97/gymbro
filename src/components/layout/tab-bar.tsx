"use client";
/**
 * Bottom tab bar (Hoy · Programa · Historial · Perfil). `usePathname` may
 * suspend under Cache Components, so (app)/layout renders <TabBar/> inside
 * <Suspense fallback={<TabBarView active={null}/>}>.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";
import { NavigationTracker } from "./back-link";

export type TabKey = "hoy" | "programa" | "historial" | "perfil";

const TABS: Array<{ key: TabKey; href: string; label: string; icon: keyof typeof Icon }> = [
  { key: "hoy", href: "/", label: "Hoy", icon: "Today" },
  { key: "programa", href: "/programa", label: "Programa", icon: "Program" },
  { key: "historial", href: "/historial", label: "Historial", icon: "History" },
  { key: "perfil", href: "/perfil", label: "Perfil", icon: "User" },
];

/** Which tab owns a pathname. */
export function tabForPath(pathname: string): TabKey | null {
  if (pathname === "/" || pathname.startsWith("/sesion")) return "hoy";
  if (pathname.startsWith("/programa") || pathname.startsWith("/ejercicios")) return "programa";
  if (pathname.startsWith("/historial")) return "historial";
  if (pathname.startsWith("/perfil")) return "perfil";
  return null;
}

export function TabBarView({ active }: { active: TabKey | null }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-safe backdrop-blur-md supports-[backdrop-filter]:bg-bg/75"
    >
      <ul className="mx-auto grid max-w-app grid-cols-4 px-1.5 pl-safe pr-safe">
        {TABS.map((t) => {
          const I = Icon[t.icon];
          const isActive = active === t.key;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "group relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold tracking-wide transition-colors",
                  isActive ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                <span
                  className={cx(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-accent text-accent-fg" : "group-active:bg-surface-2",
                  )}
                >
                  <I className="size-5.5" />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Screens reachable from several tabs keep the tab they were opened from. */
const SHARED_PREFIXES = ["/ejercicios"];

export function TabBar() {
  const pathname = usePathname();
  const shared = SHARED_PREFIXES.some((p) => pathname.startsWith(p));
  const own = tabForPath(pathname);
  const [lastOwner, setLastOwner] = useState<TabKey | null>(null);
  if (!shared && own && own !== lastOwner) setLastOwner(own);
  const active = shared ? (lastOwner ?? own) : own;
  return (
    <>
      <NavigationTracker />
      <TabBarView active={active} />
    </>
  );
}
