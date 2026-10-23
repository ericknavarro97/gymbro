/**
 * Regression for R1-10: dimmed history rows / empty exercise cards failed WCAG AA text contrast
 * because the whole row was faded with `opacity-60`. The skipped/empty state must be conveyed with
 * border/background/badge + fg-muted tokens, never by fading text.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoryList } from "@/components/history/history-list";
import type { HistoryEntry } from "@/server/services/history.service";

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  workoutLogId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-0000000000aa",
  workoutDayId: 1,
  status: "completed",
  startedAt: "2026-10-20T15:00:00.000Z",
  completedAt: "2026-10-20T16:00:00.000Z",
  weekNumber: 1,
  isDeload: false,
  dayPosition: 1,
  dayName: "Full Body 1",
  dayKind: "full_body",
  exerciseCount: 6,
  setCount: 14,
  ...over,
});

describe("HistoryList skipped rows", () => {
  const html = renderToStaticMarkup(
    createElement(HistoryList, {
      items: [
        entry({}),
        entry({
          workoutLogId: "00000000-0000-4000-8000-000000000002",
          status: "skipped",
          completedAt: null,
          startedAt: "2026-10-19T15:00:00.000Z",
          dayName: "Full Body 2",
        }),
      ],
    }),
  );

  it("never fades text with opacity", () => {
    expect(html).not.toMatch(/\bopacity-\d+/);
  });

  it("still marks the skipped state visually and with the badge", () => {
    expect(html).toContain("border-dashed");
    expect(html).toContain("Saltada");
  });
});

describe("session-detail empty cards", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../../src/components/history/session-detail.tsx", import.meta.url)),
    "utf8",
  );
  it("does not use opacity and renders the empty copy in fg-muted", () => {
    expect(src).not.toMatch(/\bopacity-\d+/);
    expect(src).toMatch(/text-fg-muted">Sin series registradas\./);
  });
});

/** WCAG 2.x relative luminance / contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("fg-muted token contrast (used for dimmed history text)", () => {
  const css = readFileSync(fileURLToPath(new URL("../../src/app/globals.css", import.meta.url)), "utf8");
  const block = (selector: string) => {
    const start = css.indexOf(selector);
    return css.slice(start, css.indexOf("}", start));
  };
  const token = (b: string, name: string) => {
    const m = b.match(new RegExp(`--gb-${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`token ${name} not found`);
    return m[1]!;
  };
  for (const [theme, selector] of [
    ["light", ":root {"],
    ["dark", ":root.dark {"],
  ] as const) {
    it(`${theme}: fg-muted >= 4.5:1 on bg, surface and surface-2`, () => {
      const b = block(selector);
      const fg = token(b, "fg-muted");
      for (const bg of ["bg", "surface", "surface-2"]) {
        expect(contrast(fg, token(b, bg))).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
