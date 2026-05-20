---
title: "ADR + Contract Audit Synthesis — 2026-05-12"
status: done
created: 2026-05-12
updated: 2026-05-12
mode: full
run_id: 2026-05-12-adr-contract-validation
slices_run: 14
slices_critical: 4
slices_high: 20
findings_total: 76
baseline: 2026-05-10-adr-contract-validation
campaign: campaign/payroll
campaign_status: merged-to-development-at-1624-UTC
module: audit
tags: [audit, synthesis, adr, contract-validation, payroll]
---

# ADR + Contract Audit Synthesis — 2026-05-12

## Executive Summary

Two days after the 2026-05-10 audit, `campaign/payroll` merged to development at 16:24 UTC (commit `5dc099d022`). This audit ran immediately post-merge to baseline the new state. The headline shift versus 2026-05-10: the Phase E voice-plane promotion-blockers (F-AC-02 landing wizard, F-SE-01 multi-tenant voice derivation) appear to have been addressed in the intervening campaigns and do not re-surface, but **four new CRITICAL findings have landed**, three of them post-payroll-merge: an unauthenticated Edge Function reading workspace Storage by body-supplied workspace_id, a capability-name mismatch between ADR-0259 and the seeded `engine_authority_config` row that risks default-allow on Lovsen queries, an `overtime_cap_policy` schema gap that blocks ADR-0254 / Phase 5 / ADR-0245 push triggers, and `typescript.ignoreBuildErrors: true` in `apps/web/next.config.ts` silently disabling the production-build type gate.

The dominant theme of this audit is **authority-gate compliance drift in the payroll surface**: 15 payroll mutation tools use `callGateAction` (Pathway A only) and zero use `gatedMutation` (Pathway A + B), with no ADR documenting the exception. ADR-0204 SS-5 backlog continues to grow rather than shrink. Two payroll mutation tools (`lockPeriod`, `addManualSupplement`) are missing the `capability:` field in their `defineTool` declarations, breaking ADR-0099 authority lookup. The post-merge state is broadly safe to development but **NOT SAFE TO PROMOTE TO PREVIEW** until C-01 (ADR-0259 capability-name mismatch) and EF-01 (analyze-setup-documents auth bypass) are closed — both are CVE-class.

Secondary themes: nine proposed ADRs continue to accumulate code references without acceptance (ADR-0151 alone has 194 references), 170 accepted ADRs have no audit slice coverage, the journey-doc canonical heading format is broken in 170 of 290 files (blocking generator output), and the mobile surface still ships a hidden `(payroll)/` route group that ADR-0133 R4 mandates be deleted plus dead Ultravox session refs in the BotssonProvider.

---

## Severity Counts (Global)

| Severity | Count | Notes |
|----------|-------|-------|
| CRITICAL | 4 | EF-01, C-01, C-02, PERF-001 |
| HIGH | 20 | Authority gate, PII routing, mobile orphans, journey heading drift, performance CI |
| MEDIUM | 27 | Schema gaps, RLS edge cases, telemetry destinations, i18n, mid-campaign churn |
| LOW | 25 | Hygiene, dead code, stale comments, frontmatter gaps |

### Per-Slice Severity

| Slice | CRITICAL | HIGH | MEDIUM | LOW |
|-------|----------|------|--------|-----|
| 01 capability-tools | 0 | 2 | 2 | 1 |
| 02 stage-engine-bff | 0 | 1 | 2 | 2 |
| 03 edge-functions | 1 | 2 | 3 | 1 |
| 04 schedule-cascade | 0 | 1 | 3 | 1 |
| 05 mobile-surface | 0 | 3 | 2 | 2 |
| 06 contracts-payroll-lovsen | 2 | 3 | 3 | 0 (4 PASS) |
| 07 db-rls-telemetry | 0 | 2 | 3 | 3 |
| 08 journeys | 0 | 2 | 2 | 1 |
| 09 adr-coverage-gaps | 0 | 0 | 0 | 0 (coverage report) |
| 10 onboarding-wizard | 0 | 2 | 2 | 7 |
| 11 performance-design | 1 | 1 | 1 | 1 |
| 12 i18n-frontmatter | 0 | 1 | 2 | 2 |
| 13 webhook-integration | 0 | 1 | 3 | 1 |
| 14 missions-e2e | 0 | 0 | 3 | 2 |

