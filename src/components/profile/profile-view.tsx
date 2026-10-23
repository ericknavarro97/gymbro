"use client";
/**
 * /perfil: account, unit, rounding, weak point (with exercise preview), theme,
 * restart program and sign out. Settings save immediately via updateSettingsAction.
 */
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { signOut } from "@/lib/auth-client";
import { restartProgramAction, updateSettingsAction } from "@/server/actions/settings.actions";
import type { WeightUnit } from "@/server/domain/units";
import type { ProfileState } from "@/server/services/profile.service";
import type { SettingsView } from "@/server/services/workout.service";
import { MediaCredit } from "../exercise/media-credit";
import { PageBody, PageHeader, SectionTitle } from "../layout/page";
import { ThemeControl } from "../theme-control";
import { BottomSheet, useDisclosure } from "../ui/bottom-sheet";
import { Button, ButtonLink } from "../ui/button";
import { Card } from "../ui/card";
import { Icon } from "../ui/icons";
import { SegmentedControl } from "../ui/segmented-control";
import { useToast } from "../ui/toast";
import { WeakPointOptionsPreview, WeakPointSheet } from "./weak-point-picker";

type WeakPoint = ProfileState["weakPoints"][number];

export interface ProfileViewProps {
  user: { name: string; username: string };
  onboarded: boolean;
  settings: SettingsView;
  weakPoints: WeakPoint[];
  /** Formatted start date of the active run, or null. */
  runStartedOn: string | null;
}

const ROUNDING: Record<WeightUnit, number[]> = { lb: [1, 2.5, 5, 10], kg: [0.5, 1, 2.5, 5] };

