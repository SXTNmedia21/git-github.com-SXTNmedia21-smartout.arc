---
title: Campaign Handoff — world-best-wfm
status: ready_for_pr
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [handoff, campaign, world-best-wfm, wfm, pos, marketplace, scheduler]
---

# Campaign Handoff — world-best-wfm

## Executive Summary

Three WFM capabilities shipped in V1 across three sorties:

1. **POS Lightspeed Mock V1** (`pos_account_management`) — 3 tools, mock adapter, EF cron, web admin UI, E2E S8
2. **Open-Shift Marketplace V1** (`shift_marketplace`) — 5 tools, pull-poll BFF, web manager UI (Tasks 0-3 + STAGE-D fix)
3. **Greedy Scheduler V1** (`scheduler`) — Riksavtalen seed + solver + 3 tools + 4 BFF routes (Tasks 0-3 + 2 STAGE-D fixes)

**ADRs originating from this campaign:** ADR-0305, ADR-0306, ADR-0307, ADR-0309 (all `proposed`).
**G3 council follow-on ADRs:** ADR-0319 (POS dispatcher architecture, `proposed`), ADR-0320 (calibration loop V2 trigger, `proposed`), ADR-0321 (swap↔marketplace convergence, `proposed`).
**Learnings:** L-0247, L-0248 (PHASE 1 foundation), L-0270, L-0271, L-0272 (G3 council), L-0273 (PHASE 4, column-name drift).

Deferred tasks (mobile + E2E for C2/C3) move to follow-on sorties. Campaign is ready for `campaign/world-best-wfm → development` PR.

---

## What Shipped Per Sortie

| Sortie | Branch | Commits | Capability | Tools | BFF Routes | Web UI | Mobile | E2E |
|---|---|---|---|---|---|---|---|---|
| C1 POS | `feat/world-best-wfm-pos-lightspeed-mvp` (merged) | 6 (T0–T5 + journey-fix) | `pos_account_management` | 3 (`connect_lightspeed`, `disconnect_pos_account`, `list_pos_accounts`) | `/api/botsson/pos/connect` (via stage-engine) | `/dashboard/admin/pos-accounts` | n/a (web-only per ADR-0133 Compose) | `p-pos-connect-and-sync.ts` (S8) ✓ |
| C2 marketplace | `feat/world-best-wfm-shift-marketplace` (merged) | 5 (T0–T3 + column-fix + journey-fix) | `shift_marketplace` | 5 (`list_open_offers`, `post_open`, `claim`, `approve_claim`, `cancel_offer`) | `GET /api/mobile/marketplace/open-offers` | `/dashboard/schedule/marketplace` | DEFERRED next sortie | DEFERRED (S9) |
| C3 scheduler | `feat/world-best-wfm-scheduler-greedy` (merged) | 7 (T0–T3 + 2 fixes + channel-guard fix + journey-fix) | `scheduler` | 3 (`propose_plan`, `accept_proposal`, `reject_proposal`) | `POST /api/scheduler/{propose-plan,accept-bundle,reject-bundle}` + `GET /api/scheduler/proposals` | DEFERRED next sortie | DEFERRED next sortie | DEFERRED (S10/S11) |

**PHASE 0 + PHASE 1 (campaign root, pre-sortie):** `pos_account` + `pos_sale_event` tables, `fn_pos_credentials_upsert/resolve` Vault helpers, `v_pos_sales_hour` view, `schedule_shift_offer` table + enum + `eligibilityFor` helper, `change_proposal` table, Riksavtalen `regulatory_framework` + 5 `framework_rule` baseline rows, telemetry events registered in `packages/telemetry/src/registry.ts` (3 POS + 5 marketplace + 3 scheduler), authority seeds for all 3 capabilities.

---

## What Was Deferred

| Item | Deferred From | Target | Priority |
|---|---|---|---|
| Mobile `(shifts)/marketplace.tsx` claim list (Task 4) | C2 marketplace | Follow-on sortie | Medium |
| E2E `P-marketplace-full-flow` (Task 5, closes S9) | C2 marketplace | Follow-on sortie | Medium |
| Web `/dashboard/schedule/proposed-plan` (Task 4) | C3 scheduler | Follow-on sortie | Medium |
| Mobile 3-component bundle UI — `<BundleCard>` + `<BundleActionBar>` + `<ReadOnlyShiftList>` (Task 5) | C3 scheduler | Follow-on sortie | Medium |
| E2E `p-scheduler-propose-accept.ts` + `p-scheduler-mobile-bundle.ts` (Task 6, closes S10/S11) | C3 scheduler | Follow-on sortie | Medium |
| Type regen (`npx supabase gen types typescript --local`) — all 3 sorties | C1/C2/C3 Task 6/7 | Pre-close-feature gate | Medium |
| Decision log finalization (mark ADRs `accepted` post-PR) | All sorties | Post-PR | Low |

---

## Decisions

### Originating ADRs (all `proposed`)

| ADR | Title | Status |
|---|---|---|
| ADR-0305 | POS Integration Architecture V1 | proposed |
| ADR-0306 | Open-Shift Marketplace V1 | proposed |
| ADR-0307 | Greedy Scheduler V1 — solver selection + V2 trigger | proposed |
| ADR-0309 | Single-row bundle pattern — ONE `change_proposal` per solver run, JSONB immutable, atomic accept V1 | proposed |

### G3 Council Follow-on ADRs (placeholder `proposed`)

