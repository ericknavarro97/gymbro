import { describe, expect, it } from "vitest";
import { formatDuration, formatRest, parseRest } from "@/server/domain/rest";
import { DomainParseError } from "@/server/domain/text";

const CLOSED_SET = [
  ["~0.5-1 min", 30, 60],
  ["~1 min", 60, 60],
  ["~1-2 min", 60, 120],
  ["~1-3 min", 60, 180],
  ["~2-3 min", 120, 180],
  ["~3-4 min", 180, 240],
  ["~3-5 min", 180, 300],
] as const;

describe("parseRest", () => {
  it.each(CLOSED_SET)("%j → %i-%i s", (text, minSec, maxSec) => {
    expect(parseRest(text)).toEqual({ minSec, maxSec });
  });

  it("N/A → null", () => {
    expect(parseRest("N/A")).toBeNull();
    expect(parseRest("n/a")).toBeNull();
    expect(parseRest(" ")).toBeNull();
  });

  it.each(CLOSED_SET)("formatRest round-trips %j", (text) => {
    expect(formatRest(parseRest(text))).toBe(text);
  });

  it.each([
    ["1-2 min", { minSec: 60, maxSec: 120 }],
    ["~1–2 mins", { minSec: 60, maxSec: 120 }],
    ["~ 2 - 3 min", { minSec: 120, maxSec: 180 }],
    ["~.5-1 min", { minSec: 30, maxSec: 60 }],
    ["90 s", { minSec: 90, maxSec: 90 }],
    ["30-45 sec", { minSec: 30, maxSec: 45 }],
  ])("tolerates %j", (text, expected) => {
    expect(parseRest(text)).toEqual(expected);
  });

  it.each(["~1", "min", "~3-2 min", "abc", "0 min", "~1-2 hours"])("rejects %j", (text) => {
    expect(() => parseRest(text)).toThrow(DomainParseError);
  });
});

describe("formatRest", () => {
  it("null → N/A", () => expect(formatRest(null)).toBe("N/A"));
  it("seconds when under a minute or not on half-minutes", () => {
    expect(formatRest({ minSec: 30, maxSec: 45 })).toBe("~30-45 s");
    expect(formatRest({ minSec: 45, maxSec: 45 })).toBe("~45 s");
    expect(formatRest({ minSec: 60, maxSec: 75 })).toBe("~60-75 s");
  });
  it("minutes otherwise", () => {
    expect(formatRest({ minSec: 90, maxSec: 150 })).toBe("~1.5-2.5 min");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [60, "1:00"],
    [90, "1:30"],
    [300, "5:00"],
    [-3, "0:00"],
    [59.6, "1:00"],
  ])("%d → %s", (sec, text) => expect(formatDuration(sec)).toBe(text));
});
