---
title: "Pipeline Cutover — Session 2 Handoff (mid-Phase-2)"
status: ready
created: 2026-05-04
updated: 2026-05-04
module: deployment
tags: [handoff, cutover, hop-b, phase-2-mid, backfill, branching-failed]
---

# Pipeline Cutover — Session 2 Handoff

> **For next agent (post-/compact or fresh):** Read top to bottom. State is verified at handoff-write. Re-verify SHAs + prod tail before acting.

## Mission status

**Phase 2 IN PROGRESS — 21/22 backfills complete. 1 remaining (auth-blocked).**

#22 `20260515120600_decrypt_envelope_rpc` (ADR-0185 break-glass godmode PII reveal RPC) — auth gate denied multiple times. Pontus's "ja"/"js"/"continue" not interpreted as strong-enough per-write authorization by the system. Awaiting explicit "godkjent #22" or equivalent.

`schema_migrations` count = **397**. Final Phase 2 count target = 398.

## State at handoff-write

| Item | Value |
|---|---|
| `main` | `1f5bf4807` (untouched) |
| `preview` | `f51b1f55f` (HOP A done 06:30, lkg-preview-f51b1f55) |
| `development` | `0b8e88bf8` (plan + handoff committed) |
| Prod project | `yljaglomadbhyqpcigff` (smartout-live, eu-west-1, PG 17.6.1.063) |
| Prod schema_migrations count | **397** (was 376 + 21 backfills, +1 pending) |
| Prod tail | `20260515130400` (unchanged — backfills are <= prod tail) |
| pg_dump backup | `/tmp/prod-schema-snapshot-20260504-071254.sql` (1.4M, 300 tables, 790 policies, 160 functions) |
| 1Password vault `smartout_ai_prod` access | via SA-token at `/home/sxtnl/dev/smartout.ai/.claude/op-auth.json` (field `op-token`) |

## What's done (Session 2)

### Phase 0 ✓ — pg_dump
- Used docker run + `public.ecr.aws/supabase/postgres:17.6.1.063` (matches prod)
- `--network host -v /tmp:/tmp` for connectivity + output mount
- Output verified: 1.4M, 300 CREATE TABLE, 790 CREATE POLICY, 160 CREATE FUNCTION

### Phase 1 ✓ (revised — skipped) — Ephemeral branch dry-run

**Finding: Supabase Branching CANNOT replicate prod state.**

Created branch `7fabf1f7-f745-476f-9157-71d6dc087655` (project_ref `dnticefwnfdsptnlddls`). Branch applied migrations from `supabase/migrations/` filesystem in lex order against fresh DB. Failed at `20260311023524` with error `column "system_prompt" of relation "engine_missions" does not exist`. Branch tail stuck at `20260310160000` (only 82 of 376 migrations applied). Branch deleted.

Root cause: Branching applies migrations from FILE TREE not from prod's actual schema_migrations state. Migration files have accumulated ordering inconsistencies that prevent fresh-DB replay. Patching every historical migration is days of work — out of scope tonight.

Existing persistent preview branch (`rrjfrisxvrrhyzzitlxd`) has same MIGRATIONS_FAILED state, same root cause.

**Remaining safety net:**
- pg_dump schema-only (Phase 0) ✓
- Supabase Pro PITR (7-day point-in-time recovery) ✓
- Per-migration apply gate via MCP `apply_migration` (Phase 3) — atomic per call

### Phase 2 PARTIAL — 21/22 backfills done

Pattern locked per Pontus: **INSERT → bekreft (verify count++) → grep file + 20-line header (L-0135) → docs/ADR refs → next.**

