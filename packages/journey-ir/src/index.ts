/**
 * @smartout/journey-ir — canonical JourneyIR package.
 *
 * Per ADR-0171, the legacy adjacent-to-capabilities path is forbidden —
 * all journey intermediate representation types, Zod schemas, and related
 * utilities live here. Consumers import from `@smartout/journey-ir`.
 *
 * Contents:
 *   - `./types` — IR type family + `CURRENT_IR_VERSION` (ADR-0178 v2).
 *   - `./schema` — Zod mirrors; accepts `"1.0.0"` and `"2.0.0"` on reads.
 *   - `./compile` — engine-runtime compile structs + `assertCurrentIrVersion`.
 *
 * M3.5 exit (ADR-0174 C.11 / ADR-0178): the migration adapter, its test
 * file, the legacy source-shape type, and the `./adapters/` directory
 * were deleted after the runner retargeted and samples were rewritten to
 * emit `JourneyIR` natively.
 */

export * from "./types";
export * from "./schema";
export * from "./compile";
export * from "./validate";
