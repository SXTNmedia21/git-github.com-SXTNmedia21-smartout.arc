// @smartout/billing/accountant — accountant-scoped subpath.
//
// Import via `@smartout/billing/accountant`.
// Contains grant resolution helpers + audit emit wrappers for the
// accountant app surface (apps/admin).
//
// These modules are environment-agnostic (no "use server" / server-only)
// so both Server Components and Server Actions can import them.

export * from "./grants";
export * from "./audit";
