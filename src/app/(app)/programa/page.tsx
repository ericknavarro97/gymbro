import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody, PageHeader } from "@/components/layout/page";
import { BlockPanel } from "@/components/program/program-weeks";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { requireUser } from "@/server/auth/session";
import { getProgramOverview } from "@/server/services/workout.service";

export const metadata: Metadata = { title: "Programa" };

export default function ProgramaPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Cargando programa" />}>
      <Program />
    </Suspense>
  );
}

async function Program() {
  const user = await requireUser();
  const overview = await getProgramOverview(user.id);

  const allWeeks = overview.blocks.flatMap((b) => b.weeks.map((w) => ({ block: b, week: w })));
  const current = allWeeks.find(({ week }) => week.days.some((d) => d.id === overview.nextDayId));
  const currentWeek = current?.week.number ?? null;
  const defaultBlock = String(current?.block.number ?? overview.blocks[0]?.number ?? 1);
  const deloadIndexes = allWeeks.filter(({ week }) => week.isDeload).map(({ week }) => week.number - 1);
  const { progress } = overview;

  return (
    <>
      <PageHeader eyebrow={overview.program.author ?? "Full Body"} title="Programa">
        <ProgressBar
          label="Progreso del programa"
          showLabel
          value={progress.ratio}
          segments={10}
          markedSegments={deloadIndexes}
          valueText={`${progress.done} de ${progress.total} sesiones`}
          trailing={
            <>
              {currentWeek ? <span className="text-accent-text">Semana {currentWeek} · </span> : null}
              {progress.done}/{progress.total}
            </>
          }
        />
      </PageHeader>
      <PageBody>
        {!overview.run ? (
          <div className="flex flex-col gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3">
            <p className="text-sm text-fg">Aún no empiezas el programa. Completa la bienvenida para llevar tu avance.</p>
            <ButtonLink href="/bienvenida" size="sm" icon={<Icon.Play className="size-4" />}>
              Empezar
            </ButtonLink>
          </div>
        ) : null}

        <Tabs
          label="Bloques del programa"
          variant="pill"
          defaultValue={defaultBlock}
          items={overview.blocks.map((b) => ({
            value: String(b.number),
            label: `Bloque ${b.number}`,
            content: <BlockPanel block={b} currentWeek={currentWeek} />,
          }))}
        />

        {overview.program.notesEs.length > 0 ? (
          <details className="group rounded-xl border border-line bg-surface">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
              <Icon.Note className="size-5 shrink-0 text-accent-text" />
              <span className="flex-1 font-semibold">Notas del programa</span>
              <Icon.ChevronDown className="size-5 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
            </summary>
            <ul className="flex list-disc flex-col gap-2 border-t border-line py-3 pr-4 pl-9 text-sm leading-relaxed text-fg-muted">
              {overview.program.notesEs.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </PageBody>
    </>
  );
}
