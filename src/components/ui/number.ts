/** Pure helpers for form controls (no "use client": safe on server and client). */

/**
 * Parse user-typed numbers: accepts "35", "35.5", "35,5", " 35 ".
 * Returns null for empty/invalid input.
 */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "" || !/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Base classes of text-like controls (Input, Select, NumberInput). */
export const controlStyles =
  "block w-full min-h-12 rounded-lg border bg-surface px-3.5 text-base text-fg placeholder:text-fg-subtle " +
  "transition-[border-color,box-shadow] outline-none " +
  "focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--gb-accent)_28%,transparent)] " +
  "disabled:opacity-50";
