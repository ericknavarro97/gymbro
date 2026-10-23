"use client";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";

/** Fallback boundary for screens outside the (app) shell (login, registro, bienvenida). */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-app flex-1 flex-col justify-center px-4 py-10">
      <EmptyState
        tone="danger"
        icon={<Icon.Alert />}
        title="Algo falló"
        description="No pudimos cargar esta pantalla. Revisa tu conexión e inténtalo de nuevo."
        action={
          <>
            <Button onClick={reset} block>
              Reintentar
            </Button>
            <ButtonLink href="/" variant="ghost" block>
              Ir a Hoy
            </ButtonLink>
          </>
        }
      />
    </main>
  );
}
