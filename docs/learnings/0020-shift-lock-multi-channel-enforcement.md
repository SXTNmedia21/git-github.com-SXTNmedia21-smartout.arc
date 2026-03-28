---
title: "Shift Lock Must Be DB-Canonical"
id: LEARNING_0020
status: canonical
layer: learning
created: 2026-03-28
updated: 2026-03-28
tags: [schedule, governance, rls, mcp, voice]
---

# Learning-0020: Shift lock must be DB-canonical in multi-channel writes

## Context

Council review for immutable shift windows found that schedule writes happen from
web hooks, voice tools, shared package hooks, and `shift-mcp` service-role paths.
The requested behavior was to block planning mutations when a shift has started
or its date has passed.

## Discovery

RLS or frontend checks alone are insufficient for this invariant. Service-role
paths can bypass RLS, and side-channel writes can bypass UI logic. The lock must
be enforced at a canonical DB layer with a field-level exception matrix.

## Impact

Future shift lock work must:

1. Enforce lock rules in DB first (trigger/function/RPC contract).
2. Keep explicit post-lock exceptions for operational fields.
3. Make all mutation channels use the same contract and reason codes.

## References

- `docs/decisions/0066-temporal-shift-lock-architecture.md`
- `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts`
- `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`
- `supabase/migrations/20260301300000_schedule_shift_table.sql`
- `supabase/migrations/20260418100300_mobile_schema_additions.sql`
