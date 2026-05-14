---
title: HANDOFF — wfm-foundation
status: done
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [handoff, wfm, foundation, pos, marketplace, scheduler, eligibility, vault]
---

# HANDOFF — wfm-foundation

> Branch: `feat/wfm-foundation` | Worktree: /home/sxtnl/dev/smartout.ai-wt-10 | Completed: 2026-05-14

## Summary

Shipped shared DB + code foundation for three V1 WFM capabilities (POS adapter, open-shift marketplace, greedy scheduler). All 7 tasks completed. Typecheck clean (52/52 turbo tasks). 491 tests pass across `@smartout/ai`.

## What Was Built

### Task 1 — Schema migration (`20260611120000_wfm_foundation.sql`)

- `public.pos_account` — workspace+vendor unique, `credentials_vault_id` FK to `vault.secrets`, status lifecycle, RLS JWT+API-key read / service-role write.
- `public.pos_sale_event` — append-only, UNIQUE `(vendor, external_event_id)` idempotency, `idx_pos_sale_event_workspace_occurred` index for D4 cascade queries, RLS JWT+API-key read / service-role INSERT.
- `public.schedule_shift_offer_status` enum — 5 values: `open`, `claimed`, `approved`, `expired`, `cancelled`.
- `public.schedule_shift_offer` — sidecar to `schedule_shift`, UNIQUE partial on `status IN ('open','claimed')` (one active offer per shift), `idx_schedule_shift_offer_workspace_status` for manager inbox, RLS JWT+API-key read / service-role write.
- `public.v_pos_sales_hour` view — hourly POS aggregate for cascade D4 demand input (`workspace_id, location_id, hour_bucket, gross_minor, net_minor, txn_count`).
- `change_proposal.kind` COMMENT updated — adds `scheduler_bundle` to taxonomy with full JSONB payload shape per ADR-0309.
- `updated_at` triggers on both tables using `public.set_updated_at()` (not `moddatetime()` — extension not enabled in this project).

### Task 2 — Vault helper (`20260611120050_wfm_vault_helper.sql`)

**First-of-kind Vault Tier 2 precedent for per-workspace external API credentials.**

- `fn_pos_credentials_upsert(workspace_id, vendor, token) → UUID` (SECURITY DEFINER, service-role only). Creates or replaces vault.secrets row, updates `pos_account.credentials_vault_id`, writes `activity_trail` audit row. Secret name convention: `pos:<workspace_id>:<vendor>`.
- `fn_pos_credentials_resolve(workspace_id, vendor) → TEXT` (SECURITY DEFINER, service-role only). Returns decrypted token via `vault.decrypted_secrets` view. Returns NULL on missing secret (pos-sync Edge Function must early-exit on NULL). No activity_trail (high-frequency cron path — aggregate at sync-run level instead).

**Pattern precedent note:** Future vendors (Toast, Onslip, Square) follow same pattern. Document in `docs/protocols/SECURITY.md` §"Per-workspace external API credentials (Vault Tier 2)".

### Task 3 — Telemetry registry

Added 11 new events across 3 new `EventCategory` values (`pos`, `shift_marketplace`, `scheduler`):

| Event | Destinations | Rationale |
|---|---|---|
| `pos.account.connected` | 4 (incl. engine_event) | Admin C4 act that unlocks D4 demand pipeline |
| `pos.account.disconnected` | 4 | Same — disconnect halts D4 |
| `pos.sale_event.ingested` | 3 (no engine_event) | Aggregated per sync run per ADR-0134; cron sync is not a state-machine trigger |
| `shift_offer.posted` | 4 | Triggers push-notification fanout (C2 sortie) |
| `shift_offer.claimed` | 4 | May auto-approve; downstream workflow reaction |
| `shift_offer.approved` | 4 | D6 shift assignment; workflow applier |
| `shift_offer.expired` | 3 | Passive — no downstream reaction V1 |
| `shift_offer.cancelled` | 3 | Passive — no downstream reaction V1 |
| `scheduler.proposal.proposed` | 4 | Triggers plan-review workflow + manager notification |
| `scheduler.proposal.accepted` | 4 | Triggers D6 shift-creation applier |
| `scheduler.proposal.rejected` | 3 | No D6 effect on rejection |

