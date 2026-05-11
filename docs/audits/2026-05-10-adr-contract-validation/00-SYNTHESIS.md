---
title: "ADR + Contract Audit Synthesis — 2026-05-10"
status: complete
created: 2026-05-10
updated: 2026-05-10
mode: full
run_id: 2026-05-10-adr-contract-validation
slices_run: 14
slices_critical: 0
slices_high: 21
findings_total: 100
baseline: 2026-05-02-adr-contract-validation
delta_closed: 4
delta_new_high: 21
delta_regressed: 2
campaign: campaign/botsson-arena
campaign_commits_ahead_of_dev: 48
phase_e_status: shipped
tags: [audit, synthesis, adr, contract-validation, phase-e, livekit, voice]
---

# ADR + Contract Audit Synthesis — 2026-05-10

## Executive Summary

Eight days after the 2026-05-02 audit, the campaign has shipped Phase E (LiveKit voice plane consolidation) and closed all three CRITICAL items from the baseline. **Zero new CRITICAL findings emerged this pass.** However, **F-AC-02 — landing wizard voice path calling a deleted backend endpoint — meets the bar for CRITICAL re-classification**: `apps/landing/src/app/api/wizard/engine-start/route.ts:47` POSTs to `/adapters/ultravox/create-call`, a route that Phase E commit `1dea96e1e` deleted from stage-engine. The landing voice widget is therefore **broken in production right now**, not "deferred to P5".

The other defining theme is a multi-tenant safety regression in the voice path that almost certainly does not show in single-workspace local dev: `services/voice-agent/src/adapter.ts:76` sends `BOTSSON_SERVICE_JWT` as the auth bearer; `chat.ts:97-108` resolves `effectiveWorkspaceId` from that JWT, which maps to `admin@smartout.local`'s workspace — not the calling user's. Capability tools, `gate_action` evaluations, and emit() calls in any voice session therefore scope against the wrong tenant. Local dev hides this because there is one workspace; production does not.

L-0176 (docstring vs body drift) is alive and recurring — the audit caught a fresh, complete instance in `billing-query` (file header claims "ADR-0134: emit() called on every tool invocation"; six tool bodies have zero `emit()` calls). ADR-0204 SS-5 backlog (gatedMutation orchestrator) is growing rather than shrinking — the schedule-voice-tools added three new direct-DB-writes-without-gate sites on top of the existing seven-hook backlog. The audit also confirms F-OB-04 (Phase E E2 BFF route `/api/emma/session` has zero consumers) and F-ME-01 (zero E2E coverage for any of the seven registered missions, including `mr-botsson` and `lise-interview` which are the heart of Phase E).

**Verdict on the 48-commit campaign promotion:** **NOT SAFE TO PROMOTE AS-IS**. Two issues block: F-AC-02 (broken landing route in prod) and F-SE-01 (cross-tenant voice workspace derivation). Both are landed-and-shipping-now, not theoretical.

---

## Severity Reclassification

### F-AC-02 — Landing wizard voice → MEDIUM **upgraded to CRITICAL**

Slice 09 tagged this MEDIUM with the rationale "landing voice widget is currently broken in production." That description meets every CRITICAL criterion the baseline used: live runtime impact, user-facing, no graceful degradation, no documented exception path beyond "informally declared P5." The Phase E E6 deletion of `/adapters/ultravox/create-call` is now active on the deployed branch, and `apps/landing/src/app/api/wizard/engine-start/route.ts:47` still calls it. The route lives. Visitors clicking the landing voice CTA hit a deleted endpoint and silently fail.

The audit slice's justification for MEDIUM was "AC#1 item list scoped only `apps/web/` and `services/stage-engine/`, so technically not in scope for Phase E sign-off." That is a **scoping defense**, not a **severity argument**. The runtime reality is broken-in-prod.

**Reclassified: CRITICAL (1 new).** Either restore the Ultravox route (no) or land the LiveKit replacement on landing (P5 sortie) or hard-disable the landing voice widget pending P5. Pick one before promoting campaign.

### F-SE-01 — Voice workspace derivation → HIGH **stays HIGH but re-framed as promotion-blocker**

