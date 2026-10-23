/** Shared text normalization for the PDF value parsers (pure). */

/** Trim, unify dashes (en/em/minus → "-"), collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** True for "N/A", "n/a", "NA", "-", "" — the PDF's "no value" markers. */
export function isNotApplicable(text: string): boolean {
  const t = normalizeText(text).toLowerCase();
  return t === "" || t === "n/a" || t === "na" || t === "-";
}

export class DomainParseError extends Error {
  constructor(
    public readonly field: string,
    public readonly input: string,
  ) {
    super(`Cannot parse ${field}: ${JSON.stringify(input)}`);
    this.name = "DomainParseError";
  }
}
