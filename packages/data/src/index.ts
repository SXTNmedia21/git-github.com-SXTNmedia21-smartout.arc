/**
 * @smartout/data — TypeScript data definitions and shared hooks for Smartout.
 *
 * Five modules:
 * - validators: Zod schemas for mutation inputs
 * - permissions: C4 role-based permission matrix
 * - cascade: Entity → cascade dimension classification
 * - telemetry: Mutation event definitions
 * - day-session: TanStack Query hooks for day_line (mobile-parity, ADR-0133)
 */

export * from "./validators/index.js";
export * from "./permissions/index.js";
export * from "./cascade/index.js";
export * from "./telemetry/index.js";
export * from "./day-session/index.js";
