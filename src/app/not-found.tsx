import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-app flex-1 flex-col justify-center px-4 py-10">
      <EmptyState
        icon={<Icon.Dumbbell />}
        title="No encontramos eso"
        description="La página no existe o ya no está disponible."
        action={
          <ButtonLink href="/" block>
            Ir a Hoy
          </ButtonLink>
        }
      />
    </main>
  );
}
