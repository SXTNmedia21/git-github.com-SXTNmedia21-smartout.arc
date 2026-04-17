---
title: "Schema UNIQUE constraints invalidate bookkeeping-container migration patterns"
id: LEARNING_0035
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [migration, strike-mcp, schema, postgres, trace]
---

# Learning-0035: Schema UNIQUE constraints invalidate bookkeeping-container patterns

## Context

Tier 2 v1.5 of strike-mcp tried to migrate 2 Bubble handbooks + 1 operational-
procedures container under ONE bookkeeping policy — a classic "container for
many" migration pattern. Per-file review + per-row payload trace both PASSED.
Post-implementation code-trace found the latent bug.

The v3 schema enforces `CONSTRAINT unique_policy_protocol UNIQUE (policy_id)`
at `supabase/migrations/00003_governance_tables.sql:56`. This means
policy:protocol is 1:1 — one policy owns exactly one protocol.

Applying the DRY-RUN SQL as-written would have thrown `SQLSTATE 23505
duplicate key value violates unique constraint "unique_policy_protocol"` on
row 2 of `02_protocol.sql`, aborting the transaction and cascading FK
failures through `03_procedure.sql` + `04_confirmation.sql`.

## Discovery

The bookkeeping-container migration pattern ("create one synthetic parent to
satisfy FK requirements for N migrated children") is incompatible with any
target schema that enforces UNIQUE on the parent FK. Specifically:

- If `child.parent_fk` is UNIQUE, then parent:child is 1:1.
- A migration cannot use "1 synthetic parent for N children" because the 2nd
  INSERT throws `23505 unique_violation`.

Variants of this pattern commonly appear in migrations:
- One bookkeeping policy holding N migrated protocols (our case).
- One bookkeeping season holding N migrated planning rows.
- One bookkeeping user owning N migrated records.

All fail the same way if the target schema has UNIQUE on the FK.

Three fix strategies:
1. **1:1 pairing** — emit one parent per child. Preserves schema invariant,
   no ADR needed. Best when "many containers" is semantically OK (which it
   is for bookkeeping anyway).
2. **Collapse** — N children under ONE parent of the same type. Loses
   differentiation; usually wrong.
3. **Drop the constraint** — requires ADR, changes product architecture
   system-wide for a migration convenience. High cost, low value.

Tier 2 v1.5 fixed with (1). 2 handbooks → 2 policies + 2 protocols.

## Impact

**Before emitting migration SQL:** grep target migrations for `UNIQUE (` on
every FK in the INSERT chain. If any match, reject the bookkeeping-container
pattern and emit 1:1 pairs instead.

**Migration-script checklist (add to spec templates):**
- [ ] For every FK in every INSERT, check if target has UNIQUE on the FK
- [ ] If UNIQUE: emit 1:1 parent-child pairs
- [ ] If not UNIQUE: bookkeeping-container pattern is safe

**Broader:** when a migration's `policy_id` / `season_id` / `created_by` is
pointed at a synthetic container, ask if the target schema allows many-to-one
at that join. Don't discover the answer at apply time.

## References

- Tier 2 post-implementation council: `docs/council/COUNCIL-LOG.md` 2026-04-17 (2nd entry)
- Source constraint: `supabase/migrations/00003_governance_tables.sql:56`
- Fix commit: strike-mcp `1627556` — `fix(tier2): apply council verdict must-fixes`
- Related: Learning 0033 (attestation ≠ apply-readiness), Learning 0034 (knowledge extraction), Learning 0036 (trace beats per-file)

---