---

## CRITICAL Findings (4)

### CR-1 — EF-01: `analyze-setup-documents` Edge Function auth bypass (slice 03)

**File:** `supabase/functions/analyze-setup-documents/index.ts:197-222`
**ADR:** ADR-0029
**Evidence:** Function checks for presence of `Authorization` header but never calls `getUser()` to validate the token. `workspace_id` is taken from the request body with no ownership verification. Service-role client created unconditionally and used to download Storage documents. Any bearer token (even malformed) passes the gate.
**Impact:** Cross-workspace Storage read by guessing/forging workspace_id UUID. ADR-0151 sibling — silent workspace-mismatch class (per L-0177).
**Remediation:** Add `getUser()` validation; verify caller is member of the supplied `workspace_id` via `get_workspace_ids_for_user()` or RLS-checked select before service-role Storage access. Browser-invoked path also violates ADR-0029 (EF-04 covers the broader pattern).

### CR-2 — C-01: ADR-0259 capability-name mismatch creates default-allow path (slice 06)

**File:** `supabase/migrations/20260520130000_legal_capability_authority_seed.sql:77,106`
**ADR:** ADR-0259
**Evidence:** ADR-0259 Decision Outcome seeds capability `industry_intelligence.lovsen_query`. The seed migration at lines 77 and 106 seeds capability `legal`. The code capability in `packages/ai/src/capabilities/legal/index.ts` is also named `legal`. The `engine_authority_config` lookup keys on capability name. If the router or any caller dispatches as `industry_intelligence.lovsen_query` (matching ADR-0259 spec), no row matches and `gate_action` falls through to default-allow (CVE-class per ADR-0189 pattern).
**Impact:** Lovsen legal query gate may silently pass-through depending on caller-side capability string resolution. Direct sibling of ADR-0189 authority-seed-parity violation.
**Remediation:** Either (a) amend ADR-0259 to document the rename to `legal`, register supersession; or (b) seed both names. Verify router resolution path uses single canonical name. Run authority-seed-parity CI check (per ADR-0189) and fail if either name is unseeded.

### CR-3 — C-02: ADR-0254 `overtime_cap_policy` table absent — Phase 5 / ADR-0245 push-triggers blocked (slice 06)

**File:** `packages/supabase/src/database.types.ts` (no `overtime_cap_policy` table)
**ADR:** ADR-0254 (proposed)
**Evidence:** ADR-0254 §4.A defines `overtime_cap_policy` table with DB-enforced Aml. §10-6 CHECK constraints. Table absent from `database.types.ts` — no migration shipped. `employment_contract.overtime_cap_policy_id` FK also absent. Downstream consequences: (1) PLAN Phase 5 80%-overtime engine_event has no numeric source; (2) ADR-0245 §H `contract.overtime_cap_warning_threshold_crossed` event cannot be emitted; (3) `contract_pay_rule` overtime evaluations rely on hardcoded values which ADR-0254 §7 explicitly forbids.
**Impact:** Phase 5 cap-check and mobile push-trigger for overtime warnings unimplementable. Hardcoded compliance values shipping today.
**Remediation:** Land migration for `overtime_cap_policy` table + `employment_contract.overtime_cap_policy_id` FK + Aml. §10-6 CHECK constraints before Phase 5 or ADR-0245 push code merges.

### CR-4 — PERF-001: `typescript.ignoreBuildErrors: true` silently disables production-build type gate (slice 11)

