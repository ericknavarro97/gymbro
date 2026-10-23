"use client";
/**
 * TechniqueChip: intensity technique pill (e.g. "Myo-reps", "Dropset");
 * tap → sheet with nameEs + descriptionEs + when it applies (scope).
 *
 * {p.technique ? <TechniqueChip technique={p.technique} /> : null}
 */
import type { TechniqueView } from "@/server/services/views";
import { Badge, Chip } from "../ui/badge";
import { BottomSheet, useDisclosure } from "../ui/bottom-sheet";
import { Icon } from "../ui/icons";
import { TECHNIQUE_SCOPE_ES } from "./shared";

export function TechniqueChip({ technique, className }: { technique: TechniqueView; className?: string }) {
  const sheet = useDisclosure();
  const name = technique.nameEs ?? technique.name;
  return (
    <>
      <Chip
        tone="accent"
        icon={<Icon.Flame className="size-4" />}
        onClick={sheet.onOpen}
        aria-haspopup="dialog"
        aria-label={`Técnica: ${name}. Ver explicación`}
        className={className}
      >
        {name}
      </Chip>
      <BottomSheet open={sheet.open} onOpenChange={sheet.setOpen} title={name} eyebrow="Técnica de intensidad">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent" icon={<Icon.Flame className="size-3.5" />}>
              {TECHNIQUE_SCOPE_ES[technique.scope]}
            </Badge>
            {technique.nameEs && technique.nameEs !== technique.name ? (
              <Badge tone="neutral">{technique.name}</Badge>
            ) : null}
          </div>
          <p className="text-base leading-relaxed whitespace-pre-line text-fg">
            {technique.descriptionEs ?? "Sin descripción disponible."}
          </p>
        </div>
      </BottomSheet>
    </>
  );
}
