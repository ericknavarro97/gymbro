import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { translateWeakPointNote } from "@/server/domain/weak-point-note";

describe("translateWeakPointNote", () => {
  it("translates the chest press note to Spanish", () => {
    expect(
      translateWeakPointNote("incline if upper pecs are lagging, flat if entire chest is lagging"),
    ).toBe("inclinado si el pecho superior está rezagado, plano si es todo el pecho");
  });

  it("is tolerant to case and whitespace", () => {
    expect(translateWeakPointNote("  Incline if upper pecs are lagging,  flat if entire chest is lagging ")).toBe(
      "inclinado si el pecho superior está rezagado, plano si es todo el pecho",
    );
  });

  it("passes through null and unknown notes", () => {
    expect(translateWeakPointNote(null)).toBeNull();
    expect(translateWeakPointNote(undefined)).toBeNull();
    expect(translateWeakPointNote("ya en español")).toBe("ya en español");
  });

  it("covers every non-null note in data/source/weak-points.json", () => {
    const raw = JSON.parse(
      readFileSync(path.join(process.cwd(), "data/source/weak-points.json"), "utf8"),
    ) as unknown;
    const notes: string[] = [];
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object")
        for (const [k, x] of Object.entries(v)) {
          if (k === "note" && typeof x === "string") notes.push(x);
          else walk(x);
        }
    };
    walk(raw);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(translateWeakPointNote(n)).not.toBe(n);
  });
});