function Row({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function initials(name: string, username: string) {
  const parts = (name || username).trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function ProfileView({ user, onboarded, settings: initial, weakPoints, runStartedOn }: ProfileViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [settings, setSettings] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [restarting, startRestart] = useTransition();
  const [signingOut, setSigningOut] = useState(false);
  const wpSheet = useDisclosure();
  const restartSheet = useDisclosure();

  const unit = settings.unit;
  const rounding = unit === "lb" ? settings.roundingLb : settings.roundingKg;
  const roundingOptions = [...new Set([...ROUNDING[unit], rounding])].sort((a, b) => a - b);
  const current = weakPoints.find((w) => w.key === settings.weakPoint?.key) ?? null;

  // Saves can overlap (tap lb then a rounding right away): only the latest
  // request may write its response / rollback, so an older, slower response
  // never overwrites a newer choice.
  const seq = useRef(0);
  const confirmed = useRef(initial);

  const save = (patch: Parameters<typeof updateSettingsAction>[0], ok: string, optimistic: Partial<SettingsView>) => {
    const id = ++seq.current;
    setSettings((s) => ({ ...s, ...optimistic }));
    startSaving(async () => {
      let r: Awaited<ReturnType<typeof updateSettingsAction>>;
      try {
        r = await updateSettingsAction(patch);
      } catch {
        r = { ok: false, error: { code: "INTERNAL", message: "No se pudo guardar. Revisa tu conexión." } };
      }
      if (r.ok) confirmed.current = r.data;
      if (id !== seq.current) return;
      if (!r.ok) {
        setSettings(confirmed.current);
        toast.error(r.error.message);
        return;
      }
      setSettings(r.data);
      toast.success(ok, { id: "settings-save" });
    });
  };

  const saveWeakPoint = (key: string | null) => {
    const id = ++seq.current;
    startSaving(async () => {
      let r: Awaited<ReturnType<typeof updateSettingsAction>>;
      try {
        r = await updateSettingsAction({ weakPointKey: key });
      } catch {
        r = { ok: false, error: { code: "INTERNAL", message: "No se pudo guardar. Revisa tu conexión." } };
      }
      if (r.ok) confirmed.current = r.data;
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      if (id === seq.current) setSettings(r.data);
      wpSheet.onClose();
      toast.success(key ? `Punto débil: ${r.data.weakPoint?.nameEs ?? ""}` : "Punto débil quitado", { id: "settings-save" });
    });
  };

  const restart = () =>
    startRestart(async () => {
      let r: Awaited<ReturnType<typeof restartProgramAction>>;
      try {
        r = await restartProgramAction({});
      } catch {
        toast.error("No se pudo reiniciar", { description: "Revisa tu conexión e intenta de nuevo." });
        return;
      }
      if (!toast.result(r, "Programa reiniciado. ¡Semana 1, día 1!")) return;
      restartSheet.onClose();
      router.push("/");
    });

  const logout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
      toast.error("No se pudo cerrar sesión. Revisa tu conexión.");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Tu cuenta" title="Perfil" />
      <PageBody>
        <Card padding="md" className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-accent font-display text-2xl font-bold text-accent-fg"
          >
            {initials(user.name, user.username)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-2xl leading-tight font-bold uppercase">{user.name || user.username}</p>
            <p className="truncate text-sm text-fg-muted">@{user.username}</p>
          </div>
        </Card>

        {!onboarded ? (
          <Card tone="accent" padding="md" className="flex flex-col gap-3">
            <p className="text-sm text-fg-muted">Aún no configuras tu programa.</p>
            <ButtonLink href="/bienvenida" block>
              Configurar ahora
            </ButtonLink>
          </Card>
        ) : null}

        <SectionTitle>Entrenamiento</SectionTitle>
        <Card padding="md" className="flex flex-col gap-5">
          <Row title="Unidad de peso" description="Para registrar y ver tus cargas. Tu historial se convierte solo.">
            <SegmentedControl
              label="Unidad de peso"
              hideLabel
              size="lg"
              value={unit}
              onChange={(u) => u !== unit && save({ unit: u }, `Unidad: ${u}`, { unit: u })}
              options={[
                { value: "lb", label: "Libras (lb)" },
                { value: "kg", label: "Kilos (kg)" },
              ]}
            />
          </Row>

          <Row
            title="Redondeo"
            description={`Las cargas calculadas (calentamiento) se redondean al múltiplo más cercano de ${rounding} ${unit}.`}
          >
            <SegmentedControl
              label={`Redondeo en ${unit}`}
              hideLabel
              value={String(rounding)}
              onChange={(v) => {
                const n = Number(v);
                if (n === rounding) return;
                save(
                  unit === "lb" ? { roundingLb: n } : { roundingKg: n },
                  `Redondeo: ${n} ${unit}`,
                  unit === "lb" ? { roundingLb: n } : { roundingKg: n },
                );
              }}
              options={roundingOptions.map((n) => ({ value: String(n), label: `${n}` }))}
            />
          </Row>
        </Card>

        <SectionTitle>Punto débil</SectionTitle>
        <Card padding="md" className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow text-fg-subtle">Brazos y punto débil</p>
              <p className="font-display text-2xl leading-tight font-bold uppercase">
                {current?.nameEs ?? settings.weakPoint?.nameEs ?? "Sin elegir"}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={wpSheet.onOpen} aria-haspopup="dialog" disabled={!onboarded}>
              Cambiar
            </Button>
          </div>
          {current ? (
            <>
              {current.guidanceEs ? <p className="text-sm leading-snug text-fg-muted">{current.guidanceEs}</p> : null}
              {current.options.length > 0 ? (
                <>
                  <WeakPointOptionsPreview options={current.options} />
                  <MediaCredit />
                </>
              ) : (
                <p className="text-sm text-fg-subtle">Este punto débil no tiene ejercicios propios; sigue la guía.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-fg-muted">
              Elige uno para que el día de brazos y punto débil te muestre sus ejercicios.
            </p>
          )}
        </Card>

        <SectionTitle>Apariencia</SectionTitle>
        <Card padding="md">
          <ThemeControl />
        </Card>

        {onboarded ? (
          <>
            <SectionTitle>Programa</SectionTitle>
            <Card padding="md" className="flex flex-col gap-3">
              <Row
                title="Reiniciar programa"
                description={
                  runStartedOn
                    ? `Empezaste el ${runStartedOn}. Reiniciar te regresa a la semana 1; tu historial se conserva.`
                    : "Empieza de nuevo desde la semana 1; tu historial se conserva."
                }
              />
              <Button variant="outline" block icon={<Icon.Swap />} onClick={restartSheet.onOpen} aria-haspopup="dialog">
                Reiniciar programa
              </Button>
            </Card>
          </>
        ) : null}

        <Button variant="ghost" block icon={<Icon.Logout />} loading={signingOut} onClick={logout} className="mt-2 text-danger">
          Cerrar sesión
        </Button>
        {saving ? (
          <span className="sr-only" role="status">
            Guardando…
          </span>
        ) : null}
      </PageBody>

      <WeakPointSheet
        open={wpSheet.open}
        onOpenChange={wpSheet.setOpen}
        weakPoints={weakPoints}
        currentKey={settings.weakPoint?.key ?? null}
        saving={saving}
        onSave={saveWeakPoint}
      />

      <BottomSheet
        open={restartSheet.open}
        onOpenChange={restartSheet.setOpen}
        eyebrow="Programa"
        title="¿Reiniciar el programa?"
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="danger" size="lg" block loading={restarting} onClick={restart}>
              Sí, reiniciar
            </Button>
            <Button variant="ghost" block onClick={restartSheet.onClose} disabled={restarting}>
              Cancelar
            </Button>
          </div>
        }
      >
        <ul className="flex flex-col gap-3 text-sm">
          <li className="flex gap-2.5">
            <Icon.Check className="mt-0.5 size-4 shrink-0 text-success" />
            <span>
              <strong>Tu historial se conserva:</strong> sesiones, series y gráficas siguen disponibles.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Icon.Swap className="mt-0.5 size-4 shrink-0 text-accent-text" />
            <span>Empiezas un programa nuevo desde la semana 1, día 1, con fecha de hoy.</span>
          </li>
          <li className="flex gap-2.5">
            <Icon.Alert className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>El progreso del programa actual se cierra y ya no podrás continuarlo.</span>
          </li>
        </ul>
      </BottomSheet>
    </>
  );
}
