"use client";
/** "Terminar sesión" / "Saltar sesión" (with confirm). Flushes pending saves first. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { completeWorkoutAction, skipWorkoutAction } from "@/server/actions/workout.actions";
import type { WorkoutSession } from "@/server/services/workout.service";
import { useSession } from "./session-context";

export function SessionFooter({ status }: { status: WorkoutSession["workoutLog"]["status"] }) {
  const { store, workoutLogId } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [finishing, startFinish] = useTransition();
  const [skipping, startSkip] = useTransition();
  const [confirmSkip, setConfirmSkip] = useState(false);
  const completed = status === "completed";

  const finish = (force = false) =>
    startFinish(async () => {
      await store.flushAll();
      if (!force && store.getUnsavedCount() > 0) {
        toast.warning("Hay series sin guardar", {
          id: "finish-unsaved",
          description: "Se guardarán solas cuando vuelva la conexión. Revisa las marcadas en amarillo o rojo.",
          duration: 8000,
          action: { label: "Terminar igual", onClick: () => finish(true) },
        });
        return;
      }
      try {
        const r = await completeWorkoutAction({ workoutLogId });
        if (!toast.result(r, completed ? "Cambios guardados" : "¡Sesión terminada! Buen trabajo")) return;
        router.push("/");
      } catch {
        toast.error("No se pudo terminar la sesión", { description: "Revisa tu conexión e intenta de nuevo." });
      }
    });

  const skip = () =>
    startSkip(async () => {
      try {
        const r = await skipWorkoutAction({ workoutLogId });
        if (!toast.result(r, "Sesión saltada")) return;
        setConfirmSkip(false);
        router.push("/");
      } catch {
        toast.error("No se pudo saltar la sesión", { description: "Revisa tu conexión e intenta de nuevo." });
      }
    });

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Button size="lg" block loading={finishing} icon={<Icon.Check />} onClick={() => finish()}>
        {completed ? "Guardar y salir" : "Terminar sesión"}
      </Button>
      {!completed ? (
        <Button variant="ghost" block onClick={() => setConfirmSkip(true)} disabled={finishing}>
          Saltar sesión
        </Button>
      ) : null}

      <BottomSheet
        open={confirmSkip}
        onOpenChange={setConfirmSkip}
        eyebrow="Saltar sesión"
        title="¿Saltar esta sesión?"
        description="Pasará a la siguiente del programa. Lo que hayas registrado aquí no contará en tu historial. Si registras una serie después, la sesión se vuelve a abrir."
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="danger" block loading={skipping} onClick={skip}>
              Sí, saltar sesión
            </Button>
            <Button variant="secondary" block onClick={() => setConfirmSkip(false)} disabled={skipping}>
              Seguir entrenando
            </Button>
          </div>
        }
      />
    </div>
  );
}
