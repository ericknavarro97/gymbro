"use client";
/**
 * "Sustituir": choose main / sub1 / sub2, or one of the user's weak point
 * options for weak point slots. Calls chooseExerciseAction and swaps the item.
 */
import { useTransition } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { ExerciseMedia } from "@/components/exercise/exercise-media";
import { MediaCredit } from "@/components/exercise/media-credit";
import { VideoButton } from "@/components/exercise/video";
import { chooseExerciseAction } from "@/server/actions/workout.actions";
import type { SessionItem } from "@/server/services/views";
import { CHOICE_LABEL } from "./format";
import { useSession } from "./session-context";

export function SubstituteSheet({
  item,
  open,
  onOpenChange,
}: {
  item: SessionItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { store, workoutLogId } = useSession();
  const toast = useToast();
  const [pending, start] = useTransition();
  const currentId = item.performedExercise?.id ?? null;
  const weak = item.slot !== "exercise";

  const choose = (exerciseId: number, name: string) => {
    if (exerciseId === currentId) {
      onOpenChange(false);
      return;
    }
    start(async () => {
      try {
        const r = await chooseExerciseAction({ workoutLogId, prescriptionId: item.id, exerciseId });
        if (!toast.result(r)) return;
        if (r.ok) store.replaceItem(r.data);
        toast.success(`Ahora: ${name}`, { id: `swap-${item.id}`, duration: 2500 });
        onOpenChange(false);
      } catch {
        toast.error("No se pudo cambiar el ejercicio", { description: "Revisa tu conexión e intenta de nuevo." });
      }
    });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={weak ? "Punto débil" : "Sustituir ejercicio"}
      title={weak ? "¿Qué ejercicio hiciste?" : "Elige el ejercicio"}
      description={
        weak
          ? "Opciones de tu punto débil para este espacio."
          : "El programa permite el principal o uno de sus dos sustitutos. Cada uno guarda su propio historial."
      }
    >
      <ul className="flex flex-col gap-2">
        {item.choices.map((c, i) => {
          const selected = c.exercise.id === currentId;
          return (
            <li
              key={`${c.kind}-${c.exercise.id}`}
              className={cx(
                "flex items-center gap-3 rounded-lg border p-2",
                selected ? "border-accent bg-accent-soft" : "border-line bg-surface",
              )}
            >
              <ExerciseMedia exercise={c.exercise} size="thumb" enlargeable={false} />
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(c.exercise.id, c.exercise.name)}
                className="flex min-h-16 min-w-0 flex-1 flex-col items-start justify-center gap-0.5 text-left disabled:opacity-60"
                aria-pressed={selected}
              >
                <span className="eyebrow text-fg-subtle">
                  {c.kind === "weak_point_option" ? `Opción ${i + 1}` : CHOICE_LABEL[c.kind]}
                </span>
                <span className="line-clamp-2 leading-tight font-semibold">{c.exercise.name}</span>
                {c.note ? <span className="text-xs text-fg-muted">{c.note}</span> : null}
              </button>
              <div className="flex shrink-0 flex-col items-center gap-1">
                {selected ? (
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent text-accent-fg" aria-label="Seleccionado">
                    <Icon.Check className="size-4" />
                  </span>
                ) : pending ? (
                  <Spinner className="size-5 text-fg-muted" />
                ) : null}
                <VideoButton youtubeId={c.exercise.youtubeId} title={c.exercise.name} variant="chip" label="Video" />
              </div>
            </li>
          );
        })}
      </ul>
      <MediaCredit className="mt-3 text-center" />
    </BottomSheet>
  );
}
