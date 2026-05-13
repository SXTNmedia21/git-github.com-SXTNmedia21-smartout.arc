---
title: "ADR + Contract Audit Synthesis — 2026-05-13"
status: complete
created: 2026-05-13
updated: 2026-05-13
mode: full
run_id: 2026-05-13-adr-contract-validation
slices_run: 14
baseline: 2026-05-10-adr-contract-validation
tags: [audit, synthesis, adr, contract-validation]
---

# ADR + Contract Audit Synthesis — 2026-05-13

## Executive Summary

Three days after 2026-05-10, the campaign that closed the Phase E voice-plane CRITICALs has produced **three NEW CRITICAL findings**, the largest being a **sister-table re-occurrence of the exact gap ADR-0299 was written to close**. The audit also confirms F-AC-02 (landing wizard → deleted endpoint) was REAL: a separate but morphologically identical CRITICAL has surfaced on `/onboarding`, which is **half-migrated** — 17 legacy scroll-wizard files still mounted as importable dead code, three of them performing ADR-0123 EF-violation calls that activate the moment anything renders them.

The single most defining theme is **regression on D6 mutation governance**. ADR-0204 SS-5 backlog has grown from 7 hooks (2026-05-10) to **13+ hooks plus 2 brand-new direct-DB-write sites** in `OversiktTab.tsx:257` and `EventDetailPanel.tsx:299,319` — meaning the canonical ADR-0156 day-control surface is now itself a violator of its own audit-integrity driver. Voice-tool writes from 2026-05-10 baseline were NOT remediated; they were joined by inline mutations inside React render closures.

The second defining theme is **sister-table blindness on RLS hardening**. `shift_approval` got per-verb WITH CHECK (Sortie A, ADR-0299) — but the **identical `FOR ALL USING(...)` no-WITH-CHECK shape persists on `department_session`, `session_hook`, `deviation`, and `personal_task`**. ADR-0299's Sortie A scope explicitly excluded these. By ADR-0299's own classification of the gap class, all four are CRITICAL D6 holes.

Third theme: **multi-tenant blind spots keep landing**. Slice 02 confirms F-SE-01 (voice cross-tenant workspace derivation) is CLOSED. But a **new** ADR-0151 violation surfaced one layer up: `botsson/chat` BFF injects `body.primeContext.profileId` directly into the LLM-visible system prompt (SE-02-01). Mobile re-introduced two new client-side-`workspace_id` violations on PII intake (`submit_own_pii`) and reconciliation. Five intelligence Edge Functions (gather/google-places/web-search/scrape/search-brreg) are **open-internet endpoints** with ZERO authentication, billed against Smartout's external API quotas. F-EF-03 alone is an active money/abuse vector, not a theoretical one.

Fourth theme: **ADR drift hygiene**. ADR-0287 (gate-action mandatory) has been `proposed` for 20+ days with the CI script and `mutateWithGate()` helper documented but not shipped — every capability merge in the gap is a regression vector. ADR-0268 (5-tab mobile) conflicts with code shipping 7 tab groups. ADR-0273 is future-dated 2026-05-25. Three accepted ADRs (0220, 0260) have no code surface; one stale proposal (0053) is 36 days old with zero implementation.

**Verdict:** Campaign promotion blocked on 3 CRITICAL + the F-EF-03 quota-abuse vector. The 3 CRITICALs are all sister-table or sister-surface gaps of issues we believed closed — the system is converging on the right shape but the converged shape doesn't always propagate.

---

## Critical Findings — Top 10 Ranked

