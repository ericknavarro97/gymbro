import { PageBody } from "@/components/layout/page";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";

/** 404 for bad ids/slugs inside the signed-in shell (keeps the tab bar). */
export default function AppNotFound() {
  return (
    <PageBody className="flex-1 justify-center pt-10">
      <EmptyState
        icon={<Icon.Dumbbell />}
        title="No encontramos eso"
        description="La sesión, el día o el ejercicio que buscas no existe o ya no está disponible."
        action={
          <>
            <ButtonLink href="/" block>
              Ir a Hoy
            </ButtonLink>
            <ButtonLink href="/programa" variant="ghost" block>
              Ver programa
            </ButtonLink>
          </>
        }
      />
    </PageBody>
  );
}
