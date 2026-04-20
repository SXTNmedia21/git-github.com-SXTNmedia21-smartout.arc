/**
 * @smartout/data — Pure TypeScript data definitions for the Smartout platform.
 *
 * Four modules:
 * - validators: Zod schemas for mutation inputs
 * - permissions: C4 role-based permission matrix
 * - cascade: Entity → cascade dimension classification
 * - telemetry: Mutation event definitions
 *
 * No Supabase client dependency — this package runs anywhere.
 */

export * from "./validators/index.js";
export * from "./permissions/index.js";
export * from "./cascade/index.js";
export * from "./telemetry/index.js";
