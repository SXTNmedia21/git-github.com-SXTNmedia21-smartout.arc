// @smartout/billing — data layer for the Smartout billing engine.
//
// ADR-0118: C3 Commercial consumer. This package holds pure,
// environment-agnostic primitives — types, Zod input schemas, and
// query functions that accept a Supabase client. Web wraps them in
// Server Actions; mobile calls them directly. No React dependency in
// the query layer; React Query hooks live in ./hooks and accept a
// caller-supplied fetcher.
//
// Fase 2 adds dispatch adapters + Server Action building blocks. The
// integration framework (Spor B / B4) is NOT exported yet — it ships
// in a follow-up batch.

export * from "./types";
export * from "./schemas";
export * from "./queries";
export * from "./hooks";
export * from "./dispatch";
export * from "./actions/dispatch";
