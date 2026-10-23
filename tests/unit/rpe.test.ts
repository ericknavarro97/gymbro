import { describe, expect, it } from "vitest";
import { formatRpe, parseRpe, tryParseRpe } from "@/server/domain/rpe";
import { DomainParseError } from "@/server/domain/text";

const CLOSED_SET = [
  ["~5", 5, 5, true],
  ["~5-6", 5, 6, true],
  ["~6", 6, 6, true],
  ["~6-7", 6, 7, true],
  ["~7", 7, 7, true],
  ["~7-8", 7, 8, true],
  ["~8", 8, 8, true],
  ["~8-9", 8, 9, true],
  ["~9", 9, 9, true],
  ["~9-10", 9, 10, true],
  ["8", 8, 8, false],
  ["10", 10, 10, false],
] as const;

describe("parseRpe", () => {
  it.each(CLOSED_SET)("%j → {%d, %d, approx=%s}", (text, min, max, approx) => {
    expect(parseRpe(text)).toEqual({ min, max, approx });
  });

  it.each(CLOSED_SET)("round-trips %j", (text) => {
    expect(formatRpe(parseRpe(text))).toBe(text);
  });

  it.each([
    [" ~ 7–8 ", { min: 7, max: 8, approx: true }],
    ["~ 9", { min: 9, max: 9, approx: true }],
    ["RPE 8", { min: 8, max: 8, approx: false }],
    ["~8.5", { min: 8.5, max: 8.5, approx: true }],
    ["0", { min: 0, max: 0, approx: false }],
  ])("tolerates %j", (text, expected) => {
    expect(parseRpe(text)).toEqual(expected);
  });

  it.each(["", "N/A", "11", "~9-11", "8-7", "abc", "~", "8-", "~-8"])("rejects %j", (text) => {
    expect(tryParseRpe(text)).toBeNull();
    expect(() => parseRpe(text)).toThrow(DomainParseError);
  });
});
