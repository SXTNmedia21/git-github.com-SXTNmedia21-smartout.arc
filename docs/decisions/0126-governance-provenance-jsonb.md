---
title: "Governance table provenance convention via `provenance JSONB`"
id: ADR-0126
collision_note: "Originally numbered 0101 before discovering development was on 0125+. Renumbered during /close-feature 2026-04-17 to avoid collision with sma-3 branch (docs/adrs-0101-0106-governance-training)."
status: accepted
layer: decision
module: governance
created: 2026-04-17
updated: 2026-04-17
decided_by: system-council
tags: [schema, provenance, governance, strike-mcp, cascade-invariant-8]
---

# ADR-0126: Governance table provenance convention via `provenance JSONB`

## Context

Strike-mcp Tier 2 migration (commit `2d4d373` in strike-mcp repo) inserts rows
from Bubble into v3 governance tables: `policy`, `protocol`, `procedure`,
`procedure_step`, `confirmation`. The original MANIFEST claimed
`source = 'bubble_migration'` tagging, but the 2026-04-17 Tier 2 v1.5
post-implementation council (Supervisor code-trace) found zero `source`
column references in the emitted SQL. Decision deferred to this ADR.

**Cascade Invariant 8:** *"Every derived/imported output must carry
provenance."* This ADR enforces the invariant for governance content
imports (strike-mcp today; DocuSeal / AI drafting / external templates
tomorrow).

## Decision

Add `provenance JSONB NOT NULL DEFAULT '{}'` to five governance tables:

- `public.policy`
- `public.protocol`
- `public.procedure`
- `public.procedure_step`
- `public.confirmation`

Guard column content with `CHECK (jsonb_typeof(provenance) = 'object')` on
each table.

Partial index on `((provenance->>'origin'))` where `provenance ? 'origin'`
for efficient origin queries.

### Convention (enforced by this ADR, not by DB)

When `provenance` is non-empty, it SHOULD include `origin` with one of:

- `'bubble-import'` — strike-mcp migration from Bubble
- `'platform-seed'` — `supabase/migrations/202604122*_seed_*.sql`
- `'admin-ui'` — TanStack mutations in `apps/web/src/app/dashboard/governance/`
- `'api'` — programmatic Edge Function / Server Action writes
- `'ai'` — future AI drafting feature

For `origin = 'bubble-import'`, strike-mcp writes this shape:

```jsonc
{
  "origin": "bubble-import",
  "bubble_id": "1739874949110x885713510733185000",  // source row ID for reverse-lookup
  "migrated_at": "2026-04-17T17:40:28.002Z",
  "tenant": "wrightegaarden",                        // workspace slug
  "batch": "2026-04-17T17:40:28.001Z"                // run ID for audit
}
```

For `origin = 'admin-ui'` (future — not enforced in this migration), the
convention is `{ origin: 'admin-ui' }` only. The `created_by` column
already carries actor identity; `provenance` carries origin-system identity.

### Scope — five tables, not ten

Governance migration `00003_governance_tables.sql` defines 10 tables
(policy, protocol, procedure, procedure_step, routine, runbook, runbook_step,
control_list, knowledge_test, confirmation). This ADR adds `provenance` to
only the five that strike-mcp Tier 2 actually writes to. When a future
importer writes to `routine` / `runbook` / `runbook_step` / `control_list` /
`knowledge_test`, that migration adds `provenance` to those tables at the
same time, paired with the importer's first release. YAGNI.

## Alternatives considered

### A. `source text NOT NULL DEFAULT 'user' + source_id text`

Proposed initially based on the `channel_event.source + source_id` precedent
in `supabase/migrations/20260422300000_channel_communications.sql:267-269`.

**Rejected** — the council identified that `channel_event.source` is a
domain classifier (event-origin type: user/system/ai/webhook), not a
provenance receipt. Reusing the name would create semantic drift:

