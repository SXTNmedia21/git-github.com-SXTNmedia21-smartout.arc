---
title: "capability_default_registry as single source of truth for workspace bootstrap"
id: ADR-0413
status: accepted
layer: decision
created: 2026-05-24
updated: 2026-05-24
---

# ADR-0413: capability_default_registry as Single Source of Truth for Workspace Bootstrap

## Context and Problem Statement

Migration `20260518000000_contract_authority_seed_upsert_and_bootstrap.sql` introduced
`capability_default_registry` — a platform-wide reference table that the
`workspace_seed_authority_defaults_trg` trigger reads on every new workspace INSERT to seed
`engine_authority_config` rows. The registry is the intended canonical list of all
capabilities with their default authority levels.

However, migration lines 235-244 explicitly excluded `communication` with a comment
"separate sortie — not in scope here." Migration `20260601100000_seed_communication_authority.sql`
later backfilled `engine_authority_config` for **existing** workspaces but left
`capability_default_registry` unchanged.

Result: new workspaces created after 2026-06-01 trigger the bootstrap trigger, which
iterates `capability_default_registry` → finds no `communication` row → creates no
`engine_authority_config` row → `gate_action` silently default-allows all callers.
This is the L-0066 CVE-class default-allow pattern. Silent. No error. No log.

A sibling of L-0292 (capability registered without intent-classifier enum entry) — the
same pattern of "add to one thing, forget to add to the companion thing."

BUG-1. Chair Phase 5 synthesis 2026-05-24.

## Decision Drivers

- Workspace bootstrap must be hermetic: every capability must be seeded on every new workspace.
- Adding a capability should require exactly one migration step in one place.
- The split between "registry" and "backfill" created a maintenance gap: authors could write
  the backfill without updating the registry and CI would not catch it.
- L-0066 precedent: default-allow is a CVE-class security gap, not a minor omission.

## Considered Options

1. **Option A** — Document the gap, require human discipline.
2. **Option B** — Add `communication` to registry only (no CI gate).
3. **Option C** — Add `communication` to registry + CI gate that enforces the rule on
   new migrations going forward.

## Decision Outcome

Chosen option: **Option C**, because Option A fails at the first distraction and Option B
does not prevent the pattern from recurring. Option C makes the invariant machine-enforceable.

**Rule:** Every new capability MUST be added to `capability_default_registry` in the **same
migration** as its `engine_authority_config` backfill seed. New capabilities that land via
separate sortier must include both the registry INSERT and the backfill INSERT in the same
migration file.

## Rules & Consequences

- **Good, because** new workspaces reliably receive all capability authority rows at INSERT
  time with no follow-up migration required.
- **Good, because** CI gate (`scripts/check-workspace-fk-cascade.mjs` family — see ADR-0409)
  can be extended to check registry completeness; for now the constraint is enforced by
  convention and documented here.
- **Bad, because** it is still a convention, not a structural constraint — a migration can
  insert into `engine_authority_config` without touching `capability_default_registry` and CI
  will not catch it today. A follow-up pgTAP test can assert registry completeness.
- **Agent Impact:** When writing any capability seed migration, verify both:
  1. `INSERT INTO public.capability_default_registry (capability, ...) ON CONFLICT DO NOTHING`
  2. `INSERT INTO public.engine_authority_config ... SELECT FROM workspace WHERE NOT EXISTS ...`
  Both must appear in the same `.sql` file.

## References

- BUG-1 (journey-sweep council 2026-05-23, chair Phase 5 synthesis 2026-05-24)
- L-0066 (CVE-class default-allow — first occurrence: contract authority seed)
- L-0292 (capability registered without intent-classifier enum entry — sibling pattern)
- `supabase/migrations/20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:235-244`
- `supabase/migrations/20260601100000_seed_communication_authority.sql`
- `supabase/migrations/20260626000000_capability_default_registry_communication.sql` (fix)

---

> Registered in `docs/decisions/0000-decision-log.md`.