**File:** `apps/web/next.config.ts:192`
**ADR:** ADR-0019
**Evidence:** `ignoreBuildErrors: true` set with comment claiming "first-rollout" workaround on 2026-05-04 for "merge-induced telemetry-brand gap." Promises type errors "still surface in dev/CI" — but `next build` will not fail on type errors, so the `build-health` CI job cannot catch type-level regressions introduced between typecheck and the final production bundle. No expiry date, no ADR exemption registered.
**Impact:** Permanent disablement of the production-build half of ADR-0019's gate. Type errors in production-only paths (e.g. `.next/types/**` generated validators) ship silently.
**Remediation:** Resolve the telemetry-brand gap typecheck errors and remove the flag, or register a formal exemption with `exemptionExpiresOn` date in ADR-0019.

---

## HIGH Findings (top 10 by impact)

| ID | Slice | ADR | File:line | One-liner |
|----|-------|-----|-----------|-----------|
| F-01 | 01 | ADR-0204 | `packages/ai/src/capabilities/payroll/tools.ts` (15 tools) | All 15 payroll mutation tools use `callGateAction` (Pathway A only); zero use `gatedMutation`. No ADR exempts payroll from dual-gate mandate. |
| F-02 | 01 | ADR-0151 | `packages/ai/src/capabilities/governance/tools.ts:62-67` | `protocol_assignment` query omits `.eq("workspace_id", ctx.workspaceId)` under service-role — cross-workspace assignment leak. |
| F-02-01 | 02 | ADR-0151 | `apps/web/src/app/api/botsson/chat/route.ts:191` + `emma/chat/route.ts:234` | BFF forwards `profile_id` in body to stage-engine; stripped by Zod today but maintenance trap if `.passthrough()` ever added. |
| EF-02 | 03 | ADR-0078 | `supabase/functions/engine-dispatch/index.ts:1613-1637` | `start_process` handler spawns sub-process `engine_state` without reading `engine_process.allowed_channels` — Layer 1 gate absent. |
| EF-03 | 03 | ADR-0029 | `apps/web/src/app/onboarding/hooks/useOnboardingState.ts:612` | `identify-company` invoked directly from browser; workspace provisioning path browser-callable. |
| SC-01 | 04 | ADR-0091, ADR-0204 | `apps/web/src/app/dashboard/schedule/_hooks/use-shift-swap.ts:224` | `useApproveSwap` calls `approve_shift_swap` RPC directly with no `gate_action`/`gatedMutation`. C4 authority bypass on admin shift-swap approval. |
| F-02 | 05 | ADR-0133 R4 | `apps/mobile/app/(app)/(me)/payroll/` | `(payroll)/` group reachable on mobile; R4 mandates deletion. Ships `payslip.tsx`, `payslip-detail.tsx`. |
| H-01 | 06 | ADR-0076 | `packages/ai/src/capabilities/contract/tools.ts:246-380` | `createEmployeeContract` calls contract-service directly, bypassing required cascade derivation `change_proposal`. No compliance validation against `regulatory_framework`. |
| H-002 | 08 | ADR-0031 | 170 of 290 `docs/journeys/JOURNEY-*.md` | Non-canonical heading format (`# Journey:` / `## Journey 1:`) breaks `generateE2ETest()` + `generateLinearSpec()` parser input. Payroll journeys shipped today use `# Journey:` (h1). |
| OW-01/02 | 10 | ADR-0134 | `apps/web/src/app/onboarding/page.tsx:32` + `AnimatedWizardShell.tsx:102-104` | `actor_id: "anonymous"` emitted on mount before auth resolves; `nonEmpty()` passes the sentinel string. Duplicate `wizard started` event fires when auth context resolves. |

**Remaining HIGH (10 more):** F-07-01 supplement_rule_match RLS gap (fixed same campaign); F-07-02 admin_filled_pii engine_event routing; F-03 mobile Ultravox session ref; H-02 tariff_revision_kind column gap; H-03 stale ADR-0235 citation in classify_amendment; PERF-002 perf-budgets CI job absent; F12-01 61 .tsx files with zero i18n infrastructure; CF-13-01 ADR-0142 contradicts ADR-0120 §8 on credit-note sign; F-04 mobile BotssonProvider Ultravox comment header; H-001 SEASON_LIFECYCLE_MISSION_ID absent from MissionIdSchema.

---

## Theme Rollup

### Theme 1: Authority Gate Compliance (CRITICAL/HIGH × 8)