| # | ID | Sev | Theme | File:Line | ADR | Why ranked here |
|---|---|---|---|---|---|---|
| 1 | F-DB-09 | CRITICAL | RLS hardening | `20260304200000_department_session.sql:65-73`, `20260412100300_session_infrastructure.sql:40-48`, `20260304200200_deviation_shift_approval.sql:92-95` | 0299 | Three D6 sister tables retain the exact `FOR ALL USING(...)` no-WITH-CHECK shape that ADR-0299 classified as a ≥30-policy class hole. Forgeable `workspace_id` on INSERT/UPDATE for any admin+ tier user with two workspace memberships. `deviation` has no role gate at all — any workspace member can mutate any deviation row. |
| 2 | F-OB-10-01 | CRITICAL | Onboarding rot | `apps/web/src/app/onboarding/{WizardContext.tsx, hooks/*, sections/*, components/*}` | 0041 | `/onboarding` runtime moved to `AnimatedWizardShell` but ~17 legacy files still mounted as importable dead code. Each would throw `useOnboarding must be used within OnboardingProvider`. Three of them (`useOnboardingState.ts:433,585,657`) perform ADR-0123-violating EF calls that activate on any revival. ADR-0041 "superseded" status is fictional until cleanup. CLOSED 2026-05-13 by feat/audit-fob10-onboarding-cleanup |
| 3 | F-CL-11 | CRITICAL | Voice/PII boundary | `packages/ai/src/capabilities/legal/index.ts:57` | 0163 | `legalCapability.allowedChannels: ["chat","voice","system"]` violates ADR-0163 §rule 4 explicitly: any capability handling contract content (§14-6, AML) MUST be `["chat"]`. L3 tool-body block exists; L2 capability-surface defence-in-depth is gone. AML §14-6 validation surface declares voice. |
| 4 | F-EF-03 | HIGH (treats as CRITICAL ops impact) | Auth perimeter | `supabase/functions/{gather-workspace-intelligence, google-places-intelligence, web-search-intelligence, scrape-website, search-brreg}/index.ts` | 0029, 0039 | All 5 set `verify_jwt = false` AND have ZERO internal auth check AND NO signature verification. Each proxies a paid external API. Open-internet POST endpoint burns Smartout's Scrapling/Serper/Google Places/Brreg quotas. Active money vector. |
| 5 | F-SC-04-15 | HIGH | ADR-0204 regression | `apps/web/src/components/day/EventDetailPanel.tsx:299,319` | 0091, 0156, 0204 | New since 2026-05-10. Two `deviation.update` calls inside React `startTransition`. No gate, no Server Action, no `emit()`. Direct DB write from inside the ADR-0156 day-control widget that ADR-0156 forbids from owning Supabase access. Materially violates ADR-0156's own audit-integrity driver. |
| 6 | F-SC-04-13 | HIGH | ADR-0204 regression | `apps/web/src/components/day/_components/day-control/OversiktTab.tsx:257` | 0091, 0156, 0204 | New since 2026-05-10. `department_session.update({duty_leader_id})` inline async inside `<select onChange>`. D6 production-table mutation from React render closure. Same pattern as #5 on a different widget. |
| 7 | F-SC-04-09 | HIGH | ADR-0204 backlog | `apps/web/src/app/dashboard/schedule/_hooks/use-employee-roster.ts:333` | 0091, 0204 | `useAutoFillShifts` bulk inserts entire week of `schedule_shift` rows with zero gate. Single user action writes 50+ shifts bypassing capability + cascade-rule evaluation. Highest blast radius of the 15 SS-5 hook findings. |
| 8 | SE-02-01 | HIGH | ADR-0151 spirit | `apps/web/src/app/api/botsson/chat/route.ts:142-149` | 0151, 0042 | Body-supplied `body.primeContext.profileId` interpolated directly into LLM-visible system prompt text. Distinct from G9 (closed). Admin can feed agent a false employee identity as display context. Not used as DB key — risk is LLM confusion + audit-trail pollution, not unauthorized DB access. |
| 9 | F-DB-11 | HIGH | ADR drift | `scripts/gate-action-coverage.ts` (missing), `mutateWithGate()` (missing), `.github/workflows/gate-action-coverage.yml` (missing) | 0287 | ADR-0287 has been `proposed` for 20+ days with concrete implementation plan in the ADR text. None of the three documented controls shipped. Every capability merge in the gap window is a regression risk against the rule the ADR was written to enforce. |
| 10 | F-MO-06 | HIGH | Mobile boundary | `apps/mobile/src/app/(me)/contract/complete-data.tsx:86,105` | 0132, 0151 | Mobile PII intake invokes `submit_own_pii` RPC with a body-supplied `p_workspace_id` from `profile?.workspace_id`. Highest-risk mobile surface for workspace-context leak. Violates "mobile thin client" + "server-derived workspace" simultaneously on a PII path. |

---

## Theme Rollup

