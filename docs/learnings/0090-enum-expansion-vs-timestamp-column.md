---
title: "Enum Expansion vs Timestamp Column — Cascade-Shape Decision Heuristic"
id: LEARNING_0090
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [database, cascade, enum, schema-design, decision-heuristic]
---

# Learning-0090: Enum Expansion vs Timestamp Column

## Context

During the Auth & Invitation Spec Scope Council (2026-04-20), Q5 asked whether `invitation_opened` should be modeled by extending the `invite_status` enum (adding `'opened'` value between `'pending'` and `'accepted'`) or by adding a nullable `opened_at timestamptz` column to `workspace_invitation`. The council split 2-2, with frontend-designer and agent-coordinator arguing for the enum (treats "opened" as first-class state, visible to SQL/RLS/UI filter) and system-steward + supervisor arguing for the timestamp (opened is telemetry metadata, not a state transition). Steward's Phase 5 synthesis resolved this as **different** semantics and chose timestamp.

This is not the first time this shape has come up. It appeared in:
- ADR-0136 (camera evidence — could have been `evidence_status` enum; chose `captured_at` + `reviewed_at` timestamps).
- Likely in ADR-0164 (season activation — status vs multiple `*_at` timestamps).
- The helpdesk ticket lifecycle (ADR-0161 — ticket is `engine_state`, lifecycle via state transitions, but evidence-linking used timestamp columns).

## Discovery

The enum-vs-timestamp decision has a repeatable heuristic:

**Use an enum value when:**
- Every consumer must branch on the value (RLS policies, business logic, engine_event filtering).
- The state is mutually exclusive with other states (you can't be both "opened" and "pending" simultaneously).
- Invariants need DB-level enforcement (e.g., "only `pending` invitations can be accepted").
- The value represents a decision (someone chose to transition).

**Use a nullable timestamp column when:**
- Only UI derives display from the value (e.g., `displayStatus = opened_at ? 'viewed' : status`).
- The state is additive/observational (being "opened" doesn't stop you from still being "pending" — an opened-but-unaccepted invitation is still pending from every consumer's view).
- Telemetry is the primary consumer, not business logic.
- Schema should be reversible without migration cost.

**The invitation `opened` case fits timestamp:** An opened-but-not-accepted invitation is still `pending` from RLS's perspective, from accept-flow's perspective, from expiry-cron's perspective. Only the admin-facing StatusList UI cares, and it derives display via `deriveDisplayStatus(invitation)`. Promoting `opened` to enum would force every query to consider a new state, without any business logic actually using it.

## Impact

- **Added to `smartout-database-guide` skill:** New heuristic section "Enum vs Timestamp — when to promote a lifecycle event to a first-class state."
- **Applied retroactively:** When reviewing existing enum proposals in future councils, ask the heuristic questions before accepting new enum values. If the answer is "only the UI cares", reject and propose timestamp.
- **Applied to auth spec Q5:** Adopted `opened_at timestamptz NULL` column. UI component `InvitationStatusList` owns pure derivation `deriveDisplayStatus(invitation) → 'sent' | 'viewed' | 'accepted' | 'expired' | 'cancelled'`.
- **Prevents cascade of migrations:** Adding an enum value requires a migration, type regeneration, consumer audit, RLS review. Adding a nullable timestamp is additive and reversible.

## References

- ADR-0169 (partial unique index on pending invitations — related schema decision)
- ADR-0136 (camera evidence — same heuristic applied)
- ADR-0161 (helpdesk ticket as engine_state — timestamps over enum proliferation)
- `smartout-database-guide` skill (heuristic will be added post-council)
- `supabase/migrations/00011_employee_invitations.sql:4` (current invite_status enum — unchanged by this decision)

---

> Registered in `docs/learnings/0000-learning-log.md`.
