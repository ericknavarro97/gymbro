"use client";
import { PageBody } from "@/components/layout/page";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageBody className="pt-10">
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
    </PageBody>
  );
}
