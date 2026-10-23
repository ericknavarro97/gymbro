/**
 * Spanish copy for weak-point option notes (pure).
 *
 * data/source/weak-points.json (ground truth, English) has no Spanish field for
 * option notes, so they are translated here. Applied when seeding (so the DB
 * stores Spanish) and when building option views (so rows seeded before this
 * map existed still render in Spanish). Unknown notes fall back to the original.
 */
const WEAK_POINT_NOTE_ES: Record<string, string> = {
  "incline if upper pecs are lagging, flat if entire chest is lagging":
    "inclinado si el pecho superior está rezagado, plano si es todo el pecho",
};

export function translateWeakPointNote(note: string | null | undefined): string | null {
  if (note == null) return null;
  const key = note.replace(/\s+/g, " ").trim().toLowerCase();
  return WEAK_POINT_NOTE_ES[key] ?? note;
}
