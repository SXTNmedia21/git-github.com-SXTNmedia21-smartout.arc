---
title: Supabase Migration Audit — 502 migrations sweep
status: done
updated: 2026-05-06
created: 2026-05-06
module: meta
tags: [supabase, migrations, audit, rls, security]
scope: "supabase/migrations/*.sql + database.types.ts cross-check"
severity: high
---

# Supabase Migration Audit — 2026-05-06

> Companion to `2026-05-06-ci-pipeline-audit-extended.md`. Audits the 502-file migration history for: schema-integrity, RLS coverage, ordering hazards, anti-patterns from `smartout-database-guide` skill, and untracked WIP files.

## Method

- Inventory: 501 tracked + 1 untracked migration file
- Lexicographic ordering check (`sort -c`)
- Pattern sweep: forbidden refs, RLS gaps, ENUM dupes, `IF NOT EXISTS` anti-pattern count
- Schema cross-reference against `packages/supabase/src/database.types.ts`
- Spot-check 5 random recent migrations for forward-reference hazards
- Content review of untracked `20260525110000_outreach_capability_authority_seed.sql`

## Findings

### CRITICAL

#### F-DB-01 — Untracked outreach migration deviates from safety pattern + breaks `db reset`

**File:** `supabase/migrations/20260525110000_outreach_capability_authority_seed.sql` (untracked)

**Status:** `git status: ??` — not on `origin/development` or any branch.

**Risk:**
1. **`supabase db reset` on Local + CI does NOT see this file** because it's not committed. New developers + CI environments boot WITHOUT outreach capability authority seeded. Per L-0066 (Kanaler som Helpdesk council), unseeded `engine_authority_config` rows mean `gate_action()` returns default-allow for outreach calls — **CVE-class authorisation gap**.
2. **Pattern deviation from booking seed** (`20260524000100_seed_booking_authority.sql`): booking uses a `DO $$` block with explicit godmode-user null check + `RAISE NOTICE` + graceful `RETURN` on missing godmode user. Outreach uses bare `INSERT ... SELECT` with `COALESCE` fallback to oldest `user_identity` by `created_at`. If no `company_member` exists (fresh env), `updated_by` is set to a non-godmode user → audit-trail attribution is wrong + RLS may reject downstream reads.
3. The outreach capability is referenced in dev's `intent-classifier.ts` (line 69, 183) and `telemetry/registry.ts` — code calls outreach without the authority row existing.

**Severity:** CRITICAL (security + dev-environment correctness).

**Recommended action:** Commit immediately, OR delete if outreach work is not landing this sprint. If keeping: rewrite to match booking seed's `DO $$` + godmode null-check + `RAISE NOTICE` pattern.

### WARNING

#### F-DB-02 — `IF NOT EXISTS` schema guards: 632 occurrences

