---
title: Audit Delta — 2026-05-20 vs 2026-05-18 baseline
status: complete
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, delta, adr-contract-validation]
---

# Delta vs 2026-05-18 Baseline

**Baseline:** `docs/audits/2026-05-18-adr-contract-validation-02/00-SYNTHESIS.md`
**This run:** `docs/audits/2026-05-20-adr-contract-validation/00-SYNTHESIS.md`
**Coverage gap closed:** 14/14 slices delivered (baseline 12/14 — missed 03 + 14)

---

## Headline

- **0 regressions** (no closed item re-appeared)
- **1 genuine NEW HIGH** — MOB-01 introduced by PR #430 today
- **1 surface-restored HIGH** — EF-01 was visible 2026-05-13 but not 2026-05-18 (slice 03 absent)
- **7 closures since baseline** verified
- **Net change in totals reflects slice-restoration inventory**, not new debt

---

## New (post-baseline)

| ID | Severity | File | Source | Notes |
|---|---|---|---|---|
| MOB-01 | HIGH | `apps/mobile/src/lib/botsson-tools.ts:121-138` | PR #430 today | `mobile_call_leader` `leader_phone` PII on LiveKit `botsson-tool-call` topic; ADR-0378 R7 violated |
| MOB-02 | MEDIUM | `apps/mobile/src/lib/botsson-tools.ts:94-95` | PR #430 today | `mobile_show_toast` uses `Alert.alert()` blocking modal during voice sessions |
| MOB-03 | MEDIUM | `apps/mobile/src/hooks/use-botsson-voice-session.ts:761` | PR #430 today | DataReceived topic-guard has no unit test (voice-agent side does) |
| MOB-04 | LOW | mobile `livekit-data-publish.ts:42-47` vs voice-agent `context.ts:100-105` | PR #430 today | Dual type sources, acknowledged in ADR-0378 §Bad as follow-up |
| F-04-01 | MEDIUM | `apps/web/src/components/day/NoteEditDialog.tsx:89` | Pre-baseline (newly traced) | Direct `supabase.from("session_note").insert` with no emit |
| F-04-02 | MEDIUM | `apps/web/src/app/dashboard/_actions/pin-day-control-context.ts:35` | Pre-baseline (newly traced) | Server Action writes `engine_memory` with no emit |
| F-04-03 | LOW | `apps/web/src/components/day/tabs/OverviewTab.tsx:7,45,123` | Pre-baseline (newly traced) | `useRouter` from next/navigation inside day widget — ADR-0156 portability gap |
| F-04-04 | LOW | `update-department-session-action.ts:137`; `agent-proposals-context.tsx:131,152,205` | Pre-baseline (newly traced) | Event-name whitespace not dot-namespacing (ADR-0367 R10 drift) |
| F-04-07 | INFO | `agent-proposals-context.tsx:204-209` | New | `approveAllProposals` emit loop without H2 boot guard |
| F-04-08 | INFO | `lib/cascade/get-tariff-context.ts:28-78` | New | Context-loader-not-pure-derivation distinction not documented |
| OW-01 | HIGH | `ConfirmPositions.tsx:99-218` | Pre-baseline (newly traced) | Zero `t()` usage; entire wizard step hardcoded |
| OW-02 | HIGH | `ConfirmDepartments.tsx:64,99,117,126,145` | Pre-baseline (newly traced) | 5 hardcoded labels/placeholders post partial-migration |
| OW-03 | HIGH | `ConfirmProcedures.tsx:87,119,123,133,143,150,154,179,209` | Pre-baseline (newly traced) | 9 hardcoded strings post partial-migration |
| OW-04 | MEDIUM | `ConfirmLocations.tsx:19-31,144,177,242,265,273,289` | Pre-baseline (newly traced) | TYPE_LABELS + SUGGESTED_LOCATIONS module-level Norwegian constants |
| OW-05 | MEDIUM | `ConfirmSummary.tsx:59-169` | Pre-baseline (newly traced) | Summary card titles + ready-indicator prose hardcoded |
| OW-06 | LOW | `ConfirmDepartments.tsx:75,84` | New | `transition-all duration-200` instead of `transition-colors` |
| OW-07 | LOW | `ConfirmProcedures.tsx:99,108` | New | Same transition-all pattern |
| OW-08 | LOW | `ConfirmDepartments.tsx:78` + `ConfirmProcedures.tsx:102` | New | `bg-white/50` instead of `bg-card/50` |
| F-06-05 | MEDIUM | `legal/tools.ts:406-416` | New | `cite_law` returns bare `"LAV"` string instead of ADR-0257 `Confidence` object |
| F-06-06 | LOW | `legal/index.ts:10,71` | New | Stale "chat + voice" docstring residue after F-CL-14 fix migrated to `tools.ts` only |
| WH-01 | MEDIUM | `apps/web/src/app/api/webhooks/docuseal/route.ts:320-334` | NEW (previously undetected) | engine_event insert uses 4 non-existent columns (`entity_type`, `entity_id`, `event_name`, `created_at`); cast `as never` + `.catch(()=>{})` swallow failure |
| EF-01 | HIGH | `supabase/functions/tariff-amendment-sweep/index.ts:49` | Persistent (slice 03 absent in baseline) | Missing `[functions.tariff-amendment-sweep]` in `config.toml`; 5 of 6 cron EFs fixed since 2026-05-13 |
| EF-03 | INFO | `supabase/functions/_shared/required-secrets.ts` | NEW positive | Startup-gate helper shipped, wired only to analyze-setup-documents (adoption gap) |
| F-09-02 | MEDIUM | `supabase/migrations/20260620110200_shift_lifecycle_pipeline_v2.sql:41,105,188,454` | New (re-classified) | ADR-0321 superseded with 4 comment-only references |
| F-09-03 | MEDIUM | `scripts/` (file missing) | New | ADR-0377 enforcement script `check-telemetry-emit-coverage.ts` never shipped |
| F-09-04 | LOW | `apps/mobile/src/hooks/__tests__/use-botsson-voice-session.test.ts` | New | ADR-0378 mobile topic-guard unit test absent |
| F-09-05 | LOW | (integration test gap) | New | ADR-0378 10s timeout integration test absent (unit-only) |
| F-14-05 | MEDIUM | `apps/e2e/protocols/p-swap-marketplace-pipeline.ts` | Slice 14 restored | Unregistered protocol; spec file absent |
| F-14-06 | MEDIUM | `apps/e2e/db/announcement-atomic-rpc.spec.ts:17` | Slice 14 restored | Hardcoded Supabase service-role fallback in committed code |
| PD-01 | MEDIUM | `Orb.tsx:43` | New (residual after H2 sweep) | Runtime-computed `oklch(0.82 ${chroma} 50)` gradient with no token backing |
| PD-02 | MEDIUM | `LighthouseAvatar.tsx:53` | New (residual after H2 sweep) | Runtime-computed `oklch(0.80 ${chroma} 50 / 0.55)` halo |
| PD-03 | MEDIUM | `packages/eslint-config/plugins/smartout/rules/` | Unchanged (carryover restated) | ADR-0366 `nordic-split/no-oklch-literal` rule absent |
| PD-04 | MEDIUM | `apps/landing/src/app/globals.css:134-135,159,172` | NEW scope coverage | 4 OKLCH literals in `@layer utilities` (outside @theme) |
| PD-05 | MEDIUM | `apps/landing/src/app/free-forever/page.tsx:181,185` | NEW scope coverage | 2 Tailwind arbitrary OKLCH values |
| PD-06/07 | LOW | `apps/web/perf-budgets.json` + `apps/landing/perf-budgets.json` | Worsened | ~20 dashboard routes added since 2026-02-28, no budget entries |
| PD-08 to PD-12 | LOW | Various motion + heritage rgba sites | Carryover / new sites | Inline springs + rgba() residue |
| F-04 (slice 12) | MEDIUM | `apps/web/src/app/reset-password/page.tsx:71,115` | NEW | New file 2026-05-20 with hardcoded Norwegian in rendered JSX |
| F-01 (slice 12) | HIGH | 376 .tsx files | Worsened from 378 | -2 files only; corpus enforcement gap unchanged |
| F-02a/b/c (slice 12) | MEDIUM | DashboardShell + ReconciliationView + proposed-plan metadata | Partial improvement | DashboardShell + WebDayControl partially migrated; ReconciliationView 7 residual Norwegian chars |
| F-05/F-06/F-07 (slice 12) | LOW | docs frontmatter drift | Carryover + 47 new misses | Plan files never receive frontmatter; future-dated HANDOFF |
| M-005 | MEDIUM | `personal/tools.ts:256-304`, `helpdesk_query/tools.ts:133,385` | Pre-baseline (newly traced) | Cross-namespace inserts into engine_event / engine_trigger / engine_delayed_trigger / channel_member outside owning capability |
| WH-02/03/04 | LOW/INFO | `heartbeat/sixten`, `stripe-webhook`, Twilio absent | Carryover + INFO | Slice 13 inventory restoration |

