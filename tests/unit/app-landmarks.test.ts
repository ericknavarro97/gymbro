import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../src");
const APP_GROUP = join(SRC, "app/(app)");
const MAIN_RE = /<main[\s>]|role=["']main["']/;

/** Source without comments, so docs mentioning `<main>` don't count. */
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(name) ? [p] : [];
  });
}

describe("signed-in shell landmarks", () => {
  it("(app) layout renders a single <main> landmark", () => {
    const layout = code(join(APP_GROUP, "layout.tsx"));
    expect(layout.match(/<main[\s>]/g)?.length).toBe(1);
  });

  it("no (app) page/boundary or shared component renders a nested <main>", () => {
    const files = [...walk(APP_GROUP), ...walk(join(SRC, "components"))].filter(
      (f) => f !== join(APP_GROUP, "layout.tsx"),
    );
    const offenders = files.filter((f) => MAIN_RE.test(code(f)));
    expect(offenders).toEqual([]);
  });
});
