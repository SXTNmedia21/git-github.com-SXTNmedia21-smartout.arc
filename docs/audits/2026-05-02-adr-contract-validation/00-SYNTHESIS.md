---
title: ADR + Contract Validation — Synthesis (14 slices)
status: draft
updated: 2026-05-02
created: 2026-05-02
module: audit
tags: [audit, adr, contract-validation, synthesis]
---

## Executive Summary

- **Three CRITICAL unauth surfaces.** `engine-dispatch`, `validate-settlement`, and `process-settlement-image` Edge Functions accept `verify_jwt=false` with NO bearer/HMAC/cron-secret check. Any anonymous POST can inject engine events or mutate `daily_reconciliation`. The `docuseal-webhook` adds a fourth surface — signature check is optional AND uses non-constant-time string equality against the raw secret instead of HMAC. (slices 03 + 13)
- **`emit()` coverage is the largest single ADR-0004 gap surface in the codebase.** ~30+ confirmed mutation sites with no telemetry: 7 capability tools post-`gatedMutation`, 11 mobile offline-sync action types, 7 web BFF routes, 5 contract/legal capability tools, 6 governance Server Actions. Activity_trail and engine_event are blind to a meaningful chunk of all writes. (slices 01, 06, 07, 10)
- **L-0177 + ADR-0204 lying-docstring patterns confirmed live in code.** `journey-authoring/publishDraftTool` docstring claims `gatedMutation` wraps inserts; body has 3 direct writes outside any gate. `stage-engine/chat.ts:116-125` has the silent wizard-session→workspace fallback pattern that L-0177 was written to ban. Both shipped after the learnings were written. (slices 01 + 02)
- **Capability gate adoption is partial AND inverted.** ADR-0186 (every capability mutation must call `callGateAction`) violated by 5 high-impact capabilities: `contract` (5 tools), `helpdesk_query` (open/resolve/SLA-trigger), `operations` (createDeviation/completeTask), `journey-authoring` (publishDraft), `legal` (classify_amendment missing gate body entirely despite ADR-0249 + ADR-0099 mandate). (slices 01 + 06)
- **Decision log is structurally inconsistent.** 8+ ADRs appear twice (proposed AND accepted rows): 0190, 0195, 0196, 0197, 0204 + others. ADR-0151, 0168, 0169, 0192 are accepted in code but log says proposed. ADR-0041 (onboarding wizard, accepted) describes an architecture that is no longer the runtime path. (slices 09 + 10)

---

## Critical Findings (Top 10, Ranked)

