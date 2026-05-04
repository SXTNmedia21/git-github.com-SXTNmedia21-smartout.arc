---
id: ADR-0180
title: Engine Event Parity Contract for Telemetry
status: accepted
date: 2026-04-22
updated: 2026-04-22
layer: decision
---

# ADR-0180: Engine Event Parity Contract for Telemetry

## Context and Problem Statement

`packages/telemetry/src/registry.ts` declares each event's destinations (`posthog`, `logger`, `activity_trail`, `engine_event`, `billing_activity_log`). The `emit()` function (server-side in `emit.ts`, client-side in `emit.client.ts`) routes to all declared destinations.

But Edge Functions cannot import `emit()` — Deno cannot resolve `packages/telemetry`. Edge Functions instead direct-insert to `activity_trail` and/or `engine_event` via the Supabase service-role client. This is documented in `create-invitation/index.ts:16-19`: *"Edge Functions can't import emit() from @smartout/telemetry."*

The result (verified 2026-04-22 for invitation events):
- `invitation.created` → `activity_trail` ✓ + `engine_event` ✓
- `invitation.dispatched` → `activity_trail` ✓ + `engine_event` ✗ (parity gap)
- `invitation.opened` → `activity_trail` (via UI emit) + `engine_event` ✓ — full coverage via UI
- `invitation.expired` → `activity_trail` ✓ + `engine_event` ✗ — gap
- `invitation.cancelled` → `activity_trail` ✓ + `engine_event` ✗ — gap
- `invitation.resent` → `activity_trail` ✓ + `engine_event` ✗ — gap
- `invitation.accepted` → `activity_trail` ✓ + `engine_event` ✓

Five events have asymmetric coverage. Any future `engine_trigger` row that subscribes to `invitation.dispatched` will silently never fire because the row never lands in `engine_event`.

This is L-0094 in a different shape — telemetry registered against a contract that producers don't fully honor. Phantom-emit (L-0083) is "registered, no producer." Parity-gap (L-0094 / L-0100) is "registered with multi-destination contract, partial producer."

## Decision Drivers

- `engine_trigger` consumers (workflow engine) read from `engine_event`. Missing rows = silent dead workflows.
- Audit consumers (admin "what happened?") read from `activity_trail`. Both are load-bearing.
- Briefing-staleness pattern (L-0099 / L-0100): without a test, parity gaps are invisible to grep audits.
- ADR-0152 (activity-trail fail-fast) already covers single-destination semantics; needs symmetric contract for multi-destination.

## Decision Outcome

**Every event registered in `packages/telemetry/src/registry.ts` with multi-destination routing MUST produce a row in EVERY declared destination, OR carry an explicit per-destination exclusion in the registry with a comment justifying the exclusion.**

A new test `packages/telemetry/__tests__/parity.test.ts` enforces this contract:
1. Read every event in `EVENT_ROUTING`.
2. For each event with `dual` routing (e.g., `["activity_trail", "engine_event"]`), assert that any production code path emitting it produces both rows.
3. For Edge Function direct-insert sites (Deno cannot import `emit()`), the test scans `supabase/functions/**/index.ts` for `from("activity_trail").insert` and `from("engine_event").insert` calls and verifies both exist for the same event_type.

The test runs in CI on every PR. A failure means: either fix the emit site to write both, OR add an explicit `exclusions: ["engine_event"]` field to the registry entry with a code comment explaining why.

## Rules & Consequences

- **Required:** every multi-destination registry entry has either full coverage at every emit site OR an explicit `exclusions` field.
- **Required:** parity test green in CI for every PR.
- **Forbidden:** silently writing to one destination of a multi-destination event.
- **Migration path for Wave H:** moving `create-invitation` to a Next.js route handler auto-fixes parity for all 7 invitation events because `emit()` writes to all declared destinations. Wave H is the first compliance proof point.
- **Wave I scope:** audit remaining Edge Functions (push-dispatch, process-notifications, fire-delayed-triggers, accept-invitation) for parity gaps. Either fix or document exclusions.

## Agent Impact

- New events: when registering in `registry.ts`, decide which destinations are required and which are optional. Optional ones go in `exclusions`.
- New emit sites: `emit()` (Node) auto-handles all destinations. Edge Function direct-insert (Deno) MUST hit all destinations declared in registry, or exclude explicitly.
- Code review: new `supabase.from("activity_trail").insert` or `supabase.from("engine_event").insert` in an Edge Function is a parity-gap-suspect. Cite this ADR.

## References

- ADR-0152 (activity-trail fail-fast contract)
- ADR-0179 (browser-originated mutations via Next.js route handlers) — eliminates Edge direct-insert for browser flows, auto-closing parity gaps
- L-0094 (phantom emit contracts recurring)
- L-0100 (audit-inflation 4th occurrence — Edge direct-insert sites invisible to grep `emit\(`)
- Spec: `docs/superpowers/specs/2026-04-22-auth-invitation-wave-h-amendment.md`
