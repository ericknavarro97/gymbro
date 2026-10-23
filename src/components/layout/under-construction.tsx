/** Temporary placeholder for screens not built yet. Server-safe. */
import { ButtonLink } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { Icon } from "../ui/icons";
import { PageBody, PageHeader } from "./page";

export function UnderConstruction({ title, eyebrow, back }: { title: string; eyebrow?: string; back?: string }) {
  return (
    <>
      <PageHeader title={title} eyebrow={eyebrow} back={back} size={back ? "md" : "lg"} />
      <PageBody>
        <EmptyState
          icon={<Icon.Construction />}
          title="En construcción"
          description="Esta pantalla está en obra. Muy pronto podrás usarla."
          action={
            <ButtonLink href="/" variant="secondary" block>
              Ir a Hoy
            </ButtonLink>
          }
        />
      </PageBody>
    </>
  );
}
