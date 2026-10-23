/** Pure display helpers shared by Hoy, Programa and the Día preview. */
import type { Tone } from "../ui/badge";

export type DayStatusValue = "pending" | "in_progress" | "completed" | "skipped";

export const DAY_STATUS: Record<DayStatusValue, { label: string; tone: Tone }> = {
  completed: { label: "Hecho", tone: "success" },
  in_progress: { label: "En curso", tone: "accent" },
  pending: { label: "Pendiente", tone: "neutral" },
  skipped: { label: "Saltado", tone: "warning" },
};

/** "SEMANA DE SEMI-DESCARGA: ¡EVITA EL FALLO…!" → "¡Evita el fallo…!" (sentence case, prefix dropped). */
export function bannerSentence(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  const idx = t.indexOf(":");
  const body = (idx >= 0 && idx < t.length - 1 ? t.slice(idx + 1) : t).trim();
  const isUpper = body === body.toUpperCase();
  const s = isUpper ? body.toLowerCase() : body;
  // Capitalize the first letter (skipping leading punctuation such as "¡").
  return s.replace(/^([^\p{L}]*)(\p{L})/u, (_, p: string, c: string) => p + c.toUpperCase());
}

/** Deload banner text for a week (Spanish first). */
export function deloadText(week: { isDeload: boolean; banner: string | null; bannerEs: string | null }) {
  if (!week.isDeload) return null;
  return bannerSentence(week.bannerEs ?? week.banner) ?? "Evita el fallo y entrena más ligero esta semana.";
}

export function blockName(block: { number: number; name: string; nameEs: string | null }) {
  return block.nameEs ?? block.name;
}

export const dayHref = (week: number, position: number) => `/programa/semana/${week}/dia/${position}`;

/** "hace 2 días", "hoy", "ayer" relative to now (calendar days in `timeZone`). */
export function relativeDay(iso: string, now: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const a = Date.parse(fmt.format(new Date(iso)));
  const b = Date.parse(fmt.format(now));
  const days = Math.round((b - a) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Intl.DateTimeFormat("es-MX", { timeZone, day: "numeric", month: "short" }).format(new Date(iso));
}

/** Default CTA text for a day's log status. */
export function startLabel(status: "in_progress" | "completed" | "skipped" | null | undefined): string {
  switch (status) {
    case "in_progress":
      return "Continuar";
    case "completed":
      return "Ver sesión";
    case "skipped":
      return "Retomar";
    default:
      return "Empezar";
  }
}