| Theme | C | H | M | L | Worst offender |
|---|---|---|---|---|---|
| RLS hardening (ADR-0299 sister tables, WITH CHECK gaps) | 1 | 2 | 1 | 0 | F-DB-09 (3 D6 tables `FOR ALL USING` no WITH CHECK) |
| Onboarding/wizard rot + ADR-0123 latent drift | 1 | 2 | 1 | 1 | F-OB-10-01 (17 legacy files mounted as dead code) |
| Voice/channel/PII boundary (ADR-0163, ADR-0151) | 1 | 1 | 1 | 0 | F-CL-11 (legal capability declares voice on §14-6) |
| Edge Function auth + ADR-0179 | 0 | 3 | 2 | 0 | F-EF-03 (5 unauthenticated paid-API proxies) |
| ADR-0204/0091 D6 mutation governance | 0 | 15 | 1 | 0 | F-SC-04-15 + F-SC-04-09 (new + bulk-insert) |
| Capability tool gate/emit drift (ADR-0186, ADR-0287) | 0 | 1 | 4 | 2 | F-CT-01 (journey-authoring zero emit on writes) |
| Mobile telemetry + boundary (ADR-0132/0133/0134/0151) | 0 | 6 | 3 | 0 | F-MO-06 (mobile-direct `submit_own_pii` RPC) |
| Payroll Phase 2/3 sync (ADR-0293/0295) | 0 | 2 | 1 | 1 | F-CL-12 (recalc skipped on capability path) |
| Webhook integrity (ADR-0079, 0142) | 0 | 1 | 2 | 3 | F-WH-04 (call_log no UNIQUE on session_id) |
| Missions/E2E coverage (ADR-0038) | 0 | 2 | 2 | 3 | F-ME-01 (zero E2E for 7 missions) |
| Journeys/ADR drift (ADR-0031, 0268, 0273, 0260, 0274, 0278) | 0 | 0 | 4 | 6 | ADR-0268 mobile 5-tab vs 7-tab reality |
| Stage-engine/BFF (ADR-0042, 0289, 0296) | 0 | 1 | 1 | 1 | SE-02-01 (primeContext.profileId injection) |
| Performance & design (ADR-0019) | 0 | 2 | 3 | 2 | F-02 (landing Sentry source-map unconditional) |
| i18n adoption + frontmatter | 0 | 2 | 1 | 1 | 15% i18n adoption + 38 hardcoded NO toasts |
| **TOTALS** | **3** | **40** | **26** | **20** | (89 total findings after dedup) |

Notes on counts:
- Slice 04 reports 15 HIGH but they share root cause (ADR-0204 backlog) — counted as 15 individual hooks here for theme integrity.
- F-EF-03 listed under HIGH bucket per slice 03 severity, but treated as CRITICAL in operational ranking due to active quota-abuse vector.
- F-DB-09 contains three distinct tables sharing one root cause; counted once at CRITICAL.

---

## ADR Conflict Table — Claimed Status vs Reality

| ADR | Status (frontmatter) | Reality | Gap |
|---|---|---|---|
| 0031 | accepted | Migration ships schema-only; only `onboarding` journey seeded; claim "68 journeys seeded" is not met | Seed gap — needs migration or text revision |
| 0041 | superseded | Runtime moved; ~17 legacy files still on disk and importable | Cleanup never completed |
| 0053 | proposed (36 days) | No `services/simulator/`, no simulation migration | Ship-or-kill required |
| 0056 | done (non-canonical status) | Implementation present; status enum should be `accepted` | Frontmatter normalization |
| 0137 / 0138 / 0139 | draft | 0137/0138 effectively superseded by 0203/0207/0287; 0139 token unverified | Close as superseded |
| 0152 | proposed | Code already enforces non-empty IDs; effectively superseded by 0193 | Promote-then-supersede or fold |
| 0163 | accepted | `legal/index.ts:57` declares voice on §14-6 content — direct contradiction | F-CL-11 violation |
| 0179 | accepted | `wizard-definition.ts:295` + `useOnboardingState.ts:433,585,657` invoke EFs from browser | F-EF-02a + F-EF-04 violations |
| 0204 | accepted | 13+ mutation hooks bypass; 2 new violations since 2026-05-10 | Backlog growing not shrinking |
| 0220 | accepted | No `apps/web/src/components/botsson/` directory matches "Botsson Conversational Front Door" | Surface-text drift |
| 0260 | proposed (15 days) | Cabinet Grotesk: zero hits in repo | Kill or schedule |
| 0268 | proposed | Code ships 7 tab groups, spec says 5 | Reconcile (slice 05 owner) |
| 0273 | proposed | `created: 2026-05-25` is 12 days future-dated | Mechanical date fix |
| 0274 / 0278 | proposed (9 days) | `mission_run` table absent; `*governance*` workflow absent | Spec-only — ship or strike |
| 0287 | proposed (20 days) | `gate-action-coverage.ts` missing; `mutateWithGate()` missing; CI workflow missing | F-DB-11 — implement or restate |
| 0296 | accepted | DROP migration exists but not applied to dev DB | Pre-Cloud-promotion gate |
| 0299 | accepted (Sortie A) | `shift_approval` fixed; `department_session`, `session_hook`, `deviation`, `personal_task` retain same gap class | Needs Sortie A.2 |

