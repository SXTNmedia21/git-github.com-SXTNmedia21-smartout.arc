/**
 * ir-ts-emitter.ts
 *
 * Emit a JourneyIR object as a TypeScript module that, when placed in
 * apps/e2e/protocols/, becomes a runnable protocol entry.
 *
 * Strategy: serialize as JSON, wrap as `export const <Slug>: JourneyIR = <json>;`.
 * The exported const name is the slug with non-alphanumeric characters removed
 * so that "P-002" → "P002" (valid TS identifier, no hyphen).
 *
 * Purely a string transformation — no I/O, no LLM calls. Caller is responsible
 * for writing the result to disk (API route handles that).
 */

import type { JourneyIR } from "@smartout/journey-ir";

export function emitIRToTypescript(ir: JourneyIR): string {
  // Strip all non-alphanumeric chars from slug to produce a valid TS identifier.
  // "P-002" → "P002", "P-ADMIN-ONBOARDING" → "PADMINONBOARDING"
  const constName = ir.slug.replace(/[^A-Za-z0-9]/g, "");
  const json = JSON.stringify(ir, null, 2);

  return `import type { JourneyIR } from "@smartout/journey-ir";

/**
 * ${ir.slug}: ${ir.title}
 *
 * Module: ${ir.module}
 * Compiled by Journey Control Center.
 */
export const ${constName}: JourneyIR = ${json};
`;
}