`callGateAction` Pathway A only across 15 payroll tools, 3 journey runner tools (PARTIAL), 1 shift-swap RPC bypass, 1 sub-process spawning gap, 1 governance workspace_id leak. ADR-0204 SS-5 backlog growing — payroll campaign shipped without `gatedMutation` migration. ADR-0099 capability-field misses on `lockPeriod` + `addManualSupplement`. C-01 (ADR-0259 capability-name mismatch) is the apex of this theme: gate may default-allow under specific call paths.

### Theme 2: PII Safety & ADR-0077 (MEDIUM × 2)

`payroll.admin_filled_pii` routes to `engine_event` while sibling `personal_number_revealed` + `bank_account_revealed` events intentionally exclude it. `engine_memory` PII redaction at write is present (`session-recorder.ts:14`) but `expires_at = NOW() + 7 days` auto-set for `sensitivity='pii'` rows not confirmed in migration. `MissingInfoSheet` no-echo for admin-fill (ADR-0077 SMA-305) PASSED.

### Theme 3: Workspace Isolation (CRITICAL × 1, HIGH × 1)

EF-01 (analyze-setup-documents) is the standout: body-supplied `workspace_id` + service-role + no caller-ownership check. Governance F-02 is the same class scoped to capability tools. Both fall under L-0177 silent-fallback pattern. Mobile telemetry contract (ADR-0134) verified clean — no `actor_id="anonymous"` fallbacks on mobile; the wizard does have it (OW-01).

### Theme 4: ADR Drift & Acceptance Gap (CRITICAL × 1, HIGH × 1)

ADR-0259 ↔ seed migration name mismatch (C-01). ADR-0142 prose contradicts ADR-0120 §8 on credit-note sign (CF-13-01) — code is correct, ADR text wrong. Stale citation H-03 (`classify_amendment` TODO cites ADR-0235 Helpdesk SLA instead of ADR-0243 field classification). 170 accepted ADRs have no audit slice coverage. 33 proposed ADRs have ≥5 code references (ADR-0151 leads with 194).

### Theme 5: Mobile Surface (HIGH × 3, MEDIUM × 2, LOW × 2)

`MOBILE_IA_CONTRACT.md` does not exist (R4). `(payroll)/` group not deleted (R4) — reachable on mobile shipping `payslip.tsx`. BotssonProvider retains `voiceSessionRef` (Ultravox legacy) at lines 7, 42, 147, 242 — dead code that mutates on voice events. Header comment claims Ultravox WebRTC despite LiveKit being live (ADR-0135). 5 UI labels still say "Lønnsslipp" — per memory note 2026-05-08, must read "lønnsgrunnlag." Mobile telemetry contract (ADR-0134) compliant; ADR-0132 thin-client compliant.

### Theme 6: Telemetry Destinations (MEDIUM × 3, LOW × 2)

`payroll.supplement_rule_test_run` → posthog only (no `activity_trail`); admin probe leaves no audit record — Arbeidstilsynet compliance gap. `payroll.supplement_rule_fired` + `payroll.timebank_accrued` lack `logger` destination, blocking real-time stdout debugging. `payroll.admin_filled_pii` engine_event inclusion rationale thin.

---

## Coverage Gaps (Slice 09)

- **Total accepted ADRs:** 204
- **Covered by slices 01-08, 10-14:** 34 distinct
- **Uncovered accepted:** 170
- **Uncovered high-enforcement subset:** 17 (ADR-0057, 0081, 0099, 0110, 0111, 0112, 0114, 0117, 0189, 0190, 0195, 0207, 0262, 0263, 0292, 0293, 0294) — payroll schema separation, admin PII RPC path, authority parity CI checks, server-action mutation primitive, admin file download 302-redirects, payroll override-applier supersession-chain, PDF library footer content
- **Orphan proposed with ≥5 code refs:** 33 — top 5: ADR-0151 (194 refs), ADR-0176 (54), ADR-0173 (37), ADR-0175 (35), ADR-0193 (21)
- **Recommended:** Slice 15 (Payroll + Authority Gate Compliance) and Slice 16 (Orphan-Proposed Acceptance Gate)