---

## Regressed (closed → open)

**None.** No baseline closure has re-appeared.

Verified holding:
- F-DB-09 (2026-05-13 CRITICAL) — sister-table sweep applied; no new no-WITH-CHECK regressions
- F-OB-10-01 (2026-05-13 CRITICAL) — 27-file onboarding cleanup; no legacy file re-introduced
- F-CL-11 (2026-05-13 CRITICAL) — legal/index.ts:57 voice on §14-6 closed
- F-EF-03 (2026-05-13 CRITICAL) — 5 intelligence EFs auth-locked; not regressed
- F-DB-12 (2026-05-13 HIGH) — staff_event WITH CHECK policies fixed; not regressed
- Mobile L-0083 ESLint enforcement — still active; PR #430 13/13 telemetry parity PASS
- ADR-0099 / ADR-0151 / ADR-0163 perimeter — intact across capability tools
- ADR-0078 channel-pinning — server-side stamping preserved
- ADR-0204 payroll-convention — re-classification (HIGH → MEDIUM in 2026-05-18) holds; not re-elevated

---

## Closed (open → closed)

| ID | Closed by | Evidence | Slice |
|---|---|---|---|
| Baseline F-04-OKLCH-DAY | H2 sortie (commits 2026-05-18 PM) | 9 day-component files now use `var(--slot-*)` / `var(--tag-*)`; `grep -rn "oklch(" apps/web/src/components/day/ apps/web/src/app/dashboard/schedule/` = 0 | 04 |
| Baseline F-04 duty_leader SA emit unverified | Code-trace confirms | `update-department-session-action.ts:136-153` has explicit `emit()` after gated write | 04 |
| Baseline F-07-SD-1 | commit 628041add (2026-05-18) | `trigger_channel_message_notification` + `get_channel_messages` carry `SET search_path = public, pg_temp` | 07 |
| 5 of 6 cron EFs (baseline 2026-05-13 HIGH cluster) | feat/audit-fef03-* + cron-EF sweep | ops-day-brief, ops-learn, ops-monitor, ops-predict, ops-triage all carry `verify_jwt=false` in config.toml | 03 |
| Baseline F-06-02 cite_law docstring chat+voice | commit f61991a96 | `tools.ts` updated; residue remains in `index.ts` (new LOW F-06-06) | 06 |
| Baseline F-12 login page Norwegian chars | i18n migration | Login page Norwegian char count 10+ → 0 | 12 |
| Baseline F-10-I18N-WIZARD-1 (ConfirmBusiness) | i18n migration | FIELDS array now uses `labelKey`/`placeholderKey`; render calls `t(field.labelKey)` | 10 |
| Baseline F-10-I18N-WIZARD-2 (TariffSection + ConfirmRoles) | i18n migration | Both now use `useTranslation` from `WizardStepProps` | 10 |
| Baseline F-14-ATR-1 attach-routine testid | commit 628041add | `DayLineStrip.tsx:101` testid now static | 14 |
| Baseline F-02-PROFILE-1 chat BFF profile workspace | commit 628041add | botsson/chat + emma/chat BFFs include `.eq("workspace_id",...)` | 02 |
| Baseline F-02 day-line-push profile workspace scope (Finding B) | commit 628041add | `handlers/day-line-push.ts:301-303` includes `.eq("workspace_id", task.workspace_id)` | 02 |
| Baseline F-11-OKLCH-COMP (283 hits / ~50 files) | H2 sortie | Down to 3 hits / 2 files (helpdesk-orb runtime gradients only) | 11 |
| Baseline F-11-OKLCH-GLOBAL (18 globals.css hits) | H2 sortie | `globals.css` now compliant; `.dark` block is custom-property definition (allowed per ADR-0366) | 11 |

