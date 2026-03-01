/**
 * Splits a comma-separated string into a trimmed, non-empty array.
 * Used by journey edit forms for tags, preconditions, and data arrays.
 */
export function splitComma(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
