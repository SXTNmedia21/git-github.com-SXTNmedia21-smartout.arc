---
title: "Plan — Helpdesk Phase 1 Migrations Live (Phase B3)"
status: ready
updated: 2026-04-23
created: 2026-04-23
module: MODULE_BOTSSON
tags: [plan, helpdesk, migrations, authority-seed, engine-state, adr-0160, adr-0161, adr-0162, adr-0163, campaign-b3]
---

# Plan — Helpdesk Phase 1 Migrations Live

> **Campaign:** `docs/plans/CAMPAIGN-botsson-arena.md` — Phase B, item B3
> **Spun out from:** `docs/plans/PLAN-helpdesk-phase-0.md` (Phase 0 landed 4 accepted ADRs + 5 migration drafts)
> **Architecture:** Council 2026-04-19 (Kanaler som Help Desk) — ticket = `engine_state`, SLA reuses `engine_delayed_trigger → fire-delayed-triggers`. Zero new time-infra.
> **Follows:** B4 (`helpdesk_query` capability wiring) — not blocked on B3, but B3 is its precondition.

## Goal

Drive the helpdesk Phase 1 schema from Phase 0's `.sql.draft` state to applied, verified, and owned by `campaign/botsson-arena`. Phase 0 renamed the drafts to live `.sql` migrations on `feat/helpdesk*` (commits `e7b2fd42`, `70103fc0`, `b7bc6cde`, `4493426f`) and they are now inherited here via `development`. B3 is the auditable confirmation that the schema landed correctly on this campaign, seeds are valid, RLS policies work under both JWT and API key, and `database.types.ts` reflects the live shape — so B4 can register the capability against a schema that actually exists.

## Context

Phase 0 non-goal "Applying any `.sql` migration (Phase 1)" has been superseded by reality: the helpdesk sub-campaign shipped the schema ahead of this checkbox. The 6 live migrations that make up "Phase 1 schema":

| Migration | Purpose | ADR |
| --- | --- | --- |
| `20260515130000_helpdesk_enum_extensions.sql` | `comm_channel_type += 'desk'`, `channel_member_role += 'representative'` | 0161 |
| `20260515130100_channel_responsible_profile.sql` | `channel.responsible_profile_id` FK + CHECK (desk requires owner) + index | 0161 |
| `20260515130200_helpdesk_query_process_seed.sql` | `helpdesk_query_lifecycle` engine_process blueprint, `allowed_channels=['chat']` | 0161 / 0163 |
| `20260515130300_helpdesk_query_authority_seed.sql` | Per-workspace seed: `level='confirm'`, `min_role='manager'`, `observer_escalation_hours=72` | 0162 |
| `20260515130400_helpdesk_rls_and_thread_enum.sql` | `comm_channel_type += 'query_thread'` + `channel_jwt_select_responsible` RLS | 0161 |
| `20260515160000_channel_helpdesk_backfill.sql` | `helpdesk_enabled=true` backfill for legacy `channel_type='desk'` rows (Phase 1A.2) | 0165 |

SLA timeout is driven by existing `engine_delayed_trigger → fire-delayed-triggers`. No new Edge Function in B3.

## Scope

**In (B3):**
1. Verify all 6 migrations applied on Supabase Local from a clean `db reset` + in the preview branch DB.
2. Verify `database.types.ts` reflects the new enums (`'desk'`, `'representative'`, `'query_thread'`) and the `channel.responsible_profile_id` / `channel.helpdesk_enabled` / `channel.privacy_mode` columns.
3. Verify the `helpdesk_query` authority seed exists for every workspace, and that the `engine_authority_config` row has no default-allow combo (L-0066).
4. Verify RLS policies enforce under both JWT and API key paths (dual-policy requirement).
5. Record the live state in a short audit note inside the handoff — specifically: migration list with applied timestamps, seed row count, any workspaces that skipped a seed row.
6. Confirm `helpdesk_query_lifecycle` engine_process blueprint uses `allowed_channels=['chat']` per ADR-0163 (no voice path).
7. Ensure the progressive-channel column set (`helpdesk_enabled`, `privacy_mode`, `responsible_profile_id`) is the read-time truth source, per the 2026-04-22 Phase 1A.2 cutover.

**Out (B4 and beyond):**
- Registering the `helpdesk_query` capability in `packages/ai/src/capabilities/registry.ts` — that is already landed on `development`, but _verifying its behaviour against the seeded authority_ is B4's job, not B3's.
- Tool implementation / unit tests for `helpdesk_query` tools.
- Mobile thin-client surface for help desk (read + reply + resolve) — follows B4.
- SLA timeout wiring via `engine_delayed_trigger` — Phase 2.
- Broadcast, call recording, analytics — deleted scope per Council 2026-04-19.

## Tasks

