"use client";
/** /bienvenida: unit → weak point → start date → completeOnboardingAction → "/". */
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { WeightUnit } from "@/server/domain/units";
import { completeOnboardingAction } from "@/server/actions/settings.actions";
import type { OnboardingState } from "@/server/services/onboarding.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cx } from "../ui/cx";
import { Icon } from "../ui/icons";
import { Input } from "../ui/input";
import { SegmentedControl } from "../ui/segmented-control";
import { useToast } from "../ui/toast";

type WeakPoint = OnboardingState["weakPoints"][number];

export interface OnboardingFormProps {
  firstName: string;
  weakPoints: WeakPoint[];
  defaultUnit: WeightUnit;
  defaultWeakPointKey: string | null;
  /** YYYY-MM-DD in the app time zone. */
  today: string;
}

const NONE = "__none__";

function Step({ n, title, description, children }: { n: number; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 animate-rise" style={{ animationDelay: `${n * 70}ms` }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-fg font-display text-lg font-bold text-bg">
          {n}
        </span>
        <div>
          <h2 className="font-display text-[1.6rem] leading-none font-bold uppercase">{title}</h2>
          {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function WeakPointOption({
  wp,
  checked,
  onSelect,
}: {
  wp: { key: string; nameEs: string; guidanceEs: string | null; optionCount?: { slot1: number; slot2: number } };
  checked: boolean;
  onSelect: () => void;
}) {
  const total = wp.optionCount ? wp.optionCount.slot1 + wp.optionCount.slot2 : 0;
  return (
    <label
      className={cx(
        "relative flex min-h-13 cursor-pointer flex-col justify-center gap-1 rounded-lg border px-3.5 py-2.5 transition-colors",
        "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent",
        checked ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <input type="radio" name="weakPoint" value={wp.key} checked={checked} onChange={onSelect} className="sr-only" />
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold">{wp.nameEs}</span>
        <span
          className={cx(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2",
            checked ? "border-accent bg-accent text-accent-fg" : "border-line-strong",
          )}
          aria-hidden="true"
        >
          {checked ? <Icon.Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
      </span>
      {total > 0 ? (
        <span className="text-xs text-fg-subtle">
          {total} {total === 1 ? "ejercicio" : "ejercicios"} para elegir
        </span>
      ) : null}
      {checked && wp.guidanceEs ? <span className="text-sm leading-snug text-fg-muted">{wp.guidanceEs}</span> : null}
    </label>
  );
}

export function OnboardingForm({ firstName, weakPoints, defaultUnit, defaultWeakPointKey, today }: OnboardingFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [unit, setUnit] = useState<WeightUnit>(defaultUnit);
  const [weakPoint, setWeakPoint] = useState<string>(defaultWeakPointKey ?? NONE);
  const [startedOn, setStartedOn] = useState(today);
  const [dateError, setDateError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const withOptions = weakPoints.filter((w) => w.optionCount.slot1 + w.optionCount.slot2 > 0);
  const guidanceOnly = weakPoints.filter((w) => w.optionCount.slot1 + w.optionCount.slot2 === 0);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startedOn)) {
      setDateError("Elige una fecha válida.");
      return;
    }
    setDateError(undefined);
    startTransition(async () => {
      let r: Awaited<ReturnType<typeof completeOnboardingAction>>;
      try {
        r = await completeOnboardingAction({
          unit,
          weakPointKey: weakPoint === NONE ? null : weakPoint,
          startedOn,
        });
      } catch {
        toast.error("No se pudo guardar", { description: "Revisa tu conexión e intenta de nuevo." });
        return;
      }
      if (!r.ok) {
        if (r.error.fieldErrors?.startedOn) setDateError(r.error.fieldErrors.startedOn[0]);
        toast.error(r.error.message);
        return;
      }
      toast.success("¡Listo! Tu programa está activo.");
      router.replace("/");
    });
  };

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-8">
      <div className="animate-rise">
        <p className="eyebrow text-accent-text">Bienvenida</p>
        <h1 className="mt-1 font-display text-[2.6rem] leading-[0.95] font-extrabold uppercase break-words [overflow-wrap:anywhere]">
          {firstName ? `Hola, ${firstName}.` : "Hola."} Vamos a configurarte
        </h1>
        <p className="mt-2 text-fg-muted">Tres cosas y empiezas. Puedes cambiarlas después en tu perfil.</p>
      </div>

      <Step n={1} title="Unidad de peso" description="Con la que registras tus cargas.">
        <SegmentedControl
          label="Unidad de peso"
          hideLabel
          size="lg"
          value={unit}
          onChange={setUnit}
          options={[
            { value: "lb", label: "Libras (lb)" },
            { value: "kg", label: "Kilos (kg)" },
          ]}
        />
      </Step>

      <Step
        n={2}
        title="Tu punto débil"
        description="El día de Brazos y Puntos débiles incluye 1–2 ejercicios para el músculo que elijas."
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Punto débil</legend>
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            {withOptions.map((wp) => (
              <WeakPointOption key={wp.key} wp={wp} checked={weakPoint === wp.key} onSelect={() => setWeakPoint(wp.key)} />
            ))}
          </div>

          {guidanceOnly.length ? (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="info" size="sm">
                  Solo guía
                </Badge>
                <p className="text-sm text-fg-muted">No agregan ejercicios: el programa ya los trabaja bastante.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                {guidanceOnly.map((wp) => (
                  <WeakPointOption key={wp.key} wp={wp} checked={weakPoint === wp.key} onSelect={() => setWeakPoint(wp.key)} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3">
            <WeakPointOption
              wp={{ key: NONE, nameEs: "Lo decido después", guidanceEs: "Te lo preguntaremos cuando llegue el día de puntos débiles." }}
              checked={weakPoint === NONE}
              onSelect={() => setWeakPoint(NONE)}
            />
          </div>
        </fieldset>
      </Step>

      <Step n={3} title="Fecha de inicio" description="Normalmente hoy. Sirve para ubicar tus semanas.">
        <Input
          label="Fecha de inicio"
          hideLabel
          type="date"
          value={startedOn}
          max="2100-12-31"
          onChange={(e) => setStartedOn(e.target.value)}
          error={dateError}
          inputClassName="nums text-lg"
        />
      </Step>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t border-line bg-bg/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <Button type="submit" size="lg" block loading={pending} iconRight={<Icon.ChevronRight />}>
          Empezar programa
        </Button>
      </div>
    </form>
  );
}