Slice 02 tagged HIGH. Re-frame: this is a tenant-isolation breach in disguise. Local dev = single workspace = invisible. The moment campaign reaches a multi-tenant deployment (preview or prod), every voice session resolves to the service-account workspace, not the caller's. Capability queries return wrong-workspace data; `gate_action` evaluates against wrong policy; `emit()` carries wrong workspace_id into `activity_trail` and `engine_event`. ADR-0042 + ADR-0151 both fail here. **Promotion-blocker per cascade integrity invariant #5 (permissions/scope must not silently change truth).**

### F-CT-01 — billing-query L-0176 → HIGH **kept HIGH; flagged as 5th L-0176 occurrence**

L-0176 was crystallized 2026-04-29 from a single occurrence (`tools.ts:282`). 2026-05-02 baseline caught the second (`journey-authoring/publishDraftTool`). 2026-05-10 catches the third (`billing-query` file-header claim, 6 tools, 0 emit calls). The pattern is recurring at one new site per audit. **Recommendation: promote L-0176 to ESLint rule before next audit cycle.** Specifically: if a file header contains `"ADR-0134"` or `"emit()"`, every exported `execute()` body in that file must contain a call to a function named `emit`. Lint-enforceable.

---

## Cross-Cutting Themes

### Theme 1: L-0176 docstring vs body drift — recurring at 1 new site per audit

**Findings:** F-CT-01 (billing-query, 6 tools, 0 emit), F-CL-09 (PASS — all contract/payroll/legal mutations have real gate_action), F-AC-05 (identifier names containing "ultravox" — comp-bridge intentional)
**Pattern:** Authors write the docstring describing intent at file creation; bodies drift without docstring updates. Detection requires reading bodies, not headers.
**Severity escalation:** L-0176 has now produced 3 production-shipped occurrences across 5 weeks. The Steward "Tool Compliance Self-Check" table (mandatory in `smartout-agent-dev` skill) catches this when the agent uses it. Lint enforcement would catch it when they don't.
**Recommendation:** Sortie to ship `eslint-rule-no-lying-docstring` checking file headers for "ADR-0134"|"ADR-0186"|"emit()" claim → walk all `export const X = tool({...})` bodies → require `emit(` call in each.

### Theme 2: ADR-0204 gatedMutation orchestrator — backlog growing not shrinking

**Findings:** F-CT-05 (personal — 4 tools callGateAction-then-direct-write), F-SC-01 (schedule voice tools — 3 new direct writes, NEW REGRESSION), F-SC-02 (7 schedule CRUD hooks, SS-5 backlog), F-SC-04 (useCreateAbsence — gate-bypass on admin-gated table), F-CL-09 (contract/payroll/legal — PASS, all wrapped)
**Pattern:** SS-5 migration is not progressing while new bypass sites land on top. Schedule voice tools (F-SC-01) added 3 new mutations without orchestrator on the same file already containing the SS-5 backlog hooks.
**Cascade integrity:** Invariant #2 ("every datum has one role") and #8 ("every output must have provenance") violated. `schedule_day_booking` is a D6 production entity; voice-tool writes leave no `gate_evaluation` row.
**Recommendation:** Block any new voice-tool DB-writing sortie until SS-5 + voice-tool delegation pattern is decided. Voice tools should delegate to Server Actions that own gate+emit (per `createDayInfoAction` precedent at `use-day-info.ts:131`).

### Theme 3: Phase E completion gaps — voice plane shipped, perimeter incomplete