Per ADR-0309: one emit per logical bundle event — NEVER per-shift loop.

### Task 4 — Eligibility helper (`packages/ai/src/scheduler/eligibility.ts`)

Pure function, no DB calls, deterministic, shared between `shift_marketplace.claim` (C2) and `scheduler.propose_plan` (C3).

**BlockerCode enum (7 codes):**
1. `not_competent_for_role` — profile competent_roles vs shift role
2. `aml_hour_floor_exceeded` — daily max hours (default 9h from Aml §10)
3. `aml_weekly_cap_exceeded` — weekly max hours (default 40h)
4. `tariff_rest_period_violation` — minimum rest gap between shifts (default 8h Riksavtalen)
5. `absence_overlap` — recorded absence overlaps candidate window
6. `existing_shift_overlap` — double-booking check (half-open interval)
7. `no_active_contract` — no active contract covering candidate date

**Design decisions:**
- Collects ALL blockers before returning (not early-exit on first failure) — callers need complete blocker list for manager explanation.
- Fail-fast on missing context fields (L-0177): throws, never silent-fallback.
- Defaults: framework_rule values sourced from `context.framework_rules`, with sensible Norway defaults (9h daily, 40h weekly, 8h rest) when no explicit rule exists.
- ISO 8601 week key (Monday-start ISO 8601) for weekly cap grouping.
- Test suite: 13 tests — 7 BlockerCode tests, 2 happy-path (eligible + deterministic), 2 fail-fast context, 2 additional contract edge cases.

### Task 5 — Authority seeds (`20260611120100_wfm_capability_authority_seed.sql`)

ADR-0192 two-part seed for 3 capabilities. 18 rows backfilled to existing workspaces (6 × 3).

| Capability | Level | min_role | Observer hours | Rationale |
|---|---|---|---|---|
| `scheduler` | confirm | admin | 24h | Bulk shift creation is high-impact; 24h supervisor window |
| `shift_marketplace` | autonomous | manager | 12h | Affects production staffing; 12h alert window |
| `pos_account_management` | confirm | admin | 24h | Credential + data pipeline change; confirm gate |

Seeds land BEFORE capability tools ship (C1/C2/C3) to pre-position `gate_action()` correctly and avoid L-0066 default-allow CVE class.

### Task 6 — fn_payroll_proposal_applied early-exit verification

**Confirmed:** `supabase/migrations/20260604000003_payroll_phase2_recalc_triggers.sql:194` reads:

```sql
IF OLD.status = 'applied'
   OR NEW.status != 'applied'
   OR NEW.kind IS DISTINCT FROM 'wage_line_override' THEN
  RETURN NEW;
END IF;
```

The third condition `NEW.kind IS DISTINCT FROM 'wage_line_override'` means any proposal with `kind='scheduler_bundle'` (or any future kind) is silently bypassed by this trigger. Scheduler bundle acceptance will NOT trigger payroll recalc — correct behavior. The applier logic for scheduler bundles will live in the separate `accept_proposal` tool implementation (C3 sortie), NOT in this DB trigger. This closes Supervisor C-1 Phase 3 concern.

### Task 7 — Type regeneration

`npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts`

Note: `2>/dev/null` required — gen types writes WARN lines (unset env vars) to stderr; without redirect, WARN lines contaminate the TS output file causing TS1434 parse errors. The `--no-verify` workaround the plan suggested for L-0op-run-corrupts is not needed here — stderr redirect is sufficient.

`pnpm turbo typecheck`: 52/52 tasks successful.

## Decisions Made

### D1 — Vault helper as separate migration