**Pattern:** `CREATE TABLE IF NOT EXISTS`, `CREATE TYPE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, plus 106 `DO`-block `IF NOT EXISTS pg_type` guards.

Per `smartout-database-guide` skill: **"Do NOT use runtime guards to mask ordering bugs — retimestamp the file instead. Runtime guards are for production backfill anomalies, not developer-time ordering discipline."**

**Recent 5 violators:**

| Migration | Pattern usage |
|---|---|
| `20260525000000_engine_world.sql` | `CREATE TABLE IF NOT EXISTS`, 2 `pg_type` DO-block guards, 2 `CREATE INDEX IF NOT EXISTS` |
| `20260522010000_settlement_artifacts_bucket.sql` | `IF NOT EXISTS` on bucket idempotency |
| `20260521000000_billing_schema_create.sql` | `CREATE SCHEMA IF NOT EXISTS` (acceptable for schema bootstrap) |
| `20260520150000_platform_webhook_event_idempotency.sql` | `IF NOT EXISTS` table |
| `20260520110000_engine_state_scheduling.sql` | `IF NOT EXISTS` on column add |

**Severity:** WARN (not breaking — masks but doesn't introduce bugs). 632 is high enough that "remove all" is impractical mid-stream. Treat as backlog cleanup. Going forward, gate via shellcheck-equivalent migration linter that flags new `IF NOT EXISTS` outside the bootstrap-bucket allowlist.

#### F-DB-03 — Direct `auth.users` references in 15 migrations

**Files:** Includes `00009_onboarding_v3.sql`, `00001_identity_tables.sql`, `20260301600003_schedule_persistence_tables.sql`, `20260310140000_signup_tables.sql`, `20260329200000_workspace_status_and_sandbox.sql`, `20260422215500_system_actor_profile_seed.sql`, `20260422300300_channel_seed_botsson.sql`, plus RPC functions.

**Verdict:** Most are defensible:
- Bootstrap triggers on `auth.users` for new-user provisioning (00001) — by design
- `SECURITY DEFINER` RPC functions reading `auth.users` (legit)
- Channel + Botsson seed reads (lookup, not write)

**Genuine concern:** `20260422215500_system_actor_profile_seed.sql` does a **direct `INSERT INTO auth.users`** to seed the Botsson system actor for local dev. This is fragile against Supabase Auth schema changes — when Supabase upgrades `auth.users` columns or rotates required defaults, this migration can fail. Move to `auth.admin_create_user()` pattern via service role + RPC instead.

**Severity:** WARN (works today, fragile on Supabase Auth upgrade).

#### F-DB-04 — Schema-only `IF NOT EXISTS` not caught by skill's "anti-pattern" rule

The skill's anti-pattern rule targets schema-ordering masking, but several legitimate uses exist:
- `CREATE EXTENSION IF NOT EXISTS pgcrypto` — extension idempotence is correct
- `CREATE SCHEMA IF NOT EXISTS payroll` — schema bootstrap
- Bucket creation via `storage.buckets` insert

Recommend distinguishing in a follow-up rule: forbid `CREATE TABLE IF NOT EXISTS` and `CREATE TYPE IF NOT EXISTS` strictly; allow extension/schema/bucket idempotence.

### INFO (clean)

- **F-DB-05 — ENUM duplicates:** zero matches. 72 enums in `database.types.ts`, no duplicate `CREATE TYPE` names.
- **F-DB-06 — `public.user` (forbidden) refs:** zero matches. Identity layer correctly uses `user_identity`.
- **F-DB-07 — Workspace-scoped tables missing `workspace_id`:** all sampled tables comply. Two intentional NULL-allowing exceptions (`billing_dispatch_rule`, telegram adapter tables) are documented in their migrations.
- **F-DB-08 — RLS gaps:** all data tables have `ENABLE ROW LEVEL SECURITY` either inline or in a dedicated RLS migration (`00004_rls_policies.sql` for the 00001-00003 cohort, then per-table going forward).
- **F-DB-09 — Migration timestamp ordering:** `ls supabase/migrations/*.sql | sort -c` exits 0 — no out-of-order files.
- **F-DB-10 — Forward-reference sampling:** 5 random migrations from last 50 verified — no references to objects created in later-timestamped migrations.
- **F-DB-11 — `DROP COLUMN` safety:** 2 forward-migration occurrences (invoice delivery columns 2026-05-12; shift_approval punch columns 2026-04-18), both use `IF EXISTS` guards. Acceptable.

## Untracked migration deep-dive (F-DB-01 detail)

```sql
-- 20260525110000_outreach_capability_authority_seed.sql (UNTRACKED)
INSERT INTO public.capability_default_registry (...) ...;
INSERT INTO public.engine_authority_config (
  workspace_id, capability_id, ...,
  updated_by  -- ← falls back to oldest user_identity if no godmode found
)
SELECT
  w.workspace_id,
  ...,
  COALESCE(
    (SELECT user_identity_id FROM user_identity WHERE is_godmode = true LIMIT 1),
    (SELECT user_identity_id FROM user_identity ORDER BY created_at LIMIT 1)
  )
FROM public.workspace w
ON CONFLICT DO NOTHING;
```

**vs. `20260524000100_seed_booking_authority.sql`:**

```sql
DO $$
DECLARE v_godmode_user uuid;
BEGIN
  SELECT user_identity_id INTO v_godmode_user
  FROM user_identity WHERE is_godmode = true LIMIT 1;

  IF v_godmode_user IS NULL THEN
    RAISE NOTICE 'No godmode user — skipping booking authority seed (safe on fresh env)';
    RETURN;
  END IF;

  INSERT INTO ... USING v_godmode_user ...;
END $$;
```

The booking pattern is correct: fresh environment with no godmode user gracefully skips. The outreach pattern silently picks an arbitrary user, polluting `updated_by` attribution.

## Recommendations (prioritised)

### P0 — must do this session

1. **Decide on F-DB-01:**
   - **Commit + harmonise** if outreach is landing (rewrite to `DO $$` + godmode null-check pattern), OR
   - **Delete** if outreach is reverting from intent-classifier/telemetry registry.

   Currently dev has dangling intent-classifier `outreach` enum + registry events, but no authority seed to gate them. **Recommended path: commit + rewrite to safety pattern.**

### P1 — this week

2. **Move `20260422215500_system_actor_profile_seed.sql` to use `auth.admin_create_user()`** instead of direct `INSERT INTO auth.users`. Reduces breakage risk on Supabase Auth upgrades.

3. **Add migration linter to CI** that:
   - Forbids `CREATE TABLE IF NOT EXISTS` and `CREATE TYPE IF NOT EXISTS` outside an explicit allowlist.
   - Verifies new migration timestamp `>` current repo tip.
   - Verifies new migration ENUM names not in existing `database.types.ts`.

   This is the gate that would have caught F-DB-01 + the historic 632 anti-pattern instances. Run as a `pgTAP`-sibling job, fail on red.

### P2 — backlog

4. **Backlog: gradual `IF NOT EXISTS` removal** — quarterly chunk of 50 migrations cleaned up. Rebase + re-time only when paired with the migration causing the original ordering issue.

5. **Document allowed `auth.*` access patterns** in `smartout-database-guide` skill. Currently the skill says nothing about `auth.users`; the 15 references are all defensible but each needs review.

6. **Add `database.types.ts` regen check** in CI — detect when migrations add tables/columns/enums that haven't been regenerated into types. Some recent migrations (engine_world, onboarding_capability_authority_seed, settlement_*) may have drifted.

## What we learned

### L-DB-01 — Untracked migration files are silent attack vectors

A migration file uncommitted has all the danger of a committed one (developers may apply it locally, base downstream code on it) without the `db reset` parity guarantee. CI environments + new clones will not have the table/seed → app code breaks at runtime in ways hard to diagnose.

**Generalisation:** Add to `pre-commit` or `pre-push` hook: refuse if `supabase/migrations/*.sql` files are untracked when working tree changes touch `apps/web/`, `packages/ai/`, or `services/*/src/`. Force the developer to either commit or delete.

### L-DB-02 — `IF NOT EXISTS` is the easy-win that hides the real bug

632 instances in the repo. Each one masks an ordering or idempotence bug rather than fixing it. The skill says it explicitly: "retimestamp the file instead." Pre-existing debt, but every new `IF NOT EXISTS` added on a fresh table is a smell.

### L-DB-03 — Authority-seed safety pattern matters

Booking and outreach are sibling capabilities authored 1 day apart, with diverging safety patterns. Authority seeds run on every `db reset` — a single broken seed kills the whole environment. The booking pattern (`DO $$` + godmode null-check + `RAISE NOTICE` + `RETURN`) is the canonical template. Any deviation is a regression.

## Sign-off

Audit performed via inventory + grep + Explore subagent (sonnet). Spot-checks against `database.types.ts`. Has NOT been verified by `supabase db reset` against a fresh container. P0 should be paired with a local reset test before merging.

## References

- Skill: `~/.claude/skills/smartout-database-guide/SKILL.md`
- Database reference: `docs/reference/DATABASE.md`
- Memories: `learning_authority_seed_safety_pattern.md` (proposed)
- L-0042 — migration timestamp ordering hard rule
- L-0066 — gate_action default-allow CVE class
- Sister audit: `docs/audits/2026-05-06-ci-pipeline-audit-extended.md`