**Findings:** F-SE-01 (multi-tenant workspace derivation broken on voice), F-AC-02 (landing wizard voice → deleted endpoint), F-AC-05 (`ULTRAVOX_TO_OPENAI_VOICE` identifier still in agent.ts), F-OB-04 (`/api/emma/session` BFF has 0 consumers — Phase E E2 delivered as drop), F-OB-09 (client-side `getOnboardingState` in `WizardContext.tsx` not deleted, tool that should call BFF doesn't exist), F-JR-01 (5 voice-plane-consolidation journeys still `status: draft` despite Phase E shipped), F-JR-02 (`UltravoxVoice` type retained), F-ME-01 (zero E2E for any registered mission), F-ME-02 (5 voice journeys reference 5 spec files that don't exist), F-ME-07 (mr-botsson dashboard orb voice has no E2E and no `e2e_test` frontmatter field — silent gap)
**Pattern:** Phase E core deliverables (voice transport, telemetry, env cleanup) shipped clean, but perimeter (consumer wiring, multi-tenant readiness, journey-state tracking, E2E coverage, type renames, doc consolidation) is open. The HANDOFF correctly calls some of this debt out (840 prose-replace docs P5, C1.c Detox); some is silently missing (F-AC-02, F-SE-01, F-OB-04 BFF orphan).
**Cascade integrity:** Phase E E2 (`/api/emma/session`) is an undeclared **orphan concept** — route exists with no upstream caller and no downstream consumer. Per Steward orphan-check rules: every concept must have lifecycle, upstream source, downstream consumer. F-OB-04 fails on lifecycle and consumer.
**Recommendation:** Spawn a Phase F0 closure sortie that fixes F-AC-02 + F-SE-01 + wires F-OB-04 BFF + flips F-JR-01 journey statuses. Treat Phase E as not closed until perimeter passes.

### Theme 4: ADR-0179 browser → Edge Function violations (3 instances)

**Findings:** F-EF-01 (`analyze-setup-documents` — header presence-only auth + service_role + browser-callable), F-EF-02 (`ingest-workspace-knowledge` from `setup/wizard-definition.ts:295` + `send-login-code` from `people-actions.ts:766`)
**Pattern:** ADR-0179 mandates "browser MUST NOT invoke Edge Functions for workspace-scoped mutations." Pre-workspace onboarding flows have an explicit ADR-0123 exception. The three caught here are post-workspace, post-auth dashboard code.
**Bonus:** F-EF-01 doubles as a security finding — the Edge Function uses `verify_jwt = false` + accepts any `Authorization` header value as auth (`if (!authHeader)` only). Service-role client with header presence-only check.
**Recommendation:** Wrap each in a Next.js route handler. Sortie can bundle all 3.

### Theme 5: Telemetry empty-string fallback (L-0083 trap) — mobile re-occurrence

**Findings:** F-MO-01 (ShiftClockView `?? ""` workspace_id, 3 sites), F-MO-02 (use-training-data `?? ""` workspace_id), F-MO-03 (use-swap-requests `?? ""` mapping)
**Pattern:** ADR-0134 Invariant 2 forbids empty-string fallbacks; mobile keeps re-introducing them. The query-side instances aren't direct emit corruption today, but they propagate downstream and accumulate consumers.
**Recommendation:** Mobile-side ESLint rule mirroring L-0083: ban `\?\? ""` on identifier patterns matching `(workspace_id|profile_id|actor_id|user_id)`.

### Theme 6: ADR-0078 channel guard — Layer 2 gap on chat-only capabilities exposed via voice

**Findings:** F-SE-07 (3 voice tools — `get_helpdesk_status`, `get_shift_swap_status`, `get_governance_summary` — proxy to `["chat"]` capabilities), F-CL-01 (`validate_aml_14_6` L2 declares voice but L3 blocks — AC inverted), F-CL-10 (PASS — payroll/contract Høy-PII tools have all 3 layers)
**Pattern:** L1 (process-level) + L3 (tool-execute guard) cover the security; L2 (voice tool surface inclusion) is the UX gap. User hears "I can't help" from LLM rather than a clean redirect.
**FP-001 still applies** to `validate_aml_14_6` rate inversion claim, but the L2/L3 declaration mismatch is a separate finding.

### Theme 7: Webhook integration — solid but small gaps

**Findings:** F-WH-01 (docuseal leaks DB error message in 500), F-WH-02 (livekit-webhook missing null guard on env), F-WH-03 (sendgrid open/click counter not idempotent, replay double-counts), F-WH-04 (call_log no UNIQUE on session_id, room_finished replay creates dupes)
**Pattern:** Authentication and signature verification are clean (PASS on all 4 webhooks). Idempotency and error-response hygiene are inconsistent. Stripe is the gold standard; LiveKit + SendGrid + DocuSeal each miss one piece of the pattern Stripe gets right.
**Recommendation:** Single sortie addresses all 4 — small, mechanical, each fix is <10 lines.

