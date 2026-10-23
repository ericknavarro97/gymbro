"use client";
/**
 * WarmupGuideButton: card-like button on Hoy that opens a BottomSheet with the
 * general warm-up (cardio + mobility) and the explanation of the specific
 * warm-up sets protocol (45/65/85 %…). Data comes from `getWarmupGuide()`.
 */
import { BottomSheet, useDisclosure } from "../ui/bottom-sheet";
import { Button } from "../ui/button";
import { Icon } from "../ui/icons";
import type { WarmupGuide } from "./warmup-data";

const SETS_LABEL: Record<1 | 2 | 3, string> = {
  1: "1 serie de calentamiento",
  2: "2 series de calentamiento",
  3: "3 series de calentamiento",
};

export function WarmupGuideButton({ guide }: { guide: WarmupGuide }) {
  const sheet = useDisclosure();
  return (
    <>
      <button
        type="button"
        onClick={sheet.onOpen}
        aria-haspopup="dialog"
        className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2 active:scale-[0.99]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <Icon.Flame />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Calentamiento general</span>
          <span className="block truncate text-sm text-fg-muted">5-10 min de cardio + movilidad antes de empezar</span>
        </span>
        <Icon.ChevronRight className="size-5 shrink-0 text-fg-subtle" />
      </button>

      <BottomSheet
        open={sheet.open}
        onOpenChange={sheet.setOpen}
        eyebrow="Antes de cada sesión"
        title="Calentamiento"
        footer={
          <Button block onClick={sheet.onClose}>
            Listo
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <h3 className="eyebrow text-fg-subtle">1 · General</h3>
            <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {guide.general.map((g) => (
                <li key={g.position} className="flex items-start gap-3 px-3 py-2.5">
                  <span className="nums mt-0.5 w-5 shrink-0 font-display text-lg leading-none font-bold text-accent-text">
                    {g.position}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base leading-snug text-fg">{g.item}</span>
                    {g.dose ? <span className="nums block text-sm text-fg-muted">{g.dose}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="eyebrow text-fg-subtle">2 · Específico (por ejercicio)</h3>
            <p className="text-base leading-relaxed text-fg">
              Cada ejercicio indica cuántas series de calentamiento hacer. Se calculan como porcentaje del peso de tu
              primera serie efectiva; en la sesión verás los pesos ya calculados y redondeados.
            </p>
            <div className="flex flex-col gap-2">
              {([1, 2, 3] as const).map((n) => (
                <div key={n} className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                  <p className="text-sm font-semibold text-fg">{SETS_LABEL[n]}</p>
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {guide.protocol[n].map((s) => (
                      <li key={s.setNumber} className="nums text-sm text-fg-muted">
                        <span className="font-semibold text-fg">{s.pctOfWorking}%</span> × {s.repsText}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-fg-muted">
              Si el ejercicio pide “2-4”, usa el protocolo de 3 y agrega una serie libre si la necesitas. Las series de
              calentamiento no se registran.
            </p>
          </section>
        </div>
      </BottomSheet>
    </>
  );
}