Vault helper functions (`fn_pos_credentials_upsert`, `fn_pos_credentials_resolve`) ship in `20260611120050_wfm_vault_helper.sql` separate from the schema DDL migration. Rationale: (a) functions can be replaced independently of table DDL; (b) SECURITY DEFINER + vault access is a distinct security concern; (c) first-of-kind precedent deserves its own clear audit block.

### D2 — `public.set_updated_at()` not `moddatetime()`

The plan specified `moddatetime()` for `updated_at` triggers. Applied `public.set_updated_at()` instead — the project's existing trigger function. `moddatetime` extension is not enabled. Confirmed by `\df` — only `set_updated_at` exists in public schema.

### D3 — `2>/dev/null` on `gen types`

`npx supabase gen types typescript --local` writes WARN lines to stderr when env vars are unset. Redirecting `2>/dev/null` prevents WARNs from appearing in the TS output file. This differs from the op:// corruption pattern (1Password corrupting field names) but has the same symptom (non-TS content in database.types.ts). Established as permanent pattern for type regen in this project.

### D4 — parity script reports pre-existing gaps, not WFM gaps

`scripts/authority-seed-parity.ts` exits non-zero because of pre-existing missing seeds in the development branch (`contract`, `handbook_chapter`, `helpdesk_query`, `payroll`, `policy`, `protocol`, `task`). WFM capabilities (`scheduler`, `shift_marketplace`, `pos_account_management`) correctly have NO call sites yet — tool bodies ship in C1/C2/C3 sorties. The parity check for WFM will be GREEN when capability tools land (verified by scanner: literals in VALUES tuples per L-0129 are present).

### D5 — activity_trail columns

`activity_trail` uses: `event`, `action_verb`, `category`, `entity_type`, `entity_id`, `data` (JSONB). Not: `action`, `metadata`. The vault helper was corrected from the first draft after reading `20260430182443_employment_contract_activity_trail_trigger.sql`.

## Learnings Discovered

### L-NEW-1 — `gen types` stderr contamination

`npx supabase gen types typescript --local > file.ts` without `2>/dev/null` writes WARN lines (unset env vars) to the output file. Result: `WARN: environment variable is unset:` at line 1, causing TS1434 parse errors. Fix: always use `2>/dev/null` redirect. Related: L-0op-run-corrupts (different mechanism, same symptom class).

### L-NEW-2 — pnpm worktree sibling dist stale, not just pnpm-symlinks

Pre-flight built pnpm symlinks. But `@smartout/ai typecheck` still failed on TS2307 (missing `@smartout/utils`, `@smartout/journey-ir`, `@smartout/payroll-export`) because sibling packages had no `dist/`. Fix: run `pnpm --filter @smartout/<package> build` for each sibling referenced by the package under typecheck. Applied to: `types`, `utils`, `journey-ir`, `payroll-export`, `telemetry`. Add this to the worktree pre-flight step for all future sorties.

## Known Issues / Debt

### Pre-existing (not caused by this sortie)

- `scripts/authority-seed-parity.ts` exits non-zero due to 8 missing seeds (`contract`, `handbook_chapter`, `helpdesk_query`, `payroll`, `policy`, `protocol`, `task`, `x`). These are pre-existing development-branch gaps. Separate hygiene sortie needed.
- `backport-shift-swap-eligibility-placeholder` — `supabase/migrations/20260413123343_shift_swap_engine.sql` has a placeholder `eligible: true` stub. Not touched in this sortie (per plan). Flag for separate cleanup sortie.

## Next Steps for C1/C2/C3 Sub-Sorties

### C1 — `feat/wfm-pos-lightspeed-mvp` (POS integration)

**Depends on (from foundation):** `pos_account` + `pos_sale_event` tables, `fn_pos_credentials_upsert` + `fn_pos_credentials_resolve`, `v_pos_sales_hour` view, `pos.account.connected` / `pos.sale_event.ingested` telemetry events, `pos_account_management` authority seed.

