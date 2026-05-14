---
title: Handoff — POS Lightspeed Mock V1
status: in_progress
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [handoff, pos, lightspeed, wfm]
---

# Handoff — POS Lightspeed Mock V1

## What Was Built

Tasks 0–5 of the `pos-lightspeed-mvp` sortie are complete. Task 6 (type regen + decision log entry + final typecheck) is deferred and must run before `close-feature.sh`.

### Shipped artifacts (Tasks 0–5)

| Task | Artifact | Notes |
|------|----------|-------|
| T0 | Pre-flight: `pnpm install` + telemetry/types dist refresh | Per L-0190 family |
| T1 | `packages/ai/src/adapters/pos/lightspeed.ts` | Mock V1 adapter — deterministic via hash, 4 Vitest tests |
| T2 | `supabase/functions/pos-sync/index.ts` + `config.toml` entry | Standalone EF, WATCHDOG_CRON_SECRET bearer auth, `verify_jwt=false`, 3 Vitest tests |
| T3 | `packages/ai/src/capabilities/pos_account_management/` | 3 tools: `connect_lightspeed`, `disconnect_pos_account`, `list_pos_accounts`; registered in capability registry + CapabilityName union; 6 Vitest tests |
| T4 | `apps/web/src/app/dashboard/admin/pos-accounts/` | Server page + `_components/PosAccountsList.tsx`; Nordic Split design; Framer Motion spring animations |
| T5 | `apps/e2e/protocols/p-pos-connect-and-sync.ts` | E2E protocol; closes S8 |

**Foundation (PHASE 1, in campaign root — not in this sortie):** `pos_account` + `pos_sale_event` tables, `fn_pos_credentials_upsert` / `fn_pos_credentials_resolve` Vault helpers, `public.v_pos_sales_hour` view, `pos_account_management` authority seed, 3 telemetry events registered in `packages/telemetry/src/registry.ts`.

---

## Decisions

### ADR-0305 — POS Integration Architecture V1 (proposed)

The G3 council review follow-on is captured in **ADR-0319** (proposed alongside this sortie). ADR-0319 addresses four deferred design questions that were out of scope for V1:

| Question | ADR-0319 ruling |
|----------|----------------|
| Vendor enum extensibility | Named discriminated union in `database.types.ts`; new vendors add new enum member + adapter |
| Adapter dispatcher | `packages/ai/src/adapters/pos/dispatcher.ts` — routes by `vendor` enum; V1 EF inlines mockPull (technical debt, addressed V2) |
| Type sharing between EF and capability | Shared `packages/types/src/pos.ts` — avoids duplication of `SaleEvent` shape |
| Currency policy | V1 hardcodes NOK; multi-currency aggregation addressed in ADR-0312 (FX) |

---

## Learnings

### L-0270 — Vendor adapter without dispatcher is a V2 tax

When V1 ships an adapter in isolation (no dispatcher routing layer), every subsequent vendor requires touching the EF directly. The current `pos-sync` EF inlines `mockPull` from the Lightspeed adapter rather than routing through a `dispatcher.select(vendor)` call. This is intentional for V1 scope but must be remedied before vendor #2 ships — see ADR-0319.

### Channel guard pattern (project-wide convention question)

`assertChatChannel(ctx.channel ?? "chat")` is the V1 pattern copied from `payroll/tools.ts:54–62`. The `?? "chat"` default masks cases where `ctx.channel` is undefined at runtime. STAGE D R1 audit flagged this as a convention question: should undefined channel default to `"chat"` (permissive) or throw (strict)? The canonical answer is deferred pending the C3 fix pattern resolution. All POS write tools use the permissive pattern consistently for now.

### `pos-sync` sentinel `actor_id` (platform-actor gap)

The EF uses sentinel `actor_id="00000000-0000-0000-0000-000000000001"` for `activity_trail` writes. STAGE D R1 flagged this as the same class of issue addressed by the `actor_kind` + NULL `actor_id` migration in Phase 2A of engine_world. Once that migration is confirmed in causal order, `pos-sync` should switch to `actor_kind='platform'` + `actor_id=NULL`. No code change blocked on this — it is a post-migration cleanup.

---

## Known Issues / Debt

| Item | Severity | Resolution path |
|------|----------|----------------|
| Real Lightspeed K-Series OAuth2 + REST integration | High (V2 blocker) | ADR-0310 sortie; mock V1 is the explicit placeholder |
| Webhook-based ingestion (push instead of poll) | Medium | Deferred V2; cron pull is sufficient for WFM demand signal accuracy at V1 cadence |
| Adapter dispatcher missing | Medium | ADR-0319 implementation sortie when vendor #2 surfaces |
| `UNIQUE (workspace_id, vendor)` blocks multi-vendor per workspace | Low | ADR-0319 V2 schema migration |
| V1 currency hardcoded NOK | Low | ADR-0312 (FX) multi-currency aggregation |
| Mobile admin UI | Out of scope | ADR-0133 web-only for Compose verbs; mobile admin surfacing deferred |
| `assertChatChannel(ctx.channel ?? "chat")` permissive default | Convention question | Deferred to C3 fix pattern resolution |
| `pos-sync` sentinel `actor_id` | Post-migration cleanup | Switch to `actor_kind='platform'` + NULL after engine_world Phase 2A migration confirmed |

---

## Next Steps (Task 6 — deferred, must complete before close-feature.sh)

```bash
# From worktree root: /home/sxtnl/dev/smartout.ai-world-best-wfm-wt-1

# 1. Type regen (no op run wrap per L-0op-run-corrupts; stderr suppressed per plan)
npx supabase gen types typescript --local 2>/dev/null \
  > packages/supabase/src/database.types.ts

# 2. Full typecheck (52/52 clean required)
pnpm turbo typecheck

# 3. Capability + adapter + EF tests
pnpm --filter @smartout/ai test

# 4. Decision log entry
# Register ADR-0305 acceptance status review in docs/decisions/0000-decision-log.md

# 5. close-feature gate check
# JOURNEY file: docs/journeys/JOURNEY-world-best-wfm-pos-lightspeed-mvp.md ✓
# HANDOFF file: docs/HANDOFF-pos-lightspeed-mvp.md ✓
# Typecheck: pending Task 6
# Decision log: pending Task 6
```

After Task 6 passes all gates, run `close-feature.sh` from the main repo to merge `feat/world-best-wfm-pos-lightspeed-mvp` into `campaign/world-best-wfm`.
