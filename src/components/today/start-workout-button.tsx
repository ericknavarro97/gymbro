"use client";
/**
 * StartWorkoutButton: calls `startWorkoutAction` (idempotent) and navigates to
 * /sesion/<workoutLogId>. Used by Hoy and by the Día preview.
 *
 * When the log id is already known and the session is open (in progress /
 * completed), it renders a prefetched link instead (instant navigation).
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startWorkoutAction } from "@/server/actions/workout.actions";
import { Button, ButtonLink, type ButtonSize, type ButtonVariant } from "../ui/button";
import { Icon } from "../ui/icons";
import { useToast } from "../ui/toast";
import { startLabel } from "../program/format";

export interface StartWorkoutButtonProps {
  workoutDayId: number;
  /** Existing log of that day (skip the action and link directly when open). */
  workoutLog?: { id: string; status: "in_progress" | "completed" | "skipped" } | null;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

export function StartWorkoutButton({
  workoutDayId,
  workoutLog,
  label,
  variant = "primary",
  size = "lg",
  block = true,
  className,
}: StartWorkoutButtonProps) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const text = label ?? startLabel(workoutLog?.status);
  const icon = workoutLog?.status === "completed" ? <Icon.Check /> : <Icon.Play />;

  if (workoutLog && workoutLog.status !== "skipped") {
    return (
      <ButtonLink
        href={`/sesion/${workoutLog.id}`}
        prefetch
        variant={variant}
        size={size}
        block={block}
        icon={icon}
        className={className}
      >
        {text}
      </ButtonLink>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      block={block}
      icon={icon}
      loading={pending}
      className={className}
      onClick={() =>
        start(async () => {
          let r: Awaited<ReturnType<typeof startWorkoutAction>>;
          try {
            r = await startWorkoutAction({ workoutDayId });
          } catch {
            toast.error("No se pudo abrir la sesión", { description: "Revisa tu conexión e intenta de nuevo." });
            return;
          }
          if (!r.ok) {
            if (r.error.code === "NO_ACTIVE_RUN") router.push("/bienvenida");
            else toast.result(r);
            return;
          }
          router.push(`/sesion/${r.data.workoutLogId}`);
        })
      }
    >
      {pending ? "Abriendo…" : text}
    </Button>
  );
}