| # | Severity | Theme | Location | ADR(s) | Source slices | Proposed remediation | ETA |
|---|---|---|---|---|---|---|---|
| 1 | CRITICAL | Auth — unauth surface | `supabase/functions/engine-dispatch/index.ts:180-240` (`verify_jwt=false`, no bearer/HMAC) | ADR-0029 amend, ADR-0099 | 03 | Add `if (!cronSecret \|\| authHeader !== ...)` bearer check OR move to HMAC-signed DB-trigger-only | 1 day |
| 2 | CRITICAL | Auth — unauth surface | `supabase/functions/validate-settlement/index.ts` + `process-settlement-image/index.ts` (no auth, mutates `daily_reconciliation`) | ADR-0029 | 03 | Add cron/engine-dispatch shared bearer check; fail-closed | 1 day |
| 3 | CRITICAL | Webhook security | `apps/web/src/app/api/webhooks/docuseal/route.ts:53-59` — env optional + raw-secret string equality (not HMAC, not constant-time) | — (no ADR yet) | 13 | Make `DOCUSEAL_WEBHOOK_SECRET` required in env.ts; switch to HMAC-SHA256 + `timingSafeEqual` | 0.5 day |
| 4 | CRITICAL | Capability gate / L-0176 | `packages/ai/src/capabilities/journey-authoring/tools.ts:444-487` — `publishDraftTool` docstring claims gated; body has 3 direct writes outside `gatedMutation` AND violates ADR-0240 cross-namespace boundary | ADR-0204, ADR-0240, ADR-0173, L-0176 | 01 | Wrap inserts in `gatedMutation` OR delegate to `journey.publish_mission` per ADR-0240 (preferred); rewrite docstring last | 1-2 days |
| 5 | CRITICAL | Capability gate | `packages/ai/src/capabilities/legal/tools.ts:238-289` — `classify_amendment` declares `gate_action: enforce, default_allow: false` but execute body has zero `callGateAction` calls | ADR-0249, ADR-0099 | 06 | Add `callGateAction` (copy `payroll/gate.ts` pattern) before classification logic | 0.5 day |
| 6 | HIGH | L-0177 silent fallback | `services/stage-engine/src/routes/agent/chat.ts:116-125` — `wizard_session_id` supplied + row missing → silent fallback to JWT-default workspace | L-0177, ADR-0151 | 02 | Replace silent fallback with explicit 4xx (`WIZARD_NOT_FOUND`); add else-branch | 0.5 day |
| 7 | HIGH | Telemetry — emit gap | `gatedMutation()` in tools layer + 11 mobile offline-sync action types + 7 web BFF routes + capability tools (`contract.send`, `legal.cite_law`, etc.) | ADR-0004, ADR-0134 | 01, 06, 07, 10 | (a) Add `emit()` inside `gatedMutation` SS-5 success path or add explicit emit at every call site; (b) wrap mobile sync worker `actionMap[action]` with emit; (c) backfill 7 BFF routes | 3-5 days (sweep) |
| 8 | HIGH | Capability gate | `packages/ai/src/capabilities/contract/tools.ts` — 5 mutation tools (createEmployeeContract / sendEmployeeContract / forkTemplate / publishWorkspaceTemplate / deprecateWorkspaceTemplate) use custom `resolveActorRole` only, no `callGateAction` | ADR-0186, ADR-0099 | 01, 06 | Add `callGateAction` before each mutation; keep `resolveActorRole` as defence-in-depth | 1-2 days |
| 9 | HIGH | RLS lockout | `channel_department_access` + `channel_team_access` tables — RLS enabled, ALL policies commented out (zero-policy lockout) | ADR-0029 | 07 | Ship the `access_scope` resolution function described in `20260519200000` migration header BEFORE departments/teams scope is enabled in UI | 1-2 days |
| 10 | HIGH | Mobile telemetry | `apps/mobile/.../ShiftTimelineContainer.tsx:46` — `actorId = profile?.profile_id ?? "anonymous"` corrupts `activity_trail` (passes `nonEmpty()`, fails identity) | ADR-0134, L-0083 lineage | 05 | Replace with `getProfileContext()` and gate render on identity resolution | 0.5 day |

**Tier-2 (HIGH but narrower blast radius):** `helpdesk_query openTicket / resolveTicket / spawnSlaBreachTrigger` direct writes (ADR-0186, slice 01); `operations createDeviation + completeTask` direct writes (ADR-0186, slice 01); 11 cron Edge Functions with weak `if (cronSecret && ...)` guard that opens fully when env var missing (slice 03); `sendEmployeeContract` zero emit (slice 06); `validate_aml_14_6` allowedChannels advertises voice while execute() blocks it (ADR-0078 inversion, slice 06).

---

## Theme Rollup

| Theme | CRIT | HIGH | MED | LOW | Worst-offender file |
|---|---|---|---|---|---|
| Auth + authorization (gates / scope guards / dual-auth) | 4 | 8 | 2 | 1 | `engine-dispatch/index.ts` (no inbound auth) |
| Workspace_id + profile_id derivation (L-0177, ADR-0151) | 0 | 2 | 4 | 1 | `stage-engine/.../chat.ts:116-125` (silent wizard fallback) |
| Telemetry / emit() coverage (ADR-0004, ADR-0134) | 0 | 4 | ~25 | — | `gatedMutation()` SS-5 path + mobile `action-map.ts` |
| Capability boundaries (frozen-4 / cross-namespace / ADR-0173/0240) | 1 | 0 | 0 | 0 | `journey-authoring/publishDraftTool` writing journey + journey_version |
| Webhook security | 1 | 1 | 2 | 1 | `docuseal-webhook/route.ts` |
| Mobile surface boundary (ADR-0127–0135) | 0 | 1 | 1 | 1 | `ShiftTimelineContainer.tsx:46` |
| Cascade + schedule (ADR-0091/0156/0204) | 0 | 0 | 2 | 1 | `shift-lifecycle/gate.ts:93` (SS-5 sentinel no-op) |
| Documentation + journeys + ADR drift | 0 | 2 | 4 | many | Decision log (8+ duplicate ADR rows) |
| i18n + design tokens | 0 | 0 | 1 | many | i18n adoption 9.5% (~166 / 1754 files) |
| Performance + Turbopack | 0 | 1 | 1 | 1 | `next.config.ts:88-149` (webpack alias block, Turbopack untested) |

