"use client";
/** Numbered exercise instructions with an Español / English toggle. */
import { useState } from "react";
import { SegmentedControl } from "../ui/segmented-control";

export function ExerciseInstructions({ es, en }: { es: string[]; en: string[] }) {
  const [lang, setLang] = useState<"es" | "en">(es.length > 0 ? "es" : "en");
  const steps = lang === "es" ? es : en;
  const both = es.length > 0 && en.length > 0;
  return (
    <div className="flex flex-col gap-3">
      {both ? (
        <SegmentedControl
          label="Idioma de las instrucciones"
          hideLabel
          value={lang}
          onChange={setLang}
          options={[
            { value: "es", label: "Español" },
            { value: "en", label: "English" },
          ]}
        />
      ) : null}
      <ol className="flex flex-col gap-3" lang={lang}>
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-base font-bold text-accent-text"
            >
              {i + 1}
            </span>
            <p className="min-w-0 flex-1 leading-relaxed text-fg">{s}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