---

## Unchanged open

| ID | Severity | Open since | Notes |
|---|---|---|---|
| M-001 | MEDIUM | 2026-05-18 | billing-query body workspace_id (downgraded from HIGH; company-anchor limits blast) |
| M-002 | MEDIUM | 2026-05-18 | payroll/tools.ts gate-then-direct (payroll convention) |
| M-003 | MEDIUM | 2026-05-18 | shift-lifecycle/tools.ts gate-then-direct |
| M-004 | MEDIUM | 2026-05-18 | timeline-template/tools.ts cross-namespace session_hook insert |
| F-06-03 | LOW | 2026-05-18 | Deprecated DocuSeal Fastify handler with no emit |
| F-06-04 | INFO | 2026-05-18 | classify_amendment + cite_law Phase 0c stubs |
| F-07-03 | INFO | 2026-05-18 | announcement_meta has updated_at trigger but no column |
| F-07-04 | INFO | 2026-05-18 | shift_session no JWT INSERT/UPDATE policy |
| F-09-01 | LOW | 2026-05-18 | ADR-0322 undocumented gap |
| F-14-02 | LOW | 2026-05-15 | SEASON_LIFECYCLE_MISSION_ID outside MissionIdSchema lacks inline rationale |
| F-14-03 | LOW | 2026-05-15 | season-lifecycle session-spawn path has no E2E |
| F-14-04 | LOW | 2026-05-15 | MISSIONS Record<string,_> loses compile-time enum guard |
| GAP-MOB-01 | INFO | 2026-05-13 | ADR-0133 spokesperson authoring exception undocumented |
| GAP-MOB-02 | INFO | 2026-05-13 | `/api/mobile/shifts` BFF route absent |

