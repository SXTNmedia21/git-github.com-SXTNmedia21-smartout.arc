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

export * from "./validators/index";
export * from "./permissions/index";
export * from "./cascade/index";
export * from "./telemetry/index";
export * from "./day-session/index";