### Theme 8: i18n + frontmatter — systemic, not incremental

**F-IF-01:** 298 of 1072 TSX files (28%) have hardcoded Norwegian without an i18n import. Phase E new components follow the existing pattern. Not remediable in one sortie.
**F-IF-02:** Phase E ADRs 0280–0282 missing `module` + `tags` frontmatter. Template gap.
**Recommendation:** Add ESLint rule for `[æøåÆØÅ]` in JSX. Update `docs/templates/decision.md`. Both bounded mechanical work, but separate from Phase E perimeter closure.

### Theme 9: Performance design — F-PD-04 ACTIVE BUG; F-PD-03 worsening

**F-PD-04** (MEDIUM, **ACTIVE BUG**): `hover:bg-brand-orange-light` and `hover:text-brand-orange-light` resolve to no color in 4 Tailwind class uses because `--color-brand-orange-light: var(--brand-orange-light)` is missing from `globals.css @theme inline`. One-line fix.
**F-PD-03** (HIGH, WORSENED): orange-* palette bypass instances 373 → 387 (+14, from dev sync `1319bd4eb`). Trend is wrong direction.
**F-PD-01** (HIGH, UNCHANGED): `perf:audit` CI job still absent. ADR-0019 enforcement loop still disconnected.

### Theme 10: Mission registry + E2E coverage — 0/7 tested

**F-ME-01:** Zero E2E tests reference any of 7 registered mission IDs (`onboarding-interview`, `landing-demo`, `lise-interview`, `mr-botsson`, `haccp-inspector`, `shift-assistant`, `botsson-session`).
**F-ME-02:** 5 Phase E voice journeys reference 5 spec files that do not exist; all carry `e2e_test: null` not flagged in HANDOFF Test Plan.
**F-ME-07:** `mr-botsson` dashboard orb voice journey is `status: done` but lacks `e2e_test` frontmatter field entirely → not detectable by existing audit grep pattern.
**Pattern:** Phase E shipped voice as the product's core differentiator with zero regression coverage.

---

## Phase E Status

### What landed correctly

