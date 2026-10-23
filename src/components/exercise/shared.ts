/** Server-safe constants/helpers for exercise components (no "use client"). */
import type { TechniqueView } from "@/server/services/views";

export function youtubeEmbedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1`;
}

export function youtubeWatchUrl(id: string) {
  return `https://youtu.be/${encodeURIComponent(id)}`;
}

export const TECHNIQUE_SCOPE_ES: Record<TechniqueView["scope"], string> = {
  last_set: "Solo en la última serie",
  all_sets: "En todas las series",
  between_sets: "Entre series",
};