- [ ] **T1. Clean-slate verification.** `npx supabase db reset`; confirm all 6 migrations apply without error, enum lifecycle 0a/0b/0c is honored (no mixed ADD VALUE + DDL that consumes the value in the same transaction).
- [ ] **T2. Preview branch parity.** Use Supabase MCP (project `cibmhhgsrdmpnmcikalu`, preview) to list applied migrations and diff against local. Flag any drift.
- [ ] **T3. Regenerate types.** `pnpm supabase:gen-types` (or equivalent); inspect diff on `packages/supabase/src/database.types.ts`; commit the regenerated file only if it is out-of-date.
- [ ] **T4. Authority seed audit.** `SELECT workspace_id FROM workspace WHERE workspace_id NOT IN (SELECT workspace_id FROM engine_authority_config WHERE capability='helpdesk_query')` — must return zero rows. If not zero, document the gap + backfill query in the handoff.
- [ ] **T5. Default-allow scan.** `SELECT * FROM engine_authority_config WHERE capability='helpdesk_query' AND level='read_only' AND min_role IS NULL` — must return zero. L-0066 / L-0097 tripwire.
- [ ] **T6. RLS dual-policy check.** For every new policy added by the 6 migrations, confirm both a JWT policy and an API-key policy exist (or document why an API-key path is intentionally absent for `channel_jwt_select_responsible`).
- [ ] **T7. Blueprint channel restriction.** `SELECT allowed_channels FROM engine_process WHERE name='helpdesk_query_lifecycle'` returns `{chat}` exactly (ADR-0163 + ADR-0078).
- [ ] **T8. Progressive-flag consistency.** Every row with `channel_type='desk'` has `helpdesk_enabled=true` AND `responsible_profile_id IS NOT NULL`. Verifies the 2026-04-22 Phase 1A.2 backfill.
- [ ] **T9. Campaign sync confirmation.** `git log campaign/botsson-arena --oneline -- supabase/migrations/*helpdesk* supabase/migrations/*channel_progressive* supabase/migrations/*channel_helpdesk*` shows all 6 migrations present.
- [ ] **T10. Handoff.** `docs/HANDOFF-helpdesk-phase-1.md` with migration inventory, audit query outputs, any deltas, and a "B4 entry state" section.

## Acceptance Criteria

Every criterion below is falsifiable (Invariant 12).

- [ ] `ls supabase/migrations/2026051513*helpdesk* supabase/migrations/2026051513*channel_responsible* supabase/migrations/2026051516*channel_helpdesk*` returns exactly 6 files, no `.sql.draft` remaining.
- [ ] `grep -R "\.sql\.draft" supabase/migrations/` returns zero lines.
- [ ] `grep -n "'desk'\|'representative'\|'query_thread'" packages/supabase/src/database.types.ts` returns at least one match per literal.
- [ ] Supabase Local: `npx supabase db reset` exits 0 and logs all 6 migrations applied.
- [ ] `SELECT COUNT(*) FROM engine_authority_config WHERE capability='helpdesk_query'` ≥ `SELECT COUNT(*) FROM workspace`.
- [ ] `SELECT allowed_channels FROM engine_process WHERE name='helpdesk_query_lifecycle'` returns exactly `{chat}`.
- [ ] `SELECT COUNT(*) FROM channel WHERE channel_type='desk' AND (helpdesk_enabled IS DISTINCT FROM true OR responsible_profile_id IS NULL)` returns `0`.
- [ ] E2E suite subset passes: `pnpm --filter @smartout/e2e test helpdesk-rls-jwt-insert-blocked helpdesk-public-ticket-lifecycle helpdesk-private-ticket-lifecycle`.
- [ ] `pnpm turbo typecheck` passes with 0 errors.
- [ ] `docs/HANDOFF-helpdesk-phase-1.md` exists with all 10 task outputs recorded.

## Risks

1. **Enum lifecycle collision (L-0075).** `comm_channel_type` receives three new values across two migrations (`130000`: desk + representative; `130400`: query_thread). Any follow-up migration that wants to consume a new enum value must land in a later timestamped file — the 0a/0b/0c pattern is enforced by ordering, not transactions. Mitigation: T1 `db reset` is the canary.
2. **RLS dual-policy gap.** `channel_jwt_select_responsible` was added to unblock reps who aren't yet `channel_member` rows; an equivalent API-key policy may be missing. Mitigation: T6 explicit grep per policy; if missing, flag in handoff, decide with Council (do reps need external-API visibility?).
3. **Drift between local and preview branch.** Council migrations went through `feat/helpdesk*` and landed via multiple PRs (#228, #226). Preview DB may have residue from a blocker-fix cycle. Mitigation: T2 MCP diff.
4. **Authority-seed orphan workspaces.** Seed uses `SELECT FROM workspace WHERE NOT EXISTS ...` — safe for re-run, but workspaces created _between_ migration apply and capability registration have no row. Mitigation: T4 query must pass before B4 starts.
5. **B4 pre-empted by live code.** `helpdeskQueryCapability` is already registered in `capabilities/registry.ts` (commit predates this plan). B3 must not remove or modify that registration — it only verifies the seed + schema contract the capability depends on. B4 owns runtime behaviour.

## Dependencies

- **Inputs:** Phase 0 migrations merged on `campaign/botsson-arena` via `development` sync. All 4 ADRs `accepted` (0160–0163). Council verdict logged.
- **Blocks:** B4 (`helpdesk_query` capability authority + tool tests) — B4 consumes the seeded `engine_authority_config` row and the `helpdesk_query_lifecycle` process. B3 must pass before B4's gate tests run.
- **Does not block:** B1, B2, B5, Phase C/D work.

## Post-Implementation

- [ ] Tick **B3** in `docs/plans/CAMPAIGN-botsson-arena.md` roadmap (owner: Pontus).
- [ ] Append B3 row to `docs/plans/CAMPAIGN-botsson-arena.md §Sync Log` with development HEAD at closure.
- [ ] Flip helpdesk node from 🟡 → 🟢 in `docs/architecture/BOTSSON-SYSTEM-MAP.md` once B4 also ships (not during B3 — schema alone is not a green light).
- [ ] Move this plan to `docs/plans/completed/` alongside its handoff.
- [ ] Kick off B4 sub-sortie via `/start-feature helpdesk-capability-registration` from inside this worktree.

---

> After writing: this plan is registered in `docs/plans/CAMPAIGN-botsson-arena.md` roadmap (B3). No INDEX update needed — campaign doc is the index for botsson-arena plans.
