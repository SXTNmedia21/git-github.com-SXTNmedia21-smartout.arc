---
id: ADR-0331
title: "Targeted Note Audience Model — JSONB Blob (Phase 1)"
status: proposed
date: 2026-05-15
deciders: [pontus, council]
tags: [communication, schema, scheduling]
supersedes: null
superseded_by: null
layer: decision
created: 2026-05-15
updated: 2026-05-15
---

# ADR-0331: Targeted Note Audience Model — JSONB Blob (Phase 1)

## Context and Problem Statement

The Dagslinjen QuickAdd feature extends `session_note` with scheduled fanout: a manager
creates a note at 14:00, targets a team (e.g. "Lørdag PM"), and `notify_at=18:00` fires a
push/in-app notification to each resolved recipient. The note carries an **audience
specification** — a set of dept_ids / team_ids / shift_ids / profile_ids — which is
resolved at fanout time into a concrete list of `profile_id` rows.

We need to decide how to store the audience on `session_note`:

- **Option A — JSONB blob column** (`audience JSONB`) carrying optional arrays of
  `dept_ids`, `team_ids`, `shift_ids`, `profile_ids`. Resolved to recipient list at fanout
  time by the Edge Function.
- **Option B — Normalized junction table** (`session_note_audience` with one row per
  `{note_id, audience_type, audience_id}` triple).
- **Option C — Hybrid** (JSONB for intent + junction for per-recipient delivery state).

This is a Phase-1-only decision; Phase 2 may add per-recipient read-receipts, escalation,
or acknowledgement workflows that change the calculus.

## Decision Drivers

- **Codebase precedent.** `platform_communication_log.audience_filter JSONB` already
  exists as the canonical "intent snapshot" pattern (migration `20260228120000`); paired
  with `platform_communication_recipient` junction (one row per recipient, with
  `status`/`sent_at`/`delivered_at`) for per-recipient state. This is **the established
  pattern** for fanout in this codebase.
- **Per-recipient state already lives elsewhere.** The `notification` table (migration
  `20260324220000`) already stores one row per recipient with `recipient_id`, `is_read`,
  `read_at`, `metadata JSONB`. Phase-2 read-receipt for scheduled notes is solved by
  filtering `notification` rows whose `metadata->>'note_id' = session_note.id`, **not**
  by a new junction table.
- **Audience size in practice.** Median ~6 profile_ids after team resolution (`Lørdag PM`
  ≈ 4-8 members, departments ≈ 5-15). Maximum bounded by workspace size (~100).