12 ADR files frontmatter `Accepted` (capital A) vs canonical lowercase — case-typo sweep needed.

---

## Slice Contradictions

| # | Disagreement | Source slices | Resolution |
|---|---|---|---|
| 1 | F-SE-01 (voice cross-tenant) — closed or open? | Slice 02 says CLOSED (chat.ts Priority-2 path BFF-derived workspace + fail-closed 400). Baseline 2026-05-10 had this as HIGH promotion-blocker. | **CLOSED.** Slice 02 read code; baseline was based on pre-fix state. Replaced with sister concern SE-02-01 (primeContext.profileId injection one layer up). |
| 2 | F-EF-02 — closed or open? | Slice 03 splits: `wizard-definition.ts:295` STILL OPEN as F-EF-02a (HIGH); `people-actions.ts:766` DOWNGRADED (server action, not browser). | **PARTIALLY CLOSED.** Half of baseline F-EF-02 closes; half persists. Net: one HIGH still open. |
| 3 | F-JR-02 — UltravoxVoice rename: closed or open? | Slice 08 says OPEN/DEGRADED (5 sites still using `UltravoxVoice` type). Phase E shipping report claimed Ultravox-removal complete. | **OPEN.** Slice 08 has file:line evidence; type rename never landed even though runtime did. |
| 4 | F-CL-09 (contract/payroll/legal gated mutations) | Slice 06 says PASS-with-documented-deviation (gate-then-write pattern, not `gatedMutation`); baseline 2026-05-10 said PASS. | **PASS confirmed with caveat.** Codebase-accepted convention via `@authority-gate-ungated` comment in `legal/gate.ts:46`. Differs from ADR-0204 `gatedMutation` ideal but no regression. |
| 5 | F-CT-01 billing-query L-0176 occurrence | Slice 01 says CLEARED (current header makes no ADR-0134 claim). Baseline 2026-05-10 reported 5th L-0176 occurrence. | **CLEARED OR REMEDIATED.** Either header was rewritten or baseline mis-read; either way the live state is non-violating today. |
| 6 | F-OB-04 (`/api/emma/session` orphan) | Slice 10 says HIGH-open. Slice 02 says "Not a new gap in this audit; G5 tracks consumer absence as campaign planning issue." | **STILL OPEN.** Route exists, tests pass, zero consumers. Distinction between "new" and "open" doesn't change live state. |
| 7 | F-DB-17 outreach capability | Slice 07 ambivalent — initially marked PASS then corrected to INFO (still pre-declared in registry, no producer). | **INFO/UNCHANGED.** Pre-declared registry entries still orphaned. |

---

## Delta vs 2026-05-10 Baseline