---

## By-slice delta table

| # | Slice | Baseline C/H/M/L/I | This run C/H/M/L/I | Net change |
|---|---|---|---|---|
| 01 | capability-tools | 0/0/4/3/0 | 0/0/5/3/0 | +1 MEDIUM (M-005 cross-namespace personal + helpdesk_query) |
| 02 | stage-engine-bff | (under baseline 02-prefix mix) | 0/1/2/0/1 | SE-01 HIGH new (ADR-0248 single-producer); baseline day-line-push profile workspace fix CLOSED |
| 03 | edge-functions | (absent in baseline) | 0/1/0/1/3 | Slice restored — EF-01 persistent HIGH visible again |
| 04 | schedule-cascade | (baseline included 1 HIGH OKLCH cluster + 3 LOW/INFO) | 0/0/2/4/2 | OKLCH 9-file cluster CLOSED; 4 new MEDIUMs/LOWs from broader code-trace |
| 05 | mobile-surface | 0/0/0/0/3 (GAP-MOB) | 0/1/2/1/1 | NEW: MOB-01/02/03/04 from PR #430 mobile-voice-runtime-wire |
| 06 | contracts-payroll-lovsen | 0/0/0/2/1 | 0/0/1/2/2 | F-06-05 MEDIUM new (ADR-0257 Confidence type drift); F-06-06 LOW new (docstring residue) |
| 07 | db-rls-telemetry | 0/0/0/2/2 (baseline LOWs) | 0/0/0/0/2 | 2 LOWs CLOSED; PR #430 13/13 telemetry parity PASS; ALL GREEN |
| 08 | journeys | (absent or minimal in baseline) | 0/0/2/2/1 | Slice restored; 7 new mobile-voice journey docs structurally compliant |
| 09 | adr-coverage-gaps | (baseline ADR drift items minimal) | 0/0/2/3/0 | F-09-02/03/04/05 new; F-09-01 carryover; 7 new ADRs (0372-0378) all registered |
| 10 | onboarding-wizard | 0/2/0/0/0 (F-10-I18N-WIZARD-1 + -2) | 0/3/2/3/0 | Baseline 2 HIGHs CLOSED; 3 new HIGHs on adjacent files (OW-01/02/03); 2 new MEDIUMs (OW-04/05); 3 new LOWs (OW-06/07/08 Nordic Split heritage) |
| 11 | performance-design | 0/2/0/0/1 (F-11-OKLCH-COMP + F-11-OKLCH-GLOBAL) | 0/0/5/7/1 | Both baseline HIGHs CLOSED (280+ hits → 3); residual MEDIUMs on helpdesk-orb runtime + landing-app + ESLint rule absence; LOWs on motion + heritage rgba |
| 12 | i18n-frontmatter | 0/1/2/3/1 (F-IF-01 + F-12 cluster) | 0/1/4/3/1 | F-01 corpus unchanged (378 → 376); F-04 NEW (reset-password); DashboardShell + WebDayControl partial improvement; login page CLOSED |
| 13 | webhook-integration | 0/0/0/0/1 | 0/0/1/0/3 | NEW: WH-01 MEDIUM engine_event schema mismatch (silently breaks contract.signed cascade) |
| 14 | missions-e2e | (absent in baseline) | 0/0/2/3/0 | Slice restored; F-14-05 + F-14-06 new MEDIUMs; F-14-02/03/04 carryover from 2026-05-15 |

---

## ADRs gaining coverage this run

| ADR | First audited | Status |
|---|---|---|
| 0246 | 2026-05-20 | proposed; soft boundary-bleed at mission-summary.ts:62 |
| 0248 | 2026-05-20 | proposed; SE-01 violation |
| 0252 | 2026-05-20 | accepted; Riksavtalen §4 carve-out (Rule 7) confirmed |
| 0255 | 2026-05-20 | accepted; dispatch.ts SE-02 telemetry blind spot |
| 0257 | 2026-05-20 | accepted; F-06-05 Confidence type drift |
| 0367 | 2026-05-20 | accepted; tri-layer model day_line wired, shift_session UI in-progress |
| 0372 | 2026-05-20 | proposed; file + log + code parity ✅ |
| 0373 | 2026-05-20 | proposed; blocked on bursdag dependency |
| 0374 | 2026-05-20 | accepted; portal auth redirect |
| 0375 | 2026-05-20 | accepted; root-domain assert hard-fail |
| 0376 | 2026-05-20 | proposed; codifies SKILL.md carve-out |
| 0377 | 2026-05-20 | proposed; enforcement script absent (F-09-03) |
| 0378 | 2026-05-20 | proposed; code already live; PII rule R7 violated at MOB-01 |
