"use client";
/**
 * PDF notes for a prescription: Spanish translation by default, with a toggle
 * to the original English text. Falls back to English when there's no
 * translation. Long notes are clamped with "Ver más".
 */
import { useState } from "react";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";

export function NotesToggle({ es, en, className }: { es: string | null; en: string | null; className?: string }) {
  const [lang, setLang] = useState<"es" | "en">(es ? "es" : "en");
  const [expanded, setExpanded] = useState(false);
  const text = lang === "es" ? (es ?? en) : (en ?? es);
  if (!text) return null;
  const long = text.length > 160;
  const canToggle = Boolean(es && en && es.trim() !== en.trim());

  return (
    <div className={cx("rounded-lg bg-surface-2 px-3 py-2.5", className)}>
      <div className="flex items-center gap-2">
        <Icon.Note className="size-4 shrink-0 text-fg-subtle" />
        <p className="eyebrow flex-1 text-fg-subtle">Notas{lang === "en" ? " · original (inglés)" : ""}</p>
      </div>
      <p
        lang={lang}
        className={cx("mt-1 text-[0.9375rem] leading-relaxed text-fg", long && !expanded && "line-clamp-3")}
      >
        {text}
      </p>
      {long || canToggle ? (
        <div className="-mx-2 -mb-1.5 flex flex-wrap gap-x-1">
          {long ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="min-h-11 px-2 text-sm font-semibold text-accent-text"
            >
              {expanded ? "Ver menos" : "Ver más"}
            </button>
          ) : null}
          {canToggle ? (
            <button
              type="button"
              onClick={() => setLang((l) => (l === "es" ? "en" : "es"))}
              className="min-h-11 px-2 text-sm font-semibold text-fg-muted underline-offset-2 hover:underline"
            >
              {lang === "es" ? "Ver original (inglés)" : "Ver en español"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