| Bucket | Count | Items |
|---|---|---|
| **New CRITICAL** | 3 | F-DB-09 (D6 sister tables WITH CHECK gap), F-OB-10-01 (legacy onboarding files dead code), F-CL-11 (legal voice channel on §14-6) |
| **New HIGH** | ~14 | F-EF-03 (5 unauthenticated intelligence EFs), F-EF-04 (3 ADR-0123 violations on `/onboarding`), F-SC-04-13 (OversiktTab inline update), F-SC-04-15 (EventDetailPanel direct deviation writes), F-DB-10 (personal_task WITH CHECK gap), F-DB-11 (ADR-0287 enforcement not shipped), F-MO-04 (SwapRequestSheet `?? ""`), F-MO-05 (use-recon-wizard direct daily_reconciliation), F-MO-06 (mobile `submit_own_pii` RPC client workspace_id), F-CL-12 (ADR-0293 Pattern B recalc skipped), F-CL-13 (ADR-0295 feriepenger_basis=0), F-JR-NEW-02 (ADR-0031 seed gap), SE-02-01 (primeContext.profileId in LLM prompt), F-01 (optimizePackageImports drift) |
| **Regressed** (closed in baseline, re-appeared or worsened) | 4 | ADR-0204 SS-5 backlog: 7→13 hooks PLUS 2 brand new direct-write sites in OversiktTab + EventDetailPanel; F-PD-03 (orange-* palette bypass — still trending wrong direction); F-MO-01/02/03 (L-0083 baseline mobile sites still open, never remediated); F-JR-02 (UltravoxVoice type still present though Phase E claimed complete) |
| **Closed** | ~9 | F-AC-02 (landing wizard → deleted route — now Phase E complete); F-SE-01 (voice cross-tenant — chat.ts BFF-derived fixed); F-EF-01 (analyze-setup-documents — JWT+anon-RLS now); F-OB-04 partial (route exists but no consumer); F-JR-01 (5 voice journey statuses flipped to verified); F-ME-02 (5 voice journeys now reference real spec file); F-CT-01 (billing-query L-0176 cleared); F-OB-10-01 (legacy onboarding dead code — CLOSED 2026-05-13 by feat/audit-fob10-onboarding-cleanup); F-OB-10-04 (3 latent ADR-0123 violations — CLOSED automatically by F-OB-10-01 deletion) |
| **Unchanged open from baseline** | ~12 | F-DB-02 (api_key_read policies missing on 6 tables); F-DB-03 (salary_type + end_date_reason no RLS); F-MO-01/02/03 (L-0083); F-WH-01/02/03/04 (webhook hygiene); F-OB-04 + F-OB-09 (Emma BFF orphan + getOnboardingState dead path); F-PD-01 (perf-budgets CI absent); F-PD-02 (ignoreBuildErrors); F-IF-01 (i18n adoption 15%); F-ME-01 (zero mission E2E); F-ME-07 (mr-botsson orb voice no spec); F-CT-05 (personal tools — gate present, no orchestrator); ADR-0246/0247/0248 still proposed |

**Bottom-line delta:** 3 NEW CRITICAL (vs 1 in 2026-05-10 baseline). 7 baseline items closed. 4 items regressed or worsened. Net direction: **stabilization on voice plane** (Phase E perimeter mostly closed), **regression on D6 mutation governance** (SS-5 backlog grew + new write sites in canonical day-control widgets), **new attack surface on auth perimeter** (5 unauth intelligence EFs not previously flagged).

---

## Forward Plan — Ranked Sortie List

### 1. Sortie A.2 — D6 RLS sister-table closure (CRITICAL, promotion-blocker)
**Addresses:** F-DB-09 (department_session + session_hook + deviation), F-DB-10 (personal_task), F-DB-12 (session_task row-stable workspace tighten)
**Pattern:** Mirror `20260605120000_shift_approval_rls_with_check.sql`. Per-verb split with symmetric USING + WITH CHECK. `deviation` additionally tighten USING to role-gated. Add COMMENT ON POLICY for defensive doc.
**Estimated:** 1-2 days. Mechanical migration work; pattern proven on shift_approval.
**Why first:** Three CRITICAL holes of the same class ADR-0299 was written to close. Multi-workspace-membership attack exists today; small attack surface only because most users have one workspace, but the policy permits forgery by design.