- `planning_event.source planning_event_source NOT NULL` — domain classifier
  (manual/auto/etc.), `20260421100200_cascade_a1_domain_tables.sql:140`
- `tariff_rate_table.source tariff_source NOT NULL DEFAULT 'riksavtalen'` —
  domain classifier, same file line 263
- `activity_trail.source TEXT DEFAULT 'web'` — runtime surface classifier

Readers seeing `policy.source` would have to know whether it meant
"event-origin type" (channel_event) or "provenance receipt" (migration
tracking) — the kind of overload the cascade ontology forbids.

### B. Sidecar JSONL at `supabase/migration-staging/.provenance/`

**Rejected** — violates Cascade Invariant 8's "must store" clause. Sidecar
files fail under workspace export, fresh checkouts, CI sandboxes, and any
environment where the filesystem layer diverges from the DB. Provenance
must be co-located with the data row, enforceable by RLS, queryable in
the same transaction.

### Established v3 convention (the precedent we DID follow)

`provenance JSONB NOT NULL DEFAULT '{}'` already exists in five cascade
tables:

- `department_operating_hours.provenance` — `20260421100200_cascade_a1_domain_tables.sql:81`
- `public_holiday.provenance` — same file, line 151
- `tariff_rate_table.provenance` — same file, line 270
- `schedule_template.provenance` — `20260421100350_cascade_a1_alter_existing.sql:129`
- `schedule_template_shift.provenance` — same file, line 133

This ADR extends that convention to governance content.

## Consequences

**Positive:**
- Governance tables now satisfy Cascade Invariant 8.
- Strike-mcp extractor gains reverse-lookup path (`SELECT ... WHERE provenance->>'bubble_id' = '<bubble_id>'`) without additional schema work.
- Future imports (DocuSeal, AI drafts, API) have a ready-made provenance channel — new origin values just extend the convention.
- Admin-UI queries "show me user-created content only" become
  `WHERE provenance->>'origin' IS NULL OR provenance->>'origin' = 'admin-ui'`.

**Neutral:**
- JSONB without a Zod validator invites shape drift over time — mitigated by
  this ADR documenting the convention + `CHECK (jsonb_typeof = 'object')`.
- `database.types.ts` regen required after migration applies.

**Negative:**
- Admin-UI mutations do NOT currently set `provenance` — they land with
  default `'{}'`. An `origin: 'admin-ui'` helper in the Supabase client would
  tighten the convention; deferred as follow-up (non-blocking).
- Platform seed migration `20260412200200_seed_training_protocol.sql` writes
  rows with default `'{}'` — semantically "unknown origin" rather than
  correctly tagged `'platform-seed'`. Follow-up migration can backfill
  (non-blocking).

## Implementation

Migration: `supabase/migrations/20260506100000_governance_provenance.sql`
(authored 2026-04-17).

Strike-mcp tier2_extract.ts row builders updated to emit `provenance`
on every row (strike-mcp commit following this ADR).

Verified end-to-end against local Supabase 2026-04-17:
- 2 policies + 2 protocols + 31 procedures + 21 procedure_steps all carry
  `origin: bubble-import` + `bubble_id` + `tenant` + `batch`
- `CHECK (jsonb_typeof = 'object')` holds for all rows
- Partial indexes on `((provenance->>'origin'))` exist and are populated

## References

- Cascade Core Foundation spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` (Invariant 8)
- Council session: `docs/council/COUNCIL-LOG.md` 2026-04-17 (source-tagging)
- Tier 2 v1.5 council that surfaced the ADR-pending: `docs/council/COUNCIL-LOG.md` 2026-04-17 (earlier entry)
- Learning 0038 (this session): provenance JSONB convention beats single-precedent reading
- Strike-mcp ADR-0004 (strike-mcp repo): `docs/superpowers/decisions/0004-derived-and-constant-columns.md` — original source-tagging proposal (superseded by this ADR for governance-table scope)
