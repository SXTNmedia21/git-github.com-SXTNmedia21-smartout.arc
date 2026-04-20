---
title: "Migration idempotency claims require ON CONFLICT evidence, not manifest assertions"
id: LEARNING_0052
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [migration, strike-mcp, postgres, idempotency, trace]
---

# Learning-0052: Idempotency claims require `ON CONFLICT` evidence

## Context

Tier 2 v1.5 of strike-mcp shipped a `MANIFEST.json` claiming:

> "Bookkeeping policy_id is deterministic (uuidv5) — re-runs are idempotent."

This is half true. Deterministic PKs make re-runs *reproducible*, not
*idempotent*. Without `ON CONFLICT DO NOTHING` (or equivalent `MERGE` /
`ON CONFLICT UPDATE`), the second apply throws Postgres error `23505`
(`unique_violation`) on the first INSERT because the row already exists.

Caught by Agent Coordinator code-trace during post-implementation council
review (Learning 0051, layer 2). Fix applied in strike-mcp commit `1627556`:
added `ON CONFLICT (pk) DO NOTHING` to all 4 governance INSERT files.

## Discovery

**Deterministic UUID ≠ idempotent apply.** Three orthogonal properties:

1. **Reproducible** — same input always produces the same SQL. Deterministic
   UUIDs (uuidv5) give you this.
2. **Idempotent** — running the same SQL twice has the same effect as once.
   Requires `ON CONFLICT` / `MERGE` or pre-apply existence checks.
3. **Side-effect-free** — even if rows exist, the re-apply produces no
   events, triggers, or cascades. Requires the above + trigger inspection.

Migration manifests commonly conflate (1) with (2). A manifest saying
"idempotent" without `ON CONFLICT` evidence in the emitted SQL is making
an assertion the code does not back.

**Practical test:** grep the emitted SQL for `ON CONFLICT`. If zero
matches, the migration is NOT idempotent regardless of PK determinism.

## Impact

**For migration manifests:** any MANIFEST field claiming idempotency must
be verified against SQL emission. Add a pre-commit check:

```bash
if grep -q '"idempoten' MANIFEST.json; then
  count=$(grep -c "ON CONFLICT" *.sql || echo 0)
  total=$(grep -c "INSERT INTO" *.sql || echo 0)
  if [ "$count" -lt "$total" ]; then
    echo "FAIL: MANIFEST claims idempotent but $count/$total INSERTs have ON CONFLICT"
    exit 1
  fi
fi
```

**For migration-script templates:** include `ON CONFLICT DO NOTHING` as
the default INSERT pattern. Opt out only when the migration explicitly
wants to fail on duplicate (a safety check for single-run migrations).

**For council briefings on migrations:** add "grep for `ON CONFLICT` on
every emitted INSERT" to the Phase 2 briefing when topic type includes
migration scripts.

**For strike-mcp specifically:** the `emitRowSql` function in
`scripts/tier2_extract.ts` now emits `ON CONFLICT (pk) DO NOTHING` for any
row where `PRIMARY_KEY[table]` is defined. Extend this pattern to Tier 1's
SQL emitter (`src/migration/sql_emitter.ts`) as a separate hardening pass.

## References

- Fix: strike-mcp commit `1627556` — `emitRowSql` adds `ON CONFLICT`
- Source grep that revealed the gap: "ON CONFLICT" count = 0 in original
  Tier 2 v1.5 SQL output (before fix)
- Related: Learning 0033 (attestation ≠ apply-readiness), Learning 0051
  (4-layer review model)
- Target pattern: `supabase/migrations/00003_governance_tables.sql` PKs

---
