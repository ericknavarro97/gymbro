"use client";
/**
 * Theme preference control (Perfil): Sistema / Oscuro / Claro.
 * Writes localStorage["gb-theme"] and toggles the class on <html>.
 */
import { useSyncExternalStore } from "react";
import { SegmentedControl } from "./ui/segmented-control";

export type ThemePreference = "system" | "dark" | "light";
const KEY = "gb-theme";
const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : "system";
  } catch {
    return "system";
  }
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage blocked: still apply for this page view */
  }
  const c = document.documentElement.classList;
  c.remove("dark", "light");
  if (pref !== "system") c.add(pref);
  listeners.forEach((l) => l());
}

export function useThemePreference(): [ThemePreference, (p: ThemePreference) => void] {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "system" as ThemePreference,
  );
  return [pref, setThemePreference];
}

export function ThemeControl({ className }: { className?: string }) {
  const [pref, setPref] = useThemePreference();
  return (
    <SegmentedControl
      label="Tema"
      className={className}
      value={pref}
      onChange={setPref}
      options={[
        { value: "system", label: "Sistema" },
        { value: "dark", label: "Oscuro" },
        { value: "light", label: "Claro" },
      ]}
    />
  );
}
