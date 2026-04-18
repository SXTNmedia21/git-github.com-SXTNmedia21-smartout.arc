// @smartout/billing — data layer for the Smartout billing engine.
//
// ADR-0118: C3 Commercial consumer. This package holds pure,
// environment-agnostic primitives — types, Zod input schemas, and
// query functions that accept a Supabase client. Web wraps them in
// Server Actions; mobile calls them directly. No React dependency in
// the query layer; React Query hooks live in ./hooks and accept a
// caller-supplied fetcher.
//
// Fase 2 adds dispatch adapters + Server Action building blocks, plus
// the integration adapter framework (Spor B / B4). The integration
// layer is PlaceholderAdapter-only for Fase 2 per ADR-0129; Fase 3
// replaces fiken/tripletex/stripe entries with real adapters.

export * from "./types";
export * from "./schemas";
export * from "./queries";
export * from "./hooks";
export * from "./dispatch";
export * from "./integrations";
export * from "./actions/dispatch";
export * from "./actions/dispatch-rules";
export * from "./actions/integrations";
export * from "./actions/invoice-editing";
export * from "./actions/workspace-mark-paid";