| ADR | Title | Status | Trigger |
|---|---|---|---|
| ADR-0319 | POS Adapter Dispatcher Architecture | proposed | When vendor #2 surfaces |
| ADR-0320 | POS-driven `hour_factor` calibration loop V2 | proposed | Lightspeed live + 30 days real data |
| ADR-0321 | Swap↔Marketplace V2 convergence + `engine_authority_pipeline` | proposed | First multi-stage approval use-case |

---

## Learnings

| # | Date | Title |
|---|---|---|
| L-0247 | 2026-05-14 | Pattern selection must check runtime helper constraints — `mutateWithGate` is single-call, not bulk-aware; forced single-row bundle per ADR-0309 |
| L-0248 | 2026-05-14 | Provenance for solver-triggered proposals lives in JSONB `changes`, not `framework_trigger_type` enum |
| L-0270 | 2026-05-14 | Vendor adapter without dispatcher is a V2 tax — ADR-0319 addresses |
| L-0271 | 2026-05-14 | Capability tool silent expansion — per-tool ADR table must be updated atomically with each new tool |
| L-0272 | 2026-05-14 | Stub-cron-without-algorithm = telemetry-domain drift — calibration cron must carry algorithm body or feature flag |
| L-0273 | 2026-05-14 | Column-name drift between BFF/tool code and schema → Supabase silent-fail (2 occurrences: C2 `cancel_reason`, C3 `trigger_entity_id`) |

---

## Council Sessions

### G1 — ADR-0307 + ADR-0309 (solver selection + bundle pattern)

Chair self-reversal triggered (7th L-0147 precedent). Key outcome: `propose_plan` uses single-row bundle (`change_proposal.kind='scheduler_bundle'`), NOT N-row per-shift. Reason: `mutateWithGate` is single-call — N gate calls = N round-trips or 1 gate eval for N writes (ADR-0099 violation). Solver provenance (version, run_id, inputs_hash) goes into `changes` JSONB, NOT `framework_trigger_type` enum (L-0248). ADR-0309 `proposed`.

### G2 — Solver determinism + Lightspeed credentials

Confirmed: `solveGreedy` determinism via SHA-256 canonical input hash + `ASC, profile_id ASC` tie-break. Lightspeed credentials: Vault RPC helpers `fn_pos_credentials_upsert/resolve` (PG Vault encrypted at rest). No plaintext in DB columns.

### G3 — 3 architectural questions (2026-05-14)

Three questions resolved:

1. **POS dispatcher** → ADR-0319: ship dispatcher layer before vendor #2. V1 EF inlines mockPull = technical debt documented.
2. **Calibration loop V2** → ADR-0320: DEFER until Lightspeed live + 30 days data. Stub-cron without algorithm = activity_trail lie (L-0272).
3. **Swap↔marketplace convergence** → ADR-0321: defer multi-stage approval to when first use-case requested. `list_open_offers` registered as 5th marketplace tool (ADR-0306 G3 amendment). L-0270 + L-0271 + L-0272 promoted from G3 findings.

---

## Known Issues / Debt

| # | Item | Severity | Resolution |
|---|---|---|---|
| D1 | Channel-guard `?? "chat"` permissive default in C1 POS tools (R1 finding) | Convention | C3 fixed with positive enum `!== "chat"` — recommend project-wide audit follow-up |
| D2 | `pos-sync` EF sentinel `actor_id="00000000-...-0001"` should switch to `actor_kind='platform'` + NULL | Low | Post engine_world Phase 2A migration cleanup |
| D3 | `approve_claim` shift-UPDATE has no row-count check — stale `shift_id` silently passes | Low | Defensive fix in C2 follow-on sortie |
| D4 | C2 TanStack `onSuccess` missing `// emit() delegated to BFF per ADR-0134` comment marker | Cosmetic | Add in C2 follow-on |
| D5 | C3 `accept_proposal` voice-channel rejection path not covered by dedicated test | Low | Add in Task 6 batch or standalone fix |
| D6 | C3 `day_category: "morning" as const` hardcoded — all proposed shifts get morning regardless of `start_at` | Low | Derive from `start_at` hour in V2 or document in ADR-0309 §V2 errata |
| D7 | 4 ADRs `proposed` — await `accepted` post-PR review | Tracking | Mark accepted after campaign PR merges |
| D8 | ADR-0319 dispatcher impl not shipped — V1 EF inlines mockPull | Medium | ADR-0319 follow-on sortie when vendor #2 surfaces |
| D9 | ADR-0320 calibration loop not shipped | Low | Trigger: Lightspeed live + 30 days real sales data |
| D10 | ADR-0321 swap↔marketplace convergence not shipped | Low | Trigger: first multi-stage approval use-case |

---

## Next Steps for PR Opener (Pontus)

1. Open `campaign/world-best-wfm → development` PR with this HANDOFF as body reference.
2. Trigger 14 required CI checks — wait for green.
3. After merge: mark ADR-0305/0306/0307/0309 as `accepted` in decision log.
4. Schedule follow-on sorties:
   - **C2 follow-on** — mobile `(shifts)/marketplace.tsx` + E2E S9 + type regen + full typecheck
   - **C3 follow-on** — web `/dashboard/schedule/proposed-plan` + mobile 3-component bundle + E2E S10/S11 + type regen + full typecheck
   - **ADR-0319 impl sortie** — POS adapter dispatcher layer (when vendor #2 surfaces)
