/**
 * Department type classification and offset defaults for hospitality.
 * Used by I1 bootstrap to classify departments during workspace creation.
 */

/** Department name -> type mapping with confidence for bootstrap classification */
export const DEPARTMENT_TYPE_MAP: Record<
  string,
  { type: "operational" | "administrative"; confidence: "high" | "medium" | "low" }
> = {
  // Operational (high confidence)
  Kjøkken: { type: "operational", confidence: "high" },
  Kjokken: { type: "operational", confidence: "high" },
  Kitchen: { type: "operational", confidence: "high" },
  Sal: { type: "operational", confidence: "high" },
  Floor: { type: "operational", confidence: "high" },
  "Front of House": { type: "operational", confidence: "high" },
  Service: { type: "operational", confidence: "high" },
  Bar: { type: "operational", confidence: "high" },
  "Bar ute": { type: "operational", confidence: "high" },
  Uteservering: { type: "operational", confidence: "high" },
  Oppvask: { type: "operational", confidence: "high" },
  Bakeri: { type: "operational", confidence: "high" },
  Kafe: { type: "operational", confidence: "high" },
  Resepsjon: { type: "operational", confidence: "high" },
  // Administrative (high confidence)
  Kontor: { type: "administrative", confidence: "high" },
  Admin: { type: "administrative", confidence: "high" },
  Administrasjon: { type: "administrative", confidence: "high" },
  Administration: { type: "administrative", confidence: "high" },
  HR: { type: "administrative", confidence: "high" },
  Regnskap: { type: "administrative", confidence: "high" },
  Økonomi: { type: "administrative", confidence: "high" },
  Ledelse: { type: "administrative", confidence: "high" },
};

/** Normalize department name for lookup: trim, lowercase, NFC normalize */
export function lookupDepartmentType(
  name: string,
): { type: "operational" | "administrative"; confidence: "high" | "medium" | "low" } | null {
  const normalized = name.trim().normalize("NFC");
  // Direct lookup first
  if (DEPARTMENT_TYPE_MAP[normalized]) return DEPARTMENT_TYPE_MAP[normalized];
  // Case-insensitive match
  const lower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(DEPARTMENT_TYPE_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }
  // Try without diacritics
  const withoutDiacritics = lower.replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a");
  for (const [key, value] of Object.entries(DEPARTMENT_TYPE_MAP)) {
    const keyNorm = key.toLowerCase().replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a");
    if (keyNorm === withoutDiacritics) return value;
  }
  return null;
}

/** Department offset defaults in minutes (from workspace base hours) */
export const DEPARTMENT_OFFSET_DEFAULTS: Record<
  string,
  { openOffset: number; closeOffset: number }
> = {
  Kjøkken: { openOffset: -120, closeOffset: 0 },
  Kjokken: { openOffset: -120, closeOffset: 0 },
  Kitchen: { openOffset: -120, closeOffset: 0 },
  Sal: { openOffset: -60, closeOffset: 0 },
  Floor: { openOffset: -60, closeOffset: 0 },
  Service: { openOffset: -60, closeOffset: 0 },
  "Front of House": { openOffset: -60, closeOffset: 0 },
  Bar: { openOffset: 0, closeOffset: 0 },
  "Bar ute": { openOffset: 240, closeOffset: 0 },
  Uteservering: { openOffset: 0, closeOffset: 0 },
};
