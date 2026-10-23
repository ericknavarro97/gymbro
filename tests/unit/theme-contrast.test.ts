/**
 * Regression for R2-4: theme tokens must meet WCAG AA (4.5:1) for normal-size text.
 * - light primary CTA / selected segment: accent-fg on accent (and on accent-strong hover)
 * - fg-subtle labels (NOTAS eyebrow, history stat labels, form hints) on bg / surface / surface-2
 * - "Última" RPE chip: accent-text on accent-soft, without opacity fading the label
 * Both dark palettes (`:root.dark` and the prefers-color-scheme block) must stay in sync.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RpePair } from "@/components/workout/badges";

const css = readFileSync(fileURLToPath(new URL("../../src/app/globals.css", import.meta.url)), "utf8");

function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`selector ${selector} not found`);
  return css.slice(start, css.indexOf("}", start));
}
function tokens(b: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of b.matchAll(/--gb-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]!] = m[2]!.toLowerCase();
  return out;
}
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

const light = tokens(block(":root {"));
const dark = tokens(block(":root.dark {"));
const darkMedia = tokens(block(":root:not(.light) {"));

const AA = 4.5;
const pairs: [fg: string, bg: string][] = [
  ["accent-fg", "accent"],
  ["accent-fg", "accent-strong"],
  ["accent-text", "accent-soft"],
  ["fg-subtle", "bg"],
  ["fg-subtle", "surface"],
  ["fg-subtle", "surface-2"],
  ["fg-subtle", "raised"],
  ["fg-muted", "surface-2"],
];

describe("theme token contrast (WCAG AA)", () => {
  for (const [name, palette] of [
    ["light", light],
    ["dark", dark],
    ["dark (media query)", darkMedia],
  ] as const) {
    for (const [fg, bg] of pairs) {
      it(`${name}: ${fg} on ${bg} >= 4.5:1`, () => {
        expect(palette[fg], `${fg} missing`).toBeDefined();
        expect(palette[bg], `${bg} missing`).toBeDefined();
        expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  it("dark palettes are identical in both blocks", () => {
    expect(darkMedia).toEqual(dark);
  });
});

describe("RPE badges", () => {
  it("never fade the label text with opacity", () => {
    const html = renderToStaticMarkup(
      createElement(RpePair, { earlyRpe: { text: "~7-8" }, lastRpe: { text: "~9-10" } }),
    );
    expect(html).toContain("Última");
    expect(html).not.toMatch(/\bopacity-\d+/);
  });
});