### 2. Phase F sortie 4 — Voice journey perimeter + missions E2E (HIGH)
**Addresses:** F-ME-01 (0/7 mission E2E), F-ME-07 (mr-botsson orb spec), F-ME-02 (5 dangling Phase F sortie 4 deferral pointers), F-JR-02 (UltravoxVoice type rename → VoiceId), F-JR-NEW-02 (ADR-0031 seed gap)
**Pattern:** Spec covers BFF + UI layers (LiveKit transport itself can't be Playwright-tested). Add `e2e_test` frontmatter field to all 7 mission-adjacent journey docs. Either seed the remaining 67 journeys into `journey` table OR amend ADR-0031 text. Rename `UltravoxVoice` → `VoiceId` across 5 sites.
**Estimated:** 5-7 days. Largest sortie. Phase F sortie 4 was promised in 5 deferred journeys 2026-05-04 onward; no branch exists.
**Why second:** Voice is the product differentiator. ADR-0031 overstates delivery. Type-rename hygiene important before more mission authors propagate the wrong identifier.

### 3. `/onboarding` legacy cleanup + ADR-0123 tripwire reset (CRITICAL severity, MEDIUM blast)
**Addresses:** F-OB-10-01 (17 legacy files — CLOSED 2026-05-13 by feat/audit-fob10-onboarding-cleanup), F-OB-10-04 (3 latent ADR-0123 violations — CLOSED 2026-05-13 by feat/audit-fob10-onboarding-cleanup), F-OB-09 (getOnboardingState dead path), F-OB-04 (Emma BFF orphan — delete OR wire)
**Pattern:** Delete `WizardContext.tsx`, all `hooks/{useOnboardingState,useBotsson,useScrollProgress}.ts`, all `sections/*.tsx`, all `components/*.tsx`. Remove `createOnboardingTools` from `@smartout/agent-sdk` exports. Update `packages/ai/src/missions/registry.ts:57,152` instruction text. Update `voice-sdk-architecture.md` + `environment-ui-control.md`. ADR-0041 status → `superseded + cleanup-done`.
**Estimated:** 2-3 days. Mostly mechanical deletion + 2 doc updates + agent-sdk export prune.
**Why third:** ADR-0041 status is fictional until cleanup. Three ADR-0123 violations are latent; any revival of the scroll-wizard reactivates them all simultaneously. Audit-trail lies until this lands.

### 4. Edge Function auth perimeter sortie (HIGH, ops impact)
**Addresses:** F-EF-03 (5 unauthenticated intelligence EFs), F-EF-02a (`wizard-definition.ts:295` browser invoke), F-EF-04 (3 `/onboarding` browser invokes — closes naturally with #3), F-EF-05 (create-invitation deletion), F-EF-06 (CORS hardcoded `*` sweep)
**Pattern:** Add `verifyInternalAuth()` or `WATCHDOG_CRON_SECRET` gate to 5 intelligence EFs OR migrate them to `/api/workspace-intelligence/*` route handlers (matches `/join` pattern). Delete `create-invitation/index.ts`. Sweep 22 EFs with hardcoded `*` CORS to `getCorsHeaders(req)`.
**Estimated:** 3-4 days. F-EF-03 alone is an active money/abuse vector — anyone on the internet can burn Smartout's external API quotas.
**Why fourth:** Lower runtime severity than #1-#3 inside Smartout but higher cost-of-abuse externally. Cannot promote campaign with open-internet paid-API proxies.

### 5. ADR-0287 enforcement ship + L-0176 ESLint rule (HIGH)
**Addresses:** F-DB-11 (ADR-0287 controls not shipped), L-0176 recurring (4 prior occurrences across 5 weeks), F-CT-04 (journey-authoring docstring vs body drift on ADR-0240)
**Pattern:** Ship `scripts/gate-action-coverage.ts` + `mutateWithGate()` helper + `.github/workflows/gate-action-coverage.yml`. Move ADR-0287 from `proposed` to `accepted`. Prototype `eslint-rule-no-lying-docstring`: if file header contains `"ADR-0134"|"ADR-0186"|"emit()"`, every exported `tool({...})` body must contain `emit(` call.
**Estimated:** 2-3 days. Architecture decision already made in ADR text; implementation is mechanical.
**Why fifth:** Every capability merge until this ships is a regression vector. L-0176 has fired at one new site per audit for 5 audits running; ESLint is the only durable fix.

### 6. ADR-0204 SS-5 + day-control widget rescue (HIGH)
**Addresses:** F-SC-04-13 (OversiktTab inline update — NEW), F-SC-04-15 (EventDetailPanel direct deviation writes — NEW), F-SC-04-09 (useAutoFillShifts bulk insert — highest blast radius), F-SC-04-01..08, F-SC-04-10..12 (13 schedule/day-control hooks)
**Pattern:** Architectural decision required: voice tools delegate to Server Actions; Server Actions are the canonical mutation host (ADR-0114 precedent). Use `createDayInfoAction` precedent at `use-day-info.ts:131` as the template. One sortie can land the pattern + migrate 3-5 highest-impact hooks; subsequent sorties tackle the backlog. Day-control widgets (`OversiktTab`, `EventDetailPanel`) must NOT call `createClient()` directly per ADR-0156 widget-portability rule.
**Estimated:** 5-7 days for first sortie; backlog spans multiple sorties.
**Why sixth:** Backlog grew this audit cycle. Two NEW direct-write sites landed in canonical ADR-0156 day-control widgets — the canonical surface is now a violator. Cascade integrity invariant #2 (every datum has one role) and #8 (every output has provenance) violated on every shift/session/deviation mutation through these paths.

### 7. Mobile telemetry contract + BFF wrap (HIGH-MEDIUM)
**Addresses:** F-MO-01-OPEN (ShiftClockView 5 L-0083 sites), F-MO-02-OPEN (use-training-data L-0083), F-MO-03-OPEN read-side mapping, F-MO-04 (SwapRequestSheet `?? ""`), F-MO-05 (use-recon-wizard direct daily_reconciliation), F-MO-06 (submit_own_pii client workspace_id), F-MO-08 (8 sync-queue handlers direct-write)
**Pattern:** Mobile-side ESLint rule banning `\?\? ""` on `(workspace_id|profile_id|actor_id|user_id)` identifiers. BFF-wrap reconciliation + submit_own_pii. Migrate 8 sync-queue handlers to BFF in subsequent sorties.
**Estimated:** 4-5 days. F-MO-06 is highest priority (PII intake).
**Why seventh:** L-0083 keeps re-introducing. Mobile remains the most repetitive offender for this trap class.

### 8. Payroll capability ↔ BFF sync (HIGH)
**Addresses:** F-CL-12 (ADR-0293 Pattern B recalc skipped on agent-invoked supplements), F-CL-13 (ADR-0295 feriepenger_basis=0 hardcoded), F-CL-17 (delete-supplement target_profile_id misattribution)
**Pattern:** Capability tools should HTTP-call BFF routes (auth-forwarded) OR invoke shared helper that owns recalc+emit. Hoist feriepenger compute into shared helper imported by both capability + BFF.
**Estimated:** 2-3 days. Self-contained within payroll-wt-1 campaign.
**Why eighth:** Active "data corruption" surface for external regnskapsfører — Pontus flagged feriepenger_basis=0 issue on 2026-05-11.

### 9. Webhook hygiene bundle (MEDIUM)
**Addresses:** F-WH-04 (call_log UNIQUE), F-WH-03 (sendgrid counter idempotency), F-WH-01 (docuseal error leak), F-WH-02 (livekit env null guard), F-WH-05 (docuseal signature failure logging), F-WH-06 (stripe-webhook silent observability gap)
**Pattern:** Single sortie. Add UNIQUE INDEX + upsert; move sendgrid dedup to top-of-loop; replace docuseal error message with generic "internal" + server-side log; mirror stripe env-check pattern across livekit/stripe-webhook missing-env paths.
**Estimated:** 1-2 days. All fixes are small + mechanical.
**Why ninth:** Lower runtime severity than #1-#8 but easy wins. Each is <10 lines.

### 10. Performance + design parity + docs hygiene (MEDIUM-LOW)
**Addresses:** F-02 (landing source-map gate), F-05 (perf-budgets CI job absent), F-03 (landing Turbopack alias drift), F-04 (missing anchor doc), ADR-0273 date fix, 12-file `Accepted` case-typo, ADR-0260 strike or schedule, ADR-0053 ship-or-kill, ADR-0268 reconcile
**Pattern:** Mirror web `next.config.ts` source-map gate to landing. Ship `perf-budgets` CI job (warn-mode). Add Turbopack `resolveAlias` to landing matching webpack. Move/restore `performance-governance.md` anchor doc. Mechanical ADR frontmatter sweep.
**Estimated:** 2-3 days.
**Why tenth:** Quality-of-life and developer-experience. ADR drift hygiene compounds; cheaper to address in one pass.

---

## Slice-by-Slice Top Finding

- **Slice 01 (capability-tools):** F-CT-01 cleared. Top remaining: journey-authoring `saveDraft`/`publishDraft` use `gatedMutation` but zero `emit()` calls in entire file (ADR-0134 phantom-mutation, MEDIUM).
- **Slice 02 (stage-engine/BFF):** SE-02-01 HIGH — `botsson/chat` route at `:142-149` injects body-supplied `primeContext.profileId` into LLM-visible system prompt text. F-SE-01 confirmed CLOSED.
- **Slice 03 (edge-functions):** F-EF-03 HIGH — 5 intelligence EFs (`gather-workspace-intelligence`, `google-places-intelligence`, `web-search-intelligence`, `scrape-website`, `search-brreg`) have ZERO auth and proxy paid external APIs.
- **Slice 04 (schedule-cascade):** F-SC-04-13 + F-SC-04-15 HIGH — TWO new direct-DB-write violations materialized since 2026-05-10 in canonical ADR-0156 day-control widgets. ADR-0156's own audit-integrity driver violated by its own surface.
- **Slice 05 (mobile-surface):** F-MO-06 HIGH — `(me)/contract/complete-data.tsx:86,105` invokes `submit_own_pii` RPC with client-supplied `p_workspace_id`. Mobile PII intake violates ADR-0132 + ADR-0151 simultaneously.
- **Slice 06 (contracts-payroll-lovsen):** F-CL-11 CRITICAL — `legal/index.ts:57` declares `allowedChannels: ["chat","voice","system"]` on a capability handling §14-6 contract content; violates ADR-0163 §rule 4.
- **Slice 07 (db-rls-telemetry):** F-DB-09 CRITICAL — `department_session`, `session_hook`, `deviation` retain `FOR ALL USING(...)` with NO WITH CHECK; same gap class ADR-0299 Sortie A was scoped to close, applied only to `shift_approval`.
- **Slice 08 (journeys):** F-JR-NEW-02 MEDIUM — ADR-0031 claims "68 journeys seeded" but migration ships schema only with one seed journey; documented overstatement.
- **Slice 09 (adr-coverage-gaps):** ADR-0268 (5-tab) conflicts with mobile shipping 7 tab groups; 12 case-typo `Accepted` frontmatter files; ADR-0053 36-day stale; ADR-0273 future-dated.
- **Slice 10 (onboarding-wizard):** F-OB-10-01 CRITICAL — 17 legacy scroll-wizard files mounted as importable dead code; ADR-0041 "superseded" status is fictional until they're deleted.
- **Slice 11 (performance-design):** F-02 HIGH — `apps/landing/next.config.ts:89` runs `withSentryConfig` unconditionally with no `VERCEL_ENV` gate; every preview build pays 30-60s source-map tax.
- **Slice 12 (i18n-frontmatter):** F1 HIGH — i18n adoption at 15% (167/1112 tsx files); CLAUDE.md "Never hardcode Norwegian text" is aspirational, not enforced.
- **Slice 13 (webhook-integration):** F-WH-04 HIGH — `call_log` lacks UNIQUE on `call_session_id`; LiveKit `room_finished` retry duplicates immutable audit rows + over-counts `channel.call.ended` metric.
- **Slice 14 (missions-e2e):** F-ME-01 / F-ME-07 HIGH — zero E2E coverage for any of 7 registered mission personas including primary voice surface (`mr-botsson`) and onboarding interview (`onboarding-interview`). 5 deferred journeys point to non-existent Phase F sortie 4.

---

## Cross-Cutting Recurring Patterns (for memory promotion)

1. **Sister-table blindness on RLS hardening** — ADR-0299 Sortie A closed `shift_approval`; the SAME gap class on `department_session`, `session_hook`, `deviation`, `personal_task` was scope-excluded and remains CRITICAL. Pattern: when an ADR fixes a gap class, always grep for the gap shape across all sister tables of the same dimension before declaring closure.
2. **Cleanup never lands when runtime moves** — F-OB-10-01 onboarding files; F-JR-02 UltravoxVoice type; F-OB-04 Emma BFF orphan. Pattern: runtime cutover lands but dead code stays. Add "delete the predecessor" gate to `/close-feature` script when ADR status is `superseded`.
3. **ADR-0204 backlog grows on every audit** — 2026-05-10: 7 hooks. 2026-05-13: 13+ hooks + 2 new direct-write sites in canonical widgets. Pattern: no enforcement → backlog grows. ESLint rule `smartout/no-direct-supabase-write` is configured `warn` per ADR-0091 §WP4 — must escalate to `error` for governance-gated tables before next audit.
4. **L-0083 empty-string identity in mobile is incurable without ESLint** — F-MO-01/02/03 baseline still open; F-MO-04 NEW since 2026-05-10. Mobile keeps re-introducing `?? ""` fallbacks on workspace_id / profile_id / actor_id. Promote to ESLint rule banning the pattern on those identifier names.
5. **ADRs that document a CI rule but don't ship the script become latent drift** — ADR-0287 proposed 20+ days; rule documented, implementation absent. Pattern: any ADR that says "CI gate X" must ship the gate in the same sortie as the ADR acceptance. Otherwise rule reverts to convention, which doesn't hold.
6. **Phase E "complete" reports don't survive perimeter audit** — Ultravox runtime removed but `UltravoxVoice` type still present; F-OB-04 / F-OB-09 still open. Pattern: "perimeter closure" should be a discrete gate before declaring phase complete, not implicitly tied to runtime cutover.

---

*Audit complete. 14 slices. 89 deduplicated findings after merge. 3 CRITICAL, 40 HIGH, 26 MEDIUM, 20 LOW. Campaign NOT SAFE TO PROMOTE without F-DB-09 + F-OB-10-01 + F-CL-11 closure plus F-EF-03 perimeter fix. Forward plan: 10 ranked sorties. Primary regression: D6 mutation governance backlog grew + canonical ADR-0156 widgets became violators of their own audit-integrity driver.*