- **Write-once / read-once.** Audience is set at create-time, read once at `notify_at`,
  never updated. No need for indexed per-element queries (e.g. "find all notes targeting
  team X") in Phase 1 — that's a Phase 2 reporting feature.
- **RLS complexity.** `session_note` already has 3 policies (jwt_read, jwt_insert,
  service_role). Adding a junction means doubling the RLS surface plus a join in the
  resolver query.
- **Migration burden.** JSONB column = 1 ALTER + 2 indexes. Junction = new table + 4 RLS
  policies + foreign keys + cascade rules + 2 indexes.

## Considered Options

1. **Option A — JSONB blob on `session_note`** (recommended). Single column
   `audience JSONB` with optional `dept_ids` / `team_ids` / `shift_ids` / `profile_ids`
   arrays. CHECK constraint enforces non-empty audience when `notify_at IS NOT NULL`. GIN
   index for future containment queries. Resolver expands JSONB → profile_ids[] at fanout.
2. **Option B — Junction table `session_note_audience`.** One row per
   `{note_id, audience_type ENUM('dept'|'team'|'shift'|'profile'), audience_id UUID}`.
   FK integrity, queryable per-target, indexable. Costs: new table, 4 RLS policies,
   cascade on `session_note` delete, +2-3× row count at fanout time, more complex join
   for resolver.
3. **Option C — Hybrid: JSONB intent + junction for delivery state.** Audience JSONB on
   `session_note` for write/snapshot; new junction `session_note_delivery` populated by
   the scheduler with one row per resolved recipient + `delivered_at`/`read_at`. Costs:
   both options' costs + redundancy with `notification` table.

## Decision Outcome

Chosen option: **Option A — JSONB blob on `session_note`** for Phase 1.

### Rationale

- **Per-recipient state is already covered by `notification`.** The strongest argument
  for junction (Option B) is "we'll need per-recipient delivery in Phase 2." But the
  `notification` table already does exactly that: one row per recipient, `is_read`,
  `read_at`, `metadata JSONB` for back-reference. Phase-2 read-receipt query is
  `SELECT n.* FROM notification n WHERE n.metadata->>'note_id' = $1` — no new junction
  required. A `session_note_audience` junction would duplicate this responsibility.
- **Codebase precedent is strong.** `platform_communication_log` (the only other
  scheduled-fanout pattern in this codebase) uses **exactly this dual-pattern**: JSONB
  `audience_filter` for intent + recipient table for delivery. We are not inventing —
  we are matching.
- **Audience snapshot semantics.** What we store at create-time is the manager's *intent*
  ("the Lørdag PM team", not "these 4 specific profiles"). If a member joins the team
  before `notify_at`, the resolver picks them up. If a member leaves, the resolver drops
  them. A junction table would freeze membership at write-time and require a separate
  reconciliation pass — exactly the opposite of what we want.
- **RLS simplicity.** Existing `session_note` policies cover the audience — no new policy
  surface. Junction would need its own jwt_read / jwt_insert / api_key_read /
  service_role policies, all 4 needing to agree with `session_note` policies.
- **Migration risk.** Phase 1 adds 4 columns + 2 indexes to one table. Option B adds a
  new table with FKs to 4 other tables (`session_note`, `department`, `team`,
  `schedule_shift`, `profile`) — any of which can fail cascade tests.

## Rules & Consequences

### Good, because

- Matches established codebase pattern (`platform_communication_log`).
- Single-table change; faster to ship + roll back.
- "Resolve at fire-time" semantics give correct behavior for late team-membership
  changes (employee added to Lørdag PM at 17:55 still receives the 18:00 push).
- RLS surface unchanged — no new policy review burden.
- Phase 2 per-recipient state already lives in `notification` — no migration needed when
  Phase 2 builds the read-receipt UI.
- GIN index on `audience JSONB` supports future "which notes target this team?" queries
  without a schema change.

### Bad, because

- No FK integrity on audience members. If a team is deleted, its UUID lingers in
  `audience.team_ids`. **Mitigation:** resolver filters non-existent rows; emit
  `comm.scheduled_note.dangling_audience` telemetry for ops awareness.
- Cannot atomically remove one team from N notes' audiences without rewriting JSONB.
  Acceptable — this is not a Phase 1 use case.
- Containment queries (`audience @> '{"team_ids":["..."]}'`) require GIN index — slightly
  larger storage than B-tree FK indexes on a junction. Mitigation: partial index where
  `audience IS NOT NULL`.
- Slightly weaker auditability: cannot show "audit log of who was added/removed from
  audience" without diffing JSONB versions. Acceptable — note audience is write-once.

### Agent Impact

- **`smartout-agent-dev` / capability authors:** when emitting audience-based capabilities,
  shape the audience payload as `{ dept_ids?: UUID[], team_ids?: UUID[], shift_ids?:
  UUID[], profile_ids?: UUID[] }`. Zod schema in `packages/types/src/session-note.ts`
  enforces.
- **`smartout-database-guide` users:** do NOT create a `session_note_audience` junction
  table without first checking if `notification.metadata->>'note_id'` solves the use case.
- **Scheduler / Edge Function authors:** the audience resolver at
  `supabase/functions/note-fanout-scheduler/audience-resolver.ts` is the single
  authoritative resolver. Reuse it for any future targeted-fanout feature (channel
  broadcasts, training assignments). Do not duplicate JSONB → profile_ids[] logic.

## Phase 2 Migration Path (if blob is wrong choice)

If Phase 2 surfaces a hard requirement that JSONB cannot meet (e.g. per-audience-element
authority audit, acknowledgement-per-team-member that diverges from `notification.is_read`,
or "find all notes targeting profile X" hot-path queries), migration to junction is
mechanical:

```sql
-- Phase 2 migration (illustrative)
CREATE TABLE public.session_note_audience (
  note_id        UUID NOT NULL REFERENCES session_note(id) ON DELETE CASCADE,
  audience_type  TEXT NOT NULL CHECK (audience_type IN ('dept','team','shift','profile')),
  audience_id    UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, audience_type, audience_id)
);

-- Backfill from JSONB
INSERT INTO public.session_note_audience (note_id, audience_type, audience_id)
SELECT id, 'dept', (jsonb_array_elements_text(audience->'dept_ids'))::uuid
FROM public.session_note WHERE audience ? 'dept_ids'
UNION ALL
SELECT id, 'team', (jsonb_array_elements_text(audience->'team_ids'))::uuid
FROM public.session_note WHERE audience ? 'team_ids'
UNION ALL
SELECT id, 'shift', (jsonb_array_elements_text(audience->'shift_ids'))::uuid
FROM public.session_note WHERE audience ? 'shift_ids'
UNION ALL
SELECT id, 'profile', (jsonb_array_elements_text(audience->'profile_ids'))::uuid
FROM public.session_note WHERE audience ? 'profile_ids';

-- Keep audience JSONB as canonical intent; junction becomes denormalized index.
-- OR drop audience JSONB after verifying junction parity.
```

Backfill is single-pass, idempotent, and gated on Phase 2 ADR.

## Acceptance Criteria

- [ ] Migration `<TS>_session_note_targeted_fanout.sql` adds 4 columns
      (`audience JSONB`, `notify_at TIMESTAMPTZ`, `delivered_at TIMESTAMPTZ`,
      `deleted_at TIMESTAMPTZ`) to `public.session_note`.
- [ ] CHECK constraint `session_note_audience_when_targeted_chk` rejects rows where
      `notify_at IS NOT NULL AND (audience IS NULL OR audience = '{}'::jsonb)`.
- [ ] Partial B-tree index `idx_session_note_fanout_pending` exists on
      `(notify_at)` WHERE `delivered_at IS NULL AND notify_at IS NOT NULL AND
      deleted_at IS NULL`.
- [ ] GIN index `idx_session_note_audience_gin` exists on `(audience)` WHERE
      `audience IS NOT NULL`.
- [ ] `packages/types/src/session-note.ts` exports a Zod schema for `Audience` with
      optional `dept_ids[]`, `team_ids[]`, `shift_ids[]`, `profile_ids[]`, with at least
      one array non-empty.
- [ ] `supabase/functions/note-fanout-scheduler/audience-resolver.ts` exists as the
      single authoritative resolver, unit-tested for: profile-only, team-only, dept-only,
      shift-only, mixed, dedup, dangling-team-id, dangling-profile-id.
- [ ] `database.types.ts` regenerated; `session_note.Row` includes `audience: Json | null`,
      `notify_at: string | null`, `delivered_at: string | null`, `deleted_at: string | null`.
- [ ] No `session_note_audience` table is created. Phase 2 migration path documented above.
- [ ] Telemetry event `comm.scheduled_note.dangling_audience` registered for ops
      awareness (fires when resolver encounters a UUID that no longer exists).

## Cross-references

- ADR-0078 — Channel pinning (note channel is in-app + push, server-pinned)
- ADR-0099 — Authority audit rows (cross-dept fanout writes audit, see ADR-0333)
- ADR-0151 — Server-derived identity (resolver uses service_role, not user JWT)
- ADR-0244 — Capability boundaries (fanout is a `comm` capability, not `journey`)
- ADR-0332 (planned) — Scheduler cadence + transport (pg_cron → Edge Function)
- ADR-0333 (planned) — Cross-dept authority gate for note fanout
- Spec — `docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md` § 5, § 9 Q1
- Journey (write) — `docs/journeys/JOURNEY-dagslinjen-quickadd-manager-target-note-fanout.md`
- Journey (read) — `docs/journeys/JOURNEY-dagslinjen-quickadd-employee-receives-targeted-note.md`

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
