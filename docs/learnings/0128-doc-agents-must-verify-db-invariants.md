---
id: L-0128
title: Doc agents must verify DB-level invariants before declaring regressions
status: accepted
date: 2026-04-22
updated: 2026-04-22
layer: learning
tags: [process, council, docs-tutor, verification, regression-claims]
---

# L-0128: Doc agents must verify DB-level invariants before declaring regressions

## Context

During Wave H closure verification council (post-implementation, 2026-04-22), the
`docs-tutor` agent was tasked with writing `JOURNEY-wave-h.md` and refreshing
`employee-invitation-accept.md`. As a "Discovery" appended to its summary, it
flagged what it called a **regression**:

> The new `createInvitation()` lib inserts unconditionally with no
> `(workspace_id, email, status='pending')` UNIQUE constraint or pre-check.
> Duplicate-invite scenario flagged for Wave I follow-up.

This was committed to the orchestrator as a real regression.

## What actually happened

Phase 2.5 fact-check (`general-purpose` agent) verified the claim against the
codebase. Three pieces of evidence falsified the regression claim:

1. **Migration `20260515140000_invitation_opened_at_and_partial_unique_pending.sql:32-34`**
   adds a partial UNIQUE INDEX:
   ```sql
   CREATE UNIQUE INDEX workspace_invitation_pending_unique_per_email
   ON public.invitation (workspace_id, email)
   WHERE status = 'pending';
   ```
   (See ADR-0169.)
2. **The deleted `create-invitation` Edge Function ALSO had no pre-check** —
   verified via `git show 522e81a7^:supabase/functions/create-invitation/index.ts`,
   it INSERTed unconditionally. Both pre-Wave-H and post-Wave-H rely on the
   DB-level constraint to enforce uniqueness.
3. **DB returns Postgres error 23505 on duplicate** — surfaces to the user as a
   raw error today (UX gap, not data integrity gap). Behavior is byte-identical
   to pre-Wave-H.

`docs-tutor` reasoned only from the code-path (saw no pre-check in
`createInvitation()`, called it a regression). It did not check whether DB
constraints made the pre-check unnecessary.

## The pattern

**Doc/review agents that read code paths and declare regressions are blind to
DB-enforced invariants** unless they explicitly grep for `UNIQUE`, `CHECK`,
`NOT NULL`, FK constraints, and triggers in `supabase/migrations/`.

This is the **5th occurrence** of prior-claim-vs-code-truth divergence in
council briefings (per `learning_audit_inflation_pattern.md`):
- 2026-04-16 Web Perf — three concurrent write paths
- 2026-04-17 Mobile — 6 broken emit sites
- 2026-04-19 Kanaler — `gate_action` default-allow
- 2026-04-21 Journey Runner — schema-fiction columns
- 2026-04-22 Wave H — duplicate-invite false regression (this case)

## How to apply

Any doc/review agent claiming a constraint regression MUST do this before
asserting:

```bash
# For uniqueness claims:
grep -rn "UNIQUE.*<column>\|CREATE UNIQUE INDEX.*<table>" supabase/migrations/

# For check/validation claims:
grep -rn "CHECK\|CONSTRAINT.*<table>" supabase/migrations/

# For trigger claims:
grep -rn "CREATE TRIGGER.*<table>" supabase/migrations/

# For partial-index claims (the case that fooled docs-tutor):
grep -rn "WHERE status\|partial.*unique" supabase/migrations/
```

If the constraint exists at the DB level, the absence of an application-layer
pre-check is **not a regression** — it's redundant code correctly omitted.

## Promotion candidate

5 occurrences across 6 weeks crosses the run-council promotion threshold (3
occurrences in different sessions). Recommend promoting "DB-invariant grep gate"
into `run-council` SKILL.md Phase 2.5 fact-check step:

> For every "missing constraint/check/validation" claim a briefing or doc-agent
> makes, verify the constraint is genuinely missing from BOTH the code path AND
> the migration history. Application-layer omission is not a regression when DB
> enforcement exists.

## References

- ADR-0169 (partial UNIQUE index for pending invitations)
- L-0036 (4-layer review assignment — Layer 3 trigger/constraint semantics)
- L-0094 (phantom emit contracts — same pattern, inverse direction)
- `learning_audit_inflation_pattern.md` (4th-occurrence promotion 2026-04-16)
- Wave H council session 2026-04-22 Phase 2.5 finding