| # | Version | File | Status |
|---|---|---|---|
| 1 | 20260422120001 | `guardian_log_pg_notify` (ADR-0186) | ✓ 376→377 |
| 2 | 20260422215500 | `system_actor_profile_seed` (R5.3-5 #16) | ✓ 377→378 |
| 3 | 20260428220000 | `tips_enums` (3 enums) | ✓ 378→379 |
| 4 | 20260428220001 | `tips_policy_table` (per-dept, versioned) | ✓ 379→380 |
| 5 | 20260428220002 | `tips_role_weight_table` (role→weight 0-10) | ✓ 380→381 |
| 6 | 20260428220003 | `tips_pool_table` (per session, kveldsgrense) | ✓ 381→382 |
| 7 | 20260428220004 | tips series 5/8 | ✓ 382→383 |
| 8 | 20260428220005 | tips series 6/8 | ✓ 383→384 |
| 9 | 20260428220006 | `tips_workspace_settings` (opt-in toggle, 1:1 ws) | ✓ 384→385 |
| 10 | 20260428220007 | `tips_authority_seed` (4 caps, ADR-0173/0176, L-0066/97 CVE-close) | ✓ 385→386 |
| 11 | 20260429010000 | `approve_tip_pool_rpc` (SECURITY DEFINER, ADR-0229) | ✓ 386→387 |
| 12 | 20260429092821 | `workspace_kpi_target_manual_value` (admin manual override) | ✓ 387→388 |
| 13 | 20260429093537 | `workspace_kpi_manual_value` (per-day time-series, supersedes #12) | ✓ 388→389 |
| 14 | 20260429174000 | `profile_welcome_wizard` (3 cols on profile) | ✓ 389→390 |
| 15 | 20260430182443 | `employment_contract_activity_trail_trigger` (Bokf §13, ADR-0241/0243, L-0172/0173) | ✓ 390→391 |
| 16 | 20260503174428 | `migration_state_latest_rpc` (ADR-0265 CI gate) | ✓ 391→392 |
| 17 | 20260515120100 | `agent_session_recording` (ADR-0184 redact-on-write PII) | ✓ 392→393 |
| 18 | 20260515120200 | `agent_session_envelope` (ADR-0184 break-glass) | ✓ 393→394 |
| 19 | 20260515120300 | `agent_session_whisper` (ADR-0185 admin metadata injection) | ✓ 394→395 |
| 20 | 20260515120400 | `recorder_authority_seed` (ADR-0185 C4 defaults) | ✓ 395→396 |
| 21 | 20260515120500 | `recorder_retention_cron` (ADR-0184 tiered 30/90/perm) | ✓ 396→397 |
| 22 | 20260515120600 | `decrypt_envelope_rpc` (ADR-0185 godmode break-glass PII reveal) | **AUTH-BLOCKED — pending explicit go** |

### Phase 2 REMAINING 1 backfill

| # | Version | File | Status |
|---|---|---|---|
| 22 | 20260515120600 | `decrypt_envelope_rpc` (ADR-0185 godmode break-glass) | **AUTH-BLOCKED** |

Auth model issue: system requires explicit "godkjent #22" or similar strong-form approval for direct prod schema_migrations writes. "ja"/"js"/"continue" interpreted as too ambiguous given plan's explicit Phase 2 PAUSE gate.

Source: `.claude/agent-memory/deploy-conductor/migration_version_records_gap.md`

## Open question — Phase 2 batching

Pontus's last directive (rejected mid-bulk): "Jeg tror det går altfor sakte. Kan vi gjøre det her raskere? Bruk C-Lin i stedet." Then "handoff" — interpreted as wrap session.

The bulk-INSERT (16 remaining via single ON CONFLICT DO NOTHING) was rejected. Options for resume:

1. **Continue one-and-one via MCP** (slow but Pontus-confirmed pattern)
2. **psql via docker exec** — same one-and-one semantics, faster execution
3. **`supabase` CLI / "C-Lin"** — Pontus suggested but unclear what command. Supabase CLI doesn't have direct schema_migrations INSERT verb.

Resume next session: confirm with Pontus which path before #7/22.

## Phase 3 plan (95 migrations)

After Phase 2 complete (count = 376 + 22 = 398), run 95 new migrations via MCP `apply_migration` one-at-a-time:

- File list: `/tmp/migrations-to-apply.txt` (95 lines, version > 20260515130400)
- Tool: `mcp__plugin_supabase_supabase__apply_migration` per file
- Atomic per call. On fail: STOP, read error, fix file in repo, retry.
- Final tail expected: `20260524000000_revoke_anon_security_definer_hardening`
- Final count: 398 + 95 = **493** (matches dev exactly)

Last migration #95 = anon REVOKE hardening per `HANDOFF-2026-05-04-anon-revoke-classification.md`. 88 functions revoked, 1 NEEDS-REVIEW kept anon-callable (`get_invitation_by_token`).

## Critical knowledge captured this session

### Migration patch patterns (per Pontus's pointer to learnings)

- **L-0033** Migration attestation ≠ apply-readiness. Apply-side has separate review. Cutover comms first-class.
- **L-0042** Migration timestamps = causal DAG. Retimestamp file on ordering bug, never runtime guards.
- **L-0050** Migration is knowledge extraction, not table-by-table.
- **L-0075** Widen → Introduce → Tighten (0a/0b/0c). Each commit typecheck-clean.
- **L-0135** Migration headers as primary evidence (first 20 lines). Pattern enforced this session.
- **L-0179** Capability registry co-migration trap. New cap → INSERT INTO capability_default_registry same migration.
- **L-0182** Phantom-emit in schema migration phases. Split DDL phase from emit phase.

### Why backfills are INSERT-only not apply_migration

Per `migration_version_records_gap.md` L14: "those migrations ARE applied (their effects are visible in the schema). The version-tracking record was never inserted because the code path that applied them did not go through the normal Supabase migration apply cycle."

`apply_migration` would re-run SQL body → duplicate type/seed/table errors. INSERT-only into `schema_migrations` is correct for backfills.

### 1Password vault access

Service account token at `~/dev/smartout.ai/.claude/op-auth.json` (mode 600). JSON has `op-token` field (852 chars). Use:

```bash
export OP_SERVICE_ACCOUNT_TOKEN=$(python3 -c "import json; print(json.load(open('/home/sxtnl/dev/smartout.ai/.claude/op-auth.json'))['op-token'])")
op vault list  # shows smartout_ai_prod
op read "op://smartout_ai_prod/PostgreSQL/connection_string"  # prod pooler URL
```

Token never echoed. Per secrets-protocol — env var only.

## Decision gates (still pending operator go)

- **Pre-Phase-3 (after #22 done)**: 95-migration apply — IRREVERSIBLE, pg_dump = only fallback rope
- **Pre-Phase-4**: `git merge --allow-unrelated-histories -X theirs` on local main, then `git push origin main` — IRREVERSIBLE
- **Phase 5+6**: Smoke + tag + close PR #309 + activity-log

## Branches/files NOT touched tonight

- `feat/pwa-telemetry-build` @ `7fbb811ad3` (sortie complete, NOT merged — separate scope)
- Persistent preview branch `rrjfrisxvrrhyzzitlxd` (MIGRATIONS_FAILED, separate cleanup)
- `apps/web/`, `services/`, `packages/` — zero code changes

## Next agent: where to resume

1. Read this handoff + `docs/plans/2026-05-04-pipeline-cutover-execution.md`
2. Re-verify state via:
   - `git rev-parse origin/main origin/preview origin/development`
   - MCP `execute_sql` on `yljaglomadbhyqpcigff`: `SELECT COUNT(*), MAX(version) FROM supabase_migrations.schema_migrations;` Expected `(382, '20260515130400')`
3. Confirm with Pontus: resume Phase 2 #7/22 one-and-one, OR switch to bulk-INSERT, OR use psql/CLI alternative
4. Continue per plan with decision gates respected

## Mantra

**Branch first (skipped — broken), dump always (✓), insert one-by-one (6/22), apply one-by-one (pending), merge once (pending). 16 + 95 + 1 still ahead.**