---

## Delta vs 2026-05-10 Baseline

| Status | Count | Notes |
|--------|-------|-------|
| New CRITICAL | 4 | EF-01 (analyze-setup-documents auth bypass), C-01 (ADR-0259 capability mismatch), C-02 (overtime_cap_policy schema gap), PERF-001 (ignoreBuildErrors) |
| Regressed | 0 | F-AC-02 (landing wizard broken route) and F-SE-01 (multi-tenant voice derivation) from 2026-05-10 do NOT re-surface — apparently closed by Phase F0 sortie or intervening campaign work. Verify before claiming closed. |
| Closed (CRITICAL from baseline) | 2 | F-AC-02 not found in any slice this audit; F-SE-01 voice workspace derivation not surfaced |
| Unchanged open | ~15 | ADR-0204 SS-5 backlog (now expanded with payroll tools), L-0176 docstring drift pattern (5th occurrence trend continues), ADR-0246/0247/0248 still proposed, F-PD-01 perf-budgets CI absent, F-DB-03 salary_type/end_date_reason RLS, F-SE-05 BFF profile_id leak (re-surfaced as F-02-01 this audit) |
| New HIGH | ~12 | Payroll-campaign-introduced authority gate gaps, journey heading drift on payroll docs, mobile (payroll) group, OW-01/02 anonymous actor |

**Note:** The 2026-05-10 CRITICAL (F-AC-02 landing wizard) does not re-appear in slice 03 or 14. Either (a) the route was fixed/disabled in intervening commits or (b) it was out of scope for this audit's slice scoping. Recommend explicit verification.

---

## Top 5 Remediation Candidates

### 1. EF-01 — `analyze-setup-documents` auth bypass (CRITICAL — promotion-blocker)

**File:** `supabase/functions/analyze-setup-documents/index.ts:197-222`
**Fix sketch:** Replace bare `Authorization` header check with `const { data: { user } } = await supabase.auth.getUser(token); if (!user) return 401; const memberships = await getWorkspaceIdsForUser(user.id); if (!memberships.includes(body.workspace_id)) return 403;` BEFORE any service-role Storage access. Wrap function invocation in a Next.js route handler per ADR-0029.
**Estimated:** 1 day. Mechanical.

### 2. C-01 — ADR-0259 capability-name reconciliation (CRITICAL — gate default-allow)

**Files:** `supabase/migrations/20260520130000_legal_capability_authority_seed.sql:77,106` + `docs/decisions/0259-*.md` + `packages/ai/src/router/`
**Fix sketch:** Verify which capability name the router actually resolves to. Either (a) seed both `legal` and `industry_intelligence.lovsen_query` rows, or (b) amend ADR-0259 to document the rename to `legal` and run the ADR-0189 authority-seed-parity CI check. The CI check is the canonical gate — if it doesn't catch this, it's incomplete.
**Estimated:** 0.5 day mechanical + ADR amendment.

### 3. F-01 — ADR-0204 dual-gate migration for payroll mutation tools (HIGH — SS-5 backlog)

**File:** `packages/ai/src/capabilities/payroll/tools.ts` (15 tools)
**Fix sketch:** Either (a) document explicit exemption with new ADR explaining why payroll is single-gate (and update CLAUDE.md "What NOT To Do"), or (b) migrate all 15 tools to `gatedMutation` wrapping `callGateAction` per the existing pattern in `engine-world/tools.ts:report_observation`. Bundle with F-03/F-04 (missing `capability:` field on `lockPeriod` + `addManualSupplement`).
**Estimated:** 2-3 days.

### 4. C-02 — `overtime_cap_policy` table migration (CRITICAL — Phase 5 blocker)

**Files:** new migration + `database.types.ts` regen + `employment_contract.overtime_cap_policy_id` FK
**Fix sketch:** Land ADR-0254 §4 schema as proposed (table + FK + Aml. §10-6 CHECK). Move ADR-0254 from `proposed` to `accepted` simultaneously. Required before Phase 5 80%-overtime engine_event or ADR-0245 mobile push triggers can ship.
**Estimated:** 1 day migration + types regen.

