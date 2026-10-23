/**
 * Regression for R2-5: at 360px the current day name truncated to "Full B…" because the name shared
 * one line with the "Siguiente" + "En curso" badges. The name must never be truncated and the
 * badges must live on their own wrapping line under it.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockPanel } from "@/components/program/program-weeks";

type Panel = Parameters<typeof BlockPanel>[0];

const day = (position: number, name: string, status: string, isNext: boolean) => ({
  id: position,
  position,
  name,
  status,
  isNext,
  restAfter: position === 2,
  workoutLogId: null,
});

const block = {
  id: 1,
  number: 1,
  name: "Block 1",
  nameEs: "Bloque 1",
  description: null,
  weeks: [
    {
      id: 1,
      number: 1,
      isDeload: false,
      banner: null,
      bannerEs: null,
      days: [
        day(1, "Full Body 1", "in_progress", true),
        day(2, "Full Body 2", "pending", false),
        day(5, "Arms & Weak Points", "completed", false),
      ],
    },
  ],
} as unknown as Panel["block"];

const html = renderToStaticMarkup(createElement(BlockPanel, { block, currentWeek: 1 }));
const rows = html.match(/<a [\s\S]*?<\/a>/g) ?? [];

describe("Programa day row layout (R2-5)", () => {
  it("renders one link per day", () => {
    expect(rows).toHaveLength(3);
  });

  it("never truncates the day name", () => {
    for (const r of rows) expect(r).not.toMatch(/\btruncate\b/);
  });

  it("puts the name and the badges in separate lines (badges wrap below)", () => {
    const current = rows[0]!;
    // Name span closes before the badge container opens.
    const nameEnd = current.indexOf("Full Body 1</span>");
    const next = current.indexOf(">Siguiente<");
    const status = current.lastIndexOf(">En curso<");
    expect(nameEnd).toBeGreaterThan(-1);
    expect(next).toBeGreaterThan(nameEnd);
    expect(status).toBeGreaterThan(nameEnd);
    expect(current).toMatch(/flex-wrap/);
  });

  it("keeps full day name and status text in the accessible label", () => {
    expect(rows[0]).toContain('aria-label="Semana 1, Full Body 1: En curso, siguiente sesión"');
    expect(rows[2]).toContain("Arms &amp; Weak Points</span>");
    expect(rows[1]).toContain("Descanso después");
  });
});
