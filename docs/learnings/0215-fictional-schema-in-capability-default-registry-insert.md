---
title: "Fictional schema in capability_default_registry INSERT — verify columns first"
id: LEARNING_0215
status: canonical
layer: learning
created: 2026-05-05
updated: 2026-05-05
tags: [learning, migration, capability, registry, schema-verification, engine-world, adr-0192]
---

# Learning-0215: Fictional columns in `capability_default_registry` INSERT

## Reference (for grep)

- Migration: `supabase/migrations/20260525000000_engine_world.sql` (Phase 0 engine_world)
- Fix commit: `0b338cbc9 fix(migrations): unblock pgTAP — 3 schema bugs in recent migrations`
- Real schema: `supabase/migrations/20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:132-233` (per L-0179)

## What I shipped (wrong)

```sql
INSERT INTO public.capability_default_registry (
  capability,
  default_authority_level,   -- ❌ column does not exist
  description                -- ❌ column does not exist
) VALUES (
  'engine.world_observe',
  'manual',                  -- ❌ 'manual' is not a valid authority_level
  '...'
)
ON CONFLICT (capability) DO NOTHING;
```

I assumed the table shape from memory of "capability_default_registry — seed
authority defaults" without grep'ing the real schema. The columns were
fictional. The level value `'manual'` is not in the `authority_level` enum.

## Real schema (per ADR-0192)

```sql
INSERT INTO public.capability_default_registry (
  capability,
  level,
  min_role,
  requires_four_eyes,
  observer_escalation_hours,
  notes
) VALUES (
  'engine.world_observe',
  'read_only',                -- valid authority_level enum value
  'admin',
  false,
  NULL,
  '...'
)
ON CONFLICT (capability) DO NOTHING;
```

Default-deny posture for new workspaces; admins opt in via UPDATE on a
specific workspace's `engine_authority_config` row.

## Why it shipped

- Author wrote migration body from intent + memory, not from grep.
- Local typecheck does not validate INSERT column names against schema
  (TypeScript types come from `database.types.ts` regenerate, but raw SQL
  in migration files is opaque to TS).
- `supabase db reset` would have caught it locally, but I didn't reset
  before committing — same anti-pattern as L-0213 and L-0214.

## Rule

Before writing `INSERT INTO capability_default_registry`:

1. **Grep the real columns:**
   ```bash
   grep -A 20 "CREATE TABLE.*capability_default_registry" supabase/migrations/
   ```
2. **Grep the real authority_level enum values:**
   ```bash
   grep -B 0 -A 5 "CREATE TYPE.*authority_level" supabase/migrations/
   ```
3. **Cite the source migration in a header comment** so the reviewer can
   verify against the real schema in one click.

Generalizes to any `INSERT INTO <known-table>` in a migration: when the
table was created in another migration, the author MUST grep that
migration. No "I remember the columns" — memory is fictional schema.

## Author-time check

```bash
# Before committing a migration that INSERTs into capability_default_registry:
supabase db reset && supabase db reset  # Reset twice to confirm idempotency.
```

If both resets succeed: migration body matches real schema.

## Sibling

- L-0179 (capability registry co-migration trap) — opposite direction:
  registers capability code without registry tuple → CVE re-opens. L-0215
  is registers WITH tuple but tuple has fictional columns → migration
  refuses to apply at all.
- L-0042 (timestamp ordering) + L-0213 (sibling enums) + L-0214 (IMMUTABLE
  indexes) — same family: "bug ships silently because local re-apply is
  rare". All four surface at preview-side fresh-DB apply.

## References

- Migration file: `supabase/migrations/20260525000000_engine_world.sql`
- Fix commit: `0b338cbc9`
- ADR-0192 (authority seed bootstrap-trigger pattern)
- ADR-0281 (engine_world architecture, Phase 0)
- L-0179 (capability registry co-migration trap)

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-05-05.