**Remaining work:**
- `packages/ai/src/adapters/pos/lightspeed.ts` — adapter implementing `pull(account, since): SaleEvent[]`
- `supabase/functions/pos-sync/index.ts` — Edge Function (service-role, every 5 min via cron)
- `supabase/functions/pos-connect/index.ts` — OAuth connect flow (admin-only)
- `packages/ai/src/capabilities/pos_account_management/` — 3 tools: `connect_lightspeed`, `disconnect_lightspeed`, `view_pos_status`
- `supabase/functions/config.toml` — `pos-sync` and `pos-connect` entries

**Estimate impact:** Foundation saves ~2 days of schema + telemetry work.

### C2 — `feat/wfm-shift-marketplace` (open-shift marketplace)

**Depends on (from foundation):** `schedule_shift_offer` table + enum, `eligibilityFor()` helper, `shift_offer.*` telemetry events, `shift_marketplace` authority seed.

**Remaining work:**
- `packages/ai/src/capabilities/shift_marketplace/tools.ts` — 4 tools: `post_open`, `claim`, `approve_claim`, `cancel_offer` (all via `mutateWithGate` per ADR-0287)
- `supabase/functions/shift-offer-notify/index.ts` — push fanout (cap 20 recipients, ADR-0136 mobile push)
- Mobile UI: `apps/mobile/src/app/(tabs)/shifts/open-offers.tsx` — claim list + claim button
- Web UI: `/dashboard/schedule/marketplace` — manager offer list + approve action
- Authority: `auto_approve_claim` workspace config flag (engine_authority_config extended_config field)

**C4 gate shape:** `gateAction({ capability: 'shift_marketplace', actionType: 'post_open' | 'claim' | 'approve_claim' | 'cancel_offer' })`

**Estimate:** 4-6 days. Can run parallel with C3.

### C3 — `feat/wfm-scheduler-greedy` (constraint-solver scheduler)

**Depends on (from foundation):** `change_proposal.kind` taxonomy (scheduler_bundle), `eligibilityFor()` helper, `scheduler.*` telemetry events, `scheduler` authority seed.

**Remaining work:**
- `packages/ai/src/scheduler/solver/` — greedy solver TS implementation
- `packages/ai/src/capabilities/scheduler/tools.ts` — 3 tools: `propose_plan`, `accept_proposal`, `reject_proposal` (all via `mutateWithGate`, single-call shape per ADR-0309)
- BFF route `/api/scheduler/accept-bundle` (scoped per-capability, not generalized)
- Mobile UI: 3 components (`BundleCard`, `BundleActionBar`, `ReadOnlyShiftList`)
- Web UI: `/dashboard/schedule/proposed-plan` — manager bundle review
- Demand input: reads `v_pos_sales_hour` (falls back to `day_factor` if POS not connected)

**C4 gate shapes:**
- `gateAction({ capability: 'scheduler', actionType: 'propose_plan' })` — Compose verb, web-only
- `gateAction({ capability: 'scheduler', actionType: 'accept_proposal' })` — Approve verb, mobile-allowed
- `gateAction({ capability: 'scheduler', actionType: 'reject_proposal' })` — Approve verb, mobile-allowed

**Estimate:** 5-8 days. Can run parallel with C2.

### Cross-cutting for C2+C3

The `eligibilityFor()` function is stable and shared. Both capabilities must import from `packages/ai/src/scheduler/eligibility.ts`. Do NOT duplicate the logic. The caller (capability tool) is responsible for loading `EligibilityContext` from the DB — the helper itself makes no DB calls.

## Commits

1. `36d227b4f` — feat(wfm): task 1 — schema migration (POS, marketplace, scheduler)
2. `c2a44dec6` — feat(wfm): task 2 — vault helper functions for POS OAuth credentials
3. `dc7aa5c9f` — feat(wfm): task 3 — telemetry registry: 11 WFM events + dist rebuild
4. `2fcc6bae0` — feat(wfm): task 4 — eligibility helper + 13 vitest tests
5. `97dc438f2` — feat(wfm): task 5 — capability authority seeds (scheduler, marketplace, POS)
6. (Task 7 commit — this handoff + typegen + PLAN checkboxes)
