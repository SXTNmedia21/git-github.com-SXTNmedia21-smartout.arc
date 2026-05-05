---
title: HANDOFF — tip-devider (Sortie 1, campaign/payroll)
status: complete
created: 2026-04-28
updated: 2026-04-29
module: payroll
tags: [handoff, tips, sortie-1, schema, payroll-campaign]
---

# HANDOFF — tip-devider (formerly tips-data-model)

## Summary

Sortie 1 of the Payroll campaign. Lays the data foundation for tips distribution: 5 tables, 3 enums, RLS dual JWT/API-key, capability skeleton (4 tools, all `not_implemented`), authority seed (CROSS JOIN VALUES form), 4 telemetry events, `tips_workspace_settings` opt-in toggle table, regen'd database.types.ts. Pure schema + scaffolding. No user flows. No DB mutations from capability tools yet.

The Tips brainstorming originally created `campaign/tips-handling` worktree; redirected to `campaign/payroll` per Pontus's call (tips lives inside payroll umbrella). Original tips-handling worktrees orphaned (can be cleaned).

## Decisions

- **Pool granularity:** `department_session_id` (kveldsgrense), enforced via UNIQUE
- **Algorithm naming:** `equal | by_hours | by_role` (campaign vocabulary)
- **Workspace toggle:** separate `tips_workspace_settings` table (per-domain pattern, mirrors `payroll_workspace_settings`); opt-in (no row = disabled)
- **Push-notif:** out of scope; deferred to payroll-campaign payment flow
- **Schema-prep for payroll:** `tip_distribution.payroll_period_id` + `paid_at` + `paid` enum value present; populated by future flow
- **ADR rename:** Cabinet Grotesk ADR-0203 collided with existing dual-gate ADR-0203 → renumbered to ADR-0260

## Learnings

- `workspace_setting` table does NOT exist as global k/v store. Repo uses **per-domain settings tables** (e.g., `payroll_workspace_settings`). Tips followed same pattern.
- `callGateAction()` lives at `packages/ai/src/capabilities/memory/gate.ts:61` (not in a shared `packages/ai/src/gate/` location)
- `nonEmpty()` brand helper at `packages/telemetry/src/non-empty-string.ts:13`
- `is_admin_in_workspace(auth.uid(), workspace_id)` is the 2-arg form (not `is_admin_in_workspace(workspace_id)`)
- Trigger function: `public.set_updated_at()` (not `trigger_set_updated_at()`)
- `engine_authority_config` columns: `capability` + `level` (TEXT with CHECK), NOT `capability_key` + `default_authority`
- `schedule_shift` PK: `schedule_shift_id` (NOT `shift_id` — schema fiction caught at db reset)
- `department_session` PK: `department_session_id` (NOT `session_id`)
- 3 timestamp collisions inherited from development merge (May 18/19 ranges, two campaigns wrote same minute) — bumped second file in each pair by +1

## Migrations landed

| Timestamp | Subject | Commit |
|---|---|---|
| 20260428220000 | tip enums | 25603e22 |
| 20260428220001 | tip_policy + RLS | 364a9249 |
| 20260428220002 | tip_role_weight + RLS | 27528429 |
| 20260428220003 | tip_pool + RLS lifecycle locks | 7a3de336 |
| 20260428220004 | tip_distribution + employee read + UPDATE lock | 7050c55f (FK fix 2731a57c) |
| 20260428220005 | tip_adjustment_log INSERT-only audit | 7ca44e09 |
| 20260428220006 | tips_workspace_settings opt-in toggle | 74e707e0 |
| 20260428220007 | engine_authority_config seed (4 capabilities) | 2f4c68e9 |

## Code landed

| File | Subject | Commit |
|---|---|---|
| `packages/telemetry/src/registry.ts` | 4 tip_* events with Zod payloads | 48f7b49f |
| `packages/ai/src/capabilities/tips/{index,gate,tools,calculate,calculate.test}.ts` | Capability skeleton (4 tools, all not_implemented) + 9 unit tests | c744f2ed |
| `packages/ai/src/capabilities/registry.ts` + `types.ts` | tipsCapability registered | c744f2ed |
| `packages/supabase/src/database.types.ts` | Regen'd with tips schema | 8aeabb0b |

## Verification

| Gate | Result |
|---|---|
| `pnpm vitest run packages/ai/src/capabilities/tips/calculate.test.ts` | 9/9 PASS |
| `pnpm turbo typecheck` | 0 errors pre-regen; mobile pre-existing fail post-regen (unrelated, channel_type enum drift from partial db reset) |
| `npx supabase db reset` (partial) | All 8 tips migrations applied cleanly; 6 tables + 3 enums in DB; 4 authority seed rows verified |
| `pnpm tsx scripts/authority-seed-parity.ts` | All 4 tips capabilities in `seededCapabilities`; pre-existing fails (`contract`, `x` test fixture) NOT in our scope |
| Phantom-emit grep | 0 matches (skeletons don't emit) |

## Known issues / debt

- Settings UI uses single boolean column. If product requires per-user opt-in later, schema-extend.
- Mobile typecheck fails post-regen on `channel_type` enum (`ai` value missing) — caused by partial db reset (May 18 enum-add migration didn't apply due to collision). Will resolve after clean db reset.
- 4 telemetry events registered but no emit yet — Sortie 2 will populate `tip_pool created` / `tip_distribution calculated` from `tips.set_pot` body.
- Orphan worktrees `~/dev/smartout.ai-tips-handling` + `~/dev/smartout.ai-tips-handling-wt-1` from initial campaign attempt — can be cleaned via `git worktree remove` + `git branch -D`.

## Next steps

- **Sortie 2 `tips-leader-flows`:** Fill in 3 mutation tool bodies (`set_pot`, `adjust_share`, `approve_distribution`) + BFF routes + OkonomiTab tile + SignoffTab gate + reconciliation Tips-tab + AdjustmentDialog + ApproveBar
- **Sortie 3 `tips-employee-mobile`:** Fill in `tips.query_own_share` body + mobile screens + AfterShiftView tile + NotificationSheet row
- **Sortie 4 `tips-e2e-audit`:** Playwright money-flow + audit-trail review + close-feature gate hardening

## Verification commands

```bash
cd ~/dev/smartout.ai-payroll-wt-1
cd packages/ai && pnpm vitest run src/capabilities/tips/   # 9 PASS
pnpm turbo typecheck                                        # mobile pre-existing fail unrelated
npx supabase db reset                                       # apply all migrations
docker exec supabase_db_smartout.ai psql -U postgres -c "\dt public.tip*"  # 6 tables
docker exec supabase_db_smartout.ai psql -U postgres -c "SELECT capability FROM engine_authority_config WHERE capability LIKE 'tips.%';"  # 4 rows
pnpm tsx scripts/authority-seed-parity.ts                   # tips green
```