- **Voice transport migration:** Ultravox client/lib/types/adapters/env vars all removed (verified via slice 02 grep). LiveKit is the sole web/mobile voice transport.
- **Voice telemetry registry:** All 4 Phase E observational events (`voice.first_speech_ts_ms`, `voice.turn_end_ts_ms`, `voice.user_recut`, `voice.session_abandonment`) wired end-to-end in `services/voice-agent/src/agent.ts:138-261` + `packages/telemetry/src/registry.ts:9847-9865`. Routing correctly limited to `["posthog","logger"]` (no audit/workflow surface).
- **engine_world Phase 1+2:** `actor_kind` discriminator + CHECK constraint correctly preserves user-actor invariant while permitting platform NULLs (per L-0181 `learning_activity_trail_platform_gap.md`). Migration ordering 20260525 → 20260526 → 20260527 verified clean.
- **/onboarding wizard:** `useBotsson.ts` Phase E rewrite is gold-standard (zero `registerToolImplementation` calls, zero Ultravox imports, LiveKit Room transport, single `advanceToNextSection` retained as data-channel client tool per ADR-0282 R4 #11).
- **/api/wizard/start:** ADR-0151 server-derived workspace_id with explicit 403 on mismatch.
- **Voice-agent Dockerfile fix:** Today's commit `e524a966a` added workspace deps + ca-certificates to fix the regression introduced by Phase E commits `75a66007e + 41be285d1` (per L-0231).
- **ADR-0276 + ADR-0282 accepted:** flipped 2026-05-10 (`b75b40c64`).

### What's missing or broken

- **F-AC-02 (CRITICAL upgrade):** `apps/landing/src/app/api/wizard/engine-start/route.ts:47` calls `/adapters/ultravox/create-call` which Phase E E6 commit `1dea96e1e` deleted from stage-engine. Landing wizard voice broken in prod. Comment in route file acknowledges as "P5 scope" but no ticket, no plan, no disabled widget.
- **F-SE-01 (HIGH, promotion-blocker):** Voice-agent uses `BOTSSON_SERVICE_JWT` → maps to service-account workspace, not caller workspace. Multi-tenant breaking. Local-dev-invisible.
- **F-OB-04 (MEDIUM):** Phase E E2 BFF route `/api/emma/session` has zero consumers — orphan endpoint.
- **F-OB-09 (LOW):** Client-side `getOnboardingState` in `WizardContext.tsx:37-70` not deleted (dead code, but documents that the migration is incomplete on the consumer side).
- **F-JR-01 (HIGH):** 5 voice-plane-consolidation journeys still `status: draft` 8 days after Phase E shipped.
- **F-JR-02 (HIGH):** `UltravoxVoice` type name retained post-LiveKit. `coral` (the actual `lise-interview` voice) is in the `(string & {})` escape hatch, not the named union. Future authors get incorrect IDE autocomplete.
- **F-ME-01 + F-ME-02 + F-ME-07 (HIGH × 3):** Zero E2E coverage for missions; 5 Phase E journey specs missing; mr-botsson silently lacks `e2e_test` field.
- **F-AC-01 (LOW):** Stale `[ ] ADR-0276` checkbox in ADR-0282 line 176 — accepted but tracker not flipped.
- **F-AC-05 (INFO):** `ULTRAVOX_TO_OPENAI_VOICE` constant + `resolveOpenAIVoice(ultravoxVoice)` identifier names retained — AC#1 grep post-condition technically not zero. Compat-bridge documented; mission registry still uses Ultravox voice ID strings (`coral`, `mark`, `sarah`).
- **F-OB-01 (LOW):** CLAUDE.md still describes `OnboardingProvider` + `WizardContext` + 10-section architecture. ADR-0041 correctly superseded; CLAUDE.md text not updated.

### Promotion-blocker findings

| Finding | Severity | Why it blocks |
|---|---|---|
| F-AC-02 | CRITICAL (reclassified) | Live broken endpoint in landing prod path |
| F-SE-01 | HIGH | Multi-tenant data scope violation; invisible until preview/prod has 2+ workspaces |
| F-DB-01 | HIGH | `engine_world_observe_platform` GRANT to authenticated + no body guard = client-side platform-state pollution vector |

The remaining HIGH findings are non-blocking: they degrade telemetry/audit/UX but do not break runtime or breach tenant isolation.

---

## Delta vs Baseline (2026-05-02)

| Status | Count | Notes |
|---|---|---|
| Closed (CRITICAL) | 3 | engine-dispatch (C-01), bootstrap-cascade (C-02), cleanup-sandbox-workspaces (H-01) — all use `verifyInternalAuth()` now per slice 03 |
| Closed (HIGH) | 1 | CV-1 (channel_department_access + channel_team_access RLS lockout) — migration `20260520170000` ships all 4 policies × 2 tables |
| New CRITICAL | 1 | F-AC-02 reclassified from MEDIUM (landing wizard → deleted route) |
| New HIGH | 21 | F-CT-01/02/03, F-SE-01/02/05, F-EF-01/02, F-SC-01/02, F-MO-01/02, F-DB-01, F-JR-01/02, F-PD-01/02/03, F-ME-01/02 |
| Regressed (vs baseline) | 2 | F-PD-03 (orange-* 373→387 from dev sync), F-SE-05 (BFF profile_id leak still in `emma/chat` + `botsson/chat` — F-01/F-02 from 2026-05-06 not addressed) |
| Unchanged open (HIGH from baseline) | ~15 | ADR-0204 SS-5 backlog, L-0176 patterns, capability gate gaps, telemetry emit gaps, decision-log inconsistency |

Note: `journey-stuck-detector` C-01 was tagged CLOSED by botsson-arena Phase D commits. `bootstrap-cascade` C-02 closed by `1d553a4bc`. `cleanup-sandbox-workspaces` H-01 closed by `2129997b1`. Baseline CRITICAL #3 (docuseal-webhook signature check optional) — slice 13 confirms signature verification is now mandatory with `timingSafeEqual`. Closed.

The baseline's other CRITICALs (#4 publishDraftTool docstring lying, #5 classify_amendment missing gate body) — slice 01 reports `journey-authoring/publishDraft` now uses `gatedMutation()` (PASS), and slice 06 reports `classify_amendment` calls `callGateAction()` before logic (PASS at F-CL-09). **Both baseline CRITICALs closed.**

So the corrected closed count is: **3 baseline CRITICAL + 2 additional baseline CRITICAL + 1 baseline HIGH = 6 confirmed closed.** New CRITICAL count after reclassification: **1**.

---

## Top 5 Remediation Sorties

### 1. Phase F0 — Phase E perimeter closure (CRITICAL — promotion-blocker)
**Addresses:** F-AC-02 (landing broken route), F-SE-01 (voice multi-tenant), F-OB-04 (Emma BFF orphan), F-JR-01 (5 journey statuses), F-AC-01 (ADR-0282 checkbox flip)
**Estimated:** 2-3 days. Largest piece is F-SE-01 — design decision needed (per-user JWT mint at voice token route OR explicit cross-workspace promotion guard with fail-closed). F-AC-02 is binary (disable landing voice widget OR P5 LiveKit replacement).
**Why first:** Blocks campaign promotion. F-AC-02 is broken-now in prod. F-SE-01 will break the moment a 2nd workspace gets a voice session.

### 2. ADR-0204 SS-5 + voice-tool delegation (HIGH)
**Addresses:** F-SC-01 (3 new schedule voice writes — NEW REGRESSION), F-SC-02 (7 SS-5 backlog hooks), F-SC-04 (useCreateAbsence admin-gate bypass), F-CT-05 (4 personal tools)
**Estimated:** 4-6 days. Architectural decision: voice tools delegate to Server Actions; Server Actions are the canonical mutation host (ADR-0114). One sortie can land the pattern + migrate the schedule voice tools as proof; second sortie tackles the backlog.
**Why second:** Cascade integrity invariant #8 (provenance) violated on every booking/task voice write. Backlog growing not shrinking.

### 3. Capability gate + telemetry parity sweep (HIGH)
**Addresses:** F-CT-01 (billing-query L-0176, 6 tools), F-CT-02 (sendMessage no gate), F-CT-03 (acknowledgeSignal no gate + no emit), F-CT-04 (add_key_fact bypass via saveMemory), F-SE-05 (BFF profile_id leak persists from 2026-05-06)
**Estimated:** 2-3 days. Mechanical fixes; each is small. Bundle includes the L-0176 ESLint rule prototype.
**Why third:** Audit-trail integrity for AI-surfaced actions. Guardian `acknowledgeSignal` is particularly bad — guardian capability that exists for oversight has no oversight on its own state changes.

### 4. Mission E2E + protocol coverage (HIGH)
**Addresses:** F-ME-01 (0/7 missions), F-ME-02 (5 Phase E specs missing), F-ME-07 (mr-botsson silent gap), F-JR-02 (UltravoxVoice rename), F-ME-05 (P-001 protocol skipped)
**Estimated:** 5-7 days. Specs cover BFF + UI layers (LiveKit transport itself can't be Playwright-tested). Add `e2e_test` frontmatter to all 7 mission journeys for future grep coverage. Rename `UltravoxVoice` → `VoiceId`.
**Why fourth:** Phase E shipped voice as product differentiator with zero regression coverage. Any Phase F refactor of `mr-botsson` or `lise-interview` mission will not be CI-caught.

### 5. ADR-0179 + Edge Function auth hardening (MEDIUM-HIGH)
**Addresses:** F-EF-01 (analyze-setup-documents header-only auth + service_role + browser-callable), F-EF-02 (ingest-workspace-knowledge + send-login-code direct browser invoke), F-EF-04 (engine-dispatch L1 channel-allowed gap), F-WH-01/02/03/04 (webhook hygiene bundle)
**Estimated:** 3-4 days. Wrap browser-callable EFs in Next.js route handlers. Add LiveKit env null guards. Add UNIQUE constraint on `call_log.call_session_id`. One sortie can ship all of this if scoped to "Edge Function + webhook hygiene."
**Why fifth:** Lower runtime severity than #1-#4 but easy wins; deferring further accrues debt.

---

## SLA Status (open findings carried from prior audits)

| Finding | First flagged | Audits later still open | SLA breach |
|---|---|---|---|
| F-SE-05 (BFF profile_id leak emma/chat + botsson/chat) | 2026-05-06 | 1 (today) | 4 days, no fix |
| ADR-0204 SS-5 backlog (7 schedule hooks) | 2026-04-24 (ADR-0204 accepted) | ~3 weeks | New regression added on top (F-SC-01) |
| F-PD-01 (perf:audit CI job absent) | 2026-05-06 baseline | 2 (today) | UNCHANGED across both audits |
| F-PD-02 (ignoreBuildErrors no expiry) | 2026-05-06 baseline | 2 (today) | UNCHANGED — still no Linear ticket |
| F-IF-01 (i18n hardcoded NO) | Codebase-wide pre-dating campaign | many | Systemic; needs ESLint rule, not sortie |
| ADR-0246/0247/0248 (engine_state migration) | 2026-05-06 | 2 (today) | All 3 still `proposed`; Phase E did not advance |
| F-DB-03 (salary_type + end_date_reason no RLS) | 2026-05-02 baseline | 2 (today) | UNCHANGED |

**No L-0177 silent-fallback occurrences this audit** — the wizard-session branch in `chat.ts:121-138` correctly fail-closes (verified slice 02). F-SE-04 is a *structural cousin* (workspace_context.workspace_id silently used to enrich prompt while DB scope uses different value) but not a direct L-0177 instance. Worth a learning entry: "L-0177 sibling: split-brain workspace context where prompt enrichment and DB scope diverge."

---

## Promotion Decision

**Campaign `campaign/botsson-arena` is 48 commits ahead of `development`. NOT SAFE TO PROMOTE AS-IS.**

**Required before HOP A (development → preview):**

1. F-AC-02 — disable landing voice widget OR ship LiveKit replacement (binary; pick one)
2. F-SE-01 — fix voice workspace derivation OR explicitly disable multi-workspace deployment of voice-agent

**Strongly recommended before HOP A:**

3. F-DB-01 — add guard inside `engine_world_observe_platform` body OR scope GRANT to service_role only
4. F-OB-04 — wire `/api/emma/session` consumer OR document as "Phase E E2 deferred to Phase F1"

The remaining 17 HIGH findings can ship to development behind the 2 blockers above being addressed; preview/main promotion should also gate on F-DB-01 and F-OB-04 closure or explicit deferment in the PR template.

---

## Cross-Cutting Recurring Patterns (for memory promotion)

1. **L-0176 docstring vs body drift** — 5th occurrence in 5 weeks. Promote to ESLint rule before next audit.
2. **L-0083 empty-string actor_id/workspace_id** — Mobile keeps re-introducing `?? ""` fallbacks. Mobile-side ESLint rule needed.
3. **ADR-0204 SS-5 backlog growing** — Voice tools added 3 new bypass sites. Need architectural decision (Server Action delegation pattern) before more voice tools land.
4. **Phase-end perimeter incompleteness** — Phase E core deliverables clean; perimeter (consumers, types, journeys, E2E) systematically open. Add "perimeter closure" gate to feature lifecycle script.
5. **Multi-tenant blind spots in single-workspace dev** — F-SE-01 + F-MO-01/02 + F-CL-03/04 all depend on multi-workspace state to surface. Recommend a "multi-workspace local seed" helper to expose these in dev.

---

*Audit complete. 14 slices. 100 findings. 1 CRITICAL (reclassified from MEDIUM). 21 HIGH. 6 baseline CRITICAL/HIGH closed. Campaign NOT SAFE TO PROMOTE without F-AC-02 + F-SE-01 closure.*
