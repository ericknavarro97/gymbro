import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryList } from "@/components/history/history-list";
import { PageBody, PageHeader } from "@/components/layout/page";
import { ButtonLink, EmptyState, Icon, PageSkeleton } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getHistory } from "@/server/services/history.service";
import { APP_TIME_ZONE } from "@/server/services/workout.service";

export const metadata: Metadata = { title: "Historial" };

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Tus sesiones" title="Historial" />
      <Suspense fallback={<PageSkeleton label="Cargando historial" />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  const user = await requireUser();
  const items = await getHistory(user.id, { includeSkipped: true, limit: 500 });
  return (
    <PageBody>
      {items.length === 0 ? (
        <EmptyState
          icon={<Icon.History />}
          title="Todavía no hay sesiones"
          description="Cuando termines tu primer entrenamiento, aparecerá aquí con todas tus series."
          action={
            <ButtonLink href="/" icon={<Icon.Play />}>
              Ir a Hoy
            </ButtonLink>
          }
        />
      ) : (
        <HistoryList items={items} timeZone={APP_TIME_ZONE} />
      )}
    </PageBody>
  );
}