---

## ADR Conflict Table (claimed vs reality)

| ADR | Decision-log status | Reality (per slice) | Slice |
|---|---|---|---|
| ADR-0041 | accepted | Stale — describes STEP_COMPONENTS + WizardContext architecture; runtime uses `AnimatedWizardShell` + `wizard-definition.ts`; `OnboardingProvider` not mounted | 10 |
| ADR-0099 | accepted | `legal/classify_amendment` declares the gate but execute body has zero gate calls | 06 |
| ADR-0115 | accepted | `loading.tsx` pattern shipped, but `NordicSkeleton` named component referenced in ADR is not a real export | 09 |
| ADR-0122 | proposed | Only 1 of 7 declared governance telemetry events registered (`governance.content_updated`) | 09 |
| ADR-0134 | accepted | One confirmed corruption (`"anonymous"` actor_id) + 6 mutation sites bypass `getProfileContext()` cross-check; offline sync emits zero | 05, 07 |
| ADR-0139 | draft | `--color-proposed` token + `PendingBadge` zero code presence — blocks Wave 2C per ADR-0091 | 09 |
| ADR-0151 | proposed (in log) | Bumped to accepted 2026-04-23; log row stale | 09 |
| ADR-0168 | proposed | `signInWithOtp` shipped; log not updated | 09 |
| ADR-0169 | proposed | Migration `20260515140000` confirmed live; log not updated | 09 |
| ADR-0186 | accepted | 5 capabilities have mutation tools without `callGateAction` (contract / helpdesk_query / operations / journey-authoring / legal) | 01, 06 |
| ADR-0192 | proposed | `AFTER INSERT ON workspace` trigger live in migration (deviation from ADR's BEFORE — documented in migration header only) | 09 |
| ADR-0204 | accepted | `journey-authoring/publishDraftTool` docstring claims compliance; body violates. `shift-lifecycle/gate.ts:93` `execute` is sentinel no-op (SS-5 transactional gap) | 01, 04 |
| ADR-0218 | proposed | Dual-write only on signup completion path; calendar + settings remain single-source — ADR intent ("wizard MUST dual-write") only partially satisfied | 09 |
| ADR-0240 | accepted | `journey-authoring/publishDraftTool` writes `journey` + `journey_version` directly instead of delegating to `journey.publish_mission` | 01 |
| ADR-0249 | accepted | `validate_aml_14_6` channel guard inversion; capability `allowedChannels: ["chat","voice","system"]` while execute() blocks voice; `classify_amendment` missing gate body | 06 |
| ADR-0259 | accepted | Migration seeds `capability='legal'`; ADR's example SQL uses `'industry_intelligence.lovsen_query'` — name mismatch | 06 |
| ADR-0260 | proposed | Cabinet Grotesk swap not done; `Instrument Serif` still hardcoded in WelcomeWizard + comments | 09 |
| Multiple (0190/0195/0196/0197/0204) | duplicate rows in log | Same ADR appears twice (proposed + accepted); index inconsistency from campaign merges | 09 |

---

## Slice Contradictions

- **Cascade SS-4 vs SS-5 status:** Slice 4 reads `shift-lifecycle/gate.ts` as ADR-0204 SS-4 PASS with SS-5 transactional atomicity gap (`execute: () => ({ ok: true })` sentinel). Slice 1 reads `journey-authoring/saveDraftTool` as the only cleanly-compliant ADR-0204 user. No conflict — both correct, different surfaces. ADR-0204 is partial across the codebase.
- **Tariff rates "wrong" memory vs slice 4 "correct":** Memory file flagged `HOSPITALITY_TARIFF_RATES` as wrong; slice 4 confirms current code labels them "Correct (2024 satser)" but did NOT verify the numeric values against Riksavtalen. Memory may be stale; values were not re-verified in audit. Treat as: rates labelled correct, observability of fallback usage missing (no warn/emit when tier-3 fires). Verify numeric correctness in a follow-up.
- **Mobile ADR-0238 applicability:** Slice 5 says "N/A on mobile" (mobile has single Botsson surface). Slice 10 flags ADR-0238 not implemented for `/onboarding` (web). Both correct — ADR-0238 is a web concern; the gap is on web onboarding, not mobile.
- **L-0177 surface count:** Slice 1 finds 1 partial (billing-query getUsageSnapshot — body workspace_id, anchored on company). Slice 2 finds 1 confirmed (wizard_session_id silent fallback). Slice 5 flags 6 mobile mutations as "caller-supplied workspace_id, no cross-check" — same conceptual class but mitigated by RLS. No contradiction; severity tiers correctly differentiated.
- **i18n debt size:** Slice 11 says "140-file zinc/gray debt is stale, 0 active violations." Slice 12 confirms i18n debt remains massive (90%+ files hardcode Norwegian). Different debt categories — design-token migration substantially complete; i18n adoption barely started.

---

## Forward Plan — Ranked Sortie List

**Sortie 1 — Stop the bleeding (CRITICAL auth surfaces, 1-2 days, sequential)**
1. Add bearer-secret check to `engine-dispatch`, `validate-settlement`, `process-settlement-image` (CF-01 + CF-02 in slice 03).
2. Make `DOCUSEAL_WEBHOOK_SECRET` required + switch to HMAC-SHA256 + `timingSafeEqual` (CF-13-01 in slice 13).
3. Fix the 11 weak cron guards: `if (!secret || authHeader !== ...)` (CF-03 in slice 03).

**Sortie 2 — Honest docstrings + L-0177 sweep (HIGH, 2-3 days, can run parallel to Sortie 1)**
4. Fix `journey-authoring/publishDraftTool` (slice 01): either delegate per ADR-0240 OR wrap in `gatedMutation`. Rewrite docstring AFTER body verified. Use `smartout-agent-dev` Tool Compliance Self-Check table.
5. Fix wizard_session_id silent fallback in `stage-engine/.../chat.ts:116-125` (slice 02).
6. Sweep all `?.workspace_id` and `?.profile_id` chains in stage-engine routes + capability tools (apply L-0177 hard rule from steward memory).

**Sortie 3 — Capability gate compliance (HIGH, 3-5 days)**
7. Add `callGateAction` to: `contract` (5 tools), `helpdesk_query` (3 mutations), `operations` (createDeviation, completeTask), `legal/classify_amendment`. Pattern: copy `payroll/gate.ts`. (slices 01 + 06)
8. Resolve `validate_aml_14_6` allowedChannels inversion: align capability `allowedChannels` to tool execute() guards (slice 06).

**Sortie 4 — Telemetry coverage sweep (HIGH, 3-5 days)**
9. Decide: emit inside `gatedMutation` SS-5, or emit at every call site? (Architectural — needs ADR.)
10. Backfill emits: 7 capability tools (report/season/journey-ops), 11 mobile offline-sync actions, 7 web BFF routes, 5 contract/legal mutations. (slices 01 + 06 + 07)
11. Fix `ShiftTimelineContainer.tsx:46` `"anonymous"` actor_id corruption (slice 05).

**Sortie 5 — Schema + RLS (MEDIUM, 1-2 days)**
12. Ship policies for `channel_department_access` + `channel_team_access` BEFORE enabling departments/teams scope in UI (CV-1, slice 07).
13. Add read-only RLS for `salary_type` + `end_date_reason` (slice 07).
14. Fix LiveKit + SendGrid idempotency (CF-13-03, CF-13-04, slice 13).

**Sortie 6 — ADR + journey hygiene (LOW-MEDIUM, ongoing)**
15. Dedupe decision log (8+ duplicate ADR rows: 0190/0195/0196/0197/0204 etc.); update stale statuses (0151/0168/0169/0192 → accepted). (slice 09)
16. Update or sunset ADR-0041 to reflect the `AnimatedWizardShell` runtime path; add finalization emit to `wizard-definition.ts:onComplete()`. (slice 10)
17. Build journey ↔ engine_process ↔ E2E traceability index (G1, slice 08); P-001 testid backlog (slice 14).
18. Adopt i18n: enforce `no-hardcoded-strings` lint or write ADR mandating adoption timeline; add `module:` field to 491 doc files. (slice 12)

**Parallelism guide:** Sortie 1 + 2 + 4 are independent and can run in parallel (different surfaces). Sortie 3 should follow Sortie 2 (gate fixes will create new emit sites). Sortie 5 is independent. Sortie 6 is documentation-only and never blocks.

---

## Slice-by-Slice Top Finding

- **[01 — Capability tools](./01-capability-tools.md):** `journey-authoring/publishDraftTool:444-487` lies in docstring (claims gated, body has 3 direct writes outside any gate) AND violates ADR-0240 cross-namespace boundary by writing `journey`+`journey_version` directly.
- **[02 — Stage Engine + BFF](./02-stage-engine-bff.md):** L-0177 silent workspace fallback live at `stage-engine/.../chat.ts:116-125` — exact pattern the learning was written to ban, shipped after the rule.
- **[03 — Edge Functions](./03-edge-functions.md):** Three Edge Functions accept zero inbound auth (`engine-dispatch`, `validate-settlement`, `process-settlement-image`); 11 cron functions use weak `if (cronSecret && ...)` guard that opens fully if env var missing.
- **[04 — Schedule + Cascade](./04-schedule-cascade.md):** ADR-0204 SS-5 transactional atomicity gap — `gate.ts:93` `execute` is a sentinel no-op; gate evaluation row + domain write are in separate transactions.
- **[05 — Mobile Surface](./05-mobile-surface.md):** `ShiftTimelineContainer.tsx:46` corrupts `activity_trail` with `actorId = profile?.profile_id ?? "anonymous"` — passes `nonEmpty()`, fails identity.
- **[06 — Contracts + Payroll + Lovsen](./06-contracts-payroll-lovsen.md):** `legal/classify_amendment` declares ADR-0099 gate in docstring + ADR-0249 mandate but execute body has zero gate calls.
- **[07 — DB + RLS + Telemetry](./07-db-rls-telemetry.md):** `channel_department_access` + `channel_team_access` zero-policy lockout (RLS enabled, all policies commented out); `gatedMutation()` SS-5 path emits nothing — 7 capability tools dark to telemetry; 11 mobile offline actions dark.
- **[08 — Journeys](./08-journeys.md):** 190/201 journey docs have zero E2E coverage; engine processes use slug conventions that don't match JOURNEY-*.md naming — no traceability index exists.
- **[09 — ADR Coverage Gaps](./09-adr-coverage-gaps.md):** Decision log has 8+ duplicate rows (same ADR with proposed + accepted); 4 ADRs (0151/0168/0169/0192) are accepted in code but say proposed in log.
- **[10 — Onboarding Wizard](./10-onboarding-wizard.md):** ADR-0041 describes `STEP_COMPONENTS` + `WizardContext` runtime architecture that is no longer used; `page.tsx` uses `AnimatedWizardShell` and emits zero finalization telemetry.
- **[11 — Performance + Design](./11-performance-design.md):** Turbopack switch BLOCKED — `next.config.ts:88-149` webpack alias block coexists with Turbopack `resolveAlias` block, equivalence untested; `perf-budgets` CI job absent (ADR-0019 promises it, no workflow enforces it).
- **[12 — i18n + Frontmatter](./12-i18n-frontmatter.md):** i18n infrastructure complete but adopted in only 9.5% (166/1754) source files — `Lagre`/`Avbryt`/`Slett` etc. defined in common.json, hardcoded everywhere.
- **[13 — Webhook Integration](./13-webhook-integration.md):** `docuseal-webhook` is signature-optional AND uses raw-secret string equality (timing leak + DocuSeal sends HMAC, not raw secret — current check will reject valid HMAC requests).
- **[14 — Missions + E2E Protocols](./14-missions-e2e.md):** Only one Playwright Protocol (P-001) exists, permanently skipped on missing `data-testid`s — protocol pipeline produces zero generated artifacts despite full runner infrastructure.

---

## Total Counts

- **Total findings (deduped):** 87 (across 14 slices, with cross-slice duplicates merged)
- **Critical:** 5
- **High:** 18
- **Medium:** 38
- **Low / Info:** 26

The CRITICAL set is dominated by **two themes**: unauthenticated mutation surfaces (engine-dispatch / validate-settlement / process-settlement-image / docuseal-webhook) and capability-gate-bypass-by-omission (journey-authoring publishDraft + legal classify_amendment). Both are root causes that recur across slices once the slice authors traced into the relevant subsystems.