### 5. H-002 — Journey heading canonical-form rewrite (HIGH — generator input broken)

**Files:** 170 `docs/journeys/JOURNEY-*.md` (including 25 payroll JOURNEY-* shipped today)
**Fix sketch:** Mechanical rewrite from `# Journey:` / `## Journey 1:` / `## Happy Path` to canonical `## Journey: [Role] [Action]` with Precondition/steps/Postcondition/Error paths block. Payroll journeys (25 files, in-progress this campaign) should be fixed first; older 145 files in batched sortie. Verify `generateE2ETest()` parser regex against fixed format before bulk-rewrite.
**Estimated:** 0.5 day for payroll journeys; 1 day for the remainder.

---

## Verified Intentional (False Positives Confirmed)

| Pattern | Slice | Why |
|---------|-------|-----|
| FP-001 `validate_aml_14_6` channel inversion (Layer 1 voice + Layer 3 chat-only body guard) | 01, 06 | Layer 1 = perimeter union; Layer 3 = defence-in-depth. Working as designed. |
| FP-002 `HOSPITALITY_TARIFF_RATES` "wrong rates" | 04 | Confirmed correct 2024 satser. Observability gap separate finding. |
| FP-003 `useRoster` dept filter bug | 04 | Hook uses `position!inner` join, not direct `.eq("department_id")`. |
| `tips` capability `{ok:false, error:"not_implemented"}` skeleton | 02 | ADR-0261 + ADR-0196 Invariant 11 — Tips Phase 0 stub, zero emit, zero DB writes. Working as designed. |
| `payroll.timebank_accrued` + `supplement_rule_fired` → `activity_trail` only | 07 | Registry comment confirms intentional PostHog flood prevention per spec §9. |
| `supplement_rule.workspace_id` nullable | 07 | Platform-level Riksavtalen template (NULL) vs workspace override (uuid). RLS handles both correctly. |
| `stripe-webhook` `actor_id: null` / `workspace_id: null` | 13 | Stripe events are platform-level (company-scoped, not workspace-scoped). |
| `(me)/payroll` sub-route on mobile | 05 | Read-only personal payroll; not an authoring surface. R4 deletion mandate refers to top-level route group. Cleared with cleanup of UI labels. |
| `BotssonProvider` on `/onboarding` voice-only (no `BotssonShell` Orb) | 10 | ADR-0238 dual-surface concern does not apply — no competing chat surface. |
| `AgentControlPanel.tsx` Norwegian system-prompt strings | 12 | Dev debug panel; not user-visible JSX text. Multilingual concern only. |
| `LineDrawer.tsx` Riksavtalen citation tooltips | 12 | Legal text language-fixed by nature. UI labels on same file ARE violations. |

---

## Conclusion

Post-payroll-merge state: **safe for development branch, NOT SAFE for promotion to preview** until CR-1 (EF-01) and CR-2 (C-01) are closed. CR-3 (overtime_cap_policy) and CR-4 (ignoreBuildErrors) are non-blocking for current shipped surface but block Phase 5 and degrade build-quality gating respectively.

Authority-gate compliance in the payroll surface is the recurring structural debt and should be the next architectural sortie. ADR-0204 SS-5 migration needs to be planned and executed; backlog continues to grow. The L-0176 docstring-vs-body drift pattern noted in baseline did not re-surface in payroll (slice 06 H-03 is stale-ADR-citation, a sibling pattern but distinct). The mobile `(payroll)/` group and "Lønnsslipp" UI labels (memory 2026-05-08) need a focused mobile sortie.

170 uncovered accepted ADRs and 33 orphan-proposed ADRs with code references means the audit-coverage gap is wider than the deduplicated finding set suggests. Slices 15 + 16 recommended for the next audit cycle.

*Audit complete. 14 slices. 76 deduplicated findings. 4 CRITICAL. 20 HIGH. NOT SAFE TO PROMOTE without CR-1 + CR-2 closure.*
