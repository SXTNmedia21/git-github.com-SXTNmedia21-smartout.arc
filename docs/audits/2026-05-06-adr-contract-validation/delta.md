---
title: Audit Delta — 2026-05-06 vs 2026-05-02
status: done
created: 2026-05-06
updated: 2026-05-06
module: audit
tags: [audit, delta]
---

# Delta vs 2026-05-02 baseline

## Summary

| Class | Count |
|---|---|
| Closed | ~20 (5 CRITs + ~15 HIGHs) |
| Regressed | 0 code regressions; 2 documentation regressions |
| New | ~30 (2 CRIT + ~14 HIGH + ~14 MED) |
| Unchanged-open | ~15 |

## Closed (verified)

- `engine-dispatch/index.ts` — verifyInternalAuth shipped (slice 03)
- `validate-settlement/index.ts` + `process-settlement-image/index.ts` — auth landed (slice 03)
- 11 cron functions — `if (!secret || ...)` fail-closed pattern (19/20 functions correct now) (slice 03)
- `docuseal-webhook` — HMAC-SHA256 + timingSafeEqual + required secret (slice 13)
- `journey-authoring/publishDraftTool` — docstring + body align; ADR-0204 wrap correct (slice 01)
- `legal/classify_amendment` — gate body added (slice 06)
- 5 contract tools — callGateAction added (slice 06)
- contract/legal tools emit added (slice 06)
- `chat.ts:116-125` — explicit 404 replaces silent wizard fallback (slice 02, L-0177 fix)
- `channel_department_access` + `channel_team_access` — RLS policies populated (slice 07)
- `apps/mobile/.../ShiftTimelineContainer.tsx:46` — actor_id "anonymous" gone (slice 05)
- `use-punch.ts`, `use-swap.ts`, `use-create-shift.ts` — empty-string fallbacks fixed (slice 05)
- `--webpack` flag dropped + Sentry source-map gating + zinc/gray palette debt cleared (slice 11)
- `shift-lifecycle/tools.ts` — ADR-0091 direct write resolved (slice 04)
- `wizard-definition.ts` — finalization telemetry added (slice 10)
- ADR-0041 stale-status drift resolved (slice 09)

## Regressed (documentation only — no code regression)

- Decision-log duplicate rows: 8 → 21 (slice 09 M-01)
- Docs missing `module:` frontmatter: 491 → 551 (slice 12)

## New (post-baseline)

### CRITICAL (2)
- `journey-stuck-detector/index.ts:139` — broken `&&` auth pattern reopened (slice 03 C-01)
- `bootstrap-cascade/index.ts:175` — verify_jwt=false + body-supplied workspaceId, 42 service-role mutations (slice 03 C-02)

### HIGH (~14)
- `_shared.ts:101` + 3 route handlers — direct `gate_action` RPC outside orchestrator; ADR-0204 §3 CI grep does not exist (slice 04)
- `cleanup-sandbox-workspaces:11,16` — module-level `Deno.env.get` + `Bearer ${undefined}` accepted (slice 03 H-01)
- `engine_world` table — missing types, dark write, zero registry events (slice 07 H-01/H-02/M-04)
- `outreach` capability — authority seed shipped without registry events (slice 07 H-03)
- `sendgrid-webhook` — fail-open if env missing (slice 13 H-02)
- `STRIPE_WEBHOOK_SECRET` `.optional()` in env.ts (slice 13 H-01)
- `LIVEKIT_WEBHOOK_SECRET` dead code in env.ts (slice 13 H-03)
- `/api/emma/chat:192` + `/api/botsson/chat:191` — BFF still forwards profile_id (residual injection vector, slice 02 F-01/F-02)
- POST `/agent/dispatch` + PUT `/agent/queue/:id` — zero emit + no workspace scope (slice 02 F-03/F-04)
- 6 mobile hooks — caller-supplied workspace_id without getProfileContext() (slice 05 H1)
- `chat_message` direct insert in `use-botsson-chat.ts:393` + `useShiftChat.ts` (slice 05 H2)
- BotssonSheet/BotssonProvider — Ultravox dead code post-LiveKit (slice 05 H3)
- `OverviewTab.tsx:7` — Next/navigation imported in components/day/ (ADR-0156 violation, slice 04)
- `next.config.ts:185` — `typescript.ignoreBuildErrors: true` since 2026-05-04, no expiry (slice 11 F-11-02)
- 373 `orange-*` palette instances bypass `--brand-orange` token (slice 11 F-11-03)
- ADR-0265 missing from decision-log table (slice 09 H-03)
- ADR-0259 capability name conflict — uses `legal` not `industry_intelligence.lovsen_query` (slice 09 H-01, default-allow CVE class per L-0066)
- 9 onboarding components reference unmounted OnboardingProvider — runtime crash if rendered (slice 10 HIGH-1)
- ADR-0238 (DomainChatOwnership) — hook + component do not exist anywhere (slice 10 HIGH-2)
- 4 fully-public scrape/search EFs (search-brreg, scrape-website, google-places, web-search) — quota-drain surface (slice 03 H-02)

### MEDIUM (~14)
- helpdesk_query + operations — Pathway A only, no gatedMutation (slice 01 — demoted from CRIT)
- season mutation tools — zero emit, deferred to M4 (slice 01)
- ADR-0122 governance telemetry — only 1 of 7 events registered (slice 09)
- ADR-0053 stale `proposed` 44+ days (slice 09)
- ADR-0218 dual-write partial — only signup join path (slice 09)
- billing.accountant_company_grant — missing API-key read policy (slice 07 M-03)
- salary_type + end_date_reason — read-only RLS missing (slice 07)
- gatedMutation gate_evaluated emit — unregistered (slice 07)
- E2E coverage — 11% (25/221 journeys) (slice 08)
- `packages/ai/src/journey/` is single-file stub (slice 08)
- 183 test.skip occurrences across 49 specs; "Anna Olsen" cascade across 19 (slice 14)
- Playwright zero CI gate (slice 14)
- Mission registry — 6 missions, 0 with E2E coverage of mission behavior (slice 14)
- workspace_id=null race at wizard-started emit (slice 10)

## Unchanged open

- gatedMutation SS-5 transactional atomicity — `shift-lifecycle/gate.ts:93` execute is sentinel no-op
- Tariff tier-3 fallback observability — no warn/emit
- ADR-0246/0247/0248 (Sixten persona) — zero Phase A0 work
- `sendEmployeeContract` zero emit (baseline B4 persists)
- ADR-0115 NordicSkeleton — referenced not exported
- ADR-0139 `--color-proposed` + PendingBadge — zero code presence
- ADR-0240 — partial; journey-authoring still cross-namespace?  (verify in next sortie)
- P-001 hardcoded `test.skip(true, ...)` (slice 14)
- `perf-budgets` CI job absent (slice 11)
- i18n adoption 15.2% — improved from 9.5% but still launch-blocker
