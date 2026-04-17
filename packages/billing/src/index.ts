// @smartout/billing — data layer for the Smartout billing engine.
//
// ADR-0118: C3 Commercial consumer. This package holds pure,
// environment-agnostic primitives — types, Zod input schemas, and
// query functions that accept a Supabase client. Web wraps them in
// Server Actions; mobile calls them directly. No React dependency in
// the query layer; React Query hooks live in ./hooks and accept a
// caller-supplied fetcher.
//
// Task 3.1 (scaffold): empty public surface. Task 3.2 adds types +
// schemas. Task 3.3 adds queries + hooks. Task 3.4 adds
// resolveCompanyId helper in @smartout/ai (separate package).

export {};
