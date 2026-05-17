---
title: Council Session Log
status: live
updated: 2026-05-16
created: 2026-03-26
module: governance
tags: [council, decisions, multi-agent, review, governance]
---

<!-- trailing 2026-04-21 Journey Runner Suite v1.6.0 re-review appended below -->


# Council Session Log

Tracks all System Council sessions — multi-agent review meetings where specs, plans, bugs, and architectural decisions are reviewed by the full agent team.

## Sessions

| Date       | Topic                                 | Type         | Verdict                  | Agents Consulted                                          | Prior verdict held? | ADR                                                                               | Learning                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------- | ------------ | ------------------------ | --------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-17 | BotssonProvider topology lift — runtime fix for `useBotsson must be used within <BotssonProvider>` thrown by ADR-0337 `<DomainChatOwnership>` consumers (komm/chat, komm/thread, shift-clock); in-place fix wrapped `{children}` inside `EmmaOverlay` (dynamic ssr:false) | post-implementation | **APPROVE WITH CHANGES — Solution C (split BotssonHost SSR-safe from EmmaOverlay dynamic-Orb-only)**. Pre-merge: (1) `BotssonHost.tsx` new file mounts `<BotssonProvider workspaceId={...}>{children}</BotssonProvider>`; (2) EmmaOverlay reduced to `<BotssonShell />` only, stays `dynamic({ssr:false})`; (3) DashboardShell wraps `<BotssonHost>{children}<EmmaOverlay/></BotssonHost>` at line 1786 + setup-page boundary comment at line 1122-1125; (4) `BotssonChatHero.tsx:30` nested inner BotssonProvider removed + stale comment 26-28 rewritten; (5) Botsson.css ancestor audit CLEAN (no transform/contain/will-change blocking Orb fixed escape); (6) ADR-0350 drafted (slot collision: 0348+0349 taken cross-branch) amending ADR-0113 §R51 with two conditions (SSR-safe wrapper + sole provider instance); (7) Playwright regression spec `apps/e2e/tests/domain-chat-ownership/botsson-provider-scope.spec.ts` 102 lines covers G2+G3+G4. | system-steward (chair, opus — Phase 3 "block merge for ADR-0113 R51 violation" → Phase 5 REVERSED to "block merge for SPLIT + ADR + nested-provider fix" via L-0147 protocol after 3 code-tracers brought runtime evidence; 8th codified precedent), supervisor (opus — dynamic-import boundary regression caught, `BotssonChatHero.tsx:30` nested-provider silent break identified, EmmaOverlay name-vs-purpose drift, recommended Solution C split + required children prop), system-agent-coordinator (opus — Code-Tracer; 10-side-effect mount-time table in BotssonProvider, counter-based ownership API verified correct, Trust Gate PASS on capability surface, `loadAll()` 3-GET-per-route follow-up flagged), botsson-harness-builder (opus — L1-L5 trace end-to-end across 3 consumers, ADR-0238/0337 compliance verified, BOTSSON-SYSTEM-MAP Komm ADR-0238 debt closure, BotssonChatHero conflict parallel-found with Supervisor), frontend-designer (sonnet — DEGRADED via smart-explore hook loop blocking file reads; inference-only review delivered LCP HIGH severity + skeleton-flash anti-pattern + a11y missing-`<main>`-landmark + Orb suppression-flash on chunk load, recommended Solution C split). 5/5 reviewers = NOT DEGRADED for verdict purposes (frontend partial but delivered all key findings). Phase 2.5 fact-check (haiku) caught ADR slot drift (briefing said 0346 highest; actually 0347 with cross-branch collision pair). | yes — sibling council 2026-05-14 polish-wave QA `ADR-0238 debt FLAGGED as build-or-retract threshold reached` HELD + EXTENDED. ADR-0337 closed the build gap (2026-05-16); this council closes the topology gap exposed by the consumers ADR-0337 added. L-0257 phantom-contract pattern now structurally closed — Komm + shift-clock all wired against live provider. | ADR-0350 NEW (proposed — BotssonHost mount pattern amends ADR-0113 §R51 with two conditions; canonical Host vs Overlay split documented; future Solution-D escalation trigger for strict-above-shell if remount-survival breaks). | L-0289 NEW (canonical — Context-hook consumer merges must verify provider-ancestor chain; sibling L-0176/L-0177/L-0257 artifact-author-asserts-compliance-body/tree-does-not-provide class; promote to `run-council` Phase 3 hard rule on 2nd occurrence — per-consumer × per-provider-ancestor file:line table required when topic adds context-hook consumers). L-0147 8th codified precedent (Chair Phase 3 "block merge for ADR violation" → Phase 5 "REVERSED to block merge for SPLIT" via 3-tracer reversal; pattern signature: chair operates on doc-trail axis, code-tracers expand scope to runtime axis). **Semantic conflict resolution (4 pairs):** (1) Steward "ADR-0113 R51 VIOLATION, block merge" vs Agent-coord "Trust Gate PASS, ship as-is" — DIFFERENT domains both true (Agent-coord scoped to harness contract; Steward scoped to doc-trail; neither absolves the other). (2) Frontend "LCP regression HIGH, decouple" vs Agent-coord "ship as-is" — DIFFERENT, Frontend wins on evidence weight (Agent-coord did not analyze SSR-boundary regression; Frontend's chunk-gating trace identifies genuine new degradation). (3) Harness "always-structural newly exposed" vs Steward "second build-or-retract in 2 days" — DIFFERENT framings both true (Harness: provider gap predates ADR-0337; Steward: process failure to verify provider chain at consumer-merge). (4) Steward "rename warranted" vs Harness "warranted not urgent" — COMPATIBLE; Solution C makes rename intrinsic. **Chair Self-Reversal Phase 5 §1.5** explicit. **Agent Trust Gate per-component:** DomainChatOwnership PASS (unchanged), BotssonProvider scope lift PASS (no capability surface change), EmmaOverlay in-place host pattern CONDITIONAL FAIL (SSR + nested), BotssonHost split PASS. **Solution C end-state shipped same session:** Track A (topology swap) + Track B (hero cleanup) + Track C (CSS audit CLEAN) + Track D (ADR-0350) + Track E (Playwright spec) + Track F (L-0289). G1 typecheck green; G5 CSS clean; G6 ADR registered; G7 spec written; G8 setup comment landed. Pontus approved Solution C verdict 2026-05-17 → all 6 tracks dispatched and closed same session. |
| 2026-05-17 | M5 HMS cluster scoping — how to scope 8-route polish work (hms umbrella + 5 sub-tabs + procedure/[id] + policies + handbook) | plan | **APPROVE WITH CHANGES — Option C+ (4 sorties)**. Pre-M5 mutation closure (sortie 1, BLOCKER): convert use-update-deviation.ts + use-complete-task.ts to Server Actions w/ gate_action; add gate_action RPC to policy-actions.createPolicy; register "policy created" event. Pre-M5 collision-fix (sortie 2, BLOCKER): resolve 3 LIVE L-0258 collisions (listOpenDeviations 3-way, getDriftStatus 2-way, getProtocolDetail 2-way) + CI detector per ADR-0348. Then M5 sortie 3 hms-cluster-polish-read (umbrella+drift+documents+training+governance read-views, 11 components, 4-5 loading.tsx) + sortie 4 policies-handbook-polish-write (policies+handbook+procedure-detail+DeviationKanban motion budget). | system-steward (chair, opus — Phase 3 Option B → Phase 5 REVERSED to Option C+ via L-0147 protocol after 3 code-tracers brought file:line evidence; 9th codified precedent counting today's), supervisor (opus — corrected briefing telemetry claim, found ADR-0114 violations at use-update-deviation.ts:35-53 + use-complete-task.ts:25-33, recommended 4-sortie sequence with prereq), system-agent-coordinator (opus — Code-Tracer; traced 3 LIVE L-0258 collisions with file:line + per-action ADR-0204/ADR-0287 table for policy-actions.ts + use-update-deviation/use-complete-task; recommended Option B+2-carve-outs), botsson-harness-builder (opus — L1-L5 status matrix for HMS surface, BOTSSON-SYSTEM-MAP G3/G4/G8 gaps identified, cross-cutting law audit per option, Trust Gate CONDITIONAL FAIL), frontend-designer (sonnet — App Router streaming gap, hardcoded-token risk inventory by component, DeviationKanban motion-budget concern, recommended Option C with procedure/[id] in interaction sortie). 5/5 reviewers = NOT DEGRADED. Phase 2.5 fact-check (haiku) caught 3 false briefing claims (procedure/[id] existence, hook count, loading.tsx coverage) — re-verified by orchestrator before Phase 3 dispatch. | yes — 2026-05-14 Polish-Wave QA verdict (HMS bridge PASS w/ name-collision flag) HELD + EXTENDED via concrete trace. L-0258/L-0260/L-0257 sibling pattern. ADR-0325 Phase 1 grace-mode still live; this council triggers Phase 2 dedupe via M5 sortie 2. | ADR-0348 NEW (proposed — L-0258 collision detector mandatory in CI; formalizes Agent-coord's detector; Option B sub-sortie hms-collision-fix; renumbered from 0347 → 0348 in Sortie 1 G4 to resolve collision with schedule-density-persistence ADR-0347). | L-0286 NEW (canonical — Polish PRs gild half-converted patterns when prereq mutation closure skipped; sibling L-0260; promotes Phase 0 mutation-surface audit to smartout-page-polish skill). L-0287 NEW (canonical — Bridge tool description refinement = phantom-contract amplifier when L4 capability absent; sibling L-0257; promotes Phase 0 capability check to smartout-page-polish skill). L-0147 9th codified precedent (Chair Phase 3 Option B → Phase 5 Option C+ via 3-tracer reversal; pattern signature confirmed: chair generalizes from cascade-role axis, code-tracers falsify with file:line). **Semantic conflict resolution (7 pairs):** (1) Steward P3 "scope `hms` low collision risk" vs Agent-coord "3 LIVE collisions traced" — DIFFERENT, P3 FALSIFIED, REVERSED. (2) Steward P3 "policy-actions audit as precondition" vs Supervisor "prereq sortie" vs Agent-coord "30-min carve-out" — PARTIAL, all agree must precede; resolved to fold into pre-M5 closure sortie. (3) Steward P3 "capability gap = defer" vs Harness "phantom L4 contract IF polish adds descriptions" — DIFFERENT, P3 INCOMPLETE, REFINED (defer conditional on polish scope). (4) Steward cascade-role axis vs Frontend interaction-depth axis — DIFFERENT AXES, orthogonal not conflicting (sequence by Frontend axis, validate by Steward axis). (5) Supervisor prereq vs Agent-coord carve-out vs Harness "sortie 3 defer" — PARTIAL, two code-tracers beat one. (6) Brief "0 telemetry events" vs Supervisor "events exist with space-separator" — FACT CORRECTION. (7) Brief "L-0258 scope within HMS" vs Supervisor/Agent-coord "cross-bridge collisions" — FACT CORRECTION. **Chair Self-Reversal Phase 5 §1.5** explicit on 4 Phase 3 claims. **Agent Trust Gate CONDITIONAL FAIL:** PASS only if (a) collision-3 resolved before polish, (b) use-update-deviation migrated to Server Action with gate_action, (c) "policy created" registered, (d) polish does NOT expand bridge descriptions on capability-absent domains. Pontus approved verdict 2026-05-17 → Sortie 1 (pre-m5-mutation-closure) dispatch starts immediately + Phase 8 capture (this row). |
| 2026-05-16 | Payroll Sortie-Triplet — S1 label sweep "lønnsslipp"→"lønnsgrunnlag", S2 mobile UX polish, S3 Phase 5 PII reveal (INVALID — done 2026-05-08) | plan | **APPROVE WITH CHANGES** — S1 HELD-WITH-REFINEMENT (8 live hits + 3 truncation guards, skip docs + pedagogy + AI alt-spellings + filename renames), S2 REVERSED→APPROVE (Frontend-Designer falsifiable scope: list view at `(me)/payroll/index.tsx` FlashList + skeleton, no period selector per ADR-0133, `expo-sharing` native PDF, a11y, motionTokens), S3 REVERSED→APPROVE F-CL-12 (3 tools at `packages/ai/src/capabilities/payroll/tools.ts:1323/1559/2534` missing ADR-0293 Pattern B recalc; same shape as F-CL-13 shipped `58d40f500`). Sequence: sync → S3 → S1‖S2 (NOT 3 parallel). | system-steward (chair, opus — Phase 3 + Phase 5 with **two L-0147 self-reversals same synthesis** on S2 + S3; 7th + 8th codified precedents), supervisor (opus — verified F-CL-13 closed via commit `58d40f500`, recommended Phase 4 polish for S3; corrected briefing 122 hits → 8 live UI), system-agent-coordinator (opus — Code-Tracer at `tools.ts:1323/1559/2534` verified Pattern B recalc absent; recommended F-CL-12 as S3), frontend-designer (sonnet — provided S2 falsifiable acceptance list incl. `expo-sharing` native PDF + FlashList + a11y; truncation guard for `QuickPathCards.tsx:40` 30% width increase), general-purpose (haiku — Phase 2.5 fact-check 12/13 VERIFIED + 1 OUTDATED on inflated 122-hit count). 5/5 reviewers = NOT DEGRADED. | n/a — first council on payroll positioning + post-Phase-5 sortie planning. | ADR-0346 NEW (accepted — Lønnsgrunnlag positioning canonical). | L-0284 NEW (promote — briefing hit-count inflation pattern, 3rd occurrence). L-0285 NEW (proposed — sortie candidate freshness check, `git log --all --grep` before nomination). L-0147 7th + 8th precedents (same synthesis dual-reversal on S2 + S3) — amends L-0283. **Semantic conflict resolution (4 pairs):** (1) Steward "REJECT all S3 candidates" vs Agent-Coord "Pick F-CL-12" vs Supervisor "Pick Phase 4 polish" — DIFFERENT, Agent-Coord wins on code-trace at 3 tool sites + helper exists; (2) Steward "S2 REJECT no scope" vs Frontend-Designer "S2 APPROVE WITH falsifiable scope" — REVERSED, Frontend wrote the missing scope; (3) Supervisor "5 files / 8 hits" vs Steward "5 code + 131 docs" vs briefing "122 hits" — RECONCILED, same orders of magnitude different granularity, Supervisor's 8-hit live UI count authoritative; (4) Steward "rescope S1" vs Frontend-Designer "S1 APPROVE WITH 3 GUARDS" — SAME OUTCOME, Frontend's 3 guards (QuickPathCards wrap-risk, LonnsgrunnlagViewer:101 pedagogy preservation, i18n JSON grep) adopted as S1 acceptance. **Chair Self-Reversal Phase 5 §1.5 explicit on BOTH S2 + S3** — 7th + 8th codified L-0147 precedents in single synthesis. **Agent Trust Gate GREEN** for F-CL-12 all 3 tools: helper at `packages/payroll-export/src/feriepenger.ts` exists, F-CL-13 commit `58d40f500` establishes pattern, telemetry events registered. Pontus approved verdict 2026-05-16 → execution: /sync-campaign + Phase 7-8 capture (this) + S3 dispatch first, then S1‖S2. |
| 2026-05-14 (late evening) | ADR-0325 decision — tool-name discipline; pick A/B/C/hybrid for 11 confirmed tool-registry collisions | spec | **APPROVE Hybrid D+C+A-targeted-on-survivors** — 3-phase sequenced: Phase 1 detector (this sortie), Phase 2 semantic dedupe (follow-up sortie, 1-2 weeks), Phase 3 targeted rename on survivors (after dedupe, ~3-5 names). Rejected wholesale A (30:1 churn), Option B alone (parallel-registry smell), Option A on 11 (entrenches name-as-identity). | system-steward (chair, opus — Phase 3 + Phase 5 with **L-0147 Chair Self-Reversal precedent #6** on collision count 9→11 + Option B feasibility + missing Alternative D), supervisor (opus — verified telemetry-registry precedent 12,914 lines proves central-allowlist manageable; flagged voice view-tool L-0234 fresh convention untouched), system-agent-coordinator (opus — Code-Tracer; verified page-tool registry doesn't reach LLM today via voice-agent static catalogue + LiveKit stub + zero prompt hits; identified latent bomb when LiveKit stub becomes real), botsson-harness-builder (sonnet — full sweep confirms 11 collisions not 9; verified 241 modelToolName across 46 bridges; capability registry 29 entries proven manageable precedent), frontend-designer (sonnet — **Alternative D semantic dedupe** outpaced 3 opus chairs; reframed collision-as-duplicate-OR-conflict; Phase 2 dedupe likely collapses 6-8 of 11 to shared mounts). 5/5 reviewers, NOT DEGRADED. | yes — ADR-0324 (page-tool authority semantics, this morning) held + extended; ADR-0325 was proposed-by-same-council, now accepted. | ADR-0325 REVISED (proposed → accepted as Hybrid D+C+A). ADR-0326 NEW (page-tool registration semantics — sharedMount flag, identity invariant, three-layer affordance taxonomy). | L-0267 NEW (briefing collision counts are spot-checks), L-0268 NEW (naming churn cost bounded by name flow), L-0269 NEW (frontend reframe outpaced opus chairs). Note: assigned to 0267/0268/0269 due to 0261/0262/0263 taken by concurrent pipeline-traps council same session. **Semantic conflict resolution (4 pairs):** (1) Collision count 5/9/11 — RECONCILED: 5 = spot-check, 9 = briefing, 11 = full sweep (authoritative); 2 = practical co-mount UX. (2) Steward Phase 3 dot-separated vs Supervisor camelCase-integrated — RESOLVED to camelCase (`getKommUnreadCount`) per Frontend's voice-narration critique + L-0234 precedent. (3) Agent-Coord Option A vs Supervisor Option B — both code-traced, DIFFERENT scopes, RESOLVED via Alternative D (Frontend's reframe both A and B as local optima on structural duplicate). (4) Frontend Alternative D — PARTIAL OVERLAP with everyone else; reframed problem. **Chair Self-Reversal Phase 5 §1.5** explicit on 3 Phase 3 claims (collision count, Option B feasibility, missing Alternative D). **6th codified L-0147 precedent.** Pontus approved verdict → Phase 1 detector + Phase 8 capture (this sortie). Phase 2 dedupe + Phase 3 targeted rename queued as follow-up sorties. |
| 2026-05-14 (evening) | Polish-Wave QA Pass — 33 dashboard polish bridges + 37 polish commits shipped same day. R1 audit. | post-implementation | **APPROVE WITH CHANGES** — 2 BLOCKERS (B1 shift-clock 7 dead-drop CustomEvents incl my-contract:download + setup:advance; B2 EditDepartmentDialog ungated browser-direct mutation amplified by openDepartmentEdit bridge tool); 4 MUST-FIX (M1 ADR-0238 build-or-retract — 40+ phantom comment refs; M2 docstring compliance sweep — L-0176 sweep across _tools/_hooks JSDoc; M3 tool-registry collision detector — 9 confirmed name collisions; M4 authority-config seeds for 33 bridge tools); 3 DEFER (D1 run.yml umbrella false-positive resolved; D2 season Server Action C4 compliant; D3 voice-channel guard per-bridge wave-wide). | system-steward (chair, opus — Phase 3 + Phase 5 **L-0147 Chair Self-Reversal precedent #7** counting morning's #6 from pre-promote council ADR-0323 — missed EditDepartmentDialog + tool-registry collisions + proposals docstring; extended via Agent-coord + Supervisor code-trace), supervisor (opus — ACCEPT with 1 promote-blocker; refined L-0255 "low contained" not "32 of 33 broken"; verified gate-action-coverage polarity excludes bridge dir by design; verified typecheck clean), system-agent-coordinator (opus — Code-Tracer; extended dead-drop count from 5 to 7 events across 3 bridges; found EditDepartmentDialog C-2; identified 9 name collisions C-4; flagged voice-channel guard gap C-5; flagged authority-seed gap C-6; per-tool Trust Gate table 2/5 PASS = 60% sample failure rate), botsson-harness-builder (opus — quantified mutation surface: 7 CustomEvent bridges, 5 TanStack-delegate, 2 Server-Action, 0 direct-Supabase; BOTSSON-SYSTEM-MAP 27 entries stale post-morning-refresh; DomainChatOwnership component confirmed non-existent), frontend-designer (sonnet — DEGRADED: smart-explore skill loop blocked file reads; inference-only review; confirmed ADR-0238 escalation threshold reached). 4.5/5 reviewers effective (frontend partial). | yes — morning's pre-promote council (ADR-0323) verdict held + extended; 6 of 7 originally-flagged bridges (notifications/calendar/komm/governance/year-wheel/reconciliation/season) included in same-day wave + audited intact. | ADR-0324 NEW (proposed — Page-tool authority semantics: read/navigate/propose modes; propose-* tools are confirmation-flow openers not C4-bearing; CustomEvent dispatcher MUST have matching addEventListener OR use uiActions injection; B1+B2 failure patterns canonicalized). ADR-0325 NEW (proposed — Tool-name discipline: page-scoped prefix convention; 9 collisions from wave; M3 sortie ships Option C collision detector; prefix-convention decision deferred to follow-up council). | L-0256 NEW (Bridge CustomEvent dead-end — 7 instances 2026-05-14, sibling L-0176/L-0178/L-0254), L-0257 NEW (ADR-0238 phantom-contract accumulator — 40+ comment refs to non-existent DomainChatOwnership, build-or-retract threshold reached), L-0258 NEW (Tool-registry Object.assign collision — 9 confirmed, silent last-wins, CI detector needed), L-0259 NEW (Hook-emit-location docstring drift — hook JSDoc lies about emit location vs BFF, L-0176 sibling), L-0260 NEW (Polish-wave amplifies pre-existing debt — agent-callable bridge mounted on page with ungated mutation expands blast radius from user-only to agent-triggers; EditDepartmentDialog example). **Semantic conflict resolution (4 pairs):** (1) Supervisor "use-punch.ts mobile-only" vs Steward "useShiftClock.ts web 9 emit calls" — RESOLVED: both exist independently, web hook real (8 emit not 9), Option A feasible; (2) Supervisor "L-0255 low contained" vs Steward Phase 3 "32 unaudited" — SAME observation different lenses (Supervisor counted broken-bridges = 1, Steward counted unaudited-bridges = 32, both correct in their axis); (3) Agent-coord 7 dead-drops vs Steward Phase 3 5 dead-drops — EXTENSION not conflict (Agent-coord found my-contract + setup beyond shift-clock); (4) EditDepartmentDialog ungated mutation: Agent-coord found in Phase 3 code-trace; Steward missed in Phase 3 sample — REVERSED via L-0147. **Chair Self-Reversal Phase 5 §1.5** explicit, 7th codified precedent (counting morning's #6). **Agent Trust Gate per-bridge (5 sampled, 60% fail):** shift-clock FAIL (5 dead-drops); year-wheel PASS w/ name-collision flag; hms PASS w/ name-collision flag; organization FAIL (B2 amplifies pre-existing); my-contract FAIL (1 dead-drop). Pontus approved verdict 2026-05-14 → B1+B2 sortie dispatched in parallel with this Phase 8 capture. |
| 2026-05-14 | Pre-Promote-Preview Pipeline Review — dev (`1b2ea7ec6`) → preview (`edfb47a7f`), 169 commits, 20 migrations, 17 ADRs | architecture | **APPROVE WITH CHANGES** — 3 merge-blockers (P1 notifications emit, P2 /dashboard/my-day site-map, P3 BOTSSON-SYSTEM-MAP refresh) all shipped pre-HOP A as commits 5df7e96b0/c1920984e/542a6c432. 9 deferred-tickets registered as SMA-362..370. | system-steward (chair, opus — Phase 3 + Phase 5 with **L-0147 Chair Self-Reversal precedent #6** on "0 ON CONFLICT" claim — Supervisor verified 60 idempotency guards), supervisor (opus — ACCEPT, idempotency posture verified, court_order PDF-preview gate confirmed, mobile contracts/send 0 hits), system-agent-coordinator (opus — Code-Tracer Mandate; per-tool compliance verified for legal/payroll/task/court_order BFF; pos/scheduler/shift_marketplace phantom-contract flagged as DEFERRED-safe), botsson-harness-builder (opus — L1-L5 status: 7 new bridges green, task cap green, pos/scheduler/marketplace red, komm DomainChatOwnership debt FLAGGED as pre-existing not regression), frontend-designer (sonnet — komm DomainChatOwnership HIGH then resolved as pre-existing, Min Dag site-map gap confirmed via orchestrator grep, ReconciliationView motion-token debt). 5/5 reviewers = NOT DEGRADED. Phase 2.5 fact-check skipped (intake direct git/grep, not agent-derived). | n/a — first pre-promote council. Sibling pattern: 2026-05-13 first prod release PR #381 (informed conditions on smoke-prep + lkg-tag manual). | ADR-0323 NEW (proposed — Pre-Promote-Preview Council Protocol, formalizes trigger thresholds + 5-reviewer pattern + Phase 1-8 shape). | L-0253 NEW (chair must grep before negative count claims, 6th L-0147 precedent), L-0254 NEW (harness bridges re-expose pre-existing emit gaps as agent-callable; sibling L-0083/L-0177/F-CT-01), L-0255 NEW (ASCII-only filenames; `paragraf` not `§`). **Semantic conflict resolution (5 pairs):** (1) Chair Phase 3 "0 ON CONFLICT" vs Supervisor "60 idempotency guards" — REVERSED via grep; (2) Agent-coord "phantom-contract" vs Harness "registry 29→30 only" vs Chair "code ahead of corpus" — SAME observation 3 framings; (3) Frontend "komm DomainChatOwnership shipping-blocker" vs Orchestrator "pre-existing not regression" — DIFFERENT layers; (4) Frontend "Min Dag unverified" vs Orchestrator "site-map missing entry" — confirmed gap, not conflict; (5) Agent-coord C-D vs Harness L1 on notifications bridge — different facts (Harness re: new tools, Agent-coord re: underlying hook), both true. **Agent Trust Gate:** PASS for legal/payroll/task/court_order; CONDITIONAL FAIL for notifications bridge (closed by P1); DEFERRED-safe for pos/scheduler/shift_marketplace (gate-fail-graceful). **Chair Self-Reversal Phase 5 §1.5** explicit. **6th codified L-0147 precedent.** Pontus approved verdict 2026-05-14 → P1+P2+P3 sortie + 9 Linear tickets + (this) Phase 8 capture. |
| 2026-05-12 | Payroll Day-3 `payroll.period_locked` notification handler architecture — 3 coupled decisions (Edge Function location D1, test framework D2, dispatcher wiring D3) on `PLAN-mvp-blockers.md` Task 14. | architecture | **APPROVE WITH CHANGES** — D1B (no new Edge Function, subscriber engine_process triggered by dispatcher), D2C now → D2A at Phase 4 (skip Deno test now per `update_context_targeted` precedent; Playwright E2E blocking at Phase 4), D3A.3 (NEW `notify_each_profile` dispatcher action_type, mirror ADR-0236). 2 BLOCKING amendments before sortie: (1) add `notify_each_profile` to `GATED_MUTATION_TYPES` set per ADR-0287/0099; (2) resolve dual-emit F-CT-01 at `tools.ts:901-918` + `route.ts:163-180` — kill capability emit (zeros). | system-steward (chair, opus — Phase 3 + Phase 5 with explicit Chair Self-Reversal per L-0147, 6th codified precedent — see L-0236), supervisor (opus — REJECT plan-literal, found C1-C6 critical bugs including schema drift, idempotency column missing; proposed D3.A.2 reuse send_notification+generate_steps), system-agent-coordinator (opus — Layer 2 + 4 trace, INVALIDATED Supervisor's D3.A.2 by tracing `generate_steps` at `index.ts:1961` hard-wired to protocol_assignment source; proposed D3.A.3 NEW action_type), botsson-harness-builder (opus — L1-L5 pipe + 2 amendments: GATED_MUTATION_TYPES set membership + dual-emit cleanup; corrected Supervisor+Agent-coord "no gate needed" claim — `send_notification` IS gated via state.process_id), general-purpose (sonnet — Phase 2.5 fact-check 10/15 VERIFIED + 2 FALSE + 1 OUTDATED). Skipped: frontend-designer (pure backend), narrator (orchestrator inline synthesis). 4/5 reviewers = NOT DEGRADED. | Yes — ADR-0235 (Helpdesk SLA breach handler, 2026-04-29) directly applicable. Codified pattern: cross-process consumer reactions to engine_event flow through `engine_trigger → engine_process → engine_state → dispatcher action_type`. Direct invoke (D3.B) is ADR-0235-rejected class. Pattern held. | ADR-0319 NEW (proposed — `notify_each_profile` dispatcher action_type, mirrors ADR-0236 `update_context_targeted` sibling-action-type precedent; subscriber `engine_process` rides existing `capability="payroll"` seed at `20260527100100_payroll_phase1_authority_seed.sql:38`; Day-3 sortie 6-step shape codified including Amendment 1 (GATED_MUTATION_TYPES) + Amendment 2 (dual-emit cleanup)). | L-0236 NEW (6th codified L-0147 Chair Self-Reversal precedent — Steward Phase 3 read wrong branch `development` instead of worktree `feat/payroll-mvp-blockers`, made false-state claims, REVERSED at Phase 5; new preflight `git branch --show-current` + `git log --oneline -5` + `wc -l` + `ls` mandatory before Phase 3 read; briefing-format amendment requires explicit `cwd: <worktree-path>` + branch state header). L-0237 NEW (5th codified F-CT-01 occurrence — dual-emit capability tool + BFF route; capability tool ships first iteration with hardcoded/incomplete data, BFF route ships later with real resolver, capability emit not retired; CI grep check proposed for `feat/gate-action-coverage-ci`). L-0235 NEW (hardcoded zeros in capability-tool emit data fields is a tell that route version exists; pattern: literal `0` in emit data is almost always duplicate emit (L-0237) OR silent data loss OR author-known incomplete; code review heuristic + CI lint pattern `(_count\|_total\|amount\|size\|sum):\s*0,` in emit blocks). **Semantic conflict resolution (6 pairs):** Supervisor "no gate needed" vs Harness "send_notification IS in GATED_MUTATION_TYPES at :646" — DIFFERENT, Harness wins on code-trace; Supervisor "reuse send_notification+generate_steps D3.A.2" vs Agent-coord "generate_steps hard-wired to protocol_assignment, can't fan out" — DIFFERENT, Agent-coord wins; D2 split Steward+Supervisor+Agent-coord "A Deno test" vs Harness "C skip" — DIFFERENT, resolved to C now → A at Phase 4 per update_context_targeted precedent; All four on D1B — SAME; All four on D3.B rejected — SAME; Agent-coord "no authority seed needed" vs Harness "MUST seed" — PARTIAL WIN (gate is default-allow-with-warning not default-deny per `20260516130000_gate_action_unseeded_warning.sql:273`; subscriber rides existing capability=payroll seed). **Agent Trust Gate:** CONDITIONAL PASS for ADR-0099/0287 (gated on Amendment 1); PASS for ADR-0091/0151/0161/0163/0186/0235; ADR-0173 misframed in brief (frozen-4 are JOURNEY capabilities only, not dispatcher action_types — does NOT block new action_type). Pontus approved verdict 2026-05-12 → Day-3 sortie cleared with 2 blocking amendments. |
| 2026-05-14 | Track A — Min Dag plassering. Two competing options: (A) inject as tab inside `/dashboard/calendar` DayView, (B) separate top-level route `/dashboard/my-day`. Context: ADR-0298 declares 5 task sources + `fn_list_my_tasks` UNION RPC; ADR-0300/0301/0302 already shipped read+capability+mobile-Kalender wire. Min Dag = today's view aggregating session_task + schedule_day_task + personal_task + emma_task. | architecture | **APPROVE Option C (hybrid = Option B + boundary clarification) — DEGRADED-MODE.** New route `/dashboard/my-day` as 7th `my-*` family sibling. Existing `OppgaverTab` in DayControl stays narrow (manager-curated `schedule_day_task` only). No schema, no capability, no migration. Reads `fn_list_my_tasks`, writes via existing `task.*` capability. Mobile parity: `(me)` tab default route. Two new path-gated view-mirror tools (`set_my_day_filter`, `focus_my_day_section`). | system-steward (chair, opus — perspective written inline by orchestrator citing real code: cascade-role purity argument; mixing C2 + D6 under D6 surface = wrong; `my-*` family pattern; honors canonical handoff), system-agent-coordinator (sonnet — perspective written inline by orchestrator: site-map cleanliness, path stability via stable `/dashboard/my-day` vs fragile `?tab=&day=` query state; ownership boundary L-0178/ADR-0238; view-mirror tools cleaner; BFF context extension for `my_open_tasks_count`), frontend-designer (sonnet — perspective written inline by orchestrator: click-depth penalty 3→1; `my-*` family discoverability; visual rhythm preservation; mobile parity 1:1; honors canonical handoff). Phase 2.5 fact-check (inline): briefing's framing of "Option A = frontend-designer prior recommendation" SUPERSEDED by canonical handoff `docs/modules/task-manager/taskmanager-handoff/README.md` which already declares Min Dag = forsiden (det første en ansatt ser når de åpner Smartout); existing `apps/web/src/app/dashboard/schedule/_components/day-control/OppgaverTab.tsx` shows `schedule_day_task` only, narrower than Min Dag — boundary clarification needed. **DEGRADED-MODE rationale:** Agent/Task tool not available in current environment; three perspectives written inline by orchestrator citing real code paths (CalendarPageShell, OppgaverTab, my-schedule sibling, fn_list_my_tasks RPC) drawn from Read tool. Three perspectives convergent; no 2-1 split; no chair reversal; no semantic conflict requiring resolution. **ADR slot reservation:** Track A brief reserved ADR-0310 — slot was taken across all branches (`0310-§14-6-rule-table-driven-aml-validation.md`) plus 0311-0315 also taken. Per Phase 8 Step 0 rule, advanced to next free slot **ADR-0316** (verified `git log --all --name-only`). | n/a — first council on Min Dag placement. Sibling councils: ADR-0298 parent (Mobile Oppgaver Council 2026-05-12), ADR-0302 (Sortie 4 mobile Kalender wire). | ADR-0316 NEW (proposed — Min Dag plassering, dedicated employee surface). | L-0252 NEW (canonical — Cross-cascade-role projection surfaces belong on their own route, not as tabs of single-dimension shells; meta-pattern surfaced via Phase 5 synthesis after observing council reframed "tab vs route" framing into "single-dimension vs cross-dimension surface" framing; promote to SKILL.md on 3rd occurrence). **Semantic conflict resolution (1 pair):** Option A "tab inside Kalender" vs Option B "dedicated route" — DIFFERENT (incompatible surface-ownership shells), not partial overlap; no papering needed. **Agent Trust Gate:** PASS — topic touches `task` capability surface but does not add or modify mutation tools; two new view-mirror tools (`set_my_day_filter`, `focus_my_day_section`) are path-gated read-only on UI state; pipeline ready. **Mobile boundary (ADR-0133):** CLEAN — Min Dag is execute-leaning (employee reads + completes), mobile mirror at `(me)` tab default route reads same RPC; web `/dashboard/my-day` ↔ mobile `(me)` 1:1 mapping; mobile Kalender per ADR-0302 stays date-anchored execution surface (complementary, not competing). **Phase 9 Self-Improvement:** Phase 2.5 fact-check caught load-bearing canonical handoff; observation added to council_meta — "When IA placement is the topic, Phase 1 INTAKE must explicitly search for existing canonical handoff documents in `docs/modules/<surface>/` before drafting the briefing. Briefing framings derived from agent recommendations should be sanity-checked against existing handoff if one exists." 1st occurrence today; promote to SKILL.md Phase 1 INTAKE step on 3rd. Pontus to approve verdict before implementation sortie. |
| 2026-05-14 | G2 — Phase 3f `(home)` absorption mapping + sortie split decision. 19 files (~8995 LOC) under `apps/mobile/app/(app)/(home)/`; ABSORB into `(shifts)`/`(me)`/`(calendar)` + DELETE 3 + DEFER 1 per A2 matrix. Original single-sortie plan 11× over LOC budget. | architecture | **GO WITH CHANGES** — 4-sortie split (3f.1/3f.2/3f.3/3f.4). Order inversion: retarget 25 inbound importer sites BEFORE any (home) file moves. Compliance fixes bundled with absorption (temp-deviation:162 ADR-0287 + edit-profile ADR-0134/0287). 3f.1 (THIS wt-4) scope revised: audit doc + `shift-hub.tsx` delete + 4-sortie roadmap handoff. 3f.2/3f.3/3f.4 deferred. | system-steward (chair, opus — Phase 3 GO WITH CHANGES + Phase 5 explicit Chair Self-Reversal on A1 "0 cross-folder importers" claim; **7th codified L-0147 precedent**; verified 25+ external sites via 7 importer classes), supervisor (opus — Layer 3 trigger/constraint scan no `(home)` references in migrations; pre-merge order inversion mandate; per-file Trust Gate; `(shifts)` convention check), system-agent-coordinator (opus — defended A2 matrix with deeper Layer 2+4 trace; verified shift-hub.tsx 0 inbound router.push; component-folder vs route-folder distinction; ADR-flagged item depth-verification: availability D2 authoring confirmed RRULE templates, edit-profile direct supabase.update L115 + L90 storage upload + 3 Trust Gate failures, temp-deviation:162 direct write confirmed, spokesperson:47 RLS-only forgeable-ID risk, team* PII surface email+phone), botsson-harness-builder (sonnet — ADR-0133 verb-class verification per cluster, Trust Gate per-file PASS/FAIL/UNVERIFIED matrix; edit-profile FAIL ADR-0133+0134+0287, temp-deviation FAIL ADR-0287, punch-clock+clockout UNVERIFIED need body re-trace in 3f.2; sortie order recommendation 3f.0 prerequisite for availability+edit-profile fixes; `components/home/` survives route deletion), frontend-designer (sonnet — Q1 tab overload risk in `(shifts)` 8-file dump needs sub-routing, Q2 `(me)` cluster cohesion + training as named sub-group, Q3 Nordic Split preservation 3 risks during move, Q4 operations vs existing calendar weekly strip duplicate-merge required, Q5 shift-hub DELETE safe with NoShiftView render-path verified via ShiftClockView, Q6 hms.tsx → FAB AddSheet per Nordic Split way, Q7 sortie order inversion mandatory). Phase 2.5 skipped — A1+A2+A3 audits run <30 min prior with file:line citations. 5/5 reviewers — NOT DEGRADED. | Yes — 2026-05-14 ADR-0268 accept verdict held; this G2 extends ADR-0268 execution into 4-sortie split. Prior sortie `mobile-adr-0268-audit` (closed `fd77b4b0c`) seeded the audit base. | ADR-0268 AMENDED (Council G2 verdict cross-reference + 4-sortie roadmap + L-0250/L-0251 cross-references). | L-0250 NEW (canonical — Route-group absorption requires inbound-importer audit, 7-class taxonomy not just route-tree grep). L-0251 NEW (canonical — Component-folder location aligns with route-folder during route moves). L-0147 7th codified precedent (Chair Self-Reversal on A1 "0 cross-folder importers" claim falsified by 25+ external sites). **Semantic conflict resolution (2 pairs):** (1) Steward "edit-profile APPROVE as R3 self-service" vs Harness "edit-profile FAIL ADR-0134/0287" — DIFFERENT layers (ontology permits verb vs implementation violates ADRs). Resolved: APPROVE absorption target + REQUIRE compliance fix in same commit. (2) A1 "0 cross-folder importers" vs Steward Phase 5 "25+ external sites" — REVERSED via code-trace. **Trust Gate per sortie:** 3f.1 PASS (no mutations), 3f.2 CONDITIONAL FAIL (temp-deviation + edit-profile need ADR-0287/0134 fixes; punch-clock+clockout UNVERIFIED), 3f.3 UNVERIFIED (spokesperson L-0177 + edit-profile awaiting 3f.2 fix). **Mobile boundary (ADR-0133):** Five flagged files — availability D2 authoring (DEFER to ADR-0133 R5 amendment), edit-profile R3 fuzzy (APPROVE with compliance fix), temp-deviation:162 + edit-profile direct writes (FIX BEFORE ABSORB), spokesperson L-0177 (fail-fast at move time), team* ADR-0267 PII (RLS audit before absorb). Pontus approved verdict 2026-05-14 → execution: 3f.1 audit doc + shift-hub.tsx delete + ADR-0268 amendment + L-0250 + L-0251 + 4-sortie roadmap handoff. 3f.2/3f.3/3f.4 spawn after 3f.1 closure. |
| 2026-05-14 | G1 — Scheduler bundle approval pattern (ADR-0307 + ADR-0309): single `change_proposal` row + JSONB array + atomic accept V1, OR per-row + `proposal_group_id` correlation column. Triggered by mid-PHASE-0 verification finding that change_proposal infra is single-row-only across all 12 sites. | architecture | **APPROVE WITH CHANGES — OPTION C** (single-row bundle + atomic accept V1; partial-accept deferred V2 with V2a/V2b paths documented). 5 merge blockers: (1) ADR-0309 written; (2) `change_proposal.kind='scheduler_bundle'` taxonomy add; (3) authority seed per ADR-0192 two-part pattern; (4) telemetry registry adds `scheduler.proposal.proposed/accepted/rejected`; (5) ADR-0307 amended with chair-reversal note. Mobile V1 bundle-granularity only. | system-steward (chair, opus — Phase 3 Option A → Phase 5 Option C explicit Self-Reversal per Skill §1.5; L-0147 7th precedent), supervisor (opus — Layer 3 trigger/constraint trace, found `payroll_proposal_applied_trg` `FOR EACH ROW` semantics + telemetry corruption case for Option B; verified `fn_payroll_proposal_applied:194` early-exit on non-payroll kinds → Option A trigger collision concern resolved), system-agent-coordinator (opus — Layer 2 column trace + Layer 4 capability-consumer scan, per-tool ADR-0287 compliance table; conceded chair on Q3 enum REUSE `manual_override`), botsson-harness-builder (sonnet — code-traced `mutate-with-gate.ts:255-409` single-call body = LOAD-BEARING falsifying evidence for Option A bulk-accept; voted Option B Phase 3, ultimately accepted Option C synthesis), frontend-designer (sonnet — Nordic Split 40% reduction + Android mid-tier animation budget falsified Option A default-all-checked column UX; voted Option B Phase 3, accepted Option C synthesis with mobile V1 = 3 components scope). general-purpose (haiku — Phase 2.5 fact-check, 12 claims: 9 VERIFIED, 3 FALSE-or-OUTDATED, briefing corrected before Phase 3 dispatch). 5/5 reviewers — NOT DEGRADED. | n/a — first council on scheduler bundle approval pattern. Sibling pattern from 2026-05-04 Welcome Mission V0 council (5th L-0147 precedent on Phase 3 → Phase 5 chair self-reversal) and 2026-05-13 SMA-326 council (6th precedent). This is the **7th codified L-0147 precedent**. | ADR-0309 NEW (proposed — Scheduler Bundle Proposal Pattern; canonical persistence + accept semantics). ADR-0307 AMENDED (chair-reversal note + Persistence/Capability/Telemetry/Agent-Impact lines superseded by ADR-0309). | L-0247 NEW (proposed — Pattern selection must check runtime helper constraints, not just data-model invariants; sibling L-0176 docstring-vs-body, L-0202 sibling-table over-engineering). L-0248 NEW (proposed — Provenance for solver-triggered proposals lives in JSONB `changes`, not `framework_trigger_type` enum; sibling L-0192 authority-via-registry). **Semantic conflict resolution (5 pairs):** (1) Chair (A) vs Harness (B) on cascade compliance — DIFFERENT load-bearing, both correct in their layer (chair = data-model invariants, harness = runtime helper structural constraint), Option C dissolves. (2) Chair (A) vs Frontend (B) on UX — DIFFERENT load-bearing, Frontend wins on V1 device-class reality (50 simultaneous springs stutter on mid-tier Android). (3) Supervisor vs Agent-Coord on accept-bundle scope — SAME (both want scheduler-owned, non-shared). (4) Agent-Coord vs Chair on Q3 enum — PARTIAL overlap, Agent-Coord wins (provenance lives in JSONB not enum). (5) Harness (B) vs Frontend (B) — SAME (independent code-traces converging from runtime + UX angles). **Chair Self-Reversal Phase 5 §1.5**: Phase 3 Option A vote REVERSED to Option C. Falsifying evidence: `mutate-with-gate.ts:255-409` body (Harness) + Nordic Split + animation budget (Frontend). Classification REVERSED, NOT REFINED — Option C is structurally different from A (single row, no per-row status, no per-row gate), not refinement. **Agent Trust Gate**: CONDITIONAL PASS for scheduler capability — pipeline ready after 5 merge blockers cleared (ADR + telemetry registry + authority seed + kind taxonomy + ADR-0307 amendment). Pontus approved verdict 2026-05-14 → execution: Phase 7 docs update (ADR-0309 + ADR-0307 amend + decision-log + COUNCIL-LOG + learnings + council_meta), then Phase 1 foundation sortie awaiting `/start-feature wfm-foundation` worktree approval. |
| 2026-05-14 | ADR-0268 TabBar Canonical Layout — ready to flip `proposed` → `accepted`? (post-implementation verification; 2 questions: (komm) continuity per checklist item 4 + full 1-5 review) | post-implementation | **GO WITH CHANGES** — 4 ADR text fixes applied (lines 37, 66, 126, checklist item 4); ADR-0163 cross-references corrected to ADR-0161 + ADR-0162; (komm) clarified as RETAINED route + deep-link target, not deleted; status flipped to `accepted` 2026-05-14. | system-steward (chair, opus — Phase 3 GO WITH CHANGES + Phase 5 inline synthesis via orchestrator; 4 text-fix recommendations), supervisor (sonnet — quality gate + scope compliance + Trust Gate N/A documentation-only; concurred on text fixes + flagged additional `deep-links.ts:50,64-65` `(home)` deeplinks as legitimized hidden-route pattern), system-agent-coordinator (opus — Code-Tracer Mandate Layer 2+4: traced push→deeplink→`(komm)/[channelId].tsx`→`use-ticket.ts:35-106` reads `engine_state` per ADR-0161; verified Chat tab `(chat)/index.tsx:57,553-554` consumes `QueueRow` + routes to same `(komm)` detail; verdict item 4 SATISFIED via fallback), botsson-harness-builder (sonnet — ADR-0133 + ADR-0163 PII fence at Layer 2 SATISFIED via `packages/ai/src/capabilities/helpdesk_query/index.ts:29`; verdict item 4 NOT SATISFIED until checklist records (komm) retention decision — resolved by text fix). Skipped: frontend-designer (no UI design change, documentation-only flip), narrator (orchestrator inline synthesis). 4/5 reviewers = NOT DEGRADED, skips justified by no-new-UI + no-narrative scope. Phase 2.5 fact-check skipped — files pre-verified via 2026-05-13 A1+A2 audits and orchestrator-direct briefing. | Partial — 2026-04-19 Kanaler-som-Helpdesk council (ADR-0160/0161/0162/0163 ontology + Phase 1 sequencing) held; 2026-04-20 Helpdesk Phase 1 UI council held (helpdesk surface lives in Chat tab "Skranke" segment + `(komm)/[channelId]` detail). ADR-0268's claim of "Chat absorption per ADR-0163" was wrong cross-reference (should be ADR-0161/0162). | None — no new ADR. ADR-0268 amended (cross-references + status flip + checklist final-state). | L-0249 NEW (canonical — ADR cross-reference content-drift; cite ADRs by title + number, never bare number; 5th cross-reference incident overall, 1st content-side, prior 4 were renumber-side per `reference_adr_renumber_pattern.md`). **Semantic conflict resolution (1 pair):** Agent-coord "item 4 SATISFIED via fallback" vs Harness "item 4 NOT SATISFIED until decision recorded" — DIFFERENT layers (code reality vs ADR text). Both right; resolved by fixing ADR text to record the retention decision. **Trust Gate:** N/A — ADR-0268 governs mobile tab navigation only; no mutations, no capabilities, no Edge Functions, no `emit()` calls. Documentation-only flip. **Mobile boundary (ADR-0133):** CLEAN — 5-tab layout maps to verb classes (Kalender D6 read, Vakter D6 read+execute, FAB AddSheet, Chat communication, Min Tid D6 personal). **ADR-0163 PII fence:** SATISFIED at Layer 2. Pontus approved verdict 2026-05-14 → execution: 4 text fixes + decision-log + L-0249 + this entry. |
| 2026-05-13 | SMA-326 isoWeek/isoYear NaN bug — backfill scope decision (Q1 strategy + Q3 sortie-creep) | architecture (bug-fix + data-recovery scope) | **APPROVE WITH CHANGES** — Q1=Option B-via-recompute (NO migration; trust `run-deviation-checks/route.ts:292-300` auto-DELETE-and-reinsert on next recalc). Q3=stay in original sortie scope (5-LOC fix + 3 regression tests, no split, no follow-up sortie). R3 reclassified CRITICAL → MEDIUM (W03 warning + W04 info severity, neither blocks period approval per `lock-period:97-104`). | system-steward (chair, opus — Phase 3 + Phase 5 w/ explicit Chair Self-Reversal: Track A R3=CRITICAL → MEDIUM after severity code-trace at deviation-checks.ts:187,245; 6th codified L-0147 precedent), supervisor (opus — Layer 3 trigger/constraint scan + scope-creep guard; 4 of 4 prior COUNCIL-LOG comparable cases split-pattern; Trust Gate PASS pure-function), system-agent-coordinator (opus — Layer 2 column-trace details.week + message text both poisoned; Layer 4 zero AI consumers confirmed, UI consumer DeviationList.tsx:122 renders message literal). Skipped: frontend-designer (no UI design change), botsson-harness-builder (not Botsson harness — payroll module backend), narrator (orchestrator inline synthesis). 3/5 reviewers = NOT DEGRADED, skips justified by backend-only + non-Botsson scope. | n/a — first council on derived-state-corruption-recovery pattern. Prior sibling 2026-04-23 Journey Engine post-impl council established 4-phase remediation-split pattern (separate-sortie-per-phase); SMA-326 inverts: NO split because recovery is auto-derivation, not data-op. | None — no new ADR. Proto-ADR for "Derived-state corruption recovery via canonical re-derivation" deferred to 2-3 more occurrences. | L-0238 NEW (canonical — derived-state-table corruption recovers via canonical re-derivation, not migration). **Semantic conflict resolution (3 pairs):** (1) Steward "no migration, trust auto-recovery via 292-300" vs Supervisor "split into separate backfill sortie" — DIFFERENT, Steward wins on cascade architecture (payroll.deviation is D6 derived state, recovers via re-derivation per invariant #3). (2) Steward "no AI consumer" vs Agent-coord "zero AI/voice consumers + DeviationList renders message literal" — SAME core (no AI) + complementary (UI surface confirmed). (3) Track A "R3 CRITICAL — blocks period approval" vs Steward "warning/info, no block" — DIFFERENT (Track A misread severity), Steward wins on direct code-trace of severity literals deviation-checks.ts:187,245. **Chair Self-Reversal Phase 5 §1**: Phase 3 R3=CRITICAL claim REVERSED to R3=MEDIUM after Steward + Agent-coord code-trace evidence (lock-period gate filter + UI consumer scope). 6th codified L-0147 precedent — pattern stable. **Agent Trust Gate**: PASS for fix — zero hits on `useMutation\|Server Action\|emit(\|supabase.from\|createClient\|capability` in `deviation-checks.ts` diff (pure function). **Mobile/Botsson boundary**: CLEAN — no mobile, no AI, no capability registry change. Pontus approved verdict 2026-05-13 → execution: Track B (build fix + 3 regression tests), Track C (code-reviewer), Track D (Linear comment posted https://linear.app/smartout/issue/SMA-326), Track E (Phase 8 knowledge capture L-0238 + this entry). |
| 2026-05-04 | Welcome Mission V0 — implementerings-spec (`IMPLEMENTATION_SPEC_welcome_mission_v0.md` 500 linjer + ADR-0271/0272/0273/0274) | spec | **REJECT — REWORK REQUIRED** — 10 BLOCKERs + 8 HIGH + 5 MEDIUM. Trust Gate FAIL på alle 4 nye tools (note_inquiry, transition_to_other_mission, point_at_setting, show_demo). ADR-0273 + ADR-0274 må REWRITES; ADR-0271 + ADR-0272 APPROVE WITH EDITS. Spec til ny sortie m/B1-B10 fix-list, deretter R2-only review. | system-steward (chair, opus — Phase 3 + Phase 5 m/eksplisitt 5. self-reversal), supervisor (opus — code-trace 3 CRITICAL + 8 HIGH inkl. is_godmode bug + system_prompt collision + last_activity_at phantom), system-agent-coordinator (opus — Code-Tracer Mandate 10-point trace; theatre-vs-durability finding; telemetri space-form vs dot-form L-0046), botsson-harness-builder (opus — selv-kritisk review av egen output, 12-row 🔴-dependency-tabell, Law 1 violation outbox), general-purpose (haiku — Phase 2.5 fact-check, oppdaget ADR-stash). Skipped: frontend-designer (backend-tung, ingen UI/Nordic Split), narrator (orchestrator inline). 4/5 reviewers = NOT DEGRADED. | n/a — første council på welcome-mission. | ADR-0271 NEW (proposed — Multi-criteria Exit Criteria, APPROVE WITH EDITS). ADR-0272 NEW (proposed — Mission Template Registry, APPROVE WITH EDITS). ADR-0273 NEW (proposed — Two-Brain emit-pattern, REWRITE). ADR-0274 NEW (proposed — Mission Run Contract, REWRITE). Alle bumped fra design-doc 0270-0273 fordi 0270 var tatt av Business Intelligence capability. | L-0205 NEW (5. forekomst Steward Phase 3 reversal — promotert til permanent council fixture). L-0206 NEW (3. forekomst stashed-ADR pattern — Phase 1 INTAKE må verifisere `git ls-files` + stash). L-0207 NEW (phantom-tool pattern — Phase 0 fact-check må greppe capability registry). L-0208 NEW (column-name collision i spec'd migrations — Phase 2.5 må greppe nye column-navn mot existing schema). **Semantic conflict resolution (4 pairs):** ADR-0246 blocker (PARTIAL — Steward overshot, code-tracers correct), agent_inquiry vs engine_memory (PARTIAL — REFINED til MEDIUM), authority_snapshot konflikt ADR-0099 (DIFFERENT — Steward overshot, snapshot er audit-historisk), two-brain atomicity (SAME — alle 3 reviewers konvergerte på "theatre"). **Agent Trust Gate:** FAIL — 4 phantom tools, telemetri-registry not ready, intent-classifier binding mangler, migrasjoner not applied, ADR-er kun stashet. Pontus approved verdict 2026-05-04 → går videre med ny sortie for rework. |
| 2026-05-04 | Pipeline Consolidation v2 (`docs/plans/2026-05-04-pipeline-consolidation-v2.md`) — re-review post-v1-REJECT, plan claims to incorporate 34 fixes from v1 council + sideagent | plan (re-review) | **APPROVE WITH CHANGES** — 11 P0 + 5 P1 + 5 P2 blockers; rework dispatched to deploy-conductor agent → commit `2946f0cab` (status `dispatch_ready`). 4 operator-action items remain (PREVIEW_E2E_KEY, DEPLOY_TAP_WEBHOOK_URL, ruleset PATCH, branch-db.sh live test). | system-steward (chair, opus — Phase 3 + Phase 5 synthesis), supervisor (opus — scope + convention + verification gaps), deploy-conductor (opus — pipeline specialist code-trace), system-agent-coordinator (sonnet override — slash-command + ADR-0271 architecture lens), orchestrator (Phase 2.5 fact-check inline — 9/9 claims VERIFIED). Skipped: frontend-designer (no UI), botsson-harness-builder (no harness touch), narrator (orchestrator inline). 4/5 reviewers — NOT DEGRADED, skips justified by pure CI/CD-deploy scope. | Yes — 2026-05-04 v1 council REJECT held; v2 incorporated 34 fixes but Phase 3 chair caught only meta-pattern blockers (category error, ordering, paradox) while Deploy-Conductor + Supervisor + Coordinator code-traced 8 additional pipeline-mechanics blockers. **5th documented chair self-reversal** (per L-0147) — pattern stabilized: chair-meta + code-tracer-mechanics both required. | ADR-0270 NEW (proposed — ephemeral preview branch lifecycle). ADR-0271 NEW (status `pending` not `proposed` — autonomous /deploy + Telegram-tap; expanded with 6 sub-specs: execution model, tap handshake n8n webhook, state schema `.deploy-state.json`, TTL 6h, rollback scope = Vercel traffic only NOT git revert, concurrency guard via lockfile). ADR-0269 NEW (proposed — pre-PR quality gate Tier 0-3 architecture). All deferred to plan execution Phase 6. | L-0190 NEW (proposed) [deploy] tag does not propagate through `gh pr merge --merge` default subject — silent skip of 3 Vercel prod deploys every cycle without explicit `--subject "[deploy]"`; cross-link ADR-0265. L-0191 NEW (proposed) slash-command workflows >10min wall-time require external state machine — single-shot slash-commands cannot span human pauses; cross-link ADR-0271. L-0192 NEW (proposed) 5th chair self-reversal — chair-meta-blockers + code-tracer-mechanics-blockers both required; single-chair Phase 3 structurally insufficient for plans touching multiple subsystems; cross-link L-0147; **promotion threshold met (5 occurrences) — codify in SKILL.md Phase 3 dispatch rules**. L-0186/0187/0189 NEW (proposed) hold up; L-0188 (asymmetric reviewer coverage) DEMOTED to anecdotal — no dedup evidence. **Semantic conflict resolution (5 pairs)**: Phase 1 split (DIFFERENT — Steward keep bundled wins on intent-coherence; Supervisor correctness fixes accepted inside), Sortie vs direct (DIFFERENT — Supervisor sortie wins on history-fragmentation evidence, BUT deploy-conductor decided direct-development for plan-doc-only rework with 30+ commits deferred to plan execution), smartout-pwa (DIFFERENT — explicit 2/3 scoping wins over silent deferral), ADR-as-experiment (PARTIAL OVERLAP — Steward timing paradox + Coordinator content gap, COMBINED into `pending` status), Telegram-tap (SAME — Coordinator + Deploy-Conductor flag same gap, n8n webhook approach). **Agent Trust Gate**: not directly applicable (plan = governance, no new mutations). Pipeline Trust Gate: critical asymmetry between [deploy] tag promise (vercel.json `ignoreCommand`) and merge-commit reality (`gh pr merge --merge` default subject) caught only by Deploy-Conductor code-trace — Phase 3 chair missed. **User approved verdict 2026-05-04 → dispatched deploy-conductor for rework. Commit `2946f0cab`: 21 fixes applied, plan now `dispatch_ready` status.** |
| 2026-04-29 | Lovsen Hospitality Intelligence Member integration (post-council follow-up) | architecture + spec | **REJECT AS SPECIFIED — REDESIGN AS `legal` CAPABILITY** (not agent); 10 lov-amendments folded into ADR-0233/0234/0236 | lovsen (general-purpose persona — norsk arbeidsrett review HØY/MEDIUM/LAV confidence per substansiell påstand, 5 lov-traps + 7 ESKALÉR-flagg arbeidsrettsadvokat-review), system-steward (chair — verified peer agents Skiftleggeren/Vertinnen/Vinkjenneren do NOT exist via grep, ADR-0220 violation, Lovsen IS capability not agent, knowledge base belongs in K1a regulatory_framework not filesystem) | Yes — 2026-04-29 Contract Module Phase 0a council REJECT verdict held; Lovsen integration extends 4-ADR split with norsk arbeidsrett amendments + 1 new learning. | ADR-0233/0234/0236 amended — see commit history. | L-0181 NEW (persona vocabulary doesn't justify agent architecture). User approved verdict 2026-04-29. |
| 2026-04-29 | Contract Module Phase 0a Foundation (ADR-0001-contract-service + ARCHITECTURE-contracts-module + 0001_contracts_module_foundation.sql 525 lines atomic) | architecture + migration | **REJECT — DO NOT DEPLOY** (direction approved-with-major-changes; split into 4 globally-registered ADRs) | system-steward (chair, Phase 3 + Phase 5), supervisor (Layer 3 trigger/constraint code-tracer), system-agent-coordinator (Layer 2+4 capability-consumer trace), botsson-harness-builder (L4 cross-cutting laws), frontend-designer (UX), narrator (orchestrator inline) + general-purpose (Phase 2.5 fact-check, 18 claims: 13 VERIFIED, 2 FALSE, 3 UNVERIFIABLE) | n/a — first council on contract foundation. | ADR-0233 NEW (Contract Schema Migration Foundation). ADR-0234 NEW (Contract / Payroll Capability Split). ADR-0235 NEW (Obligation Lifecycle). ADR-0236 NEW (Amendment Flow + AcknowledgementRing). All 4 status `proposed`. Module-local ADR-0001-contract-service marked superseded. | L-0179..L-0174 NEW. **Agent Trust Gate**: FAIL — 6 pipelines cannot keep promise. User approved verdict 2026-04-29. |
| 2026-04-29 | Helpdesk Phase 2 SLA consumer-path bug — Approach A invalidated by build-time code-trace (T2 builder caught dispatcher resume model only matches `state.current_step`, sibling steps invisible) | post-implementation | **APPROVE A (revised)** — separate transient `helpdesk_sla_breach_handler` process + new `update_context_targeted` action_type, NOT cross-state extension of `update_context`. Trust Gate PASSES (gated through dispatcher); FAILS for Option B (Edge Function direct write). | system-steward (chair), supervisor (codebase-convention + Trust Gate), system-agent-coordinator (code-tracer end-to-end Layer 2+4), botsson-harness-builder (L1-L5 pipe + harness laws) + general-purpose (Phase 2.5 fact-check, all 9 claims VERIFIED). Skipped: frontend-designer (pure backend question), narrator (orchestrator-inline synthesis). 4/5 reviewers — NOT DEGRADED, skip justified by backend-only scope. | No — Council 2026-04-28 (Steward + Engine Architect + Code Architect) ratified Approach A as APPROVE WITH CHANGES; verdict held through Phase 5 → FAILED at T2 build-time when builder traced dispatcher behavior end-to-end. Pre-design council read dispatcher code lines 411-444 but missed sequential-resume implication. Chair Self-Reversal Protocol (L-0147) applied: prior Approach A consumer-path REVERSED, replaced by separate-handler-process pattern. 3rd "concept-review missed implementation reality" pattern (L-0023 + L-0036 + L-0160). | ADR-0235 NEW (helpdesk SLA consumer path — separate breach-handler process pattern, replaces ADR-0234 Approach A consumer mechanics; reusable for future authority-resolved-timeout capabilities), ADR-0236 NEW (`update_context_targeted` action_type — cross-state context patching with workspace integrity guard CVE-class; split from `update_context` rather than extension flag — 4 reasons: call-site clarity, distinct authority gating, telemetry routing searchable, future-proofs ADR-0091 row-level auth). ADR-0234 marked `superseded-in-part` (preserved: telemetry event names, current-state `update_context`, snapshot semantics, observer proxy chain reference). ADRs 0226/0227/0228 ALSO involved earlier in session — collision with other branches (`concurrent-mutation-reconciliation-policy`, `system-map-refresh-and-verification-protocol`, `cabinet-grotesk-display-font`) → renumbered to 0229/0230 mid-session (5th cross-branch collision per L-0136). | L-0160 NEW (dispatcher sequential resume model — sibling steps invisible; resume loop only matches `state.current_step` at engine-dispatch/index.ts:413,441; trigger spawn always at step 1 line 348; caught by build-time code-trace NOT pre-design council). **Semantic conflict resolution (1 critical pair)**: Steward+Harness "split into 2 action_types" vs Code-Tracer "extend update_context with optional target_state_id" — DIFFERENT contract design choices. Steward 4-reason argument (call-site clarity, distinct gating, telemetry routing, ADR-0091 future-proofing) wins. Code-Tracer's preference for B (fire-delayed-triggers patches direct) refuted by Supervisor + Harness on Trust Gate (Edge Function has zero `emit()` calls; service-role direct write bypasses GATED_MUTATION_TYPES + gate_action; ADR-0091/0099/0161 violations stack). **Agent Trust Gate**: PASSES for A (cross-state mutation gated through dispatcher's existing machinery + workspace integrity guard); FAILS for B (Edge Function direct DB write outside gate). **Implementation cost**: 1 revert migration (T2 blueprint extension), 1 new process migration (helpdesk_sla_breach_handler), T3 trigger seed update (process_id change), 1 new dispatcher action_type with workspace integrity guard + tests, T5/T6 capability tools (preserved). Total ~smaller than original T2 footprint. **Process improvement (Phase 9)**: Phase 2.5 fact-check MUST include trigger-spawn-vs-resume trace for any plan adding blueprint steps. Code-tracer mandate must trace event flow end-to-end (emit → state advancement) not just verify code exists. User approved verdict. |
| 2026-04-28 | Route Polish Wave 1-7 post-implementation review (commit `b6c6680e` — 21 files, 33 font-heading + 9 token swaps across 60 brand-facing routes) | post-implementation | **APPROVE WITH FOLLOW-UPS** — Trust Gate PASS, mobile boundary CLEAN, white-on-white bug genuinely fixed; P1 follow-ups queued not blocking | system-steward (chair, Phase 3 + Phase 5), supervisor (Trust Gate + code-tracer), frontend-designer (Nordic Split semantic) + general-purpose (Phase 2.5 fact-check, 15/15 claims VERIFIED including 82 total font-heading-touching diff lines). Skipped: system-agent-coordinator (no AI/Stage Engine touched), botsson-harness-builder (no Botsson harness). 3/5 reviewers — NOT DEGRADED, skips justified by pure-visual scope per prior 2026-04-23 Phase 1 precedent. | Yes — 2026-04-23 Phase 1 (DashboardShell+GlobalSearchPalette) and Phase 2 (organization klynge) Nordic Split councils held. Same Trust Gate / mobile boundary / pure-visual-refactor pattern, scaled cross-cutting (60 routes vs single cluster). Year Wheel ADR-0164 typography precedent invoked by frontend-designer. | None blocking — 4 debt items flagged: tracker reference fix (ADR-0021 → ADR-0115 misattribution); auth-surface light-only oklch exception needs ADR or token migration; page-polish hook discipline (zero `.run.yml` files exist; `SKIP_PAGE_POLISH=1` is now the de-facto pattern); access-denied CTA `bg-foreground` should be `bg-primary` for brand voice. | L-0158 NEW (font-heading by rule dilutes brand voice — frontend-designer caught ~15-20 of 33 sites as semantic overuse: serif on functional `Konfigurasjon`/`Revenue vs Cost` h2 reads "magazine cover" not "section". Year Wheel ADR-0164 precedent: serif = brand moment, sans = functional structure. Heuristic: `font-heading` IFF heading is brand statement). **Semantic conflict resolution (1 pair)**: Steward "headings is headings — h2/h3 font-heading aligns with skill spec" vs Frontend "Instrument Serif is display-only per styleguide + Year Wheel precedent" — DIFFERENT, Frontend wins on styleguide + ADR precedent + 60-route scale-of-impact evidence. Steward Phase 5 explicit reversal: Phase 3 read skill literally; Frontend brought styleguide source-of-truth + Year Wheel precedent → REVERSED. **Agent Trust Gate**: PASS — `git diff 95797f17..b6c6680e | grep -E "useMutation|Server Action|emit\(|supabase\.from|createClient|capability"` returns 0 hits. Pure visual refactor. **Mobile boundary (ADR-0132/0133)**: CLEAN — 0 mobile files. **Tracker math reconciled**: Wave 1 (11) + Wave 2 (8) + Wave 3 (6) + Wave 5 (12) + Wave 6 (5) = 42 fixes ✓. **Surviving hardcodes caught by Supervisor (P1 backfill queue)**: `dashboard/ai/page.tsx:21,38` `text-indigo-400`; `scrape/page.tsx:176,281,313` `text-blue-400`+`border-blue-500/20`+`bg-blue-500/10`; `select-plan/page.tsx:268` Pro CTA white-on-white bug self-flagged in tracker but not fixed. **Frontend P1 revert candidates**: ~15-20 sites where font-heading on functional h2/h3 should revert to Geist Sans (dashboard/operations `Revenue vs Cost`+`{n} deviations`, dashboard/ai `Konfigurasjon`+`Chat`, dashboard/onboarding-assistant h2, dashboard/my-contract h2, dashboard/schedule 3 h2 if card-title class). **Pre-commit `SKIP_PAGE_POLISH=1`**: defensible per-commit, but `.claude/page-polish/` directory has zero non-template files in git history — hook is ceremonial today. Either (a) write missing run.yml files retroactively, (b) add cross-route campaign exception class, or (c) retire hook. **Tracker doc fix needed**: line 195 `## Referanser` claims "ADR-0021: Server layout + Client DashboardShell" but ADR-0021 is Subdomain-Based Workspace Routing; RSC pattern is ADR-0115. **Skuld register additions queued**: 2 ai indigo-400, 3 scrape blue-400, select-plan Pro CTA bug, page-polish hook policy decision. User said "commite" → council captured + L-0158 + this row + commit. | | architecture (process + ops) | **APPROVE WITH CHANGES** — Option A (merge-commit at campaign-PR step). Trust Gate PASS for core; CONDITIONAL for reset of existing campaigns. | system-steward (chair, Phase 3 + Phase 5), supervisor (codebase-convention + scope) + general-purpose (Phase 2.5 fact-check, 1 PARTIAL FALSE caught: PR #259 was merge-commit not squash). Skipped: system-agent-coordinator (no AI-system implications), botsson-harness-builder (no L1-L5 pipe), frontend-designer (no UI). 2/5 reviewers — NOT DEGRADED, skips justified by pure-git-workflow scope. | n/a — first council on git merge strategy. ADR-0075 release-flow + CLAUDE.md Git Workflow section silent on squash-vs-merge-commit. | ADR-0213 NEW (`campaign/* → development` PRs MUST merge-commit, never squash; sortie/sub-sortie unchanged; zero tooling change since `close-feature.sh` already uses `--no-ff` locally; GitHub repo settings: disable squash repo-wide + branch protection on `campaign/*` disallowing force-push) | L-0142 (squash-merge erodes ADR falsifiability for multi-phase work — same class as L-0094 phantom emit contracts; 3 observed instances on smartout.ai), L-0143 (pattern claims should be quantified not generalized — Phase 2.5 caught "all squash" was actually dominant-but-not-universal; promotion candidate, 1st occurrence). **Semantic conflict resolution (3 pairs)**: (A) "Pattern is everywhere" vs "Pattern is inconsistent" — DIFFERENT, Supervisor wins on PR #259 evidence; ADR text says "dominant" not "universal". (B) "CLAUDE.md silence is load-bearing" vs "ONE-line rule fix" — SAME concern, complementary framing. (C) "Reset for clean baseline" vs "0 script changes" — DIFFERENT layers (data op vs tooling); reset deferred as separate decision. **Agent Trust Gate**: PASS for core verdict (no new tools, existing merge-commit promise extended); CONDITIONAL for reset (3 conditions: zero active sub-sorties, pre-reset SHA tagged for forensics, Pontus runs not Claude). **Implementation 8 steps**: ADR-0213 written + L-0142 + L-0143 + CLAUDE.md hard-rule + GitHub repo setting (disable squash repo-wide) + GitHub branch protection on campaign/* + close-feature.sh ADR-pointer comment + this council-log entry. **Reset of year-wheel +3538 / botsson-arena +22 deferred** pending `git log --first-parent` analysis to determine real-work vs squash-noise. **GitHub UI changes require Pontus** (cannot be automated by Claude). Pre-existing campaign divergence accepted as historical until reset decision. User approved verdict. |
| 2026-04-23 | Nordic Split Phase 2 execution (organization klynge, 442 zinc refs → 0) | execution (inherited verdict) | **PASS (no new council)** | inherited Phase 1 verdict (Option C hybrid collapse); orchestrator-only gate enforcement (grep + typecheck + lint) | Yes — Phase 1 council 2026-04-23 Option C strategy held 1:1 through Phase 2. Same mapping table applied literally, 442 refs → 0. | No new ADRs — Phase 1 strategy reused. | No new learning filed. **Execution summary**: 7 files in `apps/web/src/app/dashboard/organization/` (locations-tab 74, teams/[id]/page 72, overview-tab 69, locations/[id]/page 67, departments/[id]/page 63, departments-tab 57, teams-tab 40). ~149 `isDark` ternaries collapsed, 14 preserved for brand signals (amber/emerald) + ring-offset hex fallbacks (tagged `// Nordic Split: Phase 2.5 candidate.`). **Gates**: grep 0/7, typecheck 0 errors, lint 0 errors + 24 pre-existing warnings (5 `isDark-unused` resolved via `_isDark` prefix). **Trust Gate**: PASSES — zero mutation/authority/telemetry code touched (grep against diff: 0 matches). **Mobile boundary (ADR-0132/0133)**: CLEAN — 0 mobile files. **Scope discipline**: 7 files + 2 docs, no drive-by refactors. Net -267 lines. **Commits**: 2b5f8301 (plan+journey+spec) → f3fb3c70 (plan fill) → 8eb50238 (migration) → 24ffc11a (journey verified) on `feat/helpdesk-nordic-split-phase-2`. **Phase 2.5 backlog (unchanged from Phase 1 council)**: card-elevated token, 4 iconBg brand tints in overview-tab, ring-offset hex replacement, brand-signal semantic tokens. User chose Phase 2 execution directly after Phase 1 council. |
| 2026-04-23 | Nordic Split Phase 1 post-implementation review (DashboardShell + GlobalSearchPalette, 99 zinc refs → 0) | post-implementation | **APPROVE WITH NOTES** | steward (chair), supervisor, frontend-designer, botsson-harness-builder (code-tracer) — system-agent-coordinator + narrator skipped (no agent/capability contract touched; pure visual refactor) | n/a — no prior council on Nordic Split migration; 2026-04-19 Kanaler-som-Helpdesk council (Alt D ontology) unaffected (channel logic untouched). | No new ADRs — Option C (hybrid collapse) strategy captured in frontend-designer verdict + commit `44eb5188` body. | No new learning filed. Learning candidate: "post-implementation council valuable even on 'pure visual' PR — catches legitimate design concerns (light-mode active-tab contrast weakness) that per-file code review alone missed. First of kind; promote on 3rd occurrence." **Semantic conflict resolution**: all 4 reviewers converged on PASS — no conflict. Partial overlap on Phase 2 scope: Steward + Supervisor flag docs precision + CI grep gate; Frontend flags `--card`=`--background` light-mode weakness + `shadow-md + ring-1 ring-border/40` remediation; Harness confirms 0 channel/chat/mobile/telemetry/authority code touched (diff hunks start at line 1141 of DashboardShell; all channel logic lives above line 1089 untouched). **Trust Gate**: PASSES — grep across diff for `useMutation\|Server Action\|emit(\|supabase.from\|createClient\|capability` = 0. **Mobile boundary (ADR-0132/0133)**: CLEAN — 0 mobile files touched. **WCAG AA**: all contrast ratios preserved or improved (placeholder 4.6:1 → 4.9:1). **Phase 2 backlog**: (1) `--card-elevated` token or stronger active-state shadow+ring, (2) ~15 asymmetric `isDark` ternaries with hardcoded oklch light-branch, (3) orange brand signals → `bg-signal-live` semantic token. **Merged**: commits `44eb5188` (DashboardShell -52 lines) + `8ff0eae4` (GlobalSearchPalette -73 lines) + `58c517cd` (journey verified) on `feat/helpdesk-nordic-split-phase-1`. User approved verdict → chose Phase 2 start. |
| 2026-04-23 | Post-implementation audit of Journey Engine (campaign journey-engine M1–M6 completion claim) | post-implementation + architecture | **APPROVE WITH CHANGES → REMEDIATION** | system-steward (chair, Phase 3 + Phase 5), supervisor (Layer 2 column-trace), system-agent-coordinator (code-tracer end-to-end), botsson-harness-builder (L1–L5 pipe status), frontend-designer (state-machine + UX) + general-purpose (Phase 2.5 fact-check, 12/12 claims VERIFIED) | No — 2026-04-21 Journey Runner Suite v1.6.0 verdict partially held (M1 foundations + M2 spec + M3.5 IR v2 landed) but M5 runtime claim was FALSE: `publish_mission` + `publish_guide` shipped as phantom skeletons. L-0118 (2026-04-22) violated in the campaign that created it. Campaign status claim "M1–M3.5 complete, 7/7 unblocks closed" code-traced FALSE. | ADR-0194 (JourneyIR v2.1 → engine_missions mapping — hybrid: `system_prompt`+`mode` required at IR root v2.1 additive, per-stage text derivation with `is_active=true` enrich gate), ADR-0195 (authority loader full dotted-key preservation — CVE-class fix: `authority.ts:45-51` base-key fold with undefined `.select()` row order → `CapabilityName` union gains dotted members + `tool-selector.ts:67` reads `tool.capability` dotted), ADR-0196 (Campaign Invariants 11/12/13: no phantom capabilities, falsifiable status claims, gate_action on every mutation), ADR-0197 (phantom contracts class rule — promotes L-0094 after 5th occurrence; three failure modes defined: phantom emit / phantom body / phantom status claim). All four `proposed`. | L-0124 (phantom body vs phantom emit — two shapes of same anti-pattern; L-0094's 5th occurrence introduces Mode 2 where emit fires correctly but `execute()` returns `ok:true` without side effect), L-0125 (test spirit vs letter — `journey.capability.test.ts:128-146` asserted `ok:true`+UUID which satisfied L-0118 letter while violating its spirit; tests must mirror the tool's declared side effect), L-0126 (ontology gap is an ADR, not effort — JourneyIR executable steps vs `engine_missions` agent-coaching have different ontologies; recognition signals: target NOT NULL cols with no source, same-named cols with different semantics, engineer's first instinct is hardcoded defaults), L-0127 (loader-level bugs evade grep-audits — Phase 2.5 verified 12/12 claims but Phase 3 Agent-Coord code-trace surfaced CVE in a transformation layer no briefing claim mentioned; Code-Tracer Mandate amended to cover transformation layers). Renumbered from L-0119/0120/0121/0122 during close-feature sync after add/add conflict with development's L-0107-0112→0119-0123 renumber batch. **Semantic conflict resolution**: 5 pairs classified in Phase 5 synthesis — "neuter phantoms first" vs "publish_mission body first" classified DIFFERENT (Phase 0 vs Phase 3, sequential); "authority.ts collapse" vs "gate_action gap in phantoms" classified DIFFERENT (separate bugs, both Phase 0); "extend IR v2.1" vs "seed-compile migration" classified SEQUENTIAL (IR first, then seed); "stuck→running recovery edge" (FE) vs "stuck detector cutover" classified DIFFERENT (UX vs backend). **Agent Trust Gate**: REJECTED — `publish_mission`/`publish_guide` make promises the pipeline does not keep. Block further capability-body work until Phase 0 lands. **Ground truth** (code-traced, not grep-counted): 1 of 4 capabilities GREEN (`run_guided` M5.1); `run_dev` queues but no N-C worker consumes; `publish_mission`+`publish_guide` are skeletons; stuck detector in L-0098 step A (dual-write). Mobile BFF client exists at `apps/mobile/src/lib/journey-bff.ts` (88 LOC) but no RN consumer UI — half-built thin-client pipe. `JourneyStoreListingCard` exists at `apps/web/src/app/platform-admin/journeys/versions/_components/`. Fjernkontroll state machine implements all 6 ADR-0177 states but `stuck`/`failed` have no exit edges — users trapped. **Remediation roadmap** (4 phases): Phase 0 Honesty (1-2d, neuter phantoms + fix authority.ts + add state exits), Phase 1 Contracts (3-5d, ADR-0194/0195/0196/0197 acceptance), Phase 2 Foundations (1w, gate_action on all 4 + seed-compile + L-0118-spirit tests), Phase 3 Bodies (3-4w, publish_mission → mission resolution → N-C worker IN SEPARATE CAMPAIGN → stuck flip → publish_guide), Phase 4 Mobile+Ops (2-3w, RN Fjernkontroll + seed-missions + rollback + killswitch + monitoring + preview→prod). L-0117 confirmed in practice: initial P0 list had 3 false claims (mobile BFF, StoreListingCard, publish_guide fs.write shape) — grep-count without code-trace produces false negatives. User approved remediation verdict. |
| 2026-04-22 | Pathway B authority gate CI/control model (`docs/decisions/0190-authority-parity-cascade-gate-write-orthogonal-controls.md`) | architecture | **APPROVE WITH CHANGES** (4-control split, not parity-gate clone) | steward (chair, Phase 3 + Phase 5 synthesis), supervisor (code-tracer Layer 2+3), system-agent-coordinator (authority-contract lens) + general-purpose (Phase 2.5 fact-check — 8 briefing claims verified, 4 corrections applied). Frontend-designer + botsson-harness-builder skipped (backend/CI scope only). 3/4 reviewers — NOT DEGRADED, skips justified. | Yes — 2026-04-22 L-0112 discovery ("two gate pathways, parity gate covers one") directly triggered this council. ADR-0189 (pathway-A CI gate) HOLDS and is explicitly NOT extended — pathway B gets its own structurally-different controls. L-0107 (authority appearance ≠ presence) promoted into named Smartout anti-pattern in ADR-0190 body. | ADR-0190 NEW (authority parity for `cascade_gate_write` via 4 orthogonal controls: atomic binding in `finalize_onboarding_workspace` RPC + CI entity-type coverage script + widen `GatedWriteResult.reason` + RPC-side `gate.default_permitted` emit + ESLint rule on capability seam). ADR-0091 amended with workspace-framework-binding invariant + default-permit observability + reason propagation + capability-seam defense + CI coverage requirements. | L-0113 (grep-count audit inflation — L-0054 recurrence: briefing claimed 108 call sites, Phase 2.5 → 43, Supervisor AST code-trace → **7** production sites. 3rd formal occurrence, promotes L-0054 to SKILL.md-level enforcement). L-0114 (bootstrap-cascade single-writer silent-default — provisioning step whose failure is observable only at mutation-time, on a branch whose default is permissive, is audit theater in waiting. Three-ingredient generalizable anti-pattern: fallible writer + non-blocking failure + permissive default). **Semantic conflicts resolved (5 pairs)**: (A) Control 3 placement PARTIAL OVERLAP → 3a/3b split (widen type in packages/data for caller propagation; emit inside RPC for atomicity + unbypassability). (B) Exemption storage PARTIAL OVERLAP → inline typed constant wins Stage 1, no new `docs/cascade/` dir. (C) `GatedWriteResult` widening location SAME different-paths → `packages/data/src/gated-write/types.ts`, NOT `packages/supabase`. (D) Control 2 scope PARTIAL OVERLAP → layered acceptance (Stage 1 hospitality-only, E2E excluded, Stage 2 on 2nd framework). (E) Audit theater scope DIFFERENT → widened to BOTH pathways as shared tech debt "audit consumption convergence", out of scope. **Agent Trust Gate**: NOT honest today (every non-hospitality workspace silently default-permits pathway B). Becomes honest AFTER full ship. Ship order is the gate. **Ship sequence (non-negotiable)**: 1 (atomic binding) → backfill → 3a (reason widening) → 4 (ESLint seam defense) → 2 Stage 1 (CI coverage) → 3b (RPC emits). **Named tech debt deferred**: `gate_evaluation` zero-consumer defect across BOTH pathways. User approved verdict. |
| 2026-04-22 | Post-implementation review of contract-hub-redesign (PR #234) | post-implementation | **APPROVE WITH FIX-FORWARD SORTIE** | system-steward (chair), supervisor, system-agent-coordinator, frontend-designer (degraded — re-dispatched as general-purpose for grep), botsson-harness-builder, narrator (skipped — orchestrator inline) | Phase 3 Steward "PASS WITH CONDITIONS" did NOT hold; conditions were known but not enforced as merge blockers (logged as L-0115). | ADR-0191 (agent capability tool auth-passing pattern: per-capability binary choice between BFF + agent signature OR direct admin after `gate_action`; never mix), ADR-0192 (authority seed bootstrap-trigger pattern: `BEFORE INSERT ON workspace` trigger + capability registry + COALESCE backfill closes default-allow CVE class), ADR-0193 (ADR-0134 amendment: NonEmptyString brand for telemetry actor_id/workspace_id; type-system enforcement replaces never-shipped runtime+lint+test promises) | L-0115 (ontology PASS does not imply runtime PASS — chair must produce ONE merge-gate verdict; conditional verdicts as merge-blockers, not advisory), L-0116 (sibling-tool architectural inconsistency = Trust Gate failure — uniform pattern OR explicit per-tool ADR justifying divergence), L-0117 (grep-based structural claims must be code-traced — 5th occurrence, PROMOTED to hard rule in Phase 2.5: structural claims require Read citation file:line, not grep counts; prior occurrences 2026-04-15, 2026-04-16, 2026-04-18, 2026-04-20, 2026-04-22), L-0118 (every capability tool requires E2E Trust Gate test before merge — agent → router → tool → BFF/DB → response; enforced in close-feature.sh + journey-runner-suite v1.7+). **P0 fix-forward sortie covering 4 critical defects:** CVE authority seed (ADR-0192), forkTemplate 401 (ADR-0191), triple-emit dedup, bulk gate_action. Cascade integrity preserved at ontology layer; runtime defects only — but runtime defects are merge-blockers per L-0115. **Frontend-designer subagent dispatched without Read/Bash** — degraded to general-purpose for grep; second occurrence of pattern (first 2026-04-13) — pre-load file contents in FE briefing. **First R2 in this session detected 5+ defects 4 prior gates missed** — confirms post-merge code-trace as essential review surface for capability-tool PRs. |
| 2026-04-22 | Auth & Invitation Wave H Amendment (`2026-04-22-auth-invitation-wave-h-amendment.md`) | architecture (continuation) | **APPROVE WITH CHANGES → strengthened by re-review** (Trust Gate CONDITIONAL PASS, 5 conditions all satisfied) | steward (chair, Phase 3 + Phase 5 + re-review), supervisor (re-review with full call-site audit), system-agent-coordinator (re-review with Trust Gate + ADR-0029 interaction), frontend-designer (Phase 3 only — re-review skipped, server-side refactor) + general-purpose (Phase 2.5 fact-check) | Yes — 2026-04-20 Auth & Invitation Spec Scope Council (APPROVE WITH CHANGES) held. Wave H closes preconditions #1, #2, #3 (engine_event parity + emit fix + ghost-route). Mid-council premise change: Pontus rejected CORS-sweep approach in favor of Option 2 (delete Edge, inline into Next.js route handler). | ADR-0179 NEW (browser-originated mutations via Next.js route handlers), ADR-0180 NEW (engine_event parity contract), ADR-0029 amendment (Mutation Surface Selection table), ADR-0123 amendment (create-invitation removed, tripwire 3→2), ADR-0045 clarification (single dispatch surface). | L-0103 (phantom-emit briefing-staleness for Edge direct-inserts), L-0104 (audit-inflation 4th occurrence), L-0105 (browser invoke anti-pattern), L-0106 (tripwire fired in reverse direction) — renumbered from L-0099/0100/0101/0102 due to collision with 2026-04-22 contracts council. **Semantic conflict resolution**: 8 pairs classified same/different/partial in Phase 5 synthesis. Critical reframe mid-council: briefing's L-0083 4th-occurrence claim falsified by code-trace; real issues are engine_event parity gap + fail-open emit + ADR-0045 silent violation. **Trust Gate**: CONDITIONAL PASS, 5 conditions all SATISFIED at merge time. **Implementation**: 4 PRs (H.0 ADRs → H.1 5 proxies → H.2 invite refactor → H.3 cleanup). 17 commits on `feat/wave-h-browser-invoke-cleanup`. Plan at `docs/superpowers/plans/2026-04-22-auth-invitation-wave-h.md`. **Wave I deferred work**: 5 onboarding/setup/document-drop browser invokes still active; `supabase-edge-invoke.ts` wrapper retained pending those migrations. User approved verdict. |
| 2026-04-21 | Journey Runner Suite v1.6.0 re-review (`2026-04-21-journey-runner-suite-mental-model.md`) | spec (re-review) | **APPROVE WITH CHANGES → v1.7.0 required before merge** (Agent Trust Gate REJECTED pending 7 unblock conditions) | steward (chair, Phase 3 + Phase 5), supervisor, agent-coordinator (code-tracer Layer 2+4), frontend-designer (pre-loaded spec sections), + general-purpose (Phase 2.5 fact-check — all 13 briefing claims verified) | Yes — prior 2026-04-21 council REJECTED v1.5.0 with 12 action items. v1.6.0 closes conceptual gaps (dev/runtime separation per L-0023, ADR-0074 unified, store-listing promoted) but introduces new mechanical errors (enum collision, phantom emit contracts, schema-fiction). Verdict held, gap narrowed. | ADR-0171 (packages/journey-ir canonical path), ADR-0172 (journey_version_status enum + lifecycle state model — resolves `ready_test` collision with existing `journey_status` enum), ADR-0173 (four journey capabilities: run_dev/publish_mission/publish_guide/run_guided + CapabilityName registration), ADR-0174 (ADR-0074 unification completion — Mission/Docs/Audit generators retarget to JourneyIR), ADR-0175 (journey telemetry contract — 5 registered emit events), ADR-0176 (C4 authority seed for all 4 journey capabilities — mandatory non-default rows), ADR-0177 (Fjernkontroll state machine + store-listing card schema + Nordic Split contract). All 7 status `proposed` — acceptance gated on v1.7.0 producing matching migrations + registry entries. | L-0094 (phantom emit contracts recur — 4th occurrence in ~100 days; promote Phase 2.5 emit-registry grep), L-0095 (long-spec >500-line internal contradictions, 1st occurrence — author single-pass consistency scrub checklist; note only, not promoted to SKILL.md until 3rd), L-0096 (code-trace catches schema-fiction concept-review approves — reinforces Code-Tracer Mandate for DB topics), L-0097 (C4 authority defaults are not free, 2nd occurrence — Trust Gate grep for `engine_authority_config` INSERT on every new capability), L-0098 (global scripts not owned by refactoring campaign — three-step cutover plan required for any `supabase/functions/*` change). **Semantic conflict resolution**: steward Phase 5 classified 8 overlapping findings as same/different/partial; consolidated 24 raw items → 14 distinct fixes (10 architecture + 6 design blockers + 8 non-blocking follow-ups). **Agent Trust Gate**: REJECTED for v1.6.0 — all 6 mutation-surface categories touched (Server Actions, TanStack mutations, capability tools, emit routing, C4 authority, Edge Functions). 7 unblock conditions: emit registry (5 events), enum migration (0a/0b/0c), capability registration (4 entries), `engine_authority_config` seed (4 rows), package path resolution (one of the two), Journey 3 `actor_id` resolution path specified, phantom-table corrections (`engine_missions.plan` + `journey_version_id` FK). **Ship-plan**: Week 1 parallel — draft 7 ADRs + add 5 emit registry entries + write `journey_version_status` enum migration + seed `engine_authority_config` rows. Week 2 — produce v1.7.0 spec + re-dispatch delta review (not full council). Week 3+ implementation once Trust Gate passes. User approved verdict. |
| 2026-04-20 | Docs audit + forward-plan verification (post STATE-SUMMARY refresh) | verification audit | **APPROVE WITH CHANGES** | steward (chair, Layer 1), supervisor (Layer 3 code-truth), agent-coordinator (Layer 2+4 capability-consumer) — frontend-designer skipped (no UI scope) | Yes — 2026-04-20 helpdesk final merge council + 2026-04-20 hybrid council both held. STATE-SUMMARY refresh (`d5b88e12`) was this session's doc change being audited. | No new ADRs — findings were doc correctness + process hygiene. Added ADR-0159 RESERVED marker to resolve ghost slot from 2026-04-19 mid-session renumber. | L-0082 (trust-hierarchy coherence fails on partial refresh — INDEX + root CLAUDE + ORIENTATION missed in STATE-SUMMARY update), L-0083 (registered telemetry event without producer is phantom contract — `helpdesk.query.reassigned` declared, zero emit sites; Phase 1.1 "reassign dropdown" is full-stack not UI-only), L-0084 (ADR renumber-mid-session leaves ghost slots — ADR-0159 invisible until today; 6th collision in 2026-04). **Semantic conflict resolution**: all 3 reviewers agreed on helpdesk dispatcher P0 but at DIFFERENT depths. Agent-coord Layer 4 escalated: not just `event_type_any_of` unsupported — ALSO both steps use `event_type` key where dispatcher matches `event`, AND no `engine_trigger` row maps `helpdesk.query.opened` → `helpdesk_query_lifecycle`. **Process never spawns at all.** UI direct-write is only live path. **Trust Gate**: STATE-SUMMARY passes as trust artifact; INDEX + root CLAUDE + ORIENTATION FAIL (contradictory ADR counts by boot-sequence entry path). **5 merge-blocker doc fixes applied**: (1) STATE-SUMMARY 7 patches (P0 upgrade, 14 vs 63 call-site clarification, path correction, parked-branches removed, proposed-ADR list corrected to 12, reassign scope upgraded, PR #219/#220 added, count 164→163). (2) INDEX.md regenerated (74/28 → 163/82). (3) root CLAUDE.md 54→163. (4) decision-log ADR-0159 RESERVED row. (5) ORIENTATION.md helpdesk/WebDayControl/dual-platform rows. **Follow-ups tracked**: reconciliation ADR needed for `gate_action` vs `cascade_gate_write` (open since 2026-04-16); CAMPAIGN-helpdesk.md template shell (fill or delete); campaign HANDOFF rule undefined; Phase 0 dispatcher fix escalated to Phase 1.1. User approved. |
| 2026-04-20 | Helpdesk Phase 1 UI final merge council | post-implementation | **APPROVE WITH CHANGES** | steward (chair), supervisor, agent-coordinator (Layer 2+4 code-tracer), frontend-designer | Yes — 2026-04-19 Kanaler-som-Help-Desk Alt D ontology (ADR-0160/0161/0162/0163) held through Phase 0 backend ship (`70103fc0`) and this Phase 1 UI implementation. Mobile ADR-0133 verb boundary respected. | No new ADRs — all findings were implementation-level fixes, not architectural. | L-0079 (UI terminal engine_state must stamp `completed_at` — 2 sites missed it), L-0080 (reassignment must demote prior holder — ghost representatives accreted), L-0081 (Supabase chainable-proxy mocks echo column names — 3rd occurrence; 14 tests passed against wrong column `created_at` vs real `started_at`). **Semantic conflict resolution**: Steward APPROVE (ADR/ontology clean) vs Supervisor APPROVE WITH CHANGES (Event Engine invariants broken) — DIFFERENT layers; Supervisor won on merge-blocker because runtime correctness trumps doctrine. Steward vs Agent-Coord REJECT — PARTIAL OVERLAP; Agent-Coord's `created_at→started_at` propagation blocker resolved by merge order (wt-2 carries fix into campaign before campaign→development). Agent-Coord's `event_type_any_of` seed mismatch is Phase 0 backend issue, UI writes direct so not blocking. **Trust Gate**: PASSES for UI direct-DB mutations; FAILS for lifecycle promises (engine_state.completed_at contract + dead Phase 0 state machine) — tracked as Phase 1.1 follow-up. **4 fixes applied pre-merge**: (1) `completed_at` in `resolve-ticket.ts:108` + `use-resolve-ticket.ts:82-83`, (2) prior-rep demotion in `updateDeskResponsible`, (3) `TicketHeader` pulse-budget dedupe (assignee halo calm when main orb pulses), (4) `QueueRow` waiting dot 10→12pt. **Phase 1.1 deferred**: 15 UI telemetry events, reassign dropdown, conditional tab visibility, mobile ticket message embed, Phase 0 seed dispatcher mismatch. **Merge sequence**: shared-primitives → campaign/helpdesk (`ef17e35b`), web → campaign (`995175fe`), mobile → campaign (`f0cd783e`). 33 turbo typecheck tasks green on campaign. User approved verdict. |
| 2026-04-20 | Uncommitted-changes + branch-hygiene + forward-plan council | hybrid (post-implementation + architecture + roadmap) | **APPROVE WITH CHANGES** | steward (chair), supervisor, agent-coordinator (code-tracer), frontend-designer, narrator + general-purpose (Phase 2.5 fact-check, 7 briefing errors caught) | Partial — 2026-04-19 Kanaler som Help Desk verdict still holds (Phase 0 docs just committed as `3fa9bec0`); 2026-04-20 Year Wheel council (ADR-0164) active in wt-2 unmerged. | No new ADRs. Amendment to ADR-0163 retrofit-plan added (not status change). | L-0076 (established-pattern bypass — new hook bypassed `useWorkspaceOptional`), L-0077 (ADR fail-closed without consumer audit = init-time break), L-0078 (PLAN-file decay, 4th occurrence — `PLAN-cascade-gate-write.md` status `exploration` while WP2 shipped). **Central conflict resolved**: Supervisor "ACCEPT all 5, 30-min follow-up" vs Agent-Coord "BLOCK shift-lock until TZ plumbed" — classified DIFFERENT, Agent-Coord won on substance (docstring claimed "UI mirror of DB trigger" without data-pipeline connection). Trust Gate FAILED for 2/5 commits (shift-lock TZ divergence, ADR-0163 retrofit not flagged). Both fixed same-push via `df1ecbf3` (TZ + a11y + Intl.DateTimeFormat) + `2f09b70e` (ADR-0163 retrofit plan). **5 commits shipped**: helpdesk Phase 0 docs, temporal shift-lock (amended), date-offset refactor, invite-member draft persistence, mobile expo-web history guard. **Branch hygiene sweep**: wt-1 removed, 26 merged remote branches deleted, 6 unmerged-ahead branches left for per-branch triage. **Forward plan sequenced**: (1) push done, (2) ADR-0163 PII retrofit gates Helpdesk Phase 0 Week 2, (3) Cascade Phase E re-scope (WP1+WP2 shipped silently — needs doc update not new work), (4) Gatedwrite Wave 2A Season, (5) Shift Timeline UI Phase 6, (6) Helpdesk Phase 0 (gated on #2). STATE-SUMMARY to be refreshed with verified-date annotations per L-0078. User approved verdict. |
| 2026-04-19 | Kanaler som Help Desk (ConnectTeam-style upgrade) | architecture / feature | **REJECT AS SPECIFIED — REDESIGN REQUIRED** (product intent approved; data model rejected) | steward (chair), supervisor, agent-coordinator (code-tracer), frontend-designer, narrator + general-purpose (Phase 2.5 fact-check, all 24 claims verified) | Yes — 2026-04-13 Communications/Chat/Channels (ADR-0087) held: Komm thin display, Event Engine intelligence. Dead-infra 90-day deadline (2026-07-13) for `channel_ai_policy` + `channel_event` still binding. | ADR-0160 (channel_event vs engine_event boundary — projection of engine_event), ADR-0161 (helpdesk ontology: ticket = engine_state Alt D, not channel_type='desk_query'), ADR-0162 (helpdesk_query capability placement — new isolated, not extend communication), ADR-0163 (ADR-0078 amendment — allowedChannels mandatory for PII, fail-closed at registration) | L-0070 (sibling-table pattern ≠ ontology answer; three-test rule), L-0066 (default-allow capability authority = CVE-class trap; seed migration mandatory), L-0067 (dead infra has a clock — wire before new work depends on it), L-0068 (`gate_action` Layer 1 silent for ad-hoc agent-router; Layer 2 carries load), L-0069 ("channel" has 4 meanings — session_modality / room_type / channel_id prefix convention), L-0071 (role='owner' enum collision; use FK, not enum token). **Five reviewers converged on ontology grunnproblem**: desk_query is a Cascade entity with lifecycle (engine_state), not a channel with extra columns. Original Alt A (channel_type='desk_query' + 7 conditional columns + channel_access_rule) rejected unanimously. Supervisor's sibling-table patch rejected as hiding ontology error (L-0064). **Trust Gate FAILS Phase 2+** (auto-assign, SLA, recording) until prereqs. **Trust Gate PASSES Phase 0** (4 ADRs + dead-infra wiring + schema foundation). **CVE-class side-finding**: agent-coordinator code-trace proved `gate_action` at `20260505110000_unified_authority_gate.sql:155-157` default-allows capabilities with no seed row → new capabilities auto-autonomous. Tracked separately from helpdesk as broader security fix. **Phasing**: Phase 0 (3w) = 4 ADRs + policy.ts wiring + enum/migration sequencing; Phase 1 MVP (2-3w) = desks + manual assign/resolve, mobile read+reply+resolve only; Phase 2 = auto-assign + SLA via reuse of `engine_delayed_trigger` path; Phase 3 = call recording (BLOCKED on ADR-0135 accepted); Phase 4 deleted (broadcast/analytics separate product). **Frontend gates**: SLA must be darkening orb (hue 50 → brand orange 40 at breach), never ticking clock or red; responsible person = orb-haloed avatar (lighthouse); max 3 pulsing elements per viewport; existing Komm touched files get token+i18n cleanup same PR. **Mobile verb table (ADR-0133)**: desk authoring + access-rule + SLA config + reassign-other = web-only; query composer (requester) + rep "Available to help" toggle + self-claim + resolve = mobile allowed. User approved verdict. |
| 2026-04-19 | Git cleanup + cross-worktree merge review (strike-mcp-verification, dashboard-fix) | architecture / git-hygiene | APPROVE WITH CHANGES | steward (chair), supervisor + inline orchestrator code-verification. Frontend-designer + agent-coord skipped (not relevant to git hygiene). | **AMENDS earlier 2026-04-19 cross-stack null.dispatchEvent verdict** — `useShiftLifecycle` rewrite was classified "scope bleed, extract to branch"; amended to "bug fix for mobile, ship atomically" after code-trace proved HEAD's base hook unconditionally imports `@supabase/ssr createBrowserClient` with no RN conditional export → mobile runtime crash in `shift-hub.tsx:97` via `ShiftCard`. Per L-0060 verdicts have layers — amended, not retracted. | No new ADR — cleanup actions only. `fb8fcbc8 fix(schedule): inject supabase client per platform (adr-0108)` landed on development as the actual ADR-0108 implementation. | No new learning. Reinforces L-0060 (verdict amendment) + L-0063 (diagnosis-before-patch). **Verdicts**: (1) `feat/strike-mcp-verification` merge-base = branch tip = NO-OP merge; wt-6's 14 uncommitted files are real Phase B work that stays in wt-6 for separate commit later. (2) `feat/dashboard-fix` already merged at `3fbae508`, confirmed. (3) Atomic unit for schedule fix was 5 files (supervisor claimed 7 needed, code-trace showed HEAD already had timeline-import swap). (4) Unauthorized dependency change (`@tanstack/react-query: 5.90.21` override) extracted to `chore/pin-tanstack-query-5-90-21` branch — BLOCKED from merge until ADR written. (5) Mobile `[id].tsx` symptom patches (throw-stubs + canGoBack guard) extracted to `fix/mobile-chat-web-stub-errors` branch — BLOCKED from merge until regression test confirms crash still reproduces post-SDK-revert. (6) Both session stashes dropped after verification (stash@{1} superseded by dashboard-fix merge; stash@{0} residuals were dev-local settings + regenerable DASHBOARD.md). **Integrity finding (supervisor)**: my briefing claimed "3 commits ahead of origin" — actual `0 0` (origin auto-synced during session). Final state: 2 new commits on development (`fb8fcbc8` schedule fix + `b945ba35` dev-startup chore), 2 extracted branches parked behind ADR/test gates, working tree clean, 2 fewer stashes. |
| 2026-04-19 | Cross-stack `null.dispatchEvent` audit (web Radix Sheet race + Expo-web pushState race) | bug / post-implementation | APPROVE WITH CHANGES | steward, supervisor, frontend-designer + general-purpose (code-tracer). system-agent-coordinator skipped (no agent code). | n/a — no prior council on Radix focus races or mobile SDK pinning. 2026-04-17 Mobile Strategy adjacent (ADR-0133 gap exposed). | ADR-0153 (Expo-web Surface Classification — fills ADR-0133 gap; incapacity declaration, navigation race rule, SDK pinning discipline, overlay portal rule). | L-0063 (Diagnosis-before-patch gate for crash bugs — named falsifiable root-cause hypothesis required before patch lands). **Findings**: (1) web root cause is conditional unmount at `page.tsx:90` + re-entrant close in `invoice-detail-sheet.tsx` — initial `onCloseAutoFocus` patch was band-aid, replaced by always-mount + URL-derived open state. (2) Mobile root cause is `auth-provider.tsx:104-124` route-guard race, amplified by uncommitted drift (`react@19.2.0` orphan + SDK bump mixed with feature work). (3) Dual-React claim over-weighted initially — code-tracer proved `pnpm-lock.yaml:7-9 overrides: react: 19.2.4` forces single resolution at runtime; `react@19.2.0` orphan was dead mass. (4) Sibling race at `ad-hoc-invoice-drawer.tsx:136-138` (same `setOpen+router.push` shape) — patched. (5) Scope bleed detected: uncommitted `useShiftLifecycle` rewrite (4 files, ADR-0108 pattern) bundled with unrelated nav fix — extract to separate branch. (6) Root `pnpm.overrides` gained undocumented `@tanstack/react-query: 5.90.21` entry — flagged for separate commit. Web fixes shipped; mobile SDK drift reverted (`git checkout HEAD + pnpm install + pnpm store prune` confirmed single resolution). Chair rejected pattern-promotion (symptom-patch at 3 occurrences — different remediations, not one rule). Trust Gate not tripped globally; narrow pause on Expo-web mutation work until P1 verified. Follow-ups: P2 Playwright smoke for Sheet-close-on-route-change; P3 ADR-0134 R3 backfill audit status. |
| 2026-04-19 | Full-System Health Audit | post-implementation | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator (code-tracer), frontend-designer + general-purpose (Phase 2.5 fact-check) | Partial — Mobile Strategy Council 2026-04-17 "Botsson theatre" verdict AMENDED not retracted (transport layer resolved 2026-04-18 via `6b39d877`+`f9d0f6b8`+`5a5aca9c`; telemetry + design presence still broken). STATE-SUMMARY "no critical gaps" claim refuted (C1 + O2 are critical). | ADR-0151 (stage-engine server-derives profile_id; L-0058 at runtime), ADR-0152 (activity-trail fail-fast; closes L-0038 recurrence class). ADR-0145 Vault finding reclassified — ADR already `superseded` by ADR-0148 (EHF via CSV export); R1 "RED" is stale. | L-0059 grep-count briefings undercount by 3-5x without code-trace pairing (M1 scope was 3, actual 15+). L-0060 "theatre" verdicts have layers (transport/telemetry/design presence) — amend, don't retract. L-0061 orphan capability code is invisible until engine_trigger points at it (Season `tools/season/*` + `20260422400500_cascade_budget_engine_process.sql:23-36` dormant process). L-0062 SECURITY DEFINER RPCs change threat model — don't label `gate_action` "ceremony" without tracing SQL. **Merge-blockers**: C1 (mobile use-cancel-absence.ts:69-70 + use-confirm-hours.ts:40-41 null workspace_id silently dropped by activity-trail.ts:22 — L-0038 recurring), O1 reclassified RED→YELLOW (stage-engine chat.ts:34 forgery blocked via BFF, but defense-in-depth gap for direct API-key callers), O2 (Season orphan tools = dormant cascade budget propagation). **Sprint**: M1 (15+ web useMutation missing emit()). **Release-gated before wt-3 Tripletex**: originally R1 ADR-0145, now reclassified (ADR superseded). Supervisor cleared 2 false alarms: L-0042 timestamp collision cosmetic only; ADR-0091 `gate_action` is SECURITY DEFINER server-authoritative, not ceremony. |
| 2026-04-17 | Mobile Strategy Brainstorm            | architecture | **REJECT** (parity framing) — APPROVE remediation path | steward, supervisor (re-dispatched), agent-coordinator, frontend-designer | Yes (6 prior councils) — "mobile = Phase 2" stance refined into "mobile = D6+C4 execution surface, not parity surface" | ADR-0132 (mobile thin client via BFF), ADR-0133 (web composes, mobile executes), ADR-0134 (mobile telemetry contract), ADR-0135 (LiveKit voice), ADR-0136 (witness-with-camera) [renumbered from 0127-0131 to resolve collision with feat/billing-engine-fase-2] | L-0044 parity framing creates graveyards. L-0045 emit() exists but payload broken (telemetry corruption in 6 mutation sites). L-0046 no theatre providers (Botsson startVoiceSession is no-op). L-0047 ADR-0078 channel guard vacuous without tool execution path. L-0048 two-reviewer cross-lens convergence = high signal. L-0049 hidden Expo Router groups (href: null) are dead-but-loaded code. Trust Gate REJECTED for new mobile mutations until 3 gates pass (telemetry contract test, Zod at enqueue, Botsson bridge ADR + stub). 12-week remediation plan: weeks 1-2 stop the bleeding, weeks 3-6 build bridge + data layer, weeks 7-12 execution surface. Out of scope on mobile: schedule editor, onboarding wizard, contract authoring, governance authoring, organization settings, year-wheel, cost/billing. |
| 2026-03-26 | Mobile Production Readiness v1.0      | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | n/a | None (per-role authority ADR deferred to v1.1)                                    | Authority default mismatch: tool-selector.ts=read_only vs agent-router.ts=suggest. Ultravox client tools cannot be wrapped as SmartoutTools.                                                                                                                                                                                           |
| 2026-03-27 | Onboarding Route Code Review          | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | ADR 13-18 in decision log                                                         | See decision log for full list. Key learning: pre-auth API calls fail silently.                                                                                                                                                                                                                                                        |
| 2026-03-27 | Invitation Flow E2E Audit             | feature      | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: RLS policy ADR, existing-user acceptance ADR                             | `USING (true)` RLS is never safe for PII tables. Trainee status was a no-op. Batch mode silent on dispatch.                                                                                                                                                                                                                            |
| 2026-03-27 | Invitation Core Fixes Spec Review     | spec         | APPROVE WITH CHANGES     | steward, supervisor                                       | None                                                                              | RPC must limit PII to pending invitations. Simplify existing-user to password-only (defer magic link). Migration+page must deploy together.                                                                                                                                                                                            |
| 2026-03-26 | Migration Ordering & Idempotency      | bug          | APPROVE WITH CHANGES     | steward, supervisor                                       | None                                                                              | `CREATE TABLE IF NOT EXISTS` silently ignores FK differences (CASCADE lost). Follow-up migration required. Timestamp collisions from parallel branches.                                                                                                                                                                                |
| 2026-03-27 | Notification System Fixes (8-Fix)     | bug          | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator                    | Pending: Notification Outbox Architecture ADR                                     | Engine templates invisible to registry (different namespace). Recipient resolution is a feature, not a detail. Outbox RLS `WITH CHECK (TRUE)` is never safe.                                                                                                                                                                           |
| 2026-03-27 | Profile Schema Mismatch Audit         | bug          | APPROVE WITH CHANGES     | steward, supervisor                                       | None (CLAUDE.md trap added)                                                       | `profile` has `display_name` only, not `first_name`/`last_name`. 4 broken queries found (leader-pulse, session-manager x2, list-data-sources) + 2 guardian-bus downstream. 20 files confirmed OK. Data model is correct — identity layer vs D2 workspace layer.                                                                        |
| 2026-03-28 | Wizard Routing Architecture           | architecture | APPROVE                  | steward, supervisor, agent-coordinator, frontend-designer | None (ADR-0060 already covers)                                                    | Per-route pages win over dynamic `/wizard/[id]`. Auth boundaries (public/auth/auth+workspace) prevent unification. TypeScript generics collapse in dynamic routes. Page files are 16-34 lines — no meaningful DRY gain.                                                                                                                |
| 2026-03-28 | Setup Wizard Shell Migration          | spec         | APPROVE WITH CONDITIONS  | steward, supervisor, agent-coordinator, frontend-designer | Pending: Wizard Shell Completion Contract ADR                                     | `loadState` declared in WizardDefinition type but never called by `useWizardState` — dead code across all 3 wizards. BotsTip contains regulatory content (tariffs, Mattilsynet) — not cosmetic. Step headers rendered by legacy shell, not step components — silent regression risk.                                                   |
| 2026-03-28 | Communications Stack Architecture     | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | ADR-0063: Comms consolidation                                                     | Komm canonical, Chat frozen. 3 telemetry gaps (reactions, read, mute). queueMicrotask anti-pattern in CallRoom. 4x MessageBubble maintenance problem. AI integration gap (no ai_assistant channel type yet).                                                                                                                           |
| 2026-03-28 | Chat→Komm Migration + i18n Sweep      | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-explorer | ADR-0063 amendment pending                                                        | Parallel table systems create hidden coupling through AI tools, mobile hooks, telemetry that survives UI deletion. ~90 hardcoded strings (3x initial estimate). Two tool sets for same domain (communication/ + channels.ts) — only one registered. useShiftChat blind spot in both web+mobile.                                        |
| 2026-03-28 | Dynamic Landing Engine Spec           | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: ADR-0057 (supersedes ADR-0046), ADR-0058 (conditional GSAP)              | ADR-0046 block-builder silently superseded without declaration. Landing engine must be I1 consumer, not standalone data source. 300ms crossfade violates motion.md (500ms min entrance). GSAP/Framer transform boundary must be explicit. 7 landing tables in DB undocumented in DATABASE.md.                                          |
| 2026-03-28 | Drift Insights Branch Review          | feature      | APPROVE WITH CHANGES     | steward, supervisor, frontend-designer                    | None                                                                              | i18n interpolation convention mismatch (`{x}` vs `{{x}}`) fails silently — no runtime error. Shared index files (decision log, learning log) must never be overwritten in feature branches. Hardcoded colors bypass OKLCH warm hue-shifting in dark mode.                                                                              |
| 2026-03-28 | Entity Drawer Post-Implementation     | feature      | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | 4 blockers fixed: actor_id audit trail, hardcoded strings, pin/localStorage drift, dead ref. 31 hardcoded colors flagged for follow-up. WCAG AA contrast gap on inactive tabs. Missing focus trap in sheet mode. EntityDrawerProvider isolation pattern should get ADR.                                                                |
| 2026-03-29 | Protocol Verification Engine          | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | ADR-0074 (was ADR-0071, renumbered 2026-04-07)                                    | Two mission systems (AgentMission/Ultravox vs engine_missions/Stage Engine) — generator must target DB schema. JSONB on existing table beats new table. Spring animations need 1500ms settle. protocol.json rejected as dual source of truth — TypeScript definitions instead.                                                         |
| 2026-03-29 | PVE Operations + Dashboard + Agent    | architecture | APPROVE WITH CONDITIONS  | steward, supervisor, agent-coordinator, frontend-designer | None (extends ADR-0074, was ADR-0071)                                             | Agent split: protocol-writer (observer) never touches apps/web/. Dashboard: local-only dev tool, dark theme, no Nordic Split. Manual: task-oriented not role-oriented. Testid fixes delegated via reports, not agent self-modification.                                                                                                |
| 2026-03-28 | Entity Drawer Phase 2 Design          | feature      | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | ADR-0068: Entity Drawer Surface Pattern                                           | Shift P1 > profile P2 > session P3 > team P4. Read-only only. Declarative registry. Agent bridge via WalkAi client tool. Fix debt (colors, focus trap, touch targets) IN Phase 2. day_session renamed to department_session. Drawer != schedule drawers (lightweight vs deep).                                                         |
| 2026-03-28 | Entity Drawer Phase 2 Plan Review     | plan         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | 3 blockers found: employment_contract wrong columns (contract_type→employment_category, is_active→status), CascadeTaskTab/DepartmentDetailTab props not renamed to entityId, agent bridge dead (CustomEvent→WalkAi client tool fix). All resolved during implementation.                                                               |
| 2026-03-28 | Telegram WalkAi Adapter               | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator                    | Pending: ADR-0059 (platform-admin pipeline separation)                            | Nullable DB column != nullable pipeline — TypeScript types form independent enforcement chain. Admin pipeline must be separate from employee pipeline (different authority, intent, tools). PG NOTIFY > Realtime for server-side relay. callback_data 64-byte limit requires lookup table.                                             |
| 2026-03-28 | Telegram Adapter Post-Impl            | feature      | REJECT → Fixed           | steward, supervisor, agent-coordinator                    | ADR-0059 written                                                                  | 6 column name mismatches between migration and code — subagent implementers drifted from schema. emitGuardianEvent != emit() (wrong telemetry system). Tests mock Supabase so column bugs invisible. Post-impl council is essential for adapter code.                                                                                  |
| 2026-03-28 | Cascade Tasks Production Readiness    | bug          | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | incomplete_training CTE caught zero-touch only, not partial. workspace_operating_hours is legit 4th hours table (needs CLAUDE.md update). Hardcoded colors/Norwegian/any-casts all fixed. messages group should be C4 not C2 (P2). dept_summary done/total misleading (P1).                                                            |
| 2026-03-28 | Dashboard + HMS/Drift Prod Ready      | feature      | NOT READY FOR PRODUCTION | steward, supervisor, agent-coordinator, frontend-designer | Pending: Edge Function vs Engine execution ownership ADR                          | Session lifecycle broken (signoff bypasses pending_signoff). Dual execution paths (cron EF + engine) = split-brain risk. Notification pipeline dead (hooks never fire). Fake stubs worse than missing features. Agent ops tools bypass emit(). 10 HMS files hardcoded Norwegian + stripped diacritics.                                 |
| 2026-03-28 | WizardShell + WalkAi Integration      | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Emma-Wizard Bridge ADR (supersedes ADR-0049 for wizard tools)            | Stale closures in useRegisterTools — always use refs. WalkAiProvider only in DashboardShell — onboarding needs it. WizardContext.tsx has 15 consumers, not 5. CustomEvent in packages/ui breaks React Native compat — use callback prop. Client tools have no C4 authority gating (by design).                                         |
| 2026-03-29 | Auth Security & Friction              | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Rate-limit fail-closed ADR                                               | `workspace.status` column doesn't exist — spec built on sand. `email_verified` belongs on auth.users not workspace. Engine FK missing CASCADE = cleanup cron failure. Stage Engine bypasses RLS via service_role — sandbox gates must be middleware, not RLS. Telemetry must use entity-verb format, not dot-notation.                 |
| 2026-03-28 | WizardShell + WalkAi Plan Review      | plan         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | WalkAiProvider crashes outside DashboardShell (useEntityDrawer hard dep). Context bridge useState without sendContext is dead code. Nav tool no-ops mislead Emma. completedSteps Set new ref each render. emit() may be server-only. AnimatePresence mode="wait" creates tool gap. ARIA live region V1.                                |
| 2026-03-28 | Mobile Group Call Expanded UI         | spec         | PASS WITH CONDITIONS     | steward, supervisor, frontend-designer                    | None                                                                              | CallSession type missing videoPolicy (lives on channel table). LiveKit canPublish is coarse (one boolean) — UI enforces audio/video split. RTCView import path needs verification. Speaker glow must be spring-driven not CSS keyframe. Grid-to-focus needs shared-element animation. Reduced motion check mandatory.                  |
| 2026-03-28 | Mobile Group Call Plan Review         | plan         | REJECT → Fixed           | steward, supervisor, frontend-designer                    | None                                                                              | 3 compile blockers: useTranslation doesn't exist in mobile (use constants/strings.ts), caption2/title3 typography variants don't exist (use micro/headline), CallSheet bypassed BottomSheet wrapper. Also: VideoPolicy type orphaned (moved to call-types.ts), headerLeft.color invalid ViewStyle, emit() empty actor_id.              |
| 2026-03-28 | Mobile Group Call Post-Impl           | feature      | ACCEPT WITH FIX          | steward, supervisor                                       | None                                                                              | CallBar had 5 hardcoded Norwegian strings not migrated to strings.call (fixed). useLiveKitCall.connect() doesn't enable camera for default_on/required videoPolicy (follow-up). No emit() in components (parent handles). Hardcoded hex colors logged as debt. Frontend-designer couldn't access wt-2 (worktree isolation).            |
| 2026-04-14 | Contract System Phase 2-3             | feature      | APPROVE WITH CHANGES     | frontend-designer (3 agents failed: usage limits)         | None                                                                              | useMemo+setState = anti-pattern. Semantic table scope/aria-label mandatory for matrix UIs. Degraded council mode works when orchestrator covers gaps.                                                                                                                                                                                  |
| 2026-03-29 | Interactive Dashboard Redesign        | spec         | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | session_task resolution, broadcast channel, telemetry, ADR-0068 mutation boundary | session_task.department_session_id NOT NULL blocks inline task creation in Prep mode — resolved via active/upcoming session lookup. Broadcast uses news channel_type. Spring constants were 3-10x too high. prefers-reduced-motion was missing. Entity drawer must remain read-only (ADR-0068). Feature flag recommended for rollback. |
| 2026-03-29 | Reconciliation "Stilling" Data Fix    | bug          | APPROVE WITH CHANGES     | steward, supervisor, frontend-designer                    | None                                                                              | `schedule_shift.role` (D6) != `position.name` (D2) — different dimensions, not interchangeable. Added `positionName` as new field, kept `role` unchanged. Employee name was null due to missing profile join. ~15 hardcoded Norwegian strings + `#6366f1` fallback flagged as polish-pass debt.                                        |
| 2026-04-06 | Code Review: mobile-prod + prod-gaps  | code review  | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Migration Safety ADR                                                     | DROP TABLE CASCADE in migrations = silent data destruction. supabaseAdmin:unknown forces unsafe casts across all agent tools. sendMessage only mutation tool without emit(). indigo-500 is cold-spectrum (hue ~240) in warm-only OKLCH system. Agent tools bypass RLS by design — every query MUST include manual .eq(workspace_id).   |
| 2026-04-06 | Full Plan Portfolio Review (11 plans) | plan         | MIXED (see below)        | steward, supervisor, agent-coordinator, frontend-designer | None                                                                              | See details below                                                                                                                                                                                                                                                                                                                      |
| 2026-04-06 | Journey Inference as Agent Harness    | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: Mobile Telemetry Offline Emit ADR, Journey Progress via Domain Process Engine ADR | 5 breaks verified: 12/12 mobile hooks 0 emit(), no runtime journey tracking, two journey systems, Guardian AI-only, rescue unwired. Rescue≠Re-engagement (two-tier model). Journey DB tables are dev-tracking artifacts (never repurpose). All orchestration via engine_process. |
| 2026-04-14 | Module 6 Sub-project 0 Plan Review (pre-execution) | plan | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator | None | 3 blockers found: (1) ALTER TYPE ADD VALUE in transaction — split migration, (2) trigger uses NEW.profile_status but column is NEW.status, (3) Task 5 "mobile bug" isn't a bug (is_active exists, profile_status is type not column). Plus: missing FK on assigned_by/waived_by, column default still 'pending', getTeamReadiness data exposure (moved to suggestTools), package.json incomplete. Learning: ALTER TYPE ADD VALUE cannot run in transactions (second occurrence). |
| 2026-04-14 | Module 6 Training & Competence — Implementation Plan Scoping | plan | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator, frontend-designer | None (corrections, not new architecture) | `protocol_assignment` missing `workspace_id` (blocking). Training capability is "declared ghost" (intent routes to nothing). Existing CRUD already exists (6 forms + mutations). Mobile hook has live bug (`is_active` vs `profile_status` enum). Nordic Split compliance ~30-40%. Five low-cost AI columns prevent Phase 2 rework. Shared hooks must move to `packages/` before mobile UI. Sub-project 0 (Schema + Data Foundation) is mandatory prerequisite. |
| 2026-04-13 | Contract E2E Gap Closure + Template Binding + Hospitality Intelligence | architecture | APPROVE WITH CHANGES | steward, supervisor, agent-coordinator, frontend-designer | Amend ADR-0076 (template as input), New ADR (employment_category enum), Amend ADR-0077 (form-based PII Phase 1-2) | 13 gaps mapped in contract flow — chain completely broken between composition and signing. 3-phase plan: gap closure, template binding, agent integration. Template binding placed as K1b. employment_category needs enum (TEXT is sand). Tariff lookup fragile (LIMIT 1 returns arbitrary rate). Send route telemetry bug (emits wrong event). Wizard restructured to 5 steps. Template selection invisible to admin (cascade-derived). PII collection via form page, not agent, for Phase 1-2. Tripletex researched: they do NOT generate documents — our cascade-derived contracts + compliance checking is the differentiator. |
| 2026-04-09 | Agent Harness Foundation Spec         | architecture | APPROVE WITH CHANGES     | steward, supervisor, agent-coordinator, frontend-designer | Pending: ADR-0083 (Agent Harness Foundation, extends ADR-0042)                    | engine_session_event vs guardian_log boundary must be explicit (internal replay vs external audit). delegate_task tool must live in stage-engine, not packages/ai (package boundary). createSession() requires mission_id — subagents need separate createSubagentSession(). Hooks are chat-pipeline only in Phase 1 (voice bypasses routeAgentMessage). Orbiting electrons rejected — concentric pulse rings match Nordic Split ambient language. |
| 2026-04-07 | ADR-0075 Implementation Review (post-migration) | architecture | APPROVE WITH CHANGES → FIXED | steward, supervisor, agent-coordinator, frontend-designer | ADR-0075 already written + accepted; 7 follow-up fixes applied same session | Decision log file was corrupt (concatenated frontmatters from merged feature branches) — rebuilt from scratch. `/status` did NOT regenerate DASHBOARD from `git worktree list` — command doc rewritten to enforce regeneration contract. Race in end-session.sh (DASHBOARD sed before activity-log write) reordered. close-feature.sh silent failure `2>/dev/null || true` replaced with explicit warning pattern. narrator.md line 135 missed in sweep — fixed. INDEX vs ORIENTATION trust-hierarchy conflict resolved (STATE.md demoted to layer 7). ORIENTATION MEMORY.md ambiguity clarified. All 7 fixes committed 5fe73c8b and pushed. Biggest lesson: sweep grep regex must match bare words, not just file extensions. |
| 2026-04-09 | Contract System Reconciliation: Two Unfinished Strategies | architecture | APPROVE WITH CHANGES | steward (chair), supervisor, system-agent-coordinator, frontend-designer | None (ADR-0076 already covers) | **CRITICAL FINDING: CompositionWizard is a non-functional shell** — merged as "complete" but never calls resolveComposition or any API. `state.proposal` always null, wizard always shows "Ingen forslag tilgjengelig". **Send-drawer template fetch broken** — API returns `{ data: [...] }`, drawer expects bare array, always shows empty state. Neither contract flow has EVER worked for end users despite 79 files + 5300 LOC merged. Root cause: backend is correct, UI shells exist, but wiring between them was never completed. The two strategies (template-based vs cascade-derived) are COMPLEMENTARY not competing: cascade owns substance (terms, rates, compliance), templates own form (document presentation). Phase 1 plan: wire wizard to resolveComposition API (~50 LOC), fix template fetch (1-line), fix tariff lookup (add framework_id filter), replace UUID input with employee picker, add telemetry (13 events registered but never emitted). Phase 2: change_proposal integration per ADR-0076, workspace admin template CRUD at /dashboard/settings/contracts/, merge send-drawer into wizard as final step, i18n + Nordic Split. Phase 3 (separate): contract_intake capability completely unreachable (not in intent classifier, channel never set on AgentToolContext, allowedChannels dead code). Additional findings: actor_id uses auth.uid() not profile_id in contract API routes, RLS vs API semantic mismatch (is_system vs workspace_id IS NULL), authority config seed uses wrong key format (dotted vs flat — all capabilities default to read_only). |
| 2026-04-08 | Contract Composition Engine — Round 2 (13 detailed decisions) | feature | APPROVE WITH CHANGES | steward (chair), supervisor, system-agent-coordinator, frontend-designer | ADR-0080 (compliance drift signal), ADR-0081 (admin PII bypass RPC), ADR-0082 (drafts are not versions) | 6 tensions resolved. Key rejects: `engine_state_step.status` CHECK extension (refusal belongs on contract level), per-field step granularity (bundled groups of ~5 prevents 2000 waiting-states), auto change_proposal for framework drift (use read-only materialized view instead), 4 new enum values (only `declined` + `pending_data` added, dashboard bucketing is UI layer), cross-device Realtime sync (deferred to Phase 3 — no broadcast infra exists). Key accepts: `decline_reason_code` + text on employment_contract, bundled intake groups with empathy copy per group, escalation via `engine_delayed_trigger.cancelled_at` pattern (requires migration), drafts are not versions (versioning starts at sent, idempotency key on send), admin PII bypass dashboard-only with data-shaming UX + required reason + employee notification, framework_snapshot JSONB immutable at send-time. Steward's load-bearing principle: "cascade/execution boundary — every tension that tried to cross it got rejected for the same reason. Hold that line." |
| 2026-04-07 | Contract Composition Engine (B+C+D) | feature | APPROVE WITH CHANGES (substantial) | steward, supervisor, system-agent-coordinator, frontend-designer | ADR-0076 (composition as cascade derivation), ADR-0077 (intake PII handling, proposed), ADR-0078 (engine process channel restriction), ADR-0079 (ADR-0024 amendment — employment vs platform contract separation) | 8 blockers identified. Key resolutions: `human_only` flag REJECTED (replaced by collect_signature + allowed_channels + C4 authority — cascade invariant #2); `contract_compliance_override` table REJECTED (override data lives as `employment_contract.compliance_overrides JSONB` provenance per cascade invariant #8); composition pipeline is INSIDE cascade as derivation producing `change_proposal`, not beside; `employment_contract` (HR) vs `contract` (ADR-0024 platform legal) clarified as two separate systems; `Forklart på norsk` tab reserved in UI but DISABLED in Phase 1 (Phase 2 will build `framework_lookup` verbatim, never `framework_explain` paraphrase); `framework_id` on template REJECTED (frameworks resolve at composition time via `workspace_framework_binding`). PII ADR blocks all intake code. Voice forbidden for critical data — enforced via 3-layer defence (process + capability + tool). Supervisor caught `contract_status` enum naming collision with text column in migration 20260228140000. Agent-coordinator confirmed `human_only` and `allowed_channels` do NOT exist in codebase, must be added. Frontend caught "magisk UX" risk (per-block acknowledgement non-negotiable) and proposed segmented tabs `Kontrakt \| Rettigheter \| Forklart` on mobile with bottom-sheet IA. Learnings 0029 (four permission mechanisms smell) and 0030 (contract name overloaded) captured. |
| 2026-04-07 | Three-issue retrospective: build-agent gap, parallel sessions, ADR-0075 v1.1 | architecture | APPROVE WITH CHANGES | steward (chair), supervisor, system-agent-coordinator, narrator | ADR-0075 → v1.1 amendment in place; ADR-0076 (build-agent verification evidence contract) and ADR-0078 (dev-time agent infrastructure parity) to write. ADR-0077 reserved/skipped. | Three-issue council. (1) Build agent on journey-harness-poc paraphrased DoD #5 — fix `ee2d2bb0` corrected detector off-by-one (`current_step=1` → `=2`). Process lesson: headless build agents must dump raw curl/SQL, not paraphrased prose. (2) Parallel Claude sessions both worked on ADR-0075; cb7c7c60 was committed directly to development in violation of ADR-0075's own resolved Open Q3. *"ADR-0075 was violated by the commit that shipped ADR-0075"* — preserved as canonical learning. Fix: husky Hook #7 (branch guard with MERGE_HEAD allowance), implemented via worktree (eat the dogfood). (3) ADR-0075 retroactive: ORIENTATION.md was self-described "North Star" but not in either CLAUDE.md Boot Sequence; promoted to step 0 + self-listed as tier 0 in own trust hierarchy + Hook #8 grep enforces ADR-0075 reference. Agent Coordinator's deeper insight: *"world-class agent architecture for runtime agents, zero infrastructure for the agents that build the codebase. The asymmetry is the bug."* ADR-0078 (dev_session sibling table, sealed envelope subagent prompts, dev.* telemetry family) reserved for next sprint. |
| 2026-04-16 | Botsson Observability Foundation P0+P1 pre-PR review | post-implementation | APPROVE WITH CHANGES | steward, supervisor, system-agent-coordinator | none (follow-ups queued) | Learnings 0034, 0036, 0037. Prior verdict held. 5 MUST-FIX before merge: spec stamp, sub-route AppEnv, index.ts console.*, PR Trust Gate disclosure, ADR-0116 forward-ref fix. |
| 2026-04-16 | PR #213 R2 post-implementation review | post-implementation | APPROVE WITH CHANGES | steward, supervisor, system-agent-coordinator | ADR-0117 (authority post-Phase-4) + ADR-0116 addendum (entity contract) | Learnings 0038, 0039. Trust Gate verdict PARTIAL until entity fix. Supervisor caught activity_trail silent-drop bug R1 missed — promoted to council rule in Phase 9. |

### 2026-04-06 — Full Plan Portfolio Review

**Type:** plan
**Scope:** All 11 remaining plans in `docs/superpowers/plans/`
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer (3 batches, 11 parallel agents)

#### Verdicts

| Plan                           | Verdict                 | Key Finding                                                                                                                                                                                                                               |
| ------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| telemetry-botsson-reactive     | **DO NOT MERGE**        | `workspace_setup` engine_process has 9 `wait_for_event` steps depending on `wizard.step_completed` in `engine_event`. Branch removes this routing → setup wizard hangs forever. Fix: keep engine_event routing or migrate engine_process. |
| telegram-walkai-adapter        | **DO NOT MERGE**        | Duplicate migration `20260328180000` already on development → `table already exists` failure. Branch stale: merge would delete 19+ telemetry events (auth OTP, security, enrichment). Fix: rebase on development.                         |
| invitation-flow-core-fixes     | APPROVE WITH CONDITIONS | Security fix (USING(true) → RPC). Missing emit() calls, hardcoded colors/Norwegian.                                                                                                                                                       |
| sjohuset-simulator             | APPROVE WITH CONDITIONS | Missing cascade proof tests, cleanup failure recovery, provenance on seeded data. ADR-0068 approved.                                                                                                                                      |
| protocol-verification-engine   | APPROVE WITH CONDITIONS | Skip Task 4 (migration already exists). Throw on missing service role key.                                                                                                                                                                |
| protocol-monitor-dashboard     | APPROVE                 | Fix RESULTS_BASE path. Execute after protocol engine.                                                                                                                                                                                     |
| developer-tooling-optimization | APPROVE WITH CONDITIONS | Keep "Critical Traps" and "What NOT To Do" in CLAUDE.md — only move reference material to skills.                                                                                                                                         |
| infra-prod-alignment           | APPROVE WITH CONDITIONS | **CRITICAL: Droplet path wrong** (`/opt/smartout/` → `~/dev/smartout.ai/`). Mark Tasks 1-2 done.                                                                                                                                          |
| module-zero-completion         | APPROVE WITH CONDITIONS | Split: WS-1 done → archive, WS-2 → new plan, WS-3 → backlog. Fix pg_cron violations.                                                                                                                                                      |
| deployment-pipeline            | APPROVE WITH CONDITIONS | Tasks 8-9 are Pontus-only (main branch). Verify 86 index count.                                                                                                                                                                           |
| swipe-task-review              | **REJECT**              | ALL `walkAi/` paths wrong → renamed to `Botsson/`. `useWalkAi()` doesn't exist → `useBotsson()`. `viewActionsRef` not exported. Full rewrite needed.                                                                                      |

#### Key Learnings

1. **Unmerged branches rot fast.** Both merge-ready branches (telemetry, telegram) had critical blockers discovered only through verification. Stale branches accumulate migration conflicts and telemetry regressions.
2. **engine_process event dependencies are invisible.** The `workspace_setup` process depends on wizard events routed to `engine_event`, but this dependency is only visible in SQL seed data — not in TypeScript code. Need a dependency map for engine_process triggers.
3. **Directory renames break plans silently.** The `walkAi` → `Botsson` rename invalidated an entire plan without any automated detection.
4. **Droplet path discrepancy** (`/opt/smartout/` in plan vs `~/dev/smartout.ai/` in reality) would have caused all SSH commands to fail. Memory files caught this.
5. **CLAUDE.md safety rails must stay always-loaded.** Multiple agents independently flagged that moving "Critical Traps" and "What NOT To Do" to on-demand skills creates a blind spot when skills aren't triggered.

## 2026-04-07 — Mobile Employee Login + Shifts E2E
**Type:** feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor
**Key decision:** Workspace store (Zustand + MMKV) for multi-workspace profile selection — follows existing use-theme-store pattern.
**ADR created:** none (follows existing patterns)
**Learning created:** none

**What was reviewed:**
- 2 journey documents (JOURNEY-mobile-employee-login.md, JOURNEY-mobile-shifts-overview.md)
- 3 code fixes: password reset handler, signup link wiring, workspace store for profile selection
- 6 files changed across auth flow + data hooks

**Critical finding (both agents independently):** workspace-select.tsx was reverted by linter during review — orchestrator fixed atomically with full Write.

**Follow-ups identified:**
1. Add `workspace_id` filter to shift query (defense-in-depth)
2. Add `emit()` for workspace selection (telemetry convention)
3. Fix push token registration for multi-workspace
4. Add stale-profile guard in hooks
5. i18n for hardcoded Norwegian strings (pre-existing debt)

## 2026-04-07 — Mobile Auth+Shift Bug Triage (15 bugs)
**Type:** bug
**Verdict:** APPROVE WITH CHANGES (fix 2, log 10, drop 3)
**Agents consulted:** system-steward, supervisor
**Key decision:** B1 (cache key mismatch) is OUR bug — fixed. B2 (.single() crash) pre-existing but trivial — fixed. B3-B12 pre-existing — logged. B4, B5, B13, B15 are false positives.
**ADR created:** none (B3 code-flow needs future ADR)
**Learning created:** none

**Bugs fixed this session:**
- B1: `[id].tsx:161` optimistic update cache key → `["my-shifts", selectedProfileId]`
- B2: `use-my-profile.ts:64` → `.maybeSingle()` + null handling

**Pre-existing bugs logged (10):**
- B3 (CRITICAL): Code entry flow never creates profile — dead end
- B6 (HIGH): Google OAuth callback not handled on native
- B7 (LOW): Realtime dead on pending (polling compensates)
- B8 (MEDIUM): No rejection feedback on pending
- B9 (MEDIUM): Push token for wrong workspace
- B10 (LOW): Google OAuth loading state resets instantly
- B11 (MEDIUM): Search flow silent fail on null company_id
- B12 (LOW): Wrong invite_type for search flow
- B14 (LOW): DEV_SHIFTS masks errors in dev mode

**False positives dropped (3):**
- B4: FK guarantees workspace exists for active profiles
- B5: PostgreSQL silently ignores PK in SET clause
- B13: Zustand function selectors are referentially stable
- B15: 5-min stale time is standard TanStack behavior

**Architectural findings:**
- Code-join path (B3) is an unfinished feature — needs design decision (code = authorization vs invitation)
- OAuth on native (B6) was never tested — no callback route exists

## 2026-04-06 — Journey Harness PoC Instruction Review
**Type:** spec
**Verdict:** APPROVE WITH CHANGES (5 amendments required, all incorporated)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator
**Key decision:** PoC scoped to web-only for v1 (mobile is Phase 2). Process uses `wait_for_event` step advancement, NOT second trigger. Stuck detection via dedicated Edge Function on pg_cron, not Stage Engine Guardian.
**ADR created:** none (learning logged instead)
**Learning created:** "Journey processes require entity-scoped payload + wait_for_event step advancement"

**What was reviewed:**
- `docs/superpowers/specs/2026-04-06-journey-harness-poc-instruction.md`
- The PoC plan to prove the Journey Harness chain end-to-end for Journey 03 (Sjekke vakter)

**Convergent findings (3 agents independently identified):**
1. Mobile `emit()` path is broken for engine_event delivery (web-only)
2. Event name format (registry space form vs trigger dot form) was unspecified
3. Entity payload (`entity_type` + `entity_id`) not specified for engine_state creation
4. Step advancement mechanism (wait_for_event vs second trigger) was unspecified
5. Stuck detection runtime (pg_cron vs Edge Function) was vague

**Two agents flagged:**
- ActionVerb/SmartoutEvent type expansion needed in registry.ts
- `shift roster_viewed` was misplaced (manager screen, employee journey)
- engine-dispatch resume-waiting logic must be verified before coding

**5 Amendments incorporated into the spec:**
- C1: Web-only scope for v1 (mobile Phase 2)
- C2: Entity payload contract (`entity_type: "profile"`, `entity_id: <profile_id>`)
- C3: Step advancement via `wait_for_event`, not second trigger
- C4: Event name format (space form in registry, dot form in trigger/step)
- C5: Stuck detection via dedicated Edge Function on pg_cron

**Prerequisite verification added:** Build agent must verify engine-dispatch resume-waiting logic, dispatch_push_notification existence, pg_cron availability, and engine_event provider auth path BEFORE writing any code.

**Biggest risk avoided:** Without amendments, PoC would create duplicate `engine_state` rows per profile and a journey that never advances past step 1 — "running" but proving nothing.

## 2026-04-06 — Journey Harness PoC Re-Review (Verification of Amendments)
**Type:** spec (re-review)
**Verdict:** APPROVE WITH CHANGES (2 NEW critical bugs found, both fixed)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator
**Key decision:** Amendment verification round caught 2 critical bugs that first review missed: G1 (wrong payload key `event_type` vs `event`) and G2 (client-side dev mode short-circuit). Both fixed in spec before dispatch. Added C6 constraint requiring server-side emit origin.
**ADR created:** none
**Learning created:** "Verification rounds find what first reviews miss — agent-coord traces actual code, others trace specs"

**What was reviewed:**
- The amended spec from the first council session
- Verification that all 5 amendments (C1-C5) actually solved the original gaps

**Convergent findings (Steward + Supervisor):**
- Both said "PASS WITH MINOR CONDITIONS" — same minor tilføyelser flagged
- Agreed on: employee-facing route check, pg_net check, EVENT-SEQUENCE.md update, COUNT query for DoD #8

**CRITICAL bugs found ONLY by agent-coord (not by Steward or Supervisor):**

**G1: Wrong payload key in C3** — Spec said `action_payload: { event_type: 'shift.list_viewed' }` but `engine-dispatch/index.ts:411` reads `action_payload.event` (without `_type`). Verified against existing seeds (`seed_daily_close_process.sql:71` uses `"event"`). If build agent followed the spec literally, step 1 would enter `waiting` forever — silent PoC failure.

**G2: Client-side dev mode short-circuit** — `engine-event.ts:74` returns immediately when `NODE_ENV === "development"` for client-side emits. Since PoC runs in Supabase Local with Next.js dev server, every `emit()` from a `"use client"` component (drawer, onClick, useEffect) would silently no-op. The entire telemetry chain would die in local PoC environment without anyone noticing.

**Fixes incorporated:**
- C3 updated: `action_payload: { event: '...' }` (correct key) with line 411 quoted as evidence
- New C6 added: Emit MUST originate server-side (Server Component / Server Action / Route Handler), with anti-pattern + correct pattern code examples
- Section 2 process design corrected
- Prerequisite Check expanded from 4 items to 8 items (route check, schema check, index check, extension check, etc.)
- DoD expanded from 8 to 10 items (COUNT query, EVENT-SEQUENCE.md update, emit call site documentation)
- Registry expansion now requires all 4 destinations (posthog, logger, activity_trail, engine_event)

**Council process learning:** The verification round caught what the original review missed. Agent-coord traced actual code line-by-line (engine-dispatch.ts:411, engine-event.ts:74) while Steward/Supervisor evaluated the spec at concept level. Both perspectives were necessary — concept review approves the architecture, code-tracing review catches the implementation bugs. Always run a verification round after spec amendments.

**Biggest risk avoided (this round):** Build agent would have followed spec literally and shipped a PoC where (a) no step ever advances because of payload key mismatch, OR (b) entire chain silently no-ops in local dev. Both bugs would only surface during testing — wasting hours of build time.

---

## 2026-04-07 — Untracked vercel.json: migrate droplet services to Vercel?

**Type:** architecture
**Verdict:** REJECT (DELETE the file)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator
**Frontend-designer:** skipped (not a UI question)
**ADR created:** ADR-0072
**Learning created:** 0025-stage-engine-websocket-vercel-blocker

**Subject:** An untracked `vercel.json` appeared at repo root on 2026-04-06 with an undocumented `experimentalServices` field naming web + 4 backend services. No ADR, no plan, no driver, no provenance. Question: delete, integrate, or hybrid?

**Verdict:** Unanimous DELETE (3/3).

**Key findings (each agent caught something the others missed):**

**System Steward (chair):**
- File violates Source of Truth Hierarchy — `experimentalServices` is undocumented, cannot be canonical for service topology.
- Bypasses ADR-0040 without supersession ADR.
- ADR-0071 (preview env asymmetry "services have no preview tier") would need re-derivation — vault structure, env sync manifest, the asymmetry rationale.
- scrapling network isolation regression: currently internal-only, the proposed routePrefix would make it publicly addressable.
- n8n persistent volume cannot move to Fluid Compute → Option B impossible by construction.
- Timing: cost of "no" today is zero, cost of "yes" is unbounded. We just shipped first preview→main release.

**Supervisor:**
- Scope creep: file bypassed `/start-feature`, decision log, SESSION.md, council. Every quality gate.
- DocuSeal HMAC verification depends on raw request body — Fluid Compute body parsing under `experimentalServices` is unverified. Production billing-adjacent code at risk.
- `interview-mcp` exists in `services/` but is missing from the proposed file → spec already incomplete.
- Adding Vercel Functions creates a THIRD compute fabric (Supabase Edge + droplet + Vercel) — fragmentation.
- `experimentalServices` not in any documented Vercel config surface (only `functions`, `crons`, `bunVersion`, `routes`, or `vercel.ts` + `@vercel/config`).

**System Agent Coordinator (CRITICAL — caught structural blockers others missed):**
- **WebSocket routes in stage-engine** — `/ws/:sessionId` and `/guardian/ws` are persistent connections used by onboarding UI and admin dashboard. Vercel Functions DO NOT support arbitrary WebSocket upgrades. **Hard blocker.**
- **In-process guardian-bus** — `services/stage-engine/src/core/guardian-bus.ts` distributes events via in-process EventEmitter. Multiple Fluid Compute warm instances would silently drop cross-instance events. Externalization to Upstash Redis pub/sub or Vercel Queues required.
- **Background loops** — `CLEANUP_INTERVAL_MINUTES=5` and Calendar Guardian tick need conversion to Vercel Cron.
- shift-mcp is the only clean candidate but cold-start variance (800ms-2.5s vs droplet's always-warm 300-500ms) breaks agent tool latency budget for voice flows.
- Voice (Ultravox) clarification: voice runs browser↔Ultravox directly. Stage Engine receives only short-lived server-side tool callbacks. NOT a sustained-connection issue. Good news for any future migration.

**Key decision:** Option A (DELETE). Option B impossible by construction (n8n, scrapling). Option C premature (latency cost, no driver, requires WS refactor first).

**Doc references checked:** The 3 older docs that mention `vercel.json` actually reference `apps/mobile/vercel.json` (legitimate Expo PWA SPA rewrite config), NOT the root file. No doc audit needed. Clean delete.

**Council process note:** Full council was the right call here. Each agent contributed unique findings — Steward caught the ontology + ADR conflicts, Supervisor caught the scope-creep + DocuSeal webhook risk, Agent-Coord caught the structural WebSocket blocker that nobody else would have known about. None of these would have been found by reading docs alone.

---

## 2026-04-06 — Employee Contract Management Post-Implementation Review

**Type:** feature (post-implementation)
**Verdict:** APPROVE WITH CHANGES — 6 must-fix, 4 should-fix
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer, narrator
**Key decision:** Architecture sound (D2 Resource placement, contract_type branching, cascade integrity preserved). Implementation had 6 runtime-breaking bugs requiring fix before merge.
**ADRs created:** 5 entries in feature decision log (table reuse, status propagation, suggestTools placement, X-Service-Key auth, fetch timeouts)

### What broke
1. Botsson tools referenced 4 nonexistent columns (`id` vs `contract_id`, `profile_id` doesn't exist, `contract_template_id` vs `template_id`)
2. Webhook wrote `"declined"` to enum that lacks that value → PostgreSQL constraint violation
3. POST /api/contracts created without `emit()` → telemetry gap
4. Auth header used `Authorization: Bearer` instead of `X-Service-Key` convention
5. `sendEmployeeContract` autonomous instead of suggest-confirm flow
6. Hardcoded Tailwind colors (blue-500, green-500, yellow-500) throughout UI

### Learnings captured
1. **Always verify Botsson tool schemas against `database.types.ts`** — 3 agents independently caught the same column mismatches. Plans written from memory drift from reality fast.
2. **Service-to-service auth is `X-Service-Key`, not Bearer** — second time this pattern has been confused.
3. **Irreversible AI actions belong in `suggestTools`** — `confirm`/`autonomous` authority levels expose tools without enforced UI confirmation. The suggest tier is the only one that gates on user confirmation.

### Verdict held
All fixes applied in single commit (`2fbdbdf7`). Typecheck 27/27 passing. Architecture untouched — only implementation accuracy fixes.

---

## 2026-04-06 — Employee Contract Management R2 Re-Review

**Type:** feature (re-review after R1 fixes)
**Verdict:** REJECT — 3 new blockers found by tracing end-to-end flow
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer, narrator

### What R2 found that R1 missed
R1 reviewed each side of the feature in isolation. R2 traced the integration and found 3 new blocking bugs:

1. **B1 RUNTIME BUG (Supervisor):** Drawer sent `{field_values}` but route Zod schema expects `{overrides}`. Drawer read `id` from response but route returned `{contract_id}`. The send-contract user flow was broken on first use. Pure typecheck couldn't catch this — local type annotations on `await response.json()` are unchecked claims.

2. **B2/NEW-3 INVARIANT (Steward):** Botsson `createEmployeeContract` had no `emit()` call. Silent mutation path through agent layer — bypassed activity_trail, PostHog, and engine_event. Violation of "no mutation without emit".

3. **B3/NEW-4 SECURITY (Steward):** POST /api/contracts had no role check. Any authenticated workspace member (including employees) could create contracts for any profile. Privilege escalation vector.

### Fix path
- B1: Drawer body shape aligned to Zod schema, response destructure fixed (commit `51b7b49c`)
- B2: First attempt wrote directly to activity_trail (incomplete). Second attempt refactored `@smartout/telemetry` package to use `globalThis["window"]` instead of `typeof window`, allowing import from server-only `@smartout/ai` (commit `d92a597e`)
- B3: Added admin/owner role check in route handler with user-scoped client (commit `51b7b49c`)
- Regression tests + 2 learnings filed (commit `3ce3ec71`)

### Process learning
End-to-end review IS different from per-file review. For features with drawer→API→DB flows, the reviewer must trace every payload field both directions. Captured as Learning 0023.

---

## 2026-04-07 — Employee Contract Management R3 Verification

**Type:** feature (third review)
**Verdict:** APPROVE WITH CHANGES — 0 new blockers, 2 closure-blockers tracked
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer

### Gate status
- **Merge to development:** GREEN — all R2 blockers verified fixed by 4 independent reviewers
- **Feature closure:** YELLOW — 2 items tracked

### Closure-blockers (must address before `/close-feature`)
1. **NEW-5 — `as never` cast on webhook line 225.** Gated on type regen. Local Supabase has migration drift from parallel worktree work; type regen requires resolving drift first. Tracked as closure-blocker, not merge-blocker.
2. **PII (personnummer) handling decision.** Personnummer flows through placeholder map to DocuSeal. Needs Pontus decision + ADR. Three options on table: encrypt at rest, defer to DocuSeal entirely, or split into separate restricted-access table.

### Backlog (track, don't block)
- Rename Test 1 in contracts-api.spec.ts to reflect Zod silent-strip (Supervisor)
- Document or widen route response shape for `recipient_name` (Supervisor)
- Extract `requireWorkspaceAdmin()` helper if a 4th caller appears (Steward)
- Audit codebase for other `as never` casts after type regen (Steward)

### Process observation: Convergence pattern
R1: 6 blockers → R2: 3 new blockers (in fixes) → R3: 0 new blockers. This is healthy convergence: find → fix → verify → ship. Council depth (3 rounds) was right for this surface area. Simpler features should converge in 2 rounds; cascade-touching features may need 4+. **Council depth scales with cross-cutting surface area.**

### Verdict held
4 reviewers converged on ship. Steward: "From the agent architecture perspective: this is the right fix in the right place. No follow-up needed." Supervisor: "Ship it, log items as follow-ups." Frontend: grep verified zero hardcoded palette colors.

---

## 2026-04-09 — Contract Composition Engine (Post-Implementation Review)
**Type:** feature
**Verdict:** APPROVE WITH CHANGES (8 blocking fixes applied)
**Agents consulted:** System Steward, Supervisor, Agent Coordinator, Frontend Designer
**Key decision:** 8 critical bugs caught and fixed before merge: column name mismatches, engine process lookup, JSONB access syntax, missing role gates, actor_id type error, scope creep reverts
**ADR created:** none (ADR-0076 change_proposal omission documented as tracked debt)
**Learning created:** none

### Blocking issues found and fixed
1. `address_line_1` column name mismatch in RPC + intake tools (Steward + Supervisor)
2. Engine process lookup `.eq("name")` should be `.eq("id")` (Steward + Supervisor)
3. Compliance drift view JSONB array syntax on object (Steward)
4. `compute_compliance_diff` field name mismatches (Steward)
5. Missing admin/owner role gates on 4 API routes (Supervisor)
6. `actor_id` using auth UID instead of profile_id (Supervisor)
7. Scope creep: useShiftClock emit removal (Supervisor) — reverted
8. Scope creep: notifications outbox gutted (Supervisor) — reverted

### Follow-up items tracked
- ReasoningDrawer: use Sheet instead of fixed panel (Frontend)
- DerivationStep: use WizardLoadingOverlay not bare spinner (Frontend)
- Hardcoded Tailwind colors → CSS variables (Frontend + Supervisor)
- Hardcoded Norwegian → i18n keys (Steward + Supervisor)
- Missing motion/animation (Frontend)
- ADR-0076 change_proposal integration (Steward)
- ADR-0082 idempotency key on send (Steward)
- Intent classifier for contract vs contract_intake (Agent Coord)
- Authority config defaults for contract_intake (Agent Coord)
- actingOnBehalfOf context stripping (Agent Coord)
- Entity type standardization: employment_contract (Supervisor)
- DocuSeal Nordic Split chrome (pre-existing gap)
- E2E test implementation (pre-existing gap)

### Council effectiveness
All 4 agents found real issues. Steward and Supervisor both independently found bugs 1 and 2. Agent Coordinator identified 6 missing contracts. Frontend identified 9 design issues. High-value session — bugs 1-2 alone would have caused silent data loss in production.

---

## 2026-04-09 — Production Readiness Plan (3 Sub-Plans)

**Type:** plan
**Verdict:** APPROVE WITH CHANGES — Task A2 (schedule_control) BLOCKED, 6 moderate fixes applied
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer
**Key decision:** `session_hook` is a config table, not a per-session instance table. `session-hook-executor` cron handles materialization. ADR needed for future granular scheduling.
**ADR created:** none (recommended for session hook model)
**Learning created:** L-0029: session_hook is config/template table; session-hook-executor cron materializes session_task from config + department_session join

### Critical findings (3)
1. **Task A2 schema mismatch** — plan inserted into columns that don't exist on `session_hook`. Table is per-department config, not per-session scheduling. Task BLOCKED and replaced with telemetry event registration.
2. **Outbox route payload mismatch** — `emit.ts` sends `{ event_key, metadata }`, plan expected `{ event_type, workspace_id, ... }`. Fixed to match actual payload.
3. **Missing telemetry events** — `"settings updated"`, `"team created"`, `"team deleted"` not in registry. Added registration task.

### Moderate fixes applied (6)
- Added `emit()` on team delete mutation
- Replaced `text-emerald-600` with `text-success` token
- Fixed `actor_id: ""` to use actual profile/user ID
- Added join syntax verification note for cost dashboard
- Fixed component names (SettingsLoadingSkeleton, TabContent)
- Added context propagation note for upsert_session

### Agent effectiveness
- **System Steward:** HIGH — caught schema mismatch, verified cascade model alignment
- **Supervisor:** HIGH — caught outbox payload mismatch + missing registry events + missing emit
- **Agent Coordinator:** HIGH — caught schema mismatch independently + context propagation gap
- **Frontend Designer:** MEDIUM — good design guidance but couldn't read plan file (tooling issue)

---

## 2026-04-09 — Production Readiness Post-Implementation Review

**Type:** feature (post-implementation review)
**Verdict:** APPROVE WITH CHANGES — 2 critical, 3 moderate fixes applied inline
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer
**Key decision:** Merge order wt-4 → wt-5 → wt-3 with registry dedup. Agent-coord caught dead-code outbox route (key format mismatch).
**ADR created:** none
**Learning created:** L-0030: Notification event config uses dot-notation keys but emit.ts sends space-separated — format conversion needed at API boundary

### Critical findings (2)
1. **Registry.ts conflict** — wt-3 and wt-5 both defined TeamCreated/TeamDeleted with incompatible types. Resolved by keeping wt-3's stronger types (EntityRef), removing wt-5's weaker defs and wt-3's unused SettingsUpdated.
2. **Outbox route key format** — emit.ts sends space-separated ("shift completed"), NOTIFICATION_EVENTS uses dot-notation ("shift.published"). Without conversion, the entire outbox route was dead code. Fixed with `.replace(/\s+/g, ".")`.

### Agent effectiveness
- **Supervisor:** HIGH — found registry conflict + duplicate types + all convention violations
- **Steward:** HIGH — confirmed cascade alignment + found same registry conflict + merge order
- **Agent Coordinator:** HIGH — found the CRITICAL key format mismatch that all others missed
- **Frontend Designer:** LOW — couldn't find worktrees (path mismatch smartout.ai-wt-N vs wt-N)

---

## 2026-04-10 — Platform Admin PostHog Bridge Phase 1

**Type:** architecture
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer, narrator
**Key decision:** Keep Supabase landing tables as operational source-of-truth and use PostHog as auxiliary investigative context via detail + row quick-action links.
**ADR created:** none (ADR-0037 addendum updated)
**Learning created:** 0031

---

## 2026-04-10 — Year Wheel (Årshjul) UX Pivot

**Type:** architecture
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer, narrator
**Key decision:** Physical directory rename (`season/` → `year-wheel/`) + `next.config.ts` permanent redirect. Supervisor's rewrite strategy overruled — actual blast radius verified as 25 string replacements across 14 files, not "hundreds of import path changes". Canvas/Blocks/Pins maps 1:1 to cascade resolution tiers.
**ADR created:** none (ADR-0085 already covers governance)
**Learning created:** 0032

### Key rulings

1. **Physical rename + redirect**, not rewrite (overrules Supervisor — blast radius overestimated)
2. **Click-to-edit for v1**, not drag (accepts Frontend Designer — touch incompatible)
3. **"Duplicate Last Year" is Phase 3**, not scope creep (concept is core, implementation is phased)
4. **E2E tests in Phase 1** (not Phase 5 — tests break immediately on route move)
5. **Keep BotssonTools key as `"season"`**, update path only (accepts Agent Coordinator)
6. **Block overlap needs design decision** before Phase 2 starts (swim lanes vs stacking)
7. **Pin minimum 44px hit area** (WCAG 2.5.8) with cluster collapsing for 3+ pins
8. **New fixup migration** for `resolve_cascade_tasks_rpc.sql` hardcoded hrefs (BLOCKING)

### Consensus (all 4 agents agreed)

- Canvas/Blocks/Pins is the correct mental model — direct visualization of cascade resolution
- SQL migration with hardcoded hrefs needs fixup migration (immutable)
- i18n layer already aligned (sidebar says "Årshjul", locale keys exist)
- AI architecture unaffected (Stage Engine routes by mission_id, not URL)

### Conflicts resolved

- **Rename vs Rewrite:** Steward overruled Supervisor. App Router relative imports survive rename. Rewrite would create permanent URL/filesystem discrepancy contradicting the pivot's purpose.
- **"Kopier forrige år" scope:** Supervisor called it scope creep, Designer called it hospitality-native. Resolution: ship CTA as disabled placeholder in Phase 1, full implementation in Phase 3.
- **Events tab removal:** Must keep PlanningEventsTab as list-view fallback until Pin UI has full CRUD parity.

### Agent effectiveness

- **System Steward:** HIGH — verified all 25 references, confirmed cascade alignment, correct rename decision
- **Supervisor:** HIGH — caught i18n violations, nested Sheet risk, mobile parity gap; rewrite recommendation was reasonable but overestimated risk
- **Agent Coordinator:** HIGH — confirmed AI safety, precise 10-change list with line numbers, correct BotssonTools key recommendation
- **Frontend Designer:** HIGH — complete design spec (typography, blocks, pins, canvas, empty state, animations, a11y, responsive), caught 3 high-risk areas

---

## 2026-04-12 — Year Wheel PRD Consolidation + "Fra kaos til kaskade" Hypothesis
**Type:** architecture + feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer
**Key decision:** Consolidate 5 Year Wheel documents into one master PRD (MODULE_YEAR_WHEEL_PRD.md v2.0.0). Mark UX pivot spec and gap closure design spec as superseded. Keep gap closure execution plan (stale paths need update). Keep ADR-0085. PRD written in English (convention alignment). Hypothesis framework lives in PRD Section 3 (pragmatic compromise — design rationale marked explicitly).
**ADR created:** none (language exception documented in PRD frontmatter)
**Learning created:** UI event types != DB enum values — PRD must show both layers and the mapping

### Critical findings

1. **Cascade Resolution Gap (Steward, P0):** Seasons exist in DB but produce zero `department_operating_hours` rows. Canvas/Blocks/Pins is conceptually correct but operationally disconnected from cascade scheduling. Activating a season has no downstream effect on actual staffing calculations.
2. **`season.opening_hours` is deprecated (Steward, confirmed by code):** Migration `20260421210000` explicitly marks it as `LEGACY: deprecated by Cascade A1`. Dead schema.
3. **`is_default` is governance fallback, not Canvas (Steward, confirmed by code):** Restaurant templates use `is_default = true` to find a season for policy-binding. Canvas in cascade resolution is `season_id IS NULL`. Two different concepts.
4. **Gap closure plan has 44 stale paths (Supervisor, P0):** All references point to deleted `/dashboard/season/` directory. Any agent executing this plan will fail.
5. **5 orphaned season tools (Agent Coordinator):** `packages/ai/src/tools/season/` tools exist but are not registered in any capability. Year Wheel has zero voice/chat tools.
6. **Design system violations (Frontend Designer, P0):** Hardcoded color classes, isDark prop drilling, spring constants 10x stiffer than Nordic Split tokens, no prefers-reduced-motion handling.

### Resolved questions (user confirmed)

| Question | Answer | Evidence |
|---|---|---|
| `is_default` semantics | Governance template fallback, NOT Canvas | `governance.sql:108`, `mattilsynet.sql:118`, `alcohol-labor.sql:86` all query `is_default = true` for policy-binding |
| `season.opening_hours` role | Dead schema (deprecated) | `20260421210000_cascade_cleanup_markers.sql:17-21` explicitly marks as LEGACY |
| Multiple active seasons | Max 1 active (current behavior correct) | User confirmed. Overlapping blocks are draft/planning only. |
| PRD language | English (convention alignment) | User confirmed. |

### Agent effectiveness
- **System Steward:** HIGH — found cascade resolution gap, data model incompleteness, is_default ambiguity, opening_hours dual-source risk
- **Supervisor:** HIGH — found stale path danger, convention analysis (spec vs PRD), scope creep guardrails, i18n violation
- **Agent Coordinator:** HIGH — found orphaned tools, missing capability, dual control path, calendar guardian single-season bug
- **Frontend Designer:** HIGH — complete design spec for all 7 planned features, found 6 design system violations with specific fix recommendations

---

## 2026-04-13 — Year Wheel Implementation Sequencing (Handoff Review)
**Type:** plan/architecture
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), system-agent-coordinator, frontend-designer (supervisor returned without review)
**Key decision:** B (design debt) and C (cascade resolution gap) execute in parallel. B is a hard prerequisite for A (Phase 1 features). Agent tool registration gated on C completion ("agent trust gate"). D4-only season activation is valid with warning. Calendar Guardian bug included in C scope.
**ADR created:** ADR-0086 (Year Wheel Implementation Sequencing)
**Learning created:** Agent trust depends on data pipeline completeness, not tool registration. Calendar Guardian must scope by session context, not global workspace query.

### Critical findings

1. **Option C scope understated (Steward):** "Wire season activation" requires per-department season hours config UI + activation warning + D1 row lifecycle — not just a hook.
2. **B is prerequisite for A (Frontend Designer):** FR-SEA-15 (fractal noise overlay) cannot be implemented without CSS variable color system. 258+ hardcoded color instances, 227+ isDark references across 17/29 files.
3. **Agent trust gate (Agent Coordinator):** Registering season tools before cascade gap is fixed lets Emma make promises the system can't keep. Tool registration must wait for data pipeline.
4. **Calendar Guardian bug confirmed (Agent Coordinator):** `calendar-guardian.ts:91-98` picks newest season by `created_at`, not active season. With multiple drafts, evaluates wrong season.
5. **D4-only activation is valid (Steward):** `resolveEffectiveHours()` correctly falls back to default hours. Warn on activation, don't block.

### Implementation sequence
```
Phase 0: D (supersede stale plan) + fix decision log — DONE
Phase 1: B + C in parallel (zero file overlap)
Phase 2: A (after B merges)
Phase 3: Agent wiring (after C merges)
```

### Plans written
- `docs/superpowers/plans/2026-04-13-year-wheel-design-debt-cleanup.md` (Plan B)
- `docs/superpowers/plans/2026-04-13-year-wheel-cascade-resolution.md` (Plan C)

### Agent effectiveness
- **System Steward:** HIGH — verified cascade gap depth, found ADR index gap, correct scoping questions, self-corrected Phase 3 priority after hearing other agents
- **Supervisor:** DID NOT REVIEW (returned without output)
- **Agent Coordinator:** HIGH — verified capability registry gap, found SeasonToolContext incompatibility, Calendar Guardian bug with exact line numbers, "trust-destroying pattern" insight was council's strongest finding
- **Frontend Designer:** HIGH — 258 hardcoded color instances counted, detailed design specs for all Phase 1 features, correct FR-SEA-15 prerequisite analysis

---

## 2026-04-13 — Contract `pending_data` Workflow Wiring
**Type:** feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** System Steward, Supervisor, Frontend Designer (Agent Coordinator skipped — no AI involvement)
**Key decision:** Wire existing admin PII bypass form to contract detail page and data table for `pending_data` status. Add `--warning-foreground` design token. Keep `UserPlus` icon (Steward overruled Designer).
**ADR created:** none
**Learning created:** none (convention reminder: add missing semantic tokens WITH the feature, not as follow-up debt)

### Key findings
1. **Steward:** ADR-0081 compliance confirmed. Secondary action placement correct. `profile_id` FK is correct and RLS-protected.
2. **Supervisor:** Clean wiring, i18n correct, 4 pre-existing debts noted but none introduced.
3. **Frontend Designer:** 6 hardcoded amber values, missing `--warning-foreground` token, `UserPlus` icon semantically wrong. Two "must fix" raised.
4. **Steward synthesis:** Accepted amber token fix, rejected icon change (UserPlus = established SaaS convention for "complete your profile").

### Implementation
- Added `--warning-foreground` to design tokens (light + dark mode)
- Replaced all 6 hardcoded amber values with `bg-warning/10`, `text-warning-foreground`, `border-warning/30`
- Added `pending_data` + `declined` to status filter dropdown
- Added "Fyll ut data" button in detail sheet for `pending_data` contracts

### Agent effectiveness
- **System Steward:** HIGH — ADR verification precise, good synthesis weighing icon decision
- **Supervisor:** HIGH — found 4 pre-existing debts, correctly scoped what's new vs inherited
- **Frontend Designer:** HIGH — only agent to catch dark mode risk and missing token. Icon pushback was reasonable even though overruled.

## 2026-04-13 — Communications/Chat/Channels Architecture — Hospitality Intelligence Integration
**Type:** architecture
**Verdict:** APPROVE WITH CHANGES (Phased Remediation)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer
**Key decision:** Communications is a cascade consumer, not a domain owner. C2 control plane delivers intelligence via Event Engine; Komm is a thin display surface. No cascade queries in Komm hooks. ADR-0087 written.
**Critical bugs found:** 3 (sender_profile_id wrong column, unread_count non-existent column, collector.ts employee_id vs profile_id)
**Dead infrastructure flagged:** channel_ai_policy (zero consumers), channel_event (zero consumers) — wire or drop within 90 days
**Design debt:** 20+ hardcoded Norwegian strings, ~55 hardcoded color classes, zero Framer Motion, zero glassmorphism
**Long-term vision:** Replace Slack paradigm with Shift Intelligence Surface (briefing card + quick reach + persistent PTT) — Phase 3, future council topic
**ADR created:** ADR-0087
**Learning created:** AI tool column verification, dead infrastructure 90-day deadline

## 2026-04-14 — AI Intelligence Layer for Hospitality
**Type:** architecture + feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer
**Key decisions:**
- Kill `ai_session_event` table — use existing `emit()` → `engine_event`
- Kill `ai_operations_config` table — use `policy_type: 'ai_operations'`
- No persistent daemon — use Event Engine triggers + scheduled Edge Functions
- Split into `operations-intelligence` (manager/system) + existing `operations` (employee) capabilities
- HACCP tools inside `operations-intelligence` with domain discriminator
- PREDICT is advisory only — never mutates cascade state
- LEARN persists to K1b (`engine_memory`)
- Phase: COMPILE+TRIAGE → MONITOR+ACT → PREDICT+LEARN
**ADR created:** ADR-0088
**Learning created:** Specs proposing new config/event tables must check existing policy + telemetry infra first
**Mobile requirements:** HACCP temp input <3s, offline queue, punch-in bottom sheet, three-tier haptic alerts, all capabilities must support apps/mobile/

## 2026-04-14 — Emma Voice-Mode: Contract Tools + Entity Drawer Fix
**Type:** feature + bug
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer
**Key decisions:**
- Contract mutation tools restricted to chat-only via `allowedChannels` (ADR-0078 enforcement)
- `search_profiles_by_name` added to profile capability for name-to-UUID resolution
- Entity drawer `open_entity_drawer` tool gets UUID validation
- No direct client-to-server tool bridge — use existing chat pipeline (ADR-0089)
- `emit()` added to mutating client tools (task schedule/complete)
**ADR created:** 0089 — WalkAi Bridge Architecture
**Learning:** `allowedChannels` was declared on `CapabilityDefinition` type and set on 2 capabilities (`contract_intake`, `shift_swap`) but never enforced in `selectTools()`. Defence-in-depth requires verification at every layer, not just declaration.

## [2026-04-14] — Contract System Phase 2-3 Post-Implementation Review
**Type:** feature
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** frontend-designer (steward, supervisor, agent-coordinator hit usage limits)
**Key decision:** 3 parallel features (template binding UI, contract intake agent, notifications) approved with P1 accessibility fixes applied immediately
**ADR created:** none
**Learning:** useMemo with setState calls is a lint-breaking anti-pattern — always useEffect. Semantic table attributes (scope="col"/"row") and aria-label on icon-only buttons are mandatory for matrix UIs. 3 council agents hitting usage limits simultaneously = degraded mode acceptable when orchestrator can cover gaps.

## 2026-04-14 — Phase E C4 Governance Plan Review
**Type:** plan
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator (frontend-designer skipped — 95% backend)
**Key decisions:**
- Postgres RPC gate with SECURITY DEFINER (ADR-0091)
- Contract drafts through unified apply_cascade (ADR-0093, amends ADR-0076)
- Severity → enum (ADR-0094, retrofits WP1)
- WP8 deferred to Phase E.1
- WP7 promoted P1 → P0
**ADRs created:** 0091, 0093, 0094
**Learnings created:** none
**Notes:** WP1 shipped during council review (3 commits, 23 tests green). Severity retrofit needed before WP2. Min_role enforcement in tool-selector is prerequisite for WP4.

## 2026-04-15 — Shift Lifecycle Consolidation
**Type:** architecture
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer, narrator
**Key decisions:**
- Five-Layer Architecture: Reality / Interpretation / Derivation / Decision / Execution
- Event Engine = coordination spor, NOT truth-owner (engine_state lives only during active coordination)
- shift-mcp stays thin (ADR-0036 honored); new `shift_lifecycle` capability separate from read-only `schedule`
- daily_close consumes `shift.settled` events; doesn't subsume shift_lifecycle_v1
- 1 session : N shifts (formal relation)
- time_entry = D6 source input, immutable after interpretation
- Unified authority-gate extracted from agent-router, wired into engine-dispatch (closes ADR-0077/78 active violation)
- UI: 4 phenomenological phases (Planlegges/Pågår/Oppgjør/Avsluttet); orb-driven timeline; cockpit primary, shift-sheet drill-down
- Botsson mediates deviation conversation; `deviation` table owns state
**ADRs to create:** 0095 (Five-Layer), 0096 (session↔shift), 0097 (time_entry immutable), 0098 (engine_state coordination spor), 0099 (unified authority-gate), 0100 (daily_close as aggregate consumer)
**Learnings:**
- Diagnosis "5 parallel state machines" was symptom; actual disease is missing Interpretation layer between time_entry and shift_approval
- engine_state lifespan must match coordination need (per-transition, not per-entity-lifetime) to avoid scale blowup
- Mobile punch DOES emit telemetry (deep dive overstated this gap); real telemetry hole is admin_action paths in approval/reconciliation
**Notes:** Phase 1 (authority-gate + channel-guard in engine-dispatch) ships independently as security fix regardless of consolidation cadence. Phase 3 (Derivation migrations) blocks payroll work.

---

## 2026-04-16 — Web Performance Optimization Plan
**Type:** plan
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor (code-tracer), system-agent-coordinator, frontend-designer
**Prior verdict held?** n/a — first council on web performance
**Key decision:** Sprint 1 ships after REJECT items pulled + NordicSkeleton primitive lands. Sprint 2 RSC-migrates 4 routes (people, handbook, hms, reports) with `/dashboard/schedule` explicitly excluded (ADR-0032 local-state + cross-route state push to header). Sprint 3 blocked on 3 ADRs being `accepted`.
**ADRs created:** 0113 (DashboardContext decomposition completion, facade hook + ThemeContext hoist + BotssonProvider placement), 0114 (Server Actions canonical mutation primitive + capability authority relation, explicit emit contract + shared gate RPC), 0115 (RSC migration pattern — streaming boundary, NordicSkeleton pairing, ambience invariant, first-chunk heading rule). All `proposed`.
**Learnings created:**
- **Audit inflation pattern** (`learning_audit_inflation_pattern.md`) — 4 false claims caught by code-trace: LiveKit NOT eager (statically imported in CallRoom.tsx), 28 TipTap files inflated 6× (real scope ~5 parents), middleware queries on DIFFERENT code paths (never coexist), Upstash migration would be NET SLOWER. Pattern 3rd occurrence across councils.
- **Trust Gate for mutation plans** (`feedback_trust_gate_mutation_plans.md`) — three concurrent write paths (TanStack / Server Action / capability tool) can silently diverge. Agent Coordinator caught `emit()` contract gap + authority divergence + gate bypass risk. Without ADR-0114 migration would silently drop telemetry.
- **Perceived performance = design system concern** (embedded in ADR-0115) — skeleton cold-pulse against Nordic Split warm OKLCH, TipTap dynamic pop-in, Instrument Serif FOUT would make optimized app FEEL slower.
- **"Complete ongoing decomposition" ≠ "split monolith"** (embedded in ADR-0113) — framing changes risk profile. EntityDrawer/VoiceTools/ChatPanel already split; audit understated decomposition in progress.

### Critical findings
1. **Audit was inflated.** 4 false claims caught. Shipping REJECTs would have been 4 wasted PRs — one (Upstash) would have been a user-facing perf regression.
2. **Memory 2026-03-28 about WalkAiProvider is STALE.** `useEntityDrawerOptional` exists, BotssonProvider degrades. Memory rewritten. Stale code-behavior memories are a real risk.
3. **Agent Trust Gate blockers for Sprint 3** — emit contract, authority divergence, gate bypass. Without ADR-0114 capability trust silently degrades.
4. **Schedule route is architecturally special** — ADR-0032 + cross-route state push to header. Naive RSC migration breaks the header. Parked.
5. **Design prerequisites are hard prerequisites** — NordicSkeleton primitive, Framer entrance wrapper, synchronous `data-theme` flip, first-chunk heading rule.

### Implementation sequence
```
Sprint 1 (this week)
  ├─ Bundle analysis baseline
  ├─ Pull REJECTs (LiveKit dynamic claim, middleware parallelize, Upstash, createClient hoist)
  ├─ Delete dead: apps/web/src/components/providers/posthog-provider.tsx
  ├─ NordicSkeleton primitive (design blocker for loading.tsx)
  ├─ TipTap: 5 parent dynamic() + Framer entrance wrapper
  ├─ loading.tsx for HMS + handbook (3/5 already exist)
  ├─ Geist Mono audit before removing
  └─ sonner → optimizePackageImports (the one meaningful addition)

Sprint 2 (next week)
  ├─ ADRs 0113/0114/0115 MOVED to accepted
  ├─ RSC migration: people, handbook, hms, reports
  └─ Schedule EXCLUDED (ADR-0032)

Sprint 3 (after ADRs accepted)
  ├─ Facade useDashboard() + new contexts
  ├─ Server Actions migration per ADR-0114
  └─ Perf budgets warn → fail transition
```

### ADR numbering note
Decision log shows active collision: ADR-0107 has two entries (Botsson channel derivation + Strike-MCP telemetry boundary). Used 0113/0114/0115 to avoid further collision. Verify against open branches before merge — per council_meta 2026-04-15 tripletex learning on ADR-numbering reservation protocol.

### Agent effectiveness
- **Steward (chair):** HIGH — semantic conflict resolution, Agent Trust Gate verdict, ADR reference correction (0007 not 0021 for dashboard shell), revised own 1→3 ADR split after Agent Coordinator's input
- **Supervisor (code-tracer):** HIGH — 4 false audit claims caught surgically with file:line. LiveKit + TipTap count + Upstash perf + middleware paths were each verified against code, not assumed.
- **Agent Coordinator:** HIGH — stale memory flagged, three write paths diagnosed, Trust Gate blockers enumerated, "finishing decomposition" reframe, BotssonProvider placement rule, proposed the 3-ADR split
- **Frontend Designer:** HIGH — NordicSkeleton design blocker flagged (would have shipped cold shadcn), TipTap pop-in risk, Instrument Serif FOUT streaming rule, motion eager-load list, scope-exclusion of Onboarding + Botsson

### Sprint Delivery Status (rolling)

**Sprint 1 — DONE 2026-04-16**
- 1A (#211 merged): cleanup + 3 ADRs in `proposed`
- 1B (#212 merged): Skeleton primitive (replaces shadcn), SkeletonEntrance, 7 variants
- 1C (#214 merged): 8 dynamic-imports (4 TipTap + 4 Recharts), Entrance + withEntrance HOC, 2 new + 1 upgraded loading.tsx

**Sprint 2 — DONE 2026-04-16**
- 4 routes RSC-migrated: `/dashboard/people` (full server-fetch + map → initialData), `/dashboard/handbook` (HydrationBoundary pattern with TanStack v5 cache pre-population), `/dashboard/hms` (minimal — children own data), `/dashboard/reports` (minimal — already lazy from 1C)
- New shared `_data/resolve-page-context.ts` resolver
- Schedule explicitly excluded per ADR-0032 (deferred to separate ADR)
- ADR-0113 + ADR-0115 moved `proposed` → `accepted` (pattern proven by Sprint 2)
- ADR-0114 stays `proposed` — `gate-client.ts` (ADR-0091 WP3) does not yet exist

**Sprint 3 — DEFERRED**
- Server Actions migration: BLOCKED on `gate-client.ts`. Sprint cannot start until ADR-0091 WP3 lands.
- DashboardContext decomposition: feasible but 155 consumers + careful theme cascade work. Recommended as separate dedicated effort with its own pre-flight audit (per ADR-0113 step 1: introduce facade hook + ESLint rule before any consumer migration).
- Perf budgets warn → fail: deferred. Activate after Sprint 2 baseline metrics captured.

### Sprint 2 post-implementation review (2-agent degraded mode)
Supervisor code-tracer + autonomous Designer scope review. Verdict: APPROVE FOR MERGE.
- Type preservation across server/client boundary ✓
- No Set/Map serialization bugs (Map/Set used only server-side during mapping) ✓
- HydrationBoundary cache-key match verified ✓
- No additional DB hits (cache() decorators dedupe layout's prior calls) ✓
- Mobile parity preserved (data layer in `packages/utils/`) ✓
- Skeleton CLS-safe (people min-h-[104px] matches real card height)
- One drift documented: resolver-vs-layout fallback semantics on wsParam failure (added clarifying comment per Supervisor recommendation)

---

## 2026-04-17 — Billing Engine Fase 1 (2 rounds)

**Type:** pre-spec scoping (R1) + spec review (R2)
**Agents consulted:** steward, supervisor, agent-coordinator, frontend-designer (all 4 rounds)
**Prior verdict held?** R1 → R2: YES. R1 verdict (APPROVE WITH CHANGES, 3 blockers) guided spec writing. R2 verified blockers resolved and caught 8 new issues from writing phase.

### Round 1 — Pre-spec scoping
**Verdict:** APPROVE WITH CHANGES — NOT READY FOR SPEC. 3 blockers must resolve first.
**Key decisions:**
- B1: archive `docs/invoice-engine/breakdown.md` (Fase-2 language)
- B2: extend `pricing_terms` with 5 new fields (free_users, overage_price_per_user, delivery_channel, invoice_format, agreement_period) — preserves ADR-0027
- B3: active user = strictest interpretation (initially "actually worked")
- AI-tools trimmed to workspace-admin read-only (platform-admin deferred to Fase 2 pending PlatformAdminToolContext ADR)
- Trust Gate FAIL on verify-basis (no materialized view existed)
- emit() contract is aspirational (4 of 13 capabilities); billing must enforce

### Round 2 — Written spec review
**Verdict:** APPROVE WITH CHANGES (all 4 agents) — resolved inline by orchestrator.
**Phase 2.5 fact-check caught 4 FALSE claims:**
- `schedule_shift.shift_start` (no such column — actual: `shift_date` + `start_time`)
- `schedule_shift.profile_id` (actual: `employee_id`, FK to profile)
- shift_status enum `{worked, settled}` (don't exist — actual: `completed`)
- `emit()` positional call (actual: single SmartoutEvent object)

**8 hard blockers resolved by user + orchestrator:**
- H1 `v_invoice_basis` split into view + table-valued function (Trust Gate now passes)
- H2 `is_admin_in_company()` RLS helper added to prerequisites
- H3 `workspace_activation_completed` event didn't exist — onboarding deferred to Server Action
- H4 `basis_drift_event` table defined (was undefined reference)
- H5 §21 DO NOT TOUCH list added
- H6 `usage_snapshot.workspace_id` made NOT NULL (was broken NULL-in-UNIQUE)
- H7 (user decision C): no `billing-api` Edge Function — workspace-admin reads via Server Components + Server Actions
- H8 (user decision A): active user = `shift_status = 'completed'` alone + drift detection (not cross-referenced to daily_reconciliation)

**Semantic tightening (Steward):**
- Nested credit note CHECK constraint
- `status` × `dunning_status` legal combinations CHECK
- Invoice number trigger SQL explicit (draft→issued transition)
- `dunning_note` table dropped (user decision A) — notes via `activity_trail` to preserve cascade invariant

**Frontend (Designer):**
- Concrete OKLCH values for `--success/--warning/--destructive/--info` (light+dark+foreground)
- Exact Framer Motion transition specs per surface (9 rows)
- Reason-code enums explicit (void, uncollectible, payment channel)
- Added: Historikk tab (activity_trail timeline), BulkActionBar, BasisDriftPanel
- Per-surface empty/loading/error states (7 surfaces × 3 states)

**AI-tools (Agent-coord):**
- `resolveCompanyId(ctx)` helper (no AgentToolContext widening)
- Capability registration checklist (4 touchpoints)
- CI assertion mechanism pinned (Vitest + mocked emit)

**ADRs planned:** 0118 (invoice as C3), 0119 (usage reproducibility + completed-alone + basis_drift), 0120 (immutability + credit notes + state combos), 0121 (pricing_terms extension, amends 0027)

**Key decision:** Spec approved for `writing-plans` after all inline fixes. Build-agent's path is now mechanical.
**ADR created:** 4 planned (0118-0121); pending
**Learning created:** L-pending — see §9 below


---

## 2026-04-17 — Post-Audit Remediation Plan

**Type:** post-implementation (repo-wide audit synthesis)
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor (code-tracer), system-agent-coordinator, frontend-designer
**Prior verdict held?** n/a — first council on repo-wide audit remediation; references 2026-04-16 Web Perf verdict (Sprint 2 merged) and 2026-04-17 Billing R2 (ADRs 0118-0121 reserved, not yet written)

### Context
User requested "review this repo and tell what could be better" with /effort max. 7 parallel audit agents produced findings across code quality, database, testing, dependencies, architecture, performance, docs. User then requested a council for a complete actionable remediation report.

### Phase 2.5 fact-check caught 5 FALSE audit claims (4th audit-inflation occurrence)
1. Barrel importers "45" → actual **16** (dashboard `_hooks/index.ts`)
2. "4 orphan FK UUIDs" → actual **2 genuine + 2 intentional polymorphic** (both polymorphic cases dispatch via enum column; `chat_conversation.source_id` already SQL-commented as intentional)
3. "Governance mutations missing emit()" → actual **emit present; routing partial** (`"button clicked"` → PostHog-only; 7 TODO comments self-documented the gap)
4. "121 waitForTimeout in E2E" → actual **75**
5. CLAUDE.md "31 Edge Functions" → actual **54**

### Semantic conflict resolved
**Steward Phase 3:** build new `identity-api` gateway tier for pre-workspace flows (`accept-invitation`, `create-invitation`).
**Supervisor Phase 3 (code-trace):** workspace-api `resolveAuth` hard-requires `auth.workspaceId` (line 102); invitee has none; forcing through gateway = L effort, high regression risk, currently only 2 consumers.
**Resolution (Supervisor wins):** ADR-0029 amendment with exceptions list + tripwire clause. YAGNI until 3rd pre-workspace endpoint. Steward reversed Phase 3 position on cost-to-payoff grounds. Captured as Learning 0040 (identity-boundary ontology) + ADR-0123.

### Agent Trust Gate: PASS on all 7 PRs
- PR1 (FK fixes + polymorphic comments), PR2 (barrel removal), PR3 (raw `<img>` → `next/image`), PR4 (i18n LeaderPulseCard + 10 siblings), PR5 (BotssonArena split), PR6 (governance telemetry quad-destination), PR7 (5 named hooks to `packages/dashboard-data/`), PR8 (ADR-0029 amendment docs)
- No new capabilities, no new emit() events introduced. PR6 routes existing events per ADR-0122 — contract unchanged from capability perspective.
- BotssonArena split must stop at `VIEW_COMPONENTS` boundary (line 2413); do NOT touch BotssonProvider / persona-engine / BotssonTools / tool-registry.

### Critical findings
1. **Audit inflation, 4th occurrence.** Phase 2.5 fact-check + Supervisor code-trace again earned their keep. Governance "missing emit()" was the highest-stakes false-positive — shipping PR6 without the registry trace would have fixed the wrong thing.
2. **Governance telemetry IS partially broken** — not deferred debt. `"button clicked"` routes to PostHog only; `activity_trail` + `engine_event` receive nothing for 7 policy/protocol/procedure mutations. Elevated from "Phase 2 debt" to "Phase 1 telemetry fix." ADR-0122 blocker for PR6.
3. **Identity-boundary is a real ontology class** — not ADR-0029 drift. Two pre-workspace endpoints today; ADR-0123 defines exceptions + tripwire at 3rd endpoint.
4. **ADR-numbering collision risk persists.** Billing council 2026-04-17 reserved 0118-0121 (not yet written). Web Perf 0113-0115 accepted/proposed. This council used 0122-0124 to avoid collisions. ADR reservation protocol from 2026-04-15 meta still not implemented.
5. **Mobile-parity extraction (PR7) must name specific hooks** — `use-live-shifts`, `use-active-season`, `use-action-items`, `use-my-dashboard`, `use-cascade-tasks` (Agent Coordinator's list; overlap with future Botsson tool reads). Not "5 of the 35".
6. **DashboardShell.tsx (2320 LOC) is NOT a split candidate.** ADR-0021 explicitly blesses it. Audit's C9 entry must exclude it.

### Implementation sequence
```
Week 1 — S-PRs parallel:
  ├─ PR1: FK fixes (active_contract_id, seeded_from_framework_binding_id) + COMMENT ON (assigned_ref_id, source_id)
  ├─ PR2: rewrite 16 imports off `_hooks/index.ts` + delete barrel
  ├─ PR3: raw <img> → next/image (7 sites); GiveSlide.tsx injected-Image prop (RN-safe)
  └─ PR8: ADR-0029 amendment (docs only)

Week 2:
  ├─ ADR-0122 merged → PR6 telemetry routing (7 governance events quad-destination + CI assertion)
  └─ PR4 i18n externalization (next-intl domain namespaces; Lucide Loader2 for submit states)

Week 3:
  ├─ PR5 BotssonArena split at VIEW_COMPONENTS boundary (Orb stays monolithic per motion.md)
  └─ PR7 named hooks extract to packages/dashboard-data/ (data/UI split; toasts in web wrapper)

Week 4 — buffer / E2E stabilization / deferred debt triage
```

### ADRs created
- **0122** Governance Telemetry Quad-Destination Routing (proposed) — blocks PR6
- **0123** ADR-0029 Amendment: Pre-Workspace Exceptions + Identity-Boundary Tripwire (proposed) — ships with PR8
- **0124** Polymorphic FK Documentation Convention (proposed) — applies retroactively in PR1

### Learnings created
- **L-0040** Identity-Boundary Ontology: Pre-Workspace Flows Are a Distinct Class
- **L-0041** Registry Declaration Gap: emit() Called ≠ Mutation Audit-Covered (sister to L-0038 provider-side drop)
- **Memory update:** `learning_audit_inflation_pattern.md` → 4th occurrence + 3 new sub-patterns (grep-without-context, polymorphic-FK conflation, audit-says-violation-might-mean-doc-only-fix)

### Agent effectiveness
- **Steward (chair):** HIGH — ADR impact classification, cascade integrity triage, semantic-conflict forcing, reversed own Phase 3 position on identity-api gateway based on Supervisor's code-trace (principled concession, not capitulation)
- **Supervisor (code-tracer):** HIGHEST — 5 audit inflations caught with file:line; FK trace distinguished genuine orphan from intentional polymorphic; registry-trace proved governance routing is partial not missing; ADR-0029 gateway-routing infeasibility proven with `resolveAuth` line 102 citation
- **Agent Coordinator:** HIGH — Trust Gate PASS verification for all 7 PRs; BotssonArena split boundary identified at VIEW_COMPONENTS line 2413; named the 5 PR7 hooks to prevent "5 of 35" scope drift; flagged audit miss of in-flight `TODO(plan-phase-2)` self-documentation
- **Frontend Designer:** HIGH — pre-loaded context worked; i18n via next-intl domain namespaces (not per-component); Orb-must-stay-monolithic signature element rule; ConfirmBusiness motion wrapper constraint; UX-visible priority ranking (CLS > i18n > input lag)

### Tracked debt (not this council)
- 140 files with hardcoded zinc/gray
- Remaining 29 skipped E2Es + 75 waitForTimeout calls
- 16 packages with zero tests (including critical `packages/supabase`)
- daily-briefing.tsx (1618 LOC) + shift-modal.tsx (1420 LOC) decomposition
- CLAUDE.md module-count drift (23 claimed, 2 `MODULE_*.md` files; INDEX references 23 — reconcile in dedicated doc-regen task)


---

## 2026-04-17 — Task 1 Migration Dependency Review

**Type:** plan (follow-up council after first post-audit remediation council)
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor (code-tracer)
**Prior verdict held?** Yes — first 2026-04-17 council's plan verdict held. This session reviews a previously-uncaught bug in Task 1's migration timestamps. First council's Phase 2.5 fact-check did not cover migration dependency ordering.

### Key decision

Task 1 migration (`20260417120000_orphan_fk_fixes_and_polymorphic_comments.sql`) fails to apply due to four bugs. Retimestamp to `20260511100000` and fix schema qualifier `payroll.*` → `public.*` for `employee_payroll_profile`. Process hardening ships as a SEPARATE PR outside Week 1 (skill updates + learning L-0042).

### Failure modes caught

1. Referenced table `workspace_framework_binding` created at `20260421200100:135` — after proposed timestamp
2. Referenced table `employee_payroll_profile` created at `20260421100200:317` — after proposed timestamp
3. Referenced column `seeded_from_framework_binding_id` added at `20260422400000:151` — after proposed timestamp (Supervisor code-trace caught this; Steward Phase 3 missed)
4. Schema qualifier `payroll.*` wrong; actual schema is `public` (Supervisor caught; Steward missed)

### Semantic conflict resolution

Supervisor's Phase 3 code-trace strictly dominated Steward's Phase 3 on technical depth: caught 2 additional bugs + explicit bundling-scope discipline. Steward's surviving contribution: Phase 2.5 council process addition + ADR-escalation threshold (3rd occurrence = ADR). Chair adopted Supervisor's tactical fix verbatim and merged Steward's process additions.

### Agent Trust Gate

Not applicable. Pure DB migration — no Server Actions, mutations, capability tools, or emit routing changes.

### ADRs created

None. Decision: skill rules + learning doc are right weight. Escalate to ADR on 3rd occurrence.

### Learnings created

- **L-0042** Plan documents are not ground truth for migration dependencies — migration timestamps are causal order in a dependency DAG. Four failure modes caught on Task 1 alone. PR #216 retimestamp (commit `603ea951`) is empirical twin.

### Skill updates (separate PR)

- `.claude/skills/smartout-database-guide/SKILL.md` — new "Migration Timestamp Ordering (CRITICAL — L-0042)" section
- `~/.claude/skills/run-council/SKILL.md` Phase 2.5 — new migration-dependency fact-check step

### Agent effectiveness

- **Steward (chair):** MEDIUM — Caught tactical timestamp failures, missed column dependency + schema qualifier. Phase 5 synthesis had cosmetic "Billing Engine" mislabeling (caught in user review) but substantive content correct.
- **Supervisor (code-tracer):** HIGH — Code-traced plan DDL end-to-end; caught 2 bugs Steward missed. Explicit bundling-scope discipline. File:line citations throughout.

### Process discipline fail-then-fix

First council's Phase 2.5 fact-check verified WHAT (columns exist, tables exist, files exist) but not WHEN (at proposed timestamp). This gap is now closed in run-council skill Phase 2.5 with a new migration-dependency fact-check step.
## 2026-04-16 — Tier 1 Wrightegaarden migration via strike-mcp (post-implementation review)
**Type:** post-implementation
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor (code-tracer), system-agent-coordinator (auth-bridge architect); frontend-designer skipped (no UI surface)
**Prior verdict held?** n/a — first council on strike-mcp tooling
**Key decision:** 11 mappings + 2 drops + 2 manual SQL files + 3 ADRs (strike-mcp 0004/0005/0006) are architecturally sound and code-correct. APPROVED to land. BLOCKED from production apply pending 4 must-fix operational items (invitations source constant, bridge-tool buildout, apply-script SAVEPOINT pattern, cutover communication drafts).
**Critical findings:**
- C1 invitations.json missing `constant_columns.source = 'bubble_migration'` — fixed in strike-mcp commit a7b3f16 + re-attest eaf5f59
- Bridge tool referenced in ADR-0006 is vapor (no scope, owner, deadline) — apply blocked until built (1-2 days estimated)
- "Fail loud" auth-bridge collision semantics underspecified — needs row-level SAVEPOINT, failure CSV, halt threshold (added as ADR-0006 amendment d04e97c)
- Cutover artifacts missing — drafted CUTOVER-USER-NOTICE.md + CUTOVER-SWAP-NOTICE.md (NO + EN) + gen_pending_swaps_csv.ts stub (commit d04e97c)
**Cross-reviewer agreement:** Manual SQL files (employment_contracts_synthesis.sql, records_aggregation.sql) are clean — Steward suspected source-tagging gaps; Supervisor verified explicit source='bubble_migration' literals on every INSERT (resolved in supervisor's favor).
**Semantic conflict resolution:** Steward Q1+Q2 worried manual SQLs missed source tagging; Supervisor's code-trace verified the literals exist. Same concern, different evidence sources — Supervisor's direct line:N citation wins.
**Boundary insight:** Migration "attestation complete" ≠ "apply ready". Attestation lives on the LEFT (strike-mcp emit-time correctness); apply-readiness lives on the RIGHT (operational wrappers). Captured as Learning 0033.
**ADR amendments:** strike-mcp ADR-0006 amended with required apply-script behaviors + login-flow gate + cutover artifacts requirement + bridge timeline + auth-method homogeneity check. No new smartout.ai ADR.
**Learning created:** 0033 — Migration attestation completeness ≠ apply-readiness

## 2026-04-17 — Tier 2 Bubble→v3 governance mapping (VERDICT SUPERSEDED MID-SESSION)
**Type:** architecture
**Verdict:** APPROVE WITH CHANGES (Steward synthesis) — **SUPERSEDED by user reframe same day**
**Agents consulted:** system-steward (chair), supervisor (quality gate), system-agent-coordinator (code-tracer), frontend-designer, narrator
**Prior verdict held?** n/a — first Tier 2 council; Tier 1 verdict from 2026-04-16 inherited (Learning 0033 applies)
**Key decision from council (SUPERSEDED):** Split Tier 2 into 2A/2B/2C with 7 ADRs, 3 product decisions, 3 discovery passes, Tier 1 runbook remap as blocker
**Superseding message:** Pontus — "Vi behøver ikke hente information table by table — vi henter kunnskapen fra workspacen og implementerer den i version 3." Council collapsed 7 ADRs to 1 (Tier 1 runbook patch retained; others dissolved).
**What survives from council:** (1) Tier 1 `handbooks → runbook` attestation hole — Supervisor's finding, real. (2) Strike-mcp zero-emit() observation — documented debt, non-blocking for DRY-RUN. (3) `knowledge_test.workspace_id` writer bug — Agent Coordinator code-trace, standalone v3 fix. (4) `auto_assign_protocols` trigger order constraint — folded into apply step. (5) `confirmation.name` NOT NULL — folded into row builder.
**What this produced (post-reframe):**
- Spec: `services/strike-mcp/docs/superpowers/specs/2026-04-17-tier2-content-extraction.md`
- Code: `scripts/tier2_extract.ts` (strike-mcp commits e52358b + 026ea7f)
- DRY-RUN SQL: `supabase/migration-staging-tier2/` — 1 policy + 3 protocols + 52 procedures + 2 confirmations for Wrightegaarden
**Semantic conflict seen:** Council had 6 pairs of semantic disagreement (Q1/Q3/Q8/Q9/Q10/Q11). Steward synthesis resolved most by leaning on code-traced v3 schema truth. User reframe rendered 5 of the 6 moot.
**ADR created:** none (all 7 proposed ADRs dissolved by reframe)
**Learning created:** 0034 — Migration is knowledge extraction, not table-by-table transfer
**Meta-observation:** The council produced a valid verdict, but the VERDICT OPTIMIZED FOR THE WRONG PROBLEM. Future migration councils should include a "is the framing correct?" gate before Phase 3 dispatch — Frontend Designer hinted at this ("Bubble data model encoded workarounds for Bubble UX limitations") but the signal wasn't strong enough to halt the council. Pontus's single-sentence reframe at Phase 6 was the actual synthesis.

## 2026-04-17 — Tier 2 v1.5 post-implementation review (caught latent UNIQUE violation)
**Type:** post-implementation
**Verdict:** APPROVE WITH CHANGES (8 must-fixes applied same session)
**Agents consulted:** system-steward (chair), supervisor (quality gate), system-agent-coordinator (code-tracer), frontend-designer (UI + mobile), narrator (external channels)
**Prior verdict held?** n/a — Tier 2 v1.5 is the implementation that replaced the earlier (same-day, superseded) Tier 2 mapping council verdict.
**Code under review:** strike-mcp commits `e52358b` + `026ea7f`; script `scripts/tier2_extract.ts`; DRY-RUN SQL in `supabase/migration-staging-tier2/`.
**Key finding (caught by code-trace, missed by per-file review):** v3 schema `unique_policy_protocol UNIQUE(policy_id)` at `00003_governance_tables.sql:56` would cause Postgres 23505 on row 2 of 02_protocol.sql. 3 protocols shared 1 policy_id. Entire transaction would abort. Files 03 + 04 would cascade-fail on FK.
**Other findings worth capturing:**
- Frontend: `[IMPORT]` prefix on protocol names + NULL-description audit for admin curation layer.
- Supervisor: `auto_assign_protocols` trigger fires only on profile INSERT, not protocol INSERT — existing Tier 1 profiles would silently miss new protocols without backfill.
- Steward: Handbook draft-filter asymmetry ("Hvorfor" Bubble `_status='Draft'` was emitted regardless) — now filtered at extraction.
- Agent-Coord: `ON CONFLICT DO NOTHING` missing — idempotency manifest claim was FALSE.
- Agent-Coord: MANIFEST did not state `service_role ONLY` apply requirement — JWT apply would error 42501.
- Supervisor: strike-mcp has ZERO telemetry infrastructure — DRY-RUN acceptable since apply bypasses smartout.ai code; "every-mutation-emits" rule doesn't apply to psql-driven apply.
- Agent-Coord: 46/52 procedures have NULL description (now surfaced as warning).
**Semantic conflict resolved:** Agent-Coord said FAIL (literal "would this SQL apply?"); 3 others said APPROVE WITH CHANGES (design soundness). Steward ruled PARTIAL OVERLAP — same reality, different frames. Correct label: APPROVE WITH CHANGES.
**Trust Gate:** DOES NOT PASS as-is (missing backfill = authority divergence; broken UNIQUE = apply fails; placeholder names leak to capability output). PASSES after the 8 fixes applied in strike-mcp commit `1627556`.
**Must-fixes applied (commit 1627556):**
1. 1 policy per protocol (1:1) — UNIQUE(policy_id) honored ✓
2. `[IMPORT]` prefix on protocol/policy names ✓
3. `ON CONFLICT (pk) DO NOTHING` on all INSERTs ✓
4. Handbook draft filter at extraction ✓
5. `apply_auth: "service_role ONLY"` in MANIFEST ✓
6. NULL-description audit in MANIFEST ✓
7. `mappings/handbooks.json` marked superseded ✓
8. Backfill RPC requirement documented in pre_apply_checklist (RPC itself deferred — wt-2 migration work)
**Deferred to follow-up:**
- Backfill migration (wt-2)
- Source-tagging ADR (wt-2): v3 `source text` column vs sidecar JSONL
- Activity tree → procedure_step nesting (v2)
- Parameterize workspace constants (v1.6)
- Fix pre-existing strike-mcp typecheck debt in `patch_fix_live_api_fields.ts`
**ADRs created:** none (architectural decisions deferred — schema column decision still pending)
**ADRs proposed for later:** Content provenance column on governance tables (Cascade Invariant 8: every output must have provenance).
**Learnings created:** 0035, 0036, 0037
**Meta-observation for council process:** This second council on the same day (post-impl mode on the implementation that replaced the earlier-superseded verdict) produced its highest-value finding (the UNIQUE 23505) via code-tracer layer 2. Per-file review in the morning approved the same pattern. The 4-layer model (Learning 0051) is the generalization: migration councils must assign reviewers per layer, not just per domain.

## 2026-04-17 — Source-tagging for v3 governance tables
**Type:** architecture
**Verdict:** APPROVE HYBRID — `provenance JSONB` on 5 tables (not `source text` on 10)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator (frontend skipped — pure schema/backend)
**Prior verdict held?** n/a — this is the follow-up to the 2026-04-17 Tier 2 v1.5 post-impl council which flagged source-tagging as ADR-pending.
**Key decision:** Add `provenance JSONB NOT NULL DEFAULT '{}'` to policy/protocol/procedure/procedure_step/confirmation. Reject `source text` (collides with `channel_event.source` domain classifier). Reject sidecar JSONL (violates Cascade Invariant 8 co-location). YAGNI-scope to 5 tables strike-mcp writes.
**Semantic conflict resolved:** Steward Phase 3 claimed `channel_event.source` was provenance precedent. Supervisor proved it's a DOMAIN classifier (event-origin type: user/system/ai/webhook — sits beside event_type/correlation_id). Real provenance convention is `provenance JSONB` with 5 cascade-table precedents. Steward reversed own stance in Phase 5 synthesis.
**Trust Gate:** PASS — both admin-UI insert path and strike-mcp insert path honor same DEFAULT + RLS. No authority divergence.
**ADR created:** ADR-0140 (governance-provenance-jsonb; was numbered 0126, renumbered 2026-04-18 for billing ADR-0126)
**Learning created:** 0038 (`source` is an overloaded term — verify semantics before citing convention)
**Implementation landed:** 
- `supabase/migrations/20260506100000_governance_provenance.sql` applied to local Supabase — 5 ALTER TABLE + 5 CHECK constraints + 5 partial indexes + 5 column comments
- Strike-mcp `scripts/tier2_extract.ts` updated — `makeProvenance()` helper + provenance key on every row (policies, protocols, procedures, procedure_steps, confirmations)
- Verified end-to-end: 2 policies + 2 protocols + 31 procedures + 21 procedure_steps all carry origin=bubble-import + bubble_id + tenant + batch
**Side finding:** ADR-0108 numbering collision flagged by Agent-Coord — two branches both use 0108 for different ADRs. Whichever lands second must renumber. Not this council's problem but logged.
**Side finding:** `useCreateProcedure` + `useCreateConfirmation` in `use-governance-mutations.ts` pass `workspace_id` to tables that don't have the column (same class as knowledge_test bug fixed earlier today). Separate chore, not bundled.

## 2026-04-18 — Gate-Client Migration Wave 2 (Schedule + Season + Capability)
**Type:** plan
**Verdict:** APPROVE WITH CHANGES (rescoped)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer, general-purpose (fact-check)
**Prior verdict held?** Partially — gatedwrite-pilot (2026-04-17) APPROVE WITH CHANGES held for Server Action pattern; extended here to client hooks + capability layer where different rules apply (ADR-0114 R5 realtime exemption + capability dual-gate).
**Key decision:** Rescope Wave 2 from 18 web sites + capability to Wave 2A = Season wizard only (2 sites). Wave 2B (capability) blocked on 3 ADRs (gate stacking + tool result contract + agent-router security). Wave 2C (schedule TanStack) blocked on 3 prereqs (--color-proposed token + pendingProposalId type field + realtime reconciliation contract).
**ADR created:** 3 drafts — gate-action-stacking-semantics, agent-tool-result-gate-outcome, color-proposed-pending-state-ux (see docs/decisions/)
**Learning created:** 5 — see task 2 below
**Agent Trust Gate:** REJECTED for original 18-site scope. PASSES for Wave 2A only.

## 2026-04-19 — WebDayControl replaces OversiktView (session-centric D6 admin surface)
**Type:** feature (spec-stage, pre-implementation)
**Verdict:** APPROVE WITH CHANGES (unanimous across 4 reviewers)
**Agents consulted:** system-steward (chair), supervisor (code-tracer), system-agent-coordinator (Trust Gate), frontend-designer (Nordic Split), general-purpose (Phase 2.5 fact-check)
**Prior verdict held?** Yes — Web Performance Council 2026-04-16 (ADR-0114 Server Actions), Mobile Strategy Council 2026-04-17 (ADR-0133 web composes / mobile executes), Gate-Client Wave 2 Council 2026-04-18 (Trust Gate) all held and constrained the verdict.
**Key decision:** Replace `apps/web/src/components/dashboard/OversiktView.tsx` (1070 LOC executive-summary mock) with `WebDayControl` (7-tab session-centric panel, 10 canonical widgets). Staged widget placement: `apps/web/src/components/day/` with portability discipline → extract to `packages/ui/day-control/` when mobile lands. `locked` phase derived via `derivePhase(session, recon)` helper (no migration). 3 new mutations via Server Actions (ADR-0114 scope clarified in ADR-0157 amendment). Broadcast type encoded in `channel_message.metadata.broadcast_type` JSONB. 4-PR rollout (~5 days).
**Semantic conflicts resolved:**
- **Steward vs Supervisor on ADR-0114 scope.** Different. Steward: mandatory Server Actions for all mutations. Supervisor: wholesale switch out of scope. Resolution → ADR-0157 grandfathering amendment: new mutations only, existing TanStack grandfathered.
- **Steward vs Designer on widget placement.** Different. Steward: `packages/ui/` mandatory now. Designer: stage (portability discipline in apps/web Phase 1 → extract Phase 2). Resolution → Designer's staging accepted with strict portability rules enforced.
- **Steward broadcast persistence concern vs Agent Coord factual note.** Same once clarified. Komm `channel_message` IS persistent, not ephemeral. Keep komm news pattern.
**Agent Trust Gate:** APPROVE WITH CHANGES. Conditions (must land in same PR as mutations): Server Actions for signoff/broadcast/task-toggle; seed `engine_authority_config` for `session.signoff` + `broadcast.send`; fix registry emit gap on signoff step-1; task toggle via `emit()` not direct engine_event insert; PII guardrail on broadcast (ADR-0077).
**ADR created:** ADR-0156 (Day-Control Panel canonical admin surface), ADR-0157 (Server Actions scope amendment to ADR-0114)
**Learning created:** L-0064 (Phase enum UI-vs-DB drift — use named derivation helpers)
**Follow-up items (not blocking this PR):**
- Audit: `operations/tools.ts:254` agent tool `complete_task` bypasses `emit()` registry (direct engine_event insert). Separate PR.
- Trigger: `department_session.tasks_total/tasks_completed` not auto-maintained. This PR derives client-side; long-term add trigger or deprecate columns.
- Extraction: `apps/web/src/components/day/` → `packages/ui/day-control/` when mobile consumer lands.
**Implementation spec:** `docs/superpowers/specs/2026-04-19-web-day-control-implementation-spec.md`

## 2026-04-19 — WebDayControl debt ticket review (plan-stage)
**Type:** plan
**Verdict:** APPROVE WITH CHANGES (revised 5 → 8 tickets)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator (frontend-designer skipped — tickets backend-heavy, design work locked in ADR-0156)
**Prior verdict held?** Partially — post-impl R1 (same day) stated `engine_authority_config.min_role` doesn't exist; this council proved it DOES (ALTER migration 20260410000001 added it 3 weeks prior). L-0065 captures the fact-check gap.
**Key decision:** T3 rewritten from "add schema" to "wire callers through existing gate_action()". T2 dropped (zero orphans). Added T6-T8 (HANDOFF correction, RosterTab hardcode, wrapper deletion).
**Semantic conflicts resolved:**
- Steward T3 "REJECT AS DRAFTED" vs Supervisor T3 "PASS schema-done" vs Agent Coord T3 "add tool_name column" — **same conclusion** (schema exists, caller migration) with partial overlap on fine-grain extension (deferred).
- T1 treatment — Steward (reshape) + Supervisor (3 sub-PRs) + Agent Coord (10-row taxonomy + duplicate-emit audit) → compatible, combined.
**Agent Trust Gate:** T1 CONDITIONAL (duplicate-emit audit required pre-merge), T3 PASS (schema-ready), T5 PASS (ADR-0157 compliant), T4b NEW ADR required for packages/ui dual-platform strategy.
**ADR created:** none — all 8 tickets are tactical follow-ups, not new architectural decisions. (T4b requires future ADR but that's a ticket deliverable.)
**Learning created:** 0065 (Fact-Check Must Grep Columns Across ALL Migrations, Not Just CREATE TABLE)
**Side finding:** RosterTab.tsx:18 still has `deptKey: "kitchen"` hardcode — post-impl R1 only fixed WebDayControl.tsx, missed this file. Captured as T7.
**Side finding:** HANDOFF-overview-v2.md:71 stale claim about min_role — corrected inline (this commit) + T6 to track any other documentation drift.

## 2026-04-20 — Year Wheel Redesign (shell replacement + season route split)
**Type:** spec (pre-implementation)
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator (code-tracer), frontend-designer, general-purpose (Phase 2.5 fact-check)
**Prior verdict held?** Partially. 2026-04-10 (UX Pivot) + 2026-04-12 (PRD Consolidation) + 2026-04-13 (Implementation Sequencing) held on directory/governance. This spec **defers** P1 activation-gate, missing-checklist, Activate/Archive/Duplicate buttons, Seeded-from-Riksavtalen chip, Goals tab, and Procedures tab from the 2026-04-19 holistic-design spec → logged in new spec §11.5 per L-0074.
**Key decision:** Replace `/dashboard/year-wheel` page shell with 3-column linear-timeline design (sidebar + canvas + companion rail). Split season editing to new `/dashboard/season/[seasonId]` route with primary submenu Budsjett / Dag / Time / Åpningstider / Oversikt. Retire `SeasonDrawer` + `MachineRoomSheet` + `SeasonCreateSheet`. Draw-to-create on canvas → `SeasonQuickCreateSheet` (from right) → `createSeason` → redirect to season page on `tab=budget`.
**Phase 2.5 fact-check caught 3 false briefing claims:** (a) telemetry dot-convention — actual is space-separated, (b) `createSeason` hook signature — missing `color` + `planning_cycle_id`, (c) `SeasonOverviewTab` is KPI+charts, not metadata header (drawer owns the "status+name+dates" block). Briefing corrected before Phase 3.
**Semantic conflicts resolved (Phase 5):** (1) Telemetry prefix `season ` vs `year_wheel ` → unified to `season ` (ADR-0164). (2) AiSuggestionCard: disable-buttons+no-emit vs registered-event+tracking-issue → unified to empty-state with no emit, no event registered (L-0046 applied). (3) Step 0 atomicity: single commit with type-widen+consumer update vs 0a/0b/0c split → unified to 0a/0b/0c (L-0075). (4) `planningCycleId` required vs optional → resolved as optional (factual correction; column nullable, `duplicateYear` passes null).
**Trust Gate:** Reversed from Phase 3 conditional PASS to Phase 5 **FAIL pending fixes**. Preconditions: TS `export interface` for all six new events, extend `SeasonCreated.properties.data`, unify prefix to `season`, correct categories to `operations`/`navigation`, AiSuggestionCard de-theatred, `planningCycleId` optional, §2.4 factual correction (activation is trigger-based, not silent), cascade-task href migration. All applied in spec commit `ecf2ff36`.
**Factual error caught:** Spec §2.4 claimed `activateSeason` was "gate-guarded as today". Supervisor + Agent-coord independently verified: `activateSeason` writes direct via `supabase.from('season').update()` (no cascade_gate_write). Separately, Postgres trigger at `20260428100001_season_activation_trigger.sql:9-38` already fires `season.activated` into `engine_event` — so activation is NOT silent today. Spec corrected.
**ADR created:** ADR-0164 (season-namespace-unification-telemetry)
**Learnings created:** L-0072 (registerEvent untyped without extends BaseEvent), L-0073 (UI-widget namespace is not telemetry namespace — Procedure Engine corollary), L-0074 (spec scope-reset must log against superseded spec), L-0075 (migration atomicity 0a/0b/0c pattern)
**Cross-lens convergence:** AiSuggestionCard flagged theatre by Steward + Agent-coord + Frontend-designer independently — triple-lens convergence = strong signal.
**Defers to 2026-04-19 holistic spec:** activation gate, missing checklist, Activate/Archive/Duplicate, Seeded-from pill, Goals tab, Procedures tab. All re-scheduled P2 pending activation-engine wiring completeness + real regulatory_framework provenance persistence + product clarity after route split lands.

## 2026-04-20 — Progressive Channel (helpdesk as flag, not subtype)
**Type:** spec (architecture + feature, pre-implementation)
**Verdict:** APPROVE WITH CHANGES — RESCOPED
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator (code-tracer), frontend-designer, general-purpose (Phase 2.5 fact-check), narrator
**Prior verdict held?** Partially. 2026-04-19 Kanaler som Help Desk Council verdict on `ticket=engine_state` HOLDS. Verdict on `desk=channel_type='desk'` discriminator REVISED — progressive `helpdesk_enabled` flag adopted instead. L-0070 (sibling-table not ontology answer) supported the revision.
**Key decision:** Channel remains the primitive; helpdesk is a progressive layer via `channel.helpdesk_enabled` + `channel.privacy_mode` + reuse of `channel_ai_policy`. Legacy `channel_type='desk'` rows keep enum value forever (dual-truth window). Entity ontology preserved: `engine_state.entity_id = channel.id` unchanged — public-branch message-anchoring REJECTED on code-trace evidence (would silently break `channel_event` projection + `resolve-ticket.ts:131,137`).
**Phase 2.5 fact-check caught 2 false briefing claims + 6 new findings:** (a) `channel_ai_text_mode` enum values are `'disabled'|'mention_only'|'proactive'`, not `index_only|primary_responder` as assumed; (b) enum name is `comm_channel_type`, not `channel_type`. New findings: (1) existing CHECK at `20260515130100:32` must be revised, not duplicated; (2) dead-infra deadline 2026-07-13 for `channel_ai_policy` binding; (3) `helpdesk_query_lifecycle` currently only uses `wait_for_event` (dispatcher gap); (4) `openTicket` already creates `channel_type='query_thread'` (atomic migration needed); (5) `'standard'` doesn't exist in enum (UPDATE would fail); (6) JWT INSERT RLS allows rogue helpdesks (security gap).
**Semantic conflicts resolved (Phase 5):** (1) Steward's "unify on entity_type='channel' + anchor-message in context" vs AI-coord's "single ontology, keep entity_id=channel.id" → different; resolved to AI-coord's position (steward reversed own Phase 3 R2 after code-trace evidence). (2) Supervisor's "leave channel_type='desk' forever" vs Steward's "progressive-flag-as-truth" → different; Supervisor wins on PostgreSQL technical grounds (`'standard'` doesn't exist). (3) Steward's "defer domain_tags to Phase 2" vs AI-coord's "delete domain_tags, reuse allowedChannels" → partial overlap; resolved to AI-coord's delete (overlaps ADR-0078/0163 without integration point). (4) Frontend's "orb on first message" vs AI-coord's "no message-anchor at all" → convergent; first-message computed via `MIN(created_at)` query, not FK.
**Trust Gate:** Phase 3 BLOCKED (three new write paths, entity polymorphism, half-wired plumbing). Phase 5 CONDITIONAL PASS on rescoped minimum path: keep unified entity_id=channel.id; Server Actions not dispatcher steps; L-0087 mock replacement as 1A.1 prereq.
**Pontus product decisions (Phase 6):**
- Q1 PII in public-mode helpdesk → **b with soft-hold mitigation** (post-then-flag with <800ms classifier, redact original, spawn private sub-channel). Steward had recommended a (hard block).
- Q2 channel_type for new helpdesks → **a** (leave unchanged, `helpdesk_enabled` is truth).
- Q3 Phase 1B Botsson-rad scope → **a** (no skeleton, render only when Phase 2 has data).
**ADRs created:** ADR-0165 (Progressive Channel Discriminator, amends ADR-0161 §Rules-Data-model §1), ADR-0166 (PII public-mode redaction via soft-hold classifier, amends ADR-0163).
**Learnings created:** L-0085 (dispatcher ENTITY_PK hand-maintained ceiling), L-0086 (channel_ai_policy plumbing ≠ feature — "reuse" trap), L-0087 (mock-surface trap expands with additive migrations — ship-block prereq), L-0088 (ontology change ≠ presentation change — derivable facts don't justify FKs).
**Number collision resolved mid-session:** Initial reservation had ADR-0164 + L-0083/0084 collided with parallel branches (Year Wheel council + decision-log + learning-log commits on 2026-04-20). Renumbered ADRs 0164→0165, 0165→0166; Learnings 0083→0085, 0084→0086, 0085→0087, 0086→0088 before any file written. 6th occurrence of L-0042 collision pattern.
**Security finding:** `channel_jwt_insert` policy at `20260422300100:24-26` allows JWT INSERT of `channel_type='custom'`. If `helpdesk_enabled=true` is JWT-insertable, attack vector: users self-create rogue helpdesks + foist themselves/others as rep. Phase 1A.1 ship-block: RLS narrowing policy.
**Factual correction:** "Reuse channel_ai_policy" in briefing was misleading — the table exists, `policy.ts:85-89` returns `true` unconditionally for proactive, no admin UI writes it, only one consumer reads it. Phase 2 effort scope corrected from "wire UI" to "build listener" (L-0086).

## 2026-04-20 — Auth & Invitation Spec Scope Council
**Type:** spec (scope decisions before writing implementation plan)
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator (code-tracer), frontend-designer — 4/4 responded; narrator skipped (orchestrator wrote inline synthesis); docs-tutor + VERIFY_CLAUDE_MD deferred (spec not yet implemented)
**Prior verdict held?** n/a — no prior auth/invitation council found in log grep
**Key decision:** Rescope the 1064-line holistic spec to web-only P1 (13 screens) + P0 hotfixes (middleware, ghost route, create-invitation emit) + P2 deferrals (mobile, cron, CSV, SMS/QR, cookie, dialog split, visual regression). 3 new ADRs + 1 amendment.
**ADRs created:** ADR-0167 (invitation tokens as credentials), ADR-0168 (magic link as default), ADR-0169 (partial unique index on pending). Amended ADR-0021 (portal-subdomain as canonical auth surface).
**Learnings created:** L-0089 (ghost routes in PUBLIC_ROUTES worse than 404), L-0090 (enum-vs-timestamp cascade heuristic), L-0091 (semantic conflict resolution must be explicit per-minority — 3rd occurrence, promoted to SKILL.md rule).
**Phase 2.5 fact-check caught:** (1) briefing claimed middleware redirects to `/update-password`, actually redirects to `/reset-password`; `/update-password` is ghost route in PUBLIC_ROUTES with no page file. (2) Briefing claimed 4 telemetry events registered for auth/invitation; actually 30+ events exist across auth/invitation/profile/workspace/onboarding categories. Real gap ~5 missing events.
**Trust Gate BLOCKING:** `create-invitation` Edge Function has 0 emit sites. Registered `invitation_created/dispatched` without emitters = lying infrastructure (same class as L-0083). P0 fix required before any UI spec screen can merge.
**Semantic conflict resolution:** 5 three-to-one minorities + 5 two-to-two splits, each explicitly classified right/wrong/partial or same/different/partial-overlap with named reasoning in Phase 5 synthesis. Steward minority on Q17 (/join Botsson risk) classified right on risk, wrong on remedy — majority verdict (hybrid) preserved with minority's constraint attached (`requiresWorkspace: false` + side-effect-free for /join tools).
**Blocking preconditions before P1 implementation:** (1) spec appendix mapping every new telemetry event → emit site; (2) P0 create-invitation emit fix; (3) P0 ghost-route cleanup; (4) AUTH-01/03/04 in proposed status [DONE this session]; (5) Botsson capability-manifest `requiresWorkspace: boolean` required field; (6) Nordic Split `--workspace-accent` token (hash-derived OKLCH).

## 2026-04-21 — Mobile `No QueryClient set` — @tanstack/react-query version split
**Type:** post-implementation (bug fix reviewed after applied)
**Verdict:** PASS WITH CONDITIONS — implemented
**Agents consulted:** system-steward (chair), supervisor (code-tracer), general-purpose (Phase 2.5 fact-check), narrator — 3/4 reviewers (system-agent-coordinator + frontend-designer skipped; no stage-engine or design concerns). NOT DEGRADED — skips justified.
**Prior verdict held?** n/a — first council for this bug class
**Key decision:** React context packages (`@tanstack/react-query` and any provider-based lib) MUST be declared as `peerDependencies` in workspace packages (`packages/*`), never direct `dependencies`. Apps pin the concrete version. Root `package.json` uses `pnpm.overrides` as enforcement backstop. Two violations corrected: `packages/billing` and `packages/walkieTalkie` converted to peerDependencies. Root override `@tanstack/react-query: 5.99.0` added. `apps/mobile` bumped to `^5.99.0`. All aligned via `pnpm install`.
**Supervisor critical finding:** Fix was not in effect at review time — `pnpm install` had not been run after `package.json` bump. Lockfile still pinned `5.90.21`. Blocked crash fix from taking effect. pnpm-lock.yaml must always be regenerated and committed with any package.json specifier change.
**Steward finding:** `packages/billing`'s direct dep was root cause — raised workspace floor to `5.99.0`, pnpm resolved `packages/schedule`'s peerDep to match, but `apps/mobile`'s `QueryClientProvider` stayed on `5.90.21`. Two `QueryClientContext` instances in Metro bundle = crash.
**walkieTalkie classification:** Supervisor code-traced all 7 source files — zero react-query imports. Ghost dep, not active crash vector. Converted to peerDep to close future trap door.
**Telemetry note:** Mobile mutations silently failing (no `onSuccess` firing due to missing provider) now restored. Correctness improvement, not regression.
**ADR created:** ADR-0170 (React context packages as peerDependencies in workspace libraries)
**Learning created:** L-0092 (lockfile must be regenerated with package.json), L-0093 (ghost dependency is latent trap)

## 2026-04-22 — Session Recorder + Platform Admin Intervention (spec-stage)
**Type:** spec
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, frontend-designer (+ general-purpose fact-check)
**Prior verdict held?** N/A — første council om Session Recorder / Platform Admin intervention. Bygger på BOTSSON-SYSTEM-MAP.md (2026-04-22) og eksisterende `platform-admin/guardian/` UI (80% reuse).
**Key decisions:**
- 2 ADRs (ikke 3): 0184 Session Recorder + 0185 Platform Admin Intervention. Guardian-bus migration = A6 implementation, ikke ny ADR.
- Phase 0 prerequisite chain: A3 memory-writer + A5 intent-classifier context + A6 guardian-bus → Realtime MÅ lande FØR recorder implementation (ikke part of A6 som Supervisor foreslo).
- **Whisper-mønster** fra Coordinator resolved Q1-konflikten: `<admin_note>` metadata-injeksjon i next-turn system-prompt, aldri rendered til bruker, honorerer ADR-0078.
- Tiered retention (metadata permanent / redacted 90d / envelope 30d / flagged 1y) resolved Q3 (b) vs (c) konflikt — capture full, retention tiered.
- Supabase Realtime vinner over pg_notify+SSE (infra already in stack).
- Extend eksisterende `platform-admin/guardian/` — ikke fork til `sessions/`.
- Phase 2 (cross-workspace fleet view) deferred pending ny design-handoff.

**Semantic conflicts resolved:**
- Q3 data scope: Steward+Supervisor (b metadata) vs Coordinator+Frontend (c full) — **different**, Coordinator's code-trace decisive. Resolved via tiered retention.
- Q6 real-time transport: Steward+Coordinator pg_notify+SSE vs Supervisor+Frontend Supabase Realtime — **same concern (RLS-aware real-time), different infra**. Realtime wins (already in stack).
- Q9 session scope: Steward+Coordinator (a+FK) vs Supervisor+Frontend (d match engine_state) — **same pattern, converged** on `recorder_session` + nullable `engine_state_id` FK.
- Q10 PII: Steward (b), Supervisor (a), Coordinator (b+c), Frontend (b+reversible) — **layered defense** combining all: redact-on-write + render-redact + reversible envelope + audit.
- Q14 ADR count: Steward 3 vs Supervisor+Coordinator+Frontend 2 — 2 wins. Bus migration = A6, not new ADR.
- Q15 Phase binding: Steward+Coordinator+Frontend (Phase 0) vs Supervisor (A6) — **different**. Phase 0 wins. A6-folding risks shipping recorder before memory-writer.
- Q1 intervention: Steward+Supervisor (b read+flag) vs Coordinator+Frontend (c whisper+force-stop) — **different until whisper defined**. Coordinator's spec broke deadlock.

**Agent Trust Gate:** FAIL as originally scoped, PASS gated on Phase 0. ADRs kan aksepteres nå; implementation PR CI-blokkert til A3+A5+A6 lander.

**ADR created:** ADR-0184 (Session Recorder Architecture), ADR-0185 (Platform Admin Session Intervention)
**Learning created:** L-0109 (Recorder-before-writer dead-letter), L-0110 (Whisper ≠ takeover), L-0111 (Tiered retention resolves capture/retention false dichotomy), L-0112 (Code-trace catches what grep-briefing misses) — renumbered from 0105-0108 on merge to development due to collision with contract-hub-redesign + wave-h councils.

**Implementation spec:** `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md`

**Side findings:**
- Platform Admin Guardian UI dekker 80% av needed recorder-view via reuse av `SessionList`, `SessionDetails`, `EventFeed`, `StageAnalysis`, `ToolUsageTable`, `WhisperInput`, `AlertsList`.
- Design-handoff-GAP confirmed: `docs/design/botsson/project/Botsson Arena.html` dekker operator-facing Arena, IKKE Platform Admin cross-workspace fleet-view. Phase 2 blocked på ny handoff-commission.
- `BotssonArena.tsx` LogView (line ~2140+) må få hover-flag affordance (Lucide Flag, opacity-0 group-hover:opacity-100) per 40%-reduction principle.
- 4 stage-engine core steps (agent-router.ts:83 classifier, authority.ts load, prompt-builder.ts output, agent-router.ts LLM call) leaver zero persistent trace i dag — bekreftet av Coordinator code-trace.


## 2026-04-22 — Wave H Employee Invite Closure Verification
**Type:** post-implementation
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer (degraded — no file-read), narrator (skipped — orchestrator inline synthesis)
**Prior verdict held?** Yes — Wave H council 2026-04-22 "APPROVE WITH TRUST GATE" verdict holds at code level (5/5 PASS verified by code-trace).
**Key decision:** Wave H closure is valid for declared scope (admin→employee outbound chokepoint). 4 follow-ups required for Wave I: (C1) dialog batch-success branch reads dead response shape; (C3) mobile inbound join-request bypasses lib (single-chokepoint claim partially false); (C7) `invite_type='link'` always now — schema/runtime drift; (C2) `invite_employment_type` Zod too permissive; (C6) lib silent service-role fallback.
**ADR created:** none — no new architectural decision (C7 may produce ADR-0181 in Wave I)
**Learning created:** L-0128 — Doc agents must verify DB-level invariants before declaring regressions (5th occurrence of pattern; promote candidate to run-council Phase 2.5)



## 2026-04-23 — campaign/year-wheel Post-Implementation Review (PR #249)
**Type:** post-implementation
**Verdict:** APPROVE-WITH-FOLLOWUPS
**Agents consulted:** system-steward (Chair), supervisor, system-agent-coordinator, botsson-harness-builder (code-tracer), frontend-designer (DEGRADED — no Read tools), narrator (skipped — orchestrator inline synthesis)
**Prior verdict held?** Yes — 2026-04-23 ADR-0200 council (APPROVE-WITH-CHANGES, 12 fixes) and 2026-04-20 Year Wheel Redesign verdicts both held at code level. ADR-0201 code-trace-shortcut (no full council) partially validated — Q-A/Q-C decisions held, but post-implementation surfaced 3 blockers the shortcut missed.
**Key decision:** Campaign merged cleanly (4 milestones, 2 ADRs, 4 migrations). Cascade dimension integrity intact. 4 blocker-class followups tracked in M5 cleanup sortie: (B1) CapabilityName union missing 3 Server-Action capabilities → gateAction callable from untyped paths; (B2) phantom-emit `operating_hours_generated` on idempotent re-activation; (B3) orphan `archiveSeason` client mutation still exported post-M4 (parallel cutover incomplete); (B4) concurrent-activation race can leave workspace with two active seasons (no partial UNIQUE index). Plus 3 polish items (phantom-consumer events, non-atomic Duplicate, doc hygiene).
**Semantic conflict resolution:** Steward "APPROVE-WITH-FOLLOWUPS" vs Agent-coord "NEEDS-FIX" = different, not same. Steward treated as doc debt; Agent-coord caught security-surface widening (typed union gap). Agent-coord correct on severity.
**Agent Trust Gate:** Partial PASS — 3 phantom-contract class issues (M5.2, harness C1, harness C5) each a specific ADR-0196 Invariant 11 violation. Must close in M5 before adjacent campaigns touch season namespace.
**ADR created:** none in council (ADR-0202 "Season Server-Action Capability Namespace" planned for M5.6 sortie)
**Learning created:** L-0129 — Code-trace-shortcut substitutes for full council only on pure design decisions; integration-surface work landing 3+ migrations + capability registry changes must get full Phase 3 review even when architect's open questions are code-traceable. 2026-04-23 ADR-0201 skipped full council; Agent-coord Phase 3 post-impl caught 2 of 3 blockers the shortcut missed. Also L-0050 (audit-inflation) 5th occurrence — briefing claimed availability/shift-swap dotted-event drift; Steward code-trace falsified (emit sites + registry keys both dotted, agreed).


## 2026-04-27 — Journey-Engine Campaign Closure Verification
**Type:** post-implementation
**Verdict:** APPROVE WITH CHANGES — DEGRADED MODE
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer, narrator
**Prior verdict held?** Partial — 2026-04-21 (Journey Runner Suite v1.6→v1.7) and 2026-04-23 (REMEDIATION) verdicts both HELD; this session caught 3 retraction-class regressions (R1 status vocab, R2 mission resolution, R3 stuck-detector deferred) which were closed in-session via 30+ commits. M5 "complete 2026-04-22" claim retracted twice further.
**Key decision:** Promote BLOCKED until pre-promote doc fixes (P1-P7) land. Code is shippable; closure docs violated Invariant 12 (the campaign that authored Invariant 12 shipped 4+ stale claims in own HANDOFF). Trust Gate: 2 of 4 capability promises kept end-to-end (publish_mission ✓, publish_guide ✓, run_dev ✗ no cloud worker, run_guided ✗ engine_state write-only sink). Documentation must be honest about open-loop state.
**ADR created:** 0216 (engine_state vs engine_sessions ontology, proposed)
**Learning created:** L-0144 (M5 retraction = system working as designed), L-0145 (closure-doc Invariant 12 enforcement), L-0146 (phantom-consumer pattern symmetric to L-0094)
**Notable conflicts resolved:**
- Supervisor's 2 HIGH findings (`stage_id` UUID, `workspace_id` on `engine_stages`) REFUTED by memory note 2026-04-28 — schema is intentional. First time memory-note adjudicated mid-council.
- Steward C5 (run_dev orphan) + Harness C1 (engine_state write-only) MERGED as one phantom-consumer pattern (L-0146).
- Frontend Designer review DEGRADED — orchestrator failed to pre-load file contents; review reduced to risk-map.

---

## 2026-04-28 — Journey-Engine Doc Consolidation (Post-Implementation)
**Type:** post-implementation
**Verdict:** APPROVE WITH CHANGES — DEGRADED-MODE MERGE (3 gates A/B/C)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder (+ general-purpose Phase 2.5 fact-check). Frontend-designer skipped (pure docs, no UI tokens). Narrator skipped (orchestrator inline).
**Prior verdict held?** Partial — 2026-04-27 Journey-Engine Closure (APPROVE WITH CHANGES — DEGRADED MODE) verdict held at code level; this council reviewed 2-commit doc consolidation landed AFTER closure, found 5 ADR-class new contracts shipped without ADRs.
**Subject:** Commits `d66dc0c1` (doc reorg into `docs/engines/system-intelligence/`) + `0c8a5765` (5-op skill expansion at `.claude/skills/journey-protocol/`).

**Adopted framing (Harness):** "Docs as intent, broken as commitments." 5 phantom contracts shipped simultaneously. Trust Gate FAIL on 7 contracts — worst score across 4 prior trust-gate precedents (Year Wheel / Web Perf / Post-Audit Mobile / Session Recorder).

**Unanimous findings (all 4 reviewers):**
- `journey.rescued` is phantom — zero writers/readers/registry. Conflicts with LIVE `guardian_signal → journey_rescue` push path (2026-04-06).
- `engine_missions` schema mismatch — 7 MISSION.md fields have no DB columns. Stage-engine reads only `system_prompt + mode + is_active + journey_id`.
- Approve op claim "Inserts engine_authority_config" violates ADR-0176 (migration-only) + ADR-0099 (gate_action) + Invariant I6 (gate-singleton).
- FLOW.md examples reference 8 unregistered events → would explode ADR-0175 frozen-5 contract.
- 5 ADR-class schemas shipped with ZERO ADRs registered. CLAUDE.md §"ADR Enforcement" violated.

**Unique findings (Harness only):**
- `voice_safe` field rediscovers `human_only` pattern explicitly REJECTED by ADR-0078 §Considered-Options.
- `journey.rescued` payload missing `workspace_id` + `actor_id` (ADR-0134 / Invariant 4 violation baked in).
- 13-file folder is repo-level → conflicts with multi-tenant claim (PRD §15.4).

**Phase 2.5 fact-check failures (3):**
- HANDOFF claim `packages/journey-ir/` 5 files / 634 lines → actual 6 files / 1139 lines.
- `ops/03-refine.md:55` cited migration `20260516000200_seed_journey_authority.sql` → actual `20260516000400_journey_authority_seed.sql`.
- ADR-0216 referenced as accepted → actually `proposed`.

**Semantic conflicts resolved (12 pairs analyzed):**
- Steward (4 ADR stubs proposed sufficient) vs Supervisor (3 ADRs accepted required) → DIFFERENT, Supervisor wins for development-promotion bar (Gate B).
- Agent-coord "FAIL" vs Steward "APPROVE WITH CHANGES" → SAME severity, different label.
- Harness "APPROVE as docs, REJECT as commitments" → adopted as canonical framing.
- All 4 unanimous on `journey.rescued` phantom-contract.

**Agent Trust Gate:** FAIL on all 7 contracts. 5th trust-gate precedent of 2026-04 cycle. Three gates with different bars:
- Gate A (campaign-internal): 12 docs-only fixes + 4 ADR stubs as `proposed` → DONE in this council session
- Gate B (development promotion): 4 ADRs `accepted` + schema reconciliation
- Gate C (skill runnable): full pipeline match, blocked on ADR-0216 + Phase B1 + Phase C2

**ADRs registered (proposed, all 4):**
- ADR-0222 Journey-Protocol Op Pipeline (5-op + 13-file folder)
- ADR-0223 Journey Rescue Path Reconciliation (drops journey.rescued, keeps guardian_signal)
- ADR-0224 engine_missions Schema vs MISSION.md Relationship (Option A: docs-only fields)
- ADR-0225 FLOW.md as Intent Doc — NOT Registry Source

ADR numbers 0218-0221 reserved by main-repo development branch (helpdesk-hub, Botsson front-door, KB capability gate); jumped to 0222 to avoid collision (5th occurrence of cross-worktree ADR collision pattern).

**Learnings created (4):**
- L-0151 Five phantom contracts simultaneously authored (5th trust-gate precedent of 2026-04)
- L-0152 Rejected ADR options resurface under new names (`voice_safe` rediscovery of `human_only`)
- L-0153 Dual-rescue-system trap (B3 pattern repeating against live `guardian_signal` path)
- L-0154 engine_missions silent field-drop (phantom column — distinct from phantom-emit + phantom-consumer)

**Gate A fixes applied this session:**
- INTENT banners on `05-protocol-pipeline.md`, `10-rescue-prompt-spec.md`, `ops/04-approve.md`, FLOW.md schema doc + reference doc
- Stripped `voice_safe` field from RESCUE-PROMPT format (replaced with ADR-0078 reference)
- Added `workspace_id` + `actor_id` to journey.rescued payload (ADR-0134 compliance)
- Approve op: rewrote step 7 to invoke capabilities (NOT direct DB writes)
- Fixed HANDOFF LOC (6/1139), failure codes (4 not 5)
- Fixed `ops/03-refine.md:55` migration filename + line ref
- Fixed `ops/02-spec.md:17` heading "skill" → "op"
- Inference-pattern + state-card explicit positioning in `07-journey-package-compiler.md` (runtime-derived from IR, not folder files)
- Marked `docs/specs/PRD-journey-engine-system.md` as `superseded` pointing to `01-prd.md`
- 4 ADR stubs proposed, decision log + comment header updated, 4 learnings added to log

**Outstanding (Gate B sub-sortie):**
- Promote 4 ADRs to `accepted` after review
- Resolve `engine_missions` schema vs MISSION.md (depends on ADR-0216 acceptance)
- Multi-tenant boundary clarification for 13-file folder
- SKILL.md self-contradiction line 94 vs approve-op line 57 final reconciliation
- `needs-rewrite/REWRITE-INSTRUCTIONS-system-inteligence.md` typo path + INDEX stale row

**Outstanding (Gate C — blocked on ADR-0216 acceptance):**
- Implement compile pipeline (FLOW generator, e2e generator, 13-file materializer)
- Build ROADMAP.md reader OR mark documentation-only
- Migrate MISSION resolver to full schema OR collapse fields per ADR-0224 end-state
- Reconcile rescue path: deprecate or formalize coexistence per ADR-0223 outcome

---

## 2026-04-28 — ADR-0216 Council (engine_state vs engine_sessions ontology)
**Type:** architecture (decision-class, cross-campaign)
**Verdict:** APPROVE Option B — stage-engine learns to read engine_state, capabilities unchanged, B5 action handlers emit terminal events
**Agents consulted:** system-steward (chair, Phase 3 voted A2 → REVERSED to B in Phase 5), supervisor, system-agent-coordinator, botsson-harness-builder (+ general-purpose Phase 2.5 fact-check). Frontend skipped (pure architecture). Narrator skipped (orchestrator inline).
**Prior verdict held?** N/A — first decision council on ADR-0216 (proposed since 2026-04-27 closure council).

**Vote tally:** Steward A2 → REVERSED to B / Supervisor B / Agent-Coord B / Harness B (3-1 → 4-0 after chair self-reversal).

**Trust Gate:** Option B PASSES. Preserves ADR-0173 (frozen-4 capabilities), ADR-0175 (frozen-5 telemetry), ADR-0078 + ADR-0163 (channel guard 3-layer), Event Engine universal runtime (CLAUDE.md Cascade Core), Cascade Core Foundation. Option A2 FAILS on 4 frozen contracts + Event Engine + 8 cascade domains.

**Falsifying evidence (Steward Phase 3 reversal):** Supervisor's full-codebase scan found 139 production sites across 8 unrelated cascade domains reading/writing engine_state. Steward's Phase 3 grep was scoped to stage-engine only — incomplete scope. engine_state is canonical Event Engine universal workflow runtime per CLAUDE.md, not journey-only.

**Math:** Capability E2E coverage 2/4 → 3/4 (closes run_guided phantom-consumer L-0146). Phantom-emits 0/3 → 3/3 (closes step_reached + completed + run_failed via B5 action handlers consuming engine_state_step). Cascade regressions 8 → 0. Migration scope: NONE (Option B is purely additive).

**Three-table boundary canonical:**
- `engine_missions` — journey-mode mission registry (static blueprint)
- `engine_state` + `engine_state_step` — universal Event Engine runtime (8 cascade domains)
- `engine_sessions` — voice/agent-session boundary (channel-bound)
Three tables, three roles, no merge.

**Phase 2.5 fact-check failures (3):**
- Telegram WAS added to engine_sessions.channel CHECK; system NEVER added (briefing inverted).
- Only 2 of 5 journey events emitted by capabilities; 3 phantom (briefing claimed verified).
- session-manager reads engine_missions for prompt building, not just engine_sessions (briefing simplified).

**ADRs accepted (this wave):**
- ADR-0216 promoted proposed → accepted (Option B with three-table boundary clarification)
- ADR-0223 promoted proposed → accepted (rescue reconciliation unblocked — engine_state_step provenance preserved by Option B)
- ADR-0224 amended + promoted proposed → accepted (three-table boundary references ADR-0216 outcome)

**L-0147 promotion confirmed (3rd chair self-reversal occurrence):**
- Year Wheel Redesign 2026-04-20 (Trust Gate Phase 3 PASS → Phase 5 FAIL after Agent-coord code-trace)
- /dashboard/help 2026-04-28 (Phase 3 REJECT → Phase 5 APPROVE-as-tier after frontend layout brought new evidence)
- ADR-0216 2026-04-28 (Phase 3 Option A2 → Phase 5 Option B after Supervisor's 139-site blast-radius scan)
Promoted to run-council SKILL.md Phase 5 §1.5 MANDATORY HARD RULE.

**Learnings created (3):**
- L-0155 Schema-deletion plans require full-codebase grep before vote
- L-0156 Phase 2.5 briefing accuracy gates — schema and grep verification
- L-0157 "Formalize reality" framing as deletion-plan smell (1st explicit naming)

**Implementation owned by:**
- B1 stage-engine reader → campaign/botsson-arena (separate sortie)
- B2 B5 action handlers emit terminal events → campaign/botsson-arena
- B3 capability E2E spec migration (2 of 4 specs) → campaign/journey-engine
- B4 ADR updates + promotion (this council) → DONE

---

## 2026-04-29 — Botsson on Platform Admin (R1 post-implementation review)
**Type:** post-implementation
**Verdict:** APPROVE WITH CHANGES — Tier A ship-OK, Tier B blocked
**Agents consulted:** system-steward (chair, Phase 3 PASS → Phase 5 REVERSED on publishDraftTool gate compliance), supervisor, system-agent-coordinator (Layer 2+4 code-tracer), botsson-harness-builder (Layer 4 code-tracer), frontend-designer (Layer 1). Phase 2.5 fact-check via general-purpose. Narrator skipped (orchestrator inline).
**Prior verdict held?** N/A — first council on this 3-commit landing. Builds on ADR-0239 (was 0226 pre-merge) acceptance (2026-04-29 same-day) and ADR-0216 three-table boundary (2026-04-28).

**Subject:** 3 commits on `campaign/journey-engine` mounting Botsson on `/platform-admin`:
- `616c3ee9` Mount BotssonProvider + BotssonShell on platform-admin/layout.tsx
- `72dd10c8` Wire `/api/botsson/chat` for journey_authoring + wizardSessionId + Bearer precedence
- `71822a8b` Switch wizard-chat → `/api/botsson/chat` (admin BFF)

**Trust Gate per tool (mandatory per L-0175 promotion):**

| Tool | gate_action | gatedMutation | emit | Verdict |
|------|------|------|------|---------|
| save_draft | PASS | PASS | PASS via routing | PASS |
| publish_draft | **FAIL** | **FAIL** | **FAIL** (zero emit) | **FAIL** |
| check_duplicates | PASS | n/a | PASS | PASS |
| lookup_journeys | PASS | n/a | PASS | PASS |

**Chair Self-Reversal (4th L-0147 precedent):** Chair Phase 3 generalized "ADR-0099 chain present" from save_draft to all four tools. Agent-coord + harness-builder independently code-traced `tools.ts:443-481` and found three direct Supabase writes (journey + journey_version + wizard_session) outside any gatedMutation. Chair Phase 3 = **REVERSED**. Falsifying evidence: tools.ts:443-481 body contradicts tools.ts:282 docstring claim of ADR-0204 compliance.

**Phase 2.5 fact-check corrections (3):**
- BFFs forward `profile_id` to stage-engine but stage-engine schema removed it per ADR-0151 (Zod strips silently).
- ADR-0239 (was 0226 pre-merge) Decision Outcome lists 3 tools; implementation has 4 (publishDraftTool added). ADR amended this Phase 8.
- Prime context array is 14 lines, not 13 (cosmetic).

**Phase 3 deltas (4 missed-by-Chair surfaced):**
- Frontend HIGH dual-surface UX (wizard textbox + Orb both look like "talk to AI", silent misroute)
- Supervisor BLOCKING scope decision (read-only chat vs full Botsson vs cross-workspace godmode)
- Harness P2 silent workspace-mismatch on save_draft when wizard_session row missing
- Agent-coord publishDraft rollback non-atomic + zero emit on mutations

**ADRs registered (proposed, all 2):**
- ADR-0240 (was 0237 pre-merge) Journey Authoring Tool Boundary — publishDraft delegates to journey.publish_mission (closes ADR-0204 + ADR-0173 + ADR-0099)
- ADR-0238 Botsson Surface Disambiguation — BotssonShell suppresses to passive when domain chat declares ownership

**ADR amended:**
- ADR-0239 §Decision Outcome 3 → 4 tools enumeration (publishDraft row added with ADR-0240 cross-ref)

**Learnings created (4):**
- L-0175 Chair Phase 3 must trace each tool independently in multi-tool capabilities
- L-0176 Docstring compliance claims are not evidence — trace the body
- L-0177 Silent workspace-mismatch on tool execution is the same class as forgeable IDs (sibling shape to ADR-0091 + ADR-0151)
- L-0178 Dual chat surfaces on the same page require explicit disambiguation OR suppression

**Number reservation note:** ADR-0227-0236 + L-0148-0174 already taken across branches. Reserved 0237/0238 + 0175-0178 against `git log --all` per Phase 8 Step 0 (5th L-0147-class collision avoidance). **POST-MERGE COLLISION (2026-04-29 sync-campaign):** dev had 0237-handoff-location-convention; my 0237 + 0226 renumbered to 0240 + 0239 per outsider-renumbers convention. ADR-0238 + L-0175-0178 kept (no collision). 6th L-0147-class precedent.

**L-0147 promotion confirmed (4th chair self-reversal occurrence):**
- Year Wheel Redesign 2026-04-20
- /dashboard/help 2026-04-28
- ADR-0216 2026-04-28
- Botsson on Platform Admin 2026-04-29 (this council)

**Tier A approved (ships now):** save_draft + chat + wizard advancement. Pipe state 🟡 → 🟢 for chat-and-save flow.

**Tier B blocked (does not ship until):**
- ADR-0240 Phase 1 lands (publishDraft delegates or removed from registry)
- ADR-0238 Phase 1 lands (Orb suppression on wizard page)
- Pontus declares scope (Supervisor R5: read-only chat vs full Botsson vs cross-workspace godmode)
- save_draft workspace-mismatch guard added (L-0177)
- userContext server-resolved from layout.tsx (drops "Hei Pontus" hardcoded fallback)

**P2/P3 deferred:** prime-context DRY extraction, profile_id BFF cleanup, atomicize publishDraft writes, aria-live, BotssonShell/sidebar overlap, bg-primary user-bubble token replacement, stale comment wizard-chat.tsx:128.
## 2026-04-28 — Botsson Voice + Tool Performance Council (next-3-weeks priority + retrospective)
**Type:** feature/architecture (planning + retrospective)
**Verdict:** APPROVE WITH CHANGES (chair self-reversed Phase 3 kb_query approach in Phase 5 per L-0147)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer + general-purpose Phase 2.5 fact-check (haiku, 22/23 verified). 5/5 reviewers responded — not degraded mode.
**Prior verdict held?** Builds on Council 2026-04-23 B1 dual-gate (ADR-0203/0204 stand). Builds on Council 2026-04-28 /dashboard/help (ADR-0221 amended this council). No conflict.

**Vote outcome:**
- Steward Phase 3 → kb_query as NEW capability (Tier 1)
- Steward Phase 5 → REVERSED to migrate `searchKnowledge` → `knowledge/` namespace (per L-0147 protocol)
- Supervisor → conditional kb_query (only if /help v1 on roadmap); +bumped Helpdesk Phase 0 dispatcher fix to P0
- Agent-Coord → migrate `searchKnowledge` from `communication/` to `knowledge/` (NOT new capability)
- Harness → route `intent='knowledge'` to existing capability OR migrate (no new capability); flagged B5 stale 🔴
- Frontend Designer → ADR-0177 reduced-motion not applied to orb (web + mobile), notification-orb urgency ring missing

**Trust Gate:** CONDITIONAL PASS — Tier 1 items (knowledge migration, Schedule Oslo, Helpdesk dispatcher fix, SYSTEM-MAP refresh) data pipeline ready. Deferred items (C2 HTTP, LiveKit hardening, B1 SS-4) blocked on prerequisites.

**Phase 2.5 fact-check** verified 22/23 briefing claims. ONE stale: SYSTEM-MAP cited `services/stage-engine/src/adapters/livekit.ts` — path doesn't exist.

**Major findings (cross-reviewer):**

1. **B5 phantom 🔴 falsified** by 3 independent code-traces (supervisor + agent-coord + harness): all 3 handlers (`create_deviation`, `validate_settlement`, `lock_checkout`) shipped at `supabase/functions/engine-dispatch/index.ts:800,910,995` with tests. SYSTEM-MAP + CAMPAIGN status updated this council. Drop B5 from work plan. **L-0150 4th occurrence — promotion criteria met → ADR-0227 codifies.**
2. **kb_query reversal:** `searchKnowledge` exists at `packages/ai/src/capabilities/communication/tools.ts:285-376`. Mis-namespaced — LLM never picks `communication` for "what's the policy". Live dead-code today. ADR-0221 amended scope from "register new capability" → "migrate to `knowledge/` namespace". **L-0159 fourth shape of phantom contract: mis-namespaced tool.**
3. **Schedule wrong-day root cause:** `packages/ai/src/capabilities/schedule/tools.ts:41-42` — `getMyShifts` uses raw UTC `Date.now()`, not Oslo-anchored. Falsifiable at 23:30 UTC. ~4 lines + test. Dashboard hooks (`use-week-range.ts:15-20`, `use-employee-roster.ts:268-270`) have separate Oslo bug.

**Retrospective debt (3 items):**
- C1.d bootstrap may be lazy-on-first-message instead of finalize-workspace (steward Tier 2)
- A6 pg_notify guardian bus has no durability fallback (steward Tier 2)
- A4 intent-coverage CI may be one-directional only (steward Tier 2)

**ADRs created (this wave):**
- ADR-0226 (proposed) — Concurrent Voice + UI Mutation Reconciliation Policy (gates B1 SS-4)
- ADR-0227 (proposed) — SYSTEM-MAP Refresh + Code-Trace Verification Protocol (3-layer enforcement)
- ADR-0221 amended — kb_query → knowledge migration

**Learnings:**
- L-0150 UPDATED — 4th occurrence noted, promotion to enforced rule via ADR-0227
- L-0159 NEW — Capability namespace as semantic contract (4th phantom-contract shape)
- L-0147 already covers Phase 3 chair self-reversal pattern; this session is another instance

**Next-3-weeks ranked roadmap:**

Week 1 (~3 days):
1. Helpdesk dispatcher key fix — `engine-dispatch/index.ts:419` (`event` → `event_type` to match `20260515130200_helpdesk_query_process_seed.sql`)
2. Schedule Oslo agent-layer fix — `schedule/tools.ts:41-42`
3. Schedule Oslo dashboard-hooks fix — `use-week-range.ts`, `use-employee-roster.ts`
4. Knowledge capability migration — `searchKnowledge` from `communication/` → `knowledge/` namespace + bind `intent='knowledge'`
5. SYSTEM-MAP refresh + CI freshness step

Week 2 (~5 days):
6. ADR-0226 reconciliation policy detail (gates B1 SS-4)
7. C1.d bootstrap durability test (retro debt)
8. A6 pg_notify durability replay (retro debt)
9. A4 CI bidirectionality (retro debt)
10. Reduced-motion sweep on orb (web + mobile)

Week 3 (gated):
11. B1 SS-4 implementation (after ADR-0226 accepted)
12. D2 schedule diagnose follow-up
13. C1.c Detox harness
14. C2 generator API spec write

---

## 2026-04-29 — Campaign/core-module Post-Implementation Review

**Type:** post-implementation
**Verdict:** NEEDS-FOLLOW-UP-BEFORE-/end-session (DEGRADED-MODE — frontend-designer absent)
**Agents consulted:** system-steward (chair) · supervisor · system-agent-coordinator · botsson-harness-builder · frontend-designer (FAILED — hallucinated file absence)
**Prior verdict held?** n/a — no prior council on this campaign
**Key decision:** 5 follow-up items before /end-session. Steward chair self-reversed Phase 3 SAFE-TO-CLOSE → Phase 5 NEEDS-FOLLOW-UP after Supervisor's `close-feature.sh -maxdepth 1` finding expanded scope (3rd documented chair self-reversal precedent).

**ADR created:** ADR-0237 (HANDOFF location convention canonical = docs/handoffs/, depth-2)
**Learning created:** L-0169 (ADR spec-vs-code drift pattern), L-0170 (frontend-designer hallucinates absence without Read)

**5 must-fix items shipped this session:**
1. ✅ ADR-0195 hygiene — added `page_takeover.help.panic_bar_human_button` to `CapabilityName` union
2. ✅ HANDOFF location alignment — moved M2.1 to `docs/handoffs/`, patched `~/.claude/scripts/close-feature.sh` to `-maxdepth 2`
3. ⏳ Deferred to main-promote checklist — engine_process row verify on dev DB
4. ✅ CAMPAIGN-core-module.md:34 — annotated cancelled M3.3 v2-horizon bullet
5. ✅ BOTSSON-SYSTEM-MAP.md — kb_query 🔴→🟢, channel_event M2.1 partial-read note, verified_against_code 2026-04-29

**Logged for next session:**
- ADR-0231 dedup implementation (gate_action 3x → 1x via `gate_correlation_id` propagation in stage-engine)
- ADR-0230 adoption for M2.3 governance Server Actions (single-gate → dual-gate)
- Frontend-designer Nordic Split / a11y review re-run (non-degraded agent)

**Trust Gate verdict:** CONDITIONAL PASS — gate_action 3x = pre-existing debt + ADR-0231 `proposed` (code not bound). M2.3/M3.2 hold documented `accepted` ADR contracts. ADR-0195 union drift (Q4) was real violation, fixed this session.

**Phase 9 Self-Improvement notes:**
- Phase 2.5 fact-check caught 0 false briefing claims — the briefing was clean (5/5 claims verified). Single correction: HANDOFF path location (depth-1 vs depth-2).
- Frontend-designer FAILED — hallucinated file absence reasoning from git status. False negative. 99sec + 48k tokens wasted. Recovery: orchestrator verified via direct `ls`, proceeded in DEGRADED-MODE for visual review only. **Same agent failed at L-0170 1st occurrence 2026-04-13. 2nd occurrence triggers learning, 3rd will trigger SKILL.md hard rule.**
- Steward semantic conflict resolved cleanly — Steward Phase 3 (move outlier file) vs Supervisor finding (fix script) classified as PARTIAL OVERLAP, both fix-directions adopted (belt + suspenders).
- Steward chair self-reversal explicit + named: Phase 3 SAFE-TO-CLOSE → Phase 5 NEEDS-FOLLOW-UP. 3rd documented occurrence (per L-0147). Pattern signature confirmed: chair operates on incomplete scope; reviewer code-trace expands scope; chair must reverse, not rationalize.
- New process improvement: when reviewer cites a `proposed` ADR for finding, synthesis must include ADR-status one-liner before adopting finding into verdict. Codified in L-0169.

**Frontend visual audit completion (orchestrator inline 2026-04-29 per L-0170 fallback):**
- I-1 reduced motion: ⚠️ MOSTLY — caught `PanicConfirmDrawer.tsx:176` Loader2 `animate-spin` UNGUARDED. Fixed inline to `motion-safe:animate-spin`.
- I-2 dual-channel state: ✅ PASS — all state UI uses icon + text.
- I-3 400% zoom: ✅ PASS — responsive layout, E2E coverage exists.
- I-5 voice INPUT NO: ✅ PASS — page-takeover-gate-action + help-takeover-kit hard-reject voice.
- Nordic Split: ✅ PASS — zero hardcoded colors, Lucide icons only, no emoji.
- Mobile boundary: ✅ PASS — `apps/mobile/src/components/helpdesk/` is helpdesk Phase 1 (PR #261), not /help leak.
- Skeleton parity: ⚠️ Tier 0.5 ActiveTicketBadge skeleton missing from `loading.tsx`. Fixed inline.
- Focus management: ✅ PASS — TakeoverPreview dialog semantics, PanicBar navigation role, TourHighlight non-blocking.
- Final visual verdict: PASS-TO-CLOSE. 2 polish-items shipped this session as inline fixes.

**Deferred:** C2 HTTP code, LiveKit "hardening", B1 SS-5, Helpdesk Phase 1 mutation, /dashboard/help v1 UI, notification-orb urgency ring.

---

## [2026-05-04] — Pipeline Consolidation Plan Council

**Type:** plan (review-target before implementation)
**Verdict:** REJECT — REWRITE BEFORE DISPATCH
**Agents consulted:** system-steward (chair, Phase 3 + Phase 5), supervisor (codebase + Husky + CI conventions), general-purpose security/CI specialist (sonnet — Dependabot/gitleaks/CodeQL/Vercel-trigger semantics), general-purpose Phase 2.5 fact-check (haiku — 14 claims verified, 4 FALSE/CRITICAL surfaced before Phase 3 dispatch)
**Prior verdict held?** Partial — prior `deployment-pipeline` council (ADR-0265 enforced pipeline) APPROVE WITH CONDITIONS still holds; this council reviewed plan that EXTENDS ADR-0265 with branch-DB + security baseline + inhouse pre-push.
**Subject:** `docs/plans/PLAN-pipeline-consolidation-2026-05-04.md` (501 lines, drafted in pruned worktree `serene-mcnulty-468859`, never committed — see L-0212).
**Key decision:** Plan as written cannot execute. 24 distinct must-fix items: 9 P0 dispatch-blocking, 9 P1 scope/blocker, 6 P2 polish.

### Phase 2.5 fact-check findings (4 CRITICAL pre-dispatch)
- D1 — `workflow_run: workflows: ["Vercel Production Deployment"]` does NOT fire on external Vercel deploys → Phase 4 (e2e-preview) is dead code
- D2 — `npx supabase db reset --linked=false` flag does NOT exist → Phase 2 pre-push fails on first run
- D3 — `--project=local-stack` does NOT exist in `apps/e2e/playwright.config.ts` (projects: landing/web/mobile/mobile-pwa) → Phase 2 + Phase 4 fail
- D10 — Plan claims 495 migrations; `ls supabase/migrations/*.sql | wc -l` = 492 → acceptance §8.4 fails
- Plus: ENV files `supabase/.env` + `packages/supabase/.env` referenced by §4.2 do NOT exist

### Phase 3 reviewer findings (asymmetric coverage — see L-0211)
**Steward (chair) only-catches:**
- §9 step 9 violates ADR-0265 operator-only invariant ("only Pontus does production releases")
- §4 env-var content placement (must move to `docs/protocols/ENV_PROTOCOL.md` or becomes 18th doc-conflict on archive)
- Cascade K1a/K1b reproducibility on branch DB (does `seed.sql` materialize canonical industry knowledge?)

**Supervisor only-catches:**
- **Phase 1D ruleset update gap** — without updating rulesets 14797822 + 15290760, all 4 new CI checks ship as advisory only, defeating entire security-baseline phase
- `_meta_migration_state_rpc` reference is stale → actual RPC is `migration_state_latest` (file `20260503174428_migration_state_latest_rpc.sql`)
- `--no-verify` claim factually wrong — repo has no policy blocking it; husky hooks honor `--no-verify` at git-native level

**Security/CI Specialist only-catches:**
- ADR-0266 collision risk — bubble-migration HANDOFF (2026-05-03) claims 0266-0268; billing-erik-seed 0269; CI-incident 0275 (5th occurrence Renumber Pattern, see L-0209)
- `deployment_status` event vs `repository_dispatch` for Vercel→GitHub trigger — Vercel-documented + automatic vs operator-coupled
- CodeQL Python language-matrix gap (`services/scrapling/` external-data service uncovered)
- CodeQL minute-burn at per-push trigger (10-15 min/run × 5-10 PRs/day) — must be weekly cron
- `pnpm audit --high` will fail on transitive devDeps within 2 weeks → needs `--prod` + allowlist
- Race condition: Vercel preview deploy starts before `branch-db.sh` reset → needs Gate 4.7 env-var sync

### Convergence (no genuine conflicts per Phase 5 semantic resolution)
- "Tier the pre-push hook" (Steward) ≡ "Re-budget as path-conditional" (Supervisor) — same intent, complementary mechanism
- "Hard-gate Phase 3 on Phase 1B" (Steward) ≡ "Make Phase 1B blocking" (Supervisor) — identical
- "Sequence Phase 3 as 3a-3d (ADR before code)" (Steward) ≡ "ADR-0266 written BEFORE Phase 3" (Specialist) — same

### Wall-clock divergence (see L-0210)
- Author: 4-5 hours
- Reviewers (3 independent estimates): 2-3 days
- Divergence ratio: 3-6× → REJECT verdict justified on estimate alone

### Chair Self-Reversal Protocol
**HELD with additions.** No reviewer code-traced opposite to chair's Phase 3 findings. Supervisor + Specialist surfaced 1 high-impact item each that Steward missed (Phase 1D ruleset; ADR-0266 collision); both additive, not contradictory. 0 reversals required.

### Trust Gate
**N/A.** Plan is CI/deploy infrastructure + documentation. No capability tools, mutation paths, `gate_action`, `gatedMutation`, or `emit()` surfaces touched.

### Cascade integrity
**PASS** once K1a/K1b verification step added to Phase 3 (one-bullet fix).

### Knowledge captured
- **ADR:** Pre-PR Quality Gate Architecture — pending plan rewrite. **Allocate next free slot ≥ ADR-0278** (verified via `git log --all`: highest committed = 0277-phantom-reuse-detection; collisions 0270-0275 across branches).
- **Learnings:** L-0209 (ADR Renumber Pattern hard rule, 5th occurrence), L-0210 (wall-clock divergence >3× as quality signal), L-0211 (asymmetric reviewer coverage load-bearing, 3-reviewer minimum), L-0212 (plan-file ephemerality — uncommitted plan in pruned worktree).

### Out-of-scope flags (raised to Pontus)
- 18-doc archive conflict suggests broader documentation rot — separate sortie warranted
- 30-agent parallel session pattern undocumented anywhere — worth ADR codifying developer-experience contract for pre-push tiering

### Phase 9 Self-Improvement notes
- Phase 2.5 fact-check (haiku) caught 4 CRITICAL false claims pre-Phase-3 dispatch — saved 3 reviewers from reviewing fictional command syntax. Pattern: when plan contains shell commands + workflow YAML, Phase 2.5 fact-check should explicitly run `--help` against quoted commands and grep referenced workflow names.
- Plan-file orphan discovered at Phase 8 — worktree `serene-mcnulty-468859` pruned between sessions; plan never committed. Council verdict survives only via transcript + memory. Promoted to L-0212 as 1st occurrence (advisory).
- Asymmetric coverage confirmed empirically: 7 block-level findings, NONE caught by 2+ reviewers. Promoted to L-0211 hard rule.
- Wall-clock divergence ratio surfaced as falsifiable signal — 3-6× factor justified REJECT on estimate alone. Promoted to L-0210 hard rule.
- ADR Renumber Pattern 5th occurrence — moved from advisory memory to L-0209 hard rule with mandatory `git log --all` + `git stash list` reservation check at Phase 1 INTAKE.

**Next session prerequisites:**
1. User decides: plan rewrite (option 2 from Phase 6) or capture-only (option 1, executed this session)
2. If rewrite: re-create plan file in committed `feat/plan-pipeline-consolidation-v2` branch BEFORE Phase 3 re-review (per L-0212)
3. ADR slot ≥ 0278 reserved against `git log --all` (per L-0209)

---

## 2026-05-04 — Accountant Portal Data Foundation (billing-erik-seed sortie wt-5)

**Type:** architecture / feature
**Verdict:** APPROVE WITH CHANGES (rescoped)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator (code-tracer)
**Skipped:** botsson-harness-builder (not Botsson), frontend-designer (no UI scope), narrator (orchestrator inline synthesis)
**Prior verdict held?** N/A — first council on accountant portal data foundation. Adjacent: 2026-04-17 Billing Engine Fase 1 (different scope).
**Key decision:** Consolidate 2 originally-proposed ADRs (super-admin + stripe-storage) into ONE ADR-0269 "Accountant Portal Data Foundation" covering 6 sub-decisions per Pontus option B selection. Resolves 5-migration phantom-ADR-A reference permanently.
**ADR created:** ADR-0269 (Accountant Portal Data Foundation) — proposed.
**Learning created:** L-0199 (phantom-ADR detection), L-0200 (is_godmode Cloud-incompatibility), L-0201 (CSV explicit-ID-mapping), L-0202 (Chair Phase 3 sibling-table reversal — 5th occurrence, promoted to SKILL.md hard rule), L-0203 (RLS coverage gap accountant scope), L-0204 (invoice external_reference UNIQUE for idempotent seed).

**Phase 3 disagreements (resolved in Phase 5):**
- Q1 Stripe storage: Chair P3 = sibling-table; Supervisor = invoice.external_reference; Coordinator = ADD COLUMN. Chair self-reversed to ADD COLUMN per code-trace evidence (lifecycle-independence absent).
- Q4 Yogurt 2-customer: Chair + Supervisor = 1 company; Coordinator = 2 companies. Resolved as 1 company + secondary cus_* logged in HANDOFF for future "multi-customer linkage" ADR.

**Phase 3 consensus:**
- Q2 workspace: SKIP entirely (ADR-0118 covers invoice = company-scoped).
- Q3 invoice status: void + void_reason mapping for paid (feilaktig); pair with credit_note row.
- Q5 super-admin: CROSS JOIN seed (a); REJECT is_super_admin boolean (b).

**Critical findings beyond original 5 questions:**
- ADR-A is phantom (5 migrations cite unregistered ADR) → resolved by ADR-0269 + M4 comment-fix.
- granted_by = is_godmode LIMIT 1 is Cloud-incompatible → self-grant pattern in ADR-0269.
- RLS coverage gap: user_identity + profile have no accountant policy → conditional M3 in ADR-0269.
- Idempotency gap: invoice has no UNIQUE on external_reference → M2 partial UNIQUE in ADR-0269.

**Migration plan (4 migrasjoner ≥ 20260525000000):**
- M1: company.stripe_customer_id ADD COLUMN + partial UNIQUE
- M2: invoice.external_reference partial UNIQUE
- M3: 2 RLS policies on user_identity + profile (conditional)
- M4: Erik bootstrap CROSS JOIN grant + phantom-ADR-A comment-fix

**Trust Gate:** N/A (no agent capabilities/tools/mutations).

**Implementation status:** Phase 7 + 8 complete; Phase 9 self-improvement appended to council_meta.md.

---

## 2026-05-06 — Journey Control Center sortie pre-`/close-feature` review

**Type:** post-implementation
**Verdict:** APPROVE WITH CHANGES (R1-R7 batch landed in commit `dafc3793a`)
**Branch:** `feat/journey-control-center` @ `dafc3793a` (29 commits ahead of `ffc043a6f`)
**Agents consulted:** system-steward (chair, opus), supervisor (opus), system-agent-coordinator (opus, code-tracer Layer 2 + Layer 4), general-purpose (sonnet, frontend-designer role with skill-tool-loop fallback)
**Skipped:** botsson-harness-builder (dev-tool, no Botsson L1-L5 surface), narrator (orchestrator inline synthesis)
**Prior verdict held?** N/A — first council on Journey Control Center.

**Key decision:** Approve standalone Next.js dev tool at `apps/journey-control/` (port 3065) with required fix-up batch covering Nordic Split half-wired token (`--color-success/-warning/-info` not aliased in `@theme inline`), HANDOFF factual errors (paths, data-flow command, commit count), `journey-runner.ts:51` env-passthrough comment, and ADR-0291 `proposed → accepted` promotion.

**ADR created:** ADR-0291 (Journey speed profiles — full / normal / ai_companion). Status promoted `proposed → accepted` in fix-up commit `dafc3793a`. (Plan said ADR-0284; was occupied; renumbered to 0290 → 0291 (collision w/ engine-world ADR-0290, weaker-referenced renumber 2026-05-06) — pattern: 5th+ occurrence of plan-vs-live ADR-counter drift.)
**Learning created:** L-0223 (globals.css half-wired tokens force raw-palette fallback) — 2nd occurrence; promote to Nordic Split skill hard rule on 3rd.

**Phase 3 disagreements (resolved in Phase 5):**
- **Conflict A — `text-green-500` at `run-viewer.tsx:62`**: Frontend = "Nordic Split hard violation, REQUIRED fix"; Supervisor = "Not a violation, accepted convention used in 10+ apps/web sites." Chair Phase 5 code-trace: site is in `apps/journey-control/` (not apps/web); `--success` defined raw in `globals.css:81` but `@theme inline:9-42` only aliases `--color-destructive`; new app, day 1, no accumulated debt. Frontend wins on substance. R1 + R2 fix-up wires `--color-success` through `@theme inline` and switches `run-viewer.tsx:62` to `text-success`.
- **Conflict B — production-deploy guard urgency**: Steward Phase 3 = REQUIRED 3-line NODE_ENV guard; code-tracer F-4 = "dev-tool acceptable"; Supervisor = not raised. Chair self-reversed Phase 5 per Self-Reversal Protocol — verified zero deploy surface (no vercel.json, no CI workflow, hardcoded relative `cwd` walk via `path.resolve(process.cwd(), "../..")`). Right artifact = README "do not deploy" line (deferred to sortie B), not a runtime guard. **5th documented chair-generalizes/code-tracer-falsifies precedent** (after Year Wheel 2026-04-20, /dashboard/help 2026-04-28, ADR-0216 2026-04-28, Botsson on Platform Admin 2026-04-29).
- **Conflict C — HANDOFF correction urgency**: Steward + Supervisor = REQUIRED before close; code-tracer + Frontend = not raised. `close-feature.sh` HANDOFF gate is INFO-only per Supervisor verification — does not technically block. HELD as REQUIRED via reviewer discipline (audit-trail integrity), not tooling.

**Phase 3 consensus (verified by code-tracer):**
- `speed_profile` round-trip end-to-end PASS (UI → POST → Zod → spawn env → protocol.spec → runner → multiplier; env wins over IR pinning).
- Single-run lock sound (no race in single-threaded JS).
- SSE completion race-free (exit handler synchronous, `run.done = true` + final-line push in same tick).
- Auto-register idempotency holds (colon-terminator-safe; `"P-002":` doesn't false-match `"P-002X":`).
- ADR-0178 schema-additive contract preserved (v1 IRs without `speed_profile` parse unchanged; `MINIMAL_V1_IR` test fixture confirms).

**Critical findings beyond the 4 questions briefed to each reviewer:**
- HANDOFF "Architecture" file map listed `_components/` directory + `/api/journeys/run/route.ts` (no `[slug]` segment) + invalid `node protocol-runner.ts --slug P-001` data-flow command. Three factual errors in a 96-line audit document. Fixed in R3-R5.
- `globals.css` declares `--success` / `--warning` / `--info` raw, but `@theme inline` only aliased `--color-destructive`. Half-wired token = silent regression seed on day-1 of new app. Fixed in R1-R2.
- `journey-runner.ts:51-57` spawns Playwright child with full `process.env` passthrough. Not a leak (intentional — child needs `SUPABASE_SERVICE_ROLE_KEY` for `db_record` gates per `apps/e2e/runners/protocol-runner.ts:365`) but unannotated. R6 added inline comment.

**Required fix-up (R1-R7) — landed as one commit `dafc3793a`:**
- R1: Wire `--color-success/-success-foreground/-warning/-warning-foreground/-info/-info-foreground` into `@theme inline`.
- R2: `run-viewer.tsx:62` `text-green-500` → `text-success`.
- R3: HANDOFF commit count `25` → `28`.
- R4: HANDOFF data-flow command corrected to actual `npx playwright test ... --project=web` shape with env vars.
- R5: HANDOFF Architecture paths `_components/` → `components/` + dynamic `[slug]` segments restored on 3 routes.
- R6: `journey-runner.ts:51` comment documenting intentional env passthrough.
- R7: ADR-0291 frontmatter `status: proposed → accepted`.

**Recommended (C1-C11) — sortie B / follow-up:**
- C2 README "localhost-only operator tool, do not deploy" (replaces rejected Phase 3 NODE_ENV guard)
- C3-C7 a11y batch (CompileDialog ARIA, RunViewer aria-live, SpeedPicker arrow-key, responsive grid, WCAG verify)
- C9 unit test on registry-rewrite regex (Prettier-safety)
- C10-C11 HANDOFF "Known Issues" expansion (no shadcn, no TanStack, regex single-import-block prelude assumption)

**Trust Gate:** N/A (dev-tool, no capability tools, no agent surfaces, no stage-engine, no `gate_action`, no telemetry mutations).

**Implementation status:** Phase 7 + 8 complete in commit `dafc3793a` + this COUNCIL-LOG append. Sortie ready for `/close-feature`. Phase 9 self-improvement appended to council_meta.md.

---

## 2026-05-08 R1 — Verify 4 Plans (B1, B2, vad-bench, Phase E)
**Type:** plan
**Verdict:** B1 APPROVE, B2 APPROVE WITH CHANGES, vad-bench APPROVE WITH ONE FIX, Phase E REJECT (6 critical KRIT-1 through KRIT-6)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator (code-tracer), botsson-harness-builder (code-tracer), frontend-designer + general-purpose (Phase 2.5 fact-check)
**Prior verdict held?** Yes — ADR-0282 council 2026-05-04 verdict still applies; this council adds implementation-level review.
**Key decisions:**
- B1 + B2 + vad-bench cleared to dispatch
- Phase E REJECT-AS-WRITTEN — 6 critical findings: livekit-token EF shape mismatch, engine_sessions.process_id missing, vad-bench gate path wrong, fictional import paths @/lib/auth/get-server-context, ADR-0276/0284 already exist, lise-interview mission ID does not exist
- Council adopted 4 hard rules + risk register (R-1 through R-6)
**ADR created:** none
**Learning created:** L-0225, L-0226, L-0227, L-0228 (drafts in doc-consolidation plan Phase 7)

---

## 2026-05-08 R2 — Verify 5 Plans (Post-Patch, doc-consolidation NEW)
**Type:** plan
**Verdict:** B1/B2/vad-bench HOLD prior verdicts; Phase E REJECT holds (R-5 patched cleanly via `6a61c1947`, KRIT-1/2/4/6 still open); doc-consolidation APPROVE WITH CHANGES (5 blocking + 4 minor)
**Agents consulted:** system-steward (chair, self-reversal protocol invoked once on capability-count drift discovery), supervisor, system-agent-coordinator (code-tracer — discovered capability count drift), botsson-harness-builder (code-tracer) + general-purpose (Phase 2.5 fact-check, found KRIT-7/8/9/10)
**Prior verdict held?** Yes — R1 verdicts verified post-patch.
**Key decisions:**
- Phase E Task 9 R-5 patch (commit `6a61c1947`) verified clean — closes ADR-0276/0284 ID-squatting trip-wire without scope creep
- KRIT-1/2/4/6 remain open in Phase E — pre-Phase-E foundation sortie required (`docs/superpowers/plans/2026-05-08-pre-phase-e-foundation.md`)
- doc-consolidation 5 blocking fixes patched inline this session: capability-count grep verification, skill-path split (project-relative vs ~/.claude/), Phase 6 in-repo/out-of-band split, scope-guards on Phases 3/4/5/6/7, heartbeat shell-bug fix (set -e + ((var++)) trap)
- doc-consolidation 4 minor fixes deferred: Phase E Task 10 BOTSSON-SYSTEM-MAP gate, DomainChatOwnership "vapor" framing in T2.4, ADR id-format sed pattern explicit, capability-table to T2.6 with all 29 names
**ADR created:** none
**Learning created:** L-0229 capability-count source-of-truth drift (NEW — written this session, file at `docs/learnings/0229-capability-count-source-of-truth-drift.md`)
**Council session output:** ORCHESTRATION-2026-05-08.md (master execution doc) + 6th plan (pre-Phase-E foundation)

## 2026-05-09 — Payroll Phase 5 Closure Review (post-implementation)

**Type:** post-implementation
**Verdict:** REJECT (DEGRADED-MODE — 4/5 reviewers; frontend-designer hung in Skill-only tool-loop)
**Agents consulted:** system-steward (chair, Phase 3 PASS-WITH-CONDITION → Phase 5 REVERSED to REJECT), supervisor (Layer 3 ACCEPT — triggers + cascade clean), system-agent-coordinator (Layer 2+4 BLOCK — column-trace caught 2 production bugs), botsson-harness-builder (cross-cutting laws — checked workspace_id constraint shape but missed `.eq("id", ...)` column-name bug), frontend-designer (FAILED — Skill-only agent caught by caveman tool-loop), narrator (orchestrator inline)
**Prior verdict held?** n/a — first council on payroll closure. Prior council 2026-04-29 covered contract module foundation (different scope).
**Key decision:** REJECT verdict forced 4 fixes in `tools.ts` before merge to development: (1) `.eq("id", profile_id)` → `.eq("profile_id", profile_id)` on profile-table SELECTs (production-broken — returns not_found always); (2) drop `tax_municipality_code` (column doesn't exist); (3) docstring fix on `update_payroll_profile` (claimed gatedMutation, body uses gate-then-update direct — sibling pattern); (4) test mocks now assert `.eq()` column args via vi.fn() spies. All 4 fixes shipped at SHAs `daec3534a` + `d9c80e119` + `2fa4011a7`. Pushed to `campaign/payroll`. 13/13 vitest green. Red-green cycle verified for column-name fix.
**5th documented chair self-reversal precedent** — chair generalizes architecture, code-tracer falsifies. Pattern signature: chair operates on incomplete scope, reviewer code-trace expands scope, chair must reverse.
**ADR created:** none — ADR-0250 deferral pattern + L-0176 + ADR-0204 already cover the violations; they were not enforced.
**Learning created:** L-0230 fluent-mock-chains-skip-column-validation (NEW) — sibling to L-0176 + L-0081. Promotes mock-spy column-arg assertion as required pattern.
**Process improvement:** Code-tracer mandate strengthened — when verifying ADR-0151 compliance, must check ALL `.eq()` column references against schema, not just `.eq("workspace_id", ...)`. The harness specialist verified workspace constraint shape but missed the unrelated broken column at the same call site. Future briefings should explicitly require "every column ref grepped against database.types.ts".

---

## 2026-05-10 R1 — Botsson Senior Review + Doc-Drift Closure
**Type:** review + doc-update
**Verdict:** APPROVE — recovery plan + doc patches landed inline
**Agents consulted:** botsson-harness-builder (chair, code-tracer), system-steward (verification), database guide (DB queries), cascade-developer (D1-D6 mapping)
**Prior verdict held?** Yes — Phase E + Phase F0 closures (PR #354 + #360) confirmed clean. ADR-0282 single-plane LiveKit verified end-to-end.
**Trigger:** post-Phase-E/F0 senior review + memory-writer diagnostic from sibling session caught G1 (authority never seeded → `engine_memory` 0 rows globally despite Phase A3 marked 🟢).

**Key findings (verified against DB + code 2026-05-10):**
- **G1 (CRITICAL):** Phase A3 shipped 2 of 5 plan items. Capability + writer code 🟢. Authority seed migration NEVER landed. `engine_authority_config` has no `memory` row → `save_memory` (suggest-tier) HIDDEN by default `read_only`. Items 3 (auto-summary at session-end) + 4 (TTL via pg_cron) NEVER built. Local DB reset 2026-05-03 (Bubble migration) wiped historic onboarding writes. Reader works (collector reads top-10 into prompt) — feels alive at session-start, persists nothing during chat.
- **G2 (CRITICAL):** F-DB-01 `engine_world_observe_platform` GRANT to authenticated, no body guard. Promotion-blocker.
- **3-source mission drift (G12):** code registry 7 missions, DB `engine_stages` 3 missions, MODULE_BOTSSON.md says 5. `season-lifecycle` + `discovery-call` exist in DB without registry entries. 4 of 7 code missions are single-prompt (no stage chain).
- **Cap-count drift (L-0229 5th doc surface):** `botsson-harness-builder.md` line 113 said 14, `BOTSSON-SYSTEM-MAP.md` ~17, registry truth = 29.
- **MODULE_BOTSSON.md verified_against_code: 2026-05-09** (pre-Phase-E ship), still describes Ultravox throughout, cites 3 deleted files (`stage-engine/src/routes/adapters/ultravox.ts`, `stage-engine/src/lib/ultravox.ts`, `stage-engine/src/types/ultravox.ts`).

**Patches landed in same session:**
- `~/dev/smartout.ai/.claude/agents/botsson-harness-builder.md`: cap count 14→29 with grep verification, Open Gaps rewritten (G1-G15 + closed historical), Voice Tools section rewritten (Ultravox path gone, LiveKit single-plane shape), `useRegisterTools` examples replaced with server-side capability pattern reference, "How to Wire Memory" section rewritten with G1 runtime gap detail
- `docs/architecture/BOTSSON-SYSTEM-MAP.md`: L4 cap-count rewrite (29 names listed), `memory` capability row 🟢 → 🟡 with G1 detail, `engine_memory` persistence row 🟢 → 🟡 with runtime exposure 🔴
- `docs/architecture/modules/MODULE_BOTSSON.md`: header `verified_against_code: 2026-05-10`, amendments documented, mission table 5 → 7 (added `lise-interview` + `botsson-session`), Ultravox prose stripped from §1, Noekkelfiler table rewritten with post-Phase-E file paths
- NEW `docs/architecture/BOTSSON-STAGE-MISSION-MODEL.md`: canonical stage + mission contracts, per-mission tool/data requirements, validation checklist, recovery anchors
- NEW `docs/architecture/BOTSSON-KNOWN-LIMITATIONS.md`: G1-G16 inventory with severity, fix sortie, owner, time estimate; closed limitations historical record; pre-sortie validation gate

**4 commits landed on `development` (Pontus pushes):**
- `cafd6c30c` feat(botsson): voice activity lift to provider + Krisp setProcessor race fix
- `5cfe97d8f` feat(mobile/digest): wire useDigestFeed live data
- `cf6b27431` chore(docs): drop superseded cascade architecture inventory docs
- `571575fa5` feat(komm/nyheter): wire realtime updates + auto-mark-as-read (SKIP_PAGE_POLISH=1, documented in body)

**Recovery plan (priority-ordered, sortie-bounded):**
1. F-MEM-UNBLOCK (G1) — 2-3h — botsson-harness-builder
2. F-DB01-FIX (G2) — 90min — system-agent-coordinator
3. F-DOC-REFRESH (doc drift closure cross-check) — 60min — docs-tutor
4. F-PD-04 palette one-liner (G7) — 5min — dev-direct
5. F-CT-01 billing-query emit (G3) — 60min — botsson-harness-builder
6. F-OB-04 wire-or-delete (G5) — 2-3h — botsson-harness-builder
7. F-JR-02 rename + drop compat (G6) — 30min — dev-direct
8. ADR-0204 SS-4 + voice-tool delegation (G4, G13) — 4-6h — system-agent-coordinator + botsson-harness-builder
9. Mission E2E foundation (G11) — 5-7d — protocol-writer
10. D2 schedule wrong-day diagnose (G10) — 1-2d — botsson-harness-builder
11. F-PD-03 palette cleanup (G8) — 2-3d — frontend-designer
12. DB mission registry reconciliation (G12) — 90min — botsson-harness-builder + council if scope-bearing
13. C2 generator API routes (G14) — 1-2d — botsson-harness-builder
14. L1 visuals (G15) — 3-5d — frontend-designer

**ADR created:** none — recovery plan operates within accepted ADRs (0078, 0099, 0099, 0134, 0151, 0184, 0185, 0186, 0204, 0265, 0276, 0282).

**ADR-amendment candidates flagged (require council before sortie execution):**
- ADR-0078 PII scope amendment IF F-MEM-UNBLOCK chooses opt-out default for `memory` capability authority across all workspaces (current spec says opt-in)
- ADR-0204 promotion `proposed → accepted` after SS-4 migrates 4 per-cap gates through `gatedMutation` orchestrator
- New ADR for DB mission registry reconciliation (G12) IF `season-lifecycle` and `discovery-call` are non-trivially live

**Learning created:** none new this session — G1 root cause is an instance of L-0176 (docstring vs body drift) class. Pattern crystallizes the gap between Phase-X-marked-🟢 (compile-time presence) vs Phase-X-actually-running (runtime exposure). Add to L-0176 as "Runtime exposure ≠ compile-time presence" sub-pattern in next L-0176 amendment.

**Trust Gate:** N/A — review session, no capability code mutations. Doc patches only. 4 dirty-diff commits Pontus-authored cross-surface (Botsson harness + komm + mobile + docs cleanup) — verified phantom-contract-clean (Arena consumes new `voiceActivity` context at line 2169, deleted `PlaygroundLog` + `TelemetryLog` consumed nowhere else, cascade docs last touched `7137d964d` superseded by canonical spec at `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`).

**Council session output:** 5 doc updates + 4 commits. Pontus decides push timing per `feedback_no_pr_to_development_unprompted.md`.

---

## 2026-05-11 — F-CHAT-LIST G1 Plan Validation
**Type:** feature
**Verdict:** APPROVE WITH CHANGES (5/5 reviewers, NOT DEGRADED)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer
**Prior verdict held?** yes — 2026-05-11 channel-unification verdict (status-quo session model). F-CHAT-LIST aligned. Voice ephemeral-per-turn, filter list to channel='chat'.

**Key decisions:**
- POST `/api/botsson/sessions` REMOVED. Option B confirmed by agent-coord code-trace (`agent-session.ts:23-55` — server-owned UUID). 3 endpoints total: GET list, GET :id, DELETE soft-archive.
- `is_archived BOOLEAN` over status='archived' enum (steward) — archive ⊥ lifecycle, two axes.
- 1-PR sortie, internal sequence: telemetry registry → migration → BFF → UI → Provider refactor → tests/docs.
- `emma_conversation` + `emma_transcript` deprecated. ADR-0296 written.
- Dead-flush removal includes JSDoc cleanup (L-0176 5th-occurrence avoidance).
- Group headers Geist Sans (NOT Instrument Serif) per frontend-designer.
- Motion: AnimatePresence + motionTokens.spring + 8px nudge + opacity (NOT full-width slide).
- Search field DEFERRED post-MVP.
- Mobile UI follow-up PR (web-first per ADR-0133).
- Persistence: URL-param `?session=<uuid>` via `router.replace` + server-recall fallback (most-recent on Arena mount).

**Chair Self-Reversal Protocol fired:** Steward Phase 3 said 4 endpoints. Phase 5 reversed → 3 endpoints. Falsifying evidence: agent-coord code-trace `agent-session.ts:23-55`. Classification: REVERSED.

**Trust Gate:** PASS with registry-first sequencing mandate. Telemetry events `botsson.session.created` + `botsson.session.archived` must register in `packages/telemetry/src/registry.ts` BEFORE BFF emit. activity_trail entity discriminator required per ADR-0152.

**ADR created:** ADR-0296 emma_conversation deprecation (written 2026-05-11)
**Learning created:** L-0232 Ghost-table dead-flush pattern (written 2026-05-11) — promotes to preflight rule on 3rd occurrence

---

## 2026-05-13 — Session Retrospective (6 sorties + 1 campaign)
**Type:** post-implementation retrospective
**Verdict:** APPROVE WITH CHANGES (REFINED from Phase 3)
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, botsson-harness-builder (4 reviewers, not degraded)
**Prior verdict held?** n/a — first session-retrospective council. Inputs cite prior councils 2026-05-11 + 2026-05-12 (Mobile Oppgaver) as upstream of this work.

**Subject:** Session arc 2026-05-13. 7 sub-sorties shipped (Sortie 1, A, B, 3, 4, 5a, 5b). 4 ADRs landed (0299-0302). ADR-0298 promoted proposed → accepted via Sortie 5b. Campaign `sortie-5-task-cutover` carries 5a + 5b — not yet merged to development.

**Key decisions:**
- Council classified verdict as **REFINED** not REVERSED (chair Phase 3 premise on Sortie A.2 was wrong — A.2 already merged independently — but conclusion APPROVE WITH CHANGES survives under different reasoning).
- 3 pre-merge conditions for campaign → development: (1) voice path collapse via `buildPersonalTools({omitCreateTask:true})` flag; (2) aliasTaskVerbs scheduled removal (date-tagged TODO OR remove now); (3) list_mine drift marker (paired RPC + TS comments + CODEOWNERS gate).
- 2 hygiene fixes: amend Sortie 4 HANDOFF lint-staged diagnosis (real pattern: commit-message-template reuse), document `46643dc03` scope violation.
- 4 follow-up sorties queued (NOT blockers): `plan-template-bake-gates`, `worktree-doctor`, `emma-task-writer` (Q11 closure), `close-feature-scope-gate`.
- Trust Gate verdict CONDITIONAL PASS:
  - `task.complete source=emma`: FAIL (Q11 — no scheduled writer for emma_task rows yet). Defer source.
  - `task.create_personal_task` voice: PARTIAL (condition 1 required).
  - `operations.getMyTasks` vs `task.list_mine`: DRIFT RISK (ADR-0194 watchlist, not blocker).

**Chair Self-Reversal Protocol:** classified REFINED (not REVERSED). Reviewers expanded scope but did not invert verdict. C1 Sortie A.2 premise wrong — chair self-corrected without verdict change.

**Conflicts resolved:**
- C1 Sortie A.2 stray? — FALSIFIED. A.2 landed on development independently (commit `20a573288`), not stray on campaign.
- C2 list_mine debt vs correct? — SAME concern different framing. Both reviewers agree: document, don't refactor.
- C3 Sortie 4 lint-staged collision? — OVERT CONFLICT. Supervisor diagnosis supersedes: commit-message-template reuse, not race (L-0242).
- C4 voice 2-paths fix? — PARTIAL OVERLAP. Harness proposed `omitCreateTask` flag — adopted.
- C5 close-feature audit hole? — REFINED. Supervisor adds 2nd-occurrence depth (L-0243 promote).

**ADR created:** none new this session. ADR-0303 amendment proposed (add "Campaign cutover sweep" clause covering non-RLS sister artifacts: voice tools, alias shims, eval fixtures, intent routes, capability index).
**Learning created:** L-0239 (briefing trust gate self-test), L-0240 (eval-gate skip JOURNEY discipline), L-0241 (UI-local task state collision), L-0242 (commit-message-template reuse), L-0243 (close-feature scope-gate needed, 2nd occurrence), L-0244 (hint-based LLM deprecation insufficient), L-0245 (RPC + TS-fallback paired drift marker). 7 promoted. 2 held for observation (L-0180 ff-merge-loses-sub-sortie-boundary, L-NEW-3 aliasTaskVerbs-open-ended-TODO).

**Process patterns observed:**
- 0 council escalations during build (pre-Sortie-5b council was sufficient).
- Council scope-reduction: 51 grep hits → 6 real targets after triangulation. Council audit saved typecheck-cliff regression.
- Stop-hook stale-snapshot fired 6+ times this session — confirmed as build-cycle reality not bug (supervisor).
- 4 orphan worktree dirs accumulated (wt-3, wt-5 root-owned, wt-7, wt-11) — needs `/worktree-doctor`.

---

## 2026-05-14 — Polish-Gate Semantics — measurement-strict vs pattern-match?
**Type:** architecture/process
**Verdict:** APPROVE — Commit via SKIP_PAGE_POLISH bypass, NOT verified-flip
**Agents consulted:** system-steward (chair) + supervisor + frontend-designer (3/3 responded, no degraded mode)
**Prior verdict held?** n/a — first council on polish-gate semantics
**Key decision:** `verified: true` requires runtime Lighthouse measurement of served code-under-test. `SKIP_PAGE_POLISH=1` env-var bypass is the honest path when infra blocks measurement. Pattern-match ≠ measurement. Reject `measured_elsewhere: true` field (no validator, silent precedent-erosion). Reject `code_review_only: true` hook escape (softer than SKIP_PAGE_POLISH).
**ADR created:** ADR-0308 polish-gate-semantics
**Learning created:** L-0246 polish-gate-bypass-honest-vs-fake

**Trust gate:** N/A (no new capability/tool/mutation). Diff applies only SKILL-prescribed perf patterns to `/dashboard/schedule`.

**Code-tracer findings (supervisor):** WebDayControl.tsx:97-177 confirmed as canonical reference for AnimatePresence crossfade — diff is direct port. `motionTokens.easingArray` exists at `packages/design-tokens/src/tokens.ts:192`. `loadSecondaryData` flag pre-existing on development branch; defer-fires via `requestIdleCallback({ timeout: 1200 })` + 300ms setTimeout fallback at `apps/web/src/app/dashboard/schedule/page.tsx:311-331` — post-paint firing, not immediate-after-isLoading=false.

**Frontend-designer flag (judgment call, not blocker):** Entrance fade uses `motionTokens.exitMs/1000` (0.25s) where SKILL nominal entrance is `enterMs/1000` (0.5s). Intentional for skeleton-reveal — user has been waiting, fast reveal preferred. Documented in commit body.

**Recurrence watch:** 2nd-time pattern of polish-gate vs infra-failure conflict (1st was prior session, 2nd is this sortie). On 3rd occurrence, promote `apps/e2e/scripts/<route>-perf-baseline.ts` Playwright CDP scripts as Phase 1 baseline replacement (runs headless without dev-server in loop) — would close the infra-dependency root cause.

---

## 2026-05-14 — World-Best-WFM Phase 2 Architectural Scope (G3)
**Type:** architecture
**Verdict:** APPROVE WITH CHANGES (Q1: NEW-ADR-0319 partial chair reversal — vendor enum + dispatcher codified before vendor #2; Q2: DEFER-V2 + ADR-0320 — calibration loop deferred with 5-condition gate; Q3: SHIP-V1-MIN + amend-0306 + ADR-0321 — swap/marketplace V1 as-is, V2 convergence path documented)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder
**Prior verdict held?** n/a (G3 first session on these questions; G1+G2 prior on different topics)
**Key decision:** Ship Phase 2 V1 minimal; codify vendor dispatcher (ADR-0319), defer calibration (ADR-0320), document swap convergence (ADR-0321); 4 ADR drifts fixed at close-feature: ADR-0305 §50 schema-name `cascade.` → `public.`, ADR-0306 5th tool registered + channel/gate matrix, ADR-0307 §47 solver-reads-view drift corrected. External messaging audit: 0 "POS-driven" hits found in docs/ + apps/landing/.
**ADR created:** ADR-0319 (POS adapter contract + vendor lifecycle), ADR-0320 (hour_factor calibration V2 trigger conditions), ADR-0321 (Swap↔Marketplace convergence V2 authority pipeline)
**ADR amended:** ADR-0305 §50 (schema-name fix + justification note), ADR-0306 (5th tool + channel/gate matrix), ADR-0307 §47 (solver demand source corrected)
**Learning created:** L-0270 (vendor adapter without dispatcher = V2 tax), L-0271 (capability tool silent expansion — sibling of L-0176), L-0272 (stub-cron-without-algorithm = telemetry-domain drift)

---

### Council 2026-05-14 — close-feature pipeline traps (post-implementation)

| Date | Topic | Type | Verdict | Agents | Prior verdicts | Phase 9 action |
|---|---|---|---|---|---|---|
| 2026-05-14 | Recurring close-feature pipeline traps (3 traps × 3 sub-sorties this session). Trap A: `sync(...)` commitlint reject (4 script sites). Trap B: pre-push typecheck on stale dist / missing pnpm symlinks. Trap C: `git push \| tail` masks husky exit code (operator + script-internal `\|\| true` variant at close-feature.sh:295). | post-implementation | **APPROVE WITH CHANGES** — Change A (4-site `sync`→`chore`), Change B (explicit if-branch on push), Change C (pre-flight Gate 0). Skill: command-file runbook update. No new ADR. 3 learnings (L-0261/0262/0263). 8th L-0147 Chair Self-Reversal precedent: Phase 3 Steward R1 missed 4-site scope + line:295 swallowed-push variant; Phase 5 reversed both. | system-steward (chair, opus, Phase 5 Chair Self-Reversal — verified line numbers on-disk falsifying both Steward Phase 3 R1 single-site claim and Supervisor REC-2 line:315 → actual line:295), supervisor (opus, Layer 1+2+3 — surfaced 4 script sites + script-internal Trap C variant + operator-history evidence of 6 `sync(...)` commits + canonical `chore(...)` form already hand-typed by Pontus 5×) | yes — 2026-05-05 prior memory (different blockers, sibling class) | Fix script in 4 sites; promote 3 learnings; close-feature command runbook update; no ADR (operational drift, not architectural decision). |

## 2026-05-14 — Page-Polish Skill Audit + Harness Integration E2E

**Type:** post-implementation
**Verdict:** REJECT WITH CONSTRUCTIVE PLAN
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer
**Prior verdict held?** n/a — first council on polish-skill enforcement.

**Key finding:** 75 page-scope tools shipped this session are dead-pipe. Client registry is wired through `botssonTools`; pipe breaks at two distinct points:
- Voice: `/api/wizard/start` silently drops `body.selected_tools`. `LiveKitVoiceSession.registerTool()` is a stub.
- Chat: `/api/botsson/chat` forwards no tool fields. Stage-engine schema rejects `client_tools`.

**Skill text claim** about "BFF → context_init → voice-agent reads site-map.json and injects ## Sidekart" is FALSE-AS-SHIPPED — aspirational claim shipped as factual.

**Chair self-reversed:** YES — Phase 3 "Phase 7 wired e2e" → Phase 5 REVERSED with code-trace evidence (Agent-Coord + Harness-Builder reviewers walked the pipe step-by-step; Steward + Supervisor + Frontend initially accepted "wired"). **4th documented occurrence of L-0147 Chair Self-Reversal pattern.**

**Decisions:**
- Demote skill claims (Phase 7 + Phase 8) — landed in skill update commit `6ed9eb628`.
- Mark 42 dashboard `_tools/use-*-tools.ts` files with `DEAD-PIPE-2026-05-14` quarantine marker — landed in dead-pipe-markers commit (Task 4 of plan).
- Draft ADR-0327 (HarnessAdapter — unified LLM-consumer adapter). Frontmatter + context + decision only this session; body deferred to dedicated sortie.
- Polish-wave commits stand (correct in isolation: types compile, bridges mount, registry receives, conventions hold). The defect is in the skill text's claims, not in the code itself.

**ADR created:** 0326 (proposed)
**Learnings created:** 0264, 0265, 0266

**Other findings preserved for future sorties (not P0):**
- PII leak surface in `use-contract-detail-tools.ts` + `use-invoice-detail-tools.ts` (dormant — tools dead-pipe). To revisit when HarnessAdapter ships.
- No-mutation-on-financial-surfaces convention has no detector. Add path-aware grep to strand 1 in future sortie.
- 11 duplicate `modelToolName` values across scopes. Document or rename before HarnessAdapter routes tools to a single LLM context.
- Scope-naming inconsistency (3 axes) — convention added to skill Phase 7.5 §7; existing scopes grandfathered.
- Validator check 6 (drift) is no-op for the bridge pattern this session institutionalized. Harden validator before next polish wave.
- Strand 1 (just shipped) misses: `transition-all` added in this commit-story; `shadow-xl/2xl/drop-shadow` + financial-mutation-grep + dataRef-bypass-detector queued for future sortie.

## 2026-05-14 — WFM Campaign Merge Readiness (post-merge close-out)
**Type:** architecture (campaign-merge readiness)
**Verdict:** APPROVE WITH CHANGES → executed post-merge (campaign already shipped via PR #385 mid-council; 4 of 8 gates remediated on `development` after the fact)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder, frontend-designer (TOOLING-DEGRADED — smart-explore hook loop blocked file reads)
**Prior verdict held?** n/a (no prior council on world-best-wfm)
**Key decision:** 11/11 tools PASS Trust Gate per-tool table; merge proceeded; 4 post-merge cleanup gates closed on development (`c388ef987`, `73af9ba4d`, `d1c3f26ef`, `ee4f342a4`).
**ADR created:** none — G7 flipped 6 existing WFM ADRs (0305, 0306, 0307, 0319, 0320, 0321) from `proposed` → `accepted` per G3 council ratification (`0c5106deb`).
**Learnings created:** L-0270 (closure-deliverables scope-creep, 3rd occurrence), L-0271 (frontend reviewer blocked by smart-explore hook loop — DEGRADED mode).

**Sequence of events:**
1. Phase 1-3 dispatched. All 5 reviewers responded (4 normal + 1 tooling-degraded).
2. Steward Phase 3 reported 6 conflict files (briefing said 2 — L-0167 sibling pattern; supervisor + harness disagreed on count, steward authoritative via `git merge-tree`).
3. Migration-timestamp-out-of-order: Steward claimed L-0042 violation; Supervisor + Harness traced to NO collision (slot between 200100 and next dev mig clean). Reviewer disagreement resolved: B correct.
4. Phase 5 synthesis: APPROVE WITH CHANGES with 8 gates (G1-G9). Phase 6 user-approved.
5. Pontus merged PR #385 independently mid-execution (2026-05-14 17:16Z, merge-commit per ADR-0213).
6. Re-verified post-merge state: 4 gates still outstanding on dev (G3 capability field, G4 solver_run_id, G7 ADR flip, G8 system-map).
7. Dispatched botsson-harness-builder for cleanup commits. Stop-hook fired progressive typecheck errors during edits; final state green.
8. Pushed 4 cleanup commits to origin/development: `e3b65e758..ee4f342a4`.

**Knowledge captured:** L-0270, L-0271. Phase 9 self-improvement: agents may complete reviews while parent action proceeds — council verdict can land "in retrospect" and remediation moves from pre-merge gate to post-merge cleanup commits. Worth tracking in `council_meta.md` as a precedent class.

## 2026-05-16 — swap-marketplace-convergence-v2 schema decisions
**Type:** architecture (pre-implementation, 5 schema decisions before T0)
**Verdict:** APPROVE WITH CHANGES + mandatory Phase 0 gate
**Agents consulted:** system-steward (chair, REVERSED Q1 via L-0147), supervisor, system-agent-coordinator, botsson-harness-builder (frontend-designer skipped — no UI in scope)
**Prior verdict held?** Partial. ADR-0321 (G3 council 2026-05-14) baseline — accepted V2 path; this council resolved what 0321 left open. ADR-0321's `engine_authority_pipeline_instance` DDL sketch superseded by Q1=B (reuse engine_state).

**Key decisions:**
- Q1 (pipeline instance state) = **B reuse engine_state** (per ADR-0067; chair REVERSED from Phase 3 C, 6th L-0147 precedent)
- Q2 (cross-workspace policy) = **DEFER + scope-bound single-ws + CHECK constraint** (unanimous; 3 options deferred to V2.1 ADR)
- Q3 (multi-stage gate) = **A per-stage gate_action** (unanimous; action_type encodes stage)
- Q4 (capability rename `shift_lifecycle_marketplace`) = **B defer** (unanimous; preserve V1 names)
- Q5 (channel restriction) = **A chat-only at pipeline** (unanimous; per-tool inline ADR-0288 guards retained as Layer 3 defense-in-depth)
- Phase 0 gate (6 items) MANDATORY before T0 migration
- T0.5 seed migration for `<cap>.override` rows required before override_pipeline ships

**Trust Gate:** 9 V1 tools PASS; `override_pipeline` FAIL until T0.5 seed lands; `approve_claim` 2-writes-1-gate atomic pattern at `marketplace/tools.ts:494-518` PRESERVED verbatim.

**Preservation clauses (non-negotiable):** shift_swap.* telemetry (registry 5341-5397), shift_offer.* telemetry (registry 8610-8666), ADR-0173 frozen-4 capability names, ADR-0240 cross-namespace write-ban honored.

**ADR created:** ADR-0340 (Shift Lifecycle Pipeline Implementation — supersedes ADR-0321)
**Learnings created:** L-0279 (chair Phase 3 internal inconsistency), L-0280 (ADR DDL sketches != current truth), L-0281 (default-allow CVE recurrence on pipeline override), L-0282 (Phase 0 gate beats split-into-campaigns), L-0283 (6th L-0147 precedent)

**Sortie context:** sub-sortie `feat/world-best-wfm-swap-marketplace-convergence-v2` in worktree `~/dev/smartout.ai-world-best-wfm-wt-1`. Council took 4 reviewers + chair synthesis + Phase 8 capture; Phase 0 work begins next. T0 migration blocked on Phase 0 exit gate (Pontus sign-off).

**Phase 9 self-improvement (council_meta delta):**
- 3-mot-1 split resolved via Phase 0 gate (new pattern documented as L-0282)
- Chair Phase 3 internal inconsistency = mechanism BY WHICH chair generalizes incorrectly (L-0279) — sibling to L-0147 reversal protocol
- Briefing fact-check skipped (same-session research, no stale-claim risk) — pattern reused from prior councils; explicit note kept
- All 4 reviewers responded; no degraded mode

---

## 2026-05-16 — Chat-WhatsApp Phase 3 priority + scope
**Type:** architecture / planning
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, frontend-designer, system-agent-coordinator, botsson-harness-builder
**Prior verdict held?** n/a — first council for this topic

**Key decision:** Phase 3 execution order:
1. E + ADR-0338 build — `<DomainChatOwnership>` component (1-2d sortie, highest priority)
2. C reconnect-guard fix (~30min, direct-to-development) — fires only on reconnect when camera previously active
3. B polish — only `DraftMessageInput` drops `reply_to_id` (~1h direct-to-development)
4. A E2E sortie — reuse `apps/e2e/playwright.config.ts` `mobile`/`mobile-pwa` projects + 4-5 chat journey specs (~1.5d)
5. D `campaign/chat-admin` — multi-sortie, requires ADR-0336 + ADR-0337 + authority seed migration first

**Trust Gate D FAILS** on 5 blockers:
- `channel_admin` capability not registered
- `gate_action` not declared for any channel-admin tool
- Authority seed migration missing
- ADR-0238 `<DomainChatOwnership>` component not built (declared in ADR, 0 code hits)
- Telemetry events for channel-admin on `campaign/chat-admin` branch, not on `development`

**Critical independent finding:** ADR-0238 `<DomainChatOwnership>` component DOES NOT EXIST as a component — comment convention only. `/dashboard/komm/chat` lacks declaration. Silent dual-surface bug shipping now (Orb active + domain chat active simultaneously). L-0257 had flagged this as phantom-contract accumulator; council confirmed it as active UX bug.

**ADRs created:** ADR-0336, ADR-0337, ADR-0338, ADR-0339 (all proposed)
**Learnings created:** L-0276, L-0277, L-0278

**Phase 2.5 finding (L-0276):** Haiku fact-check reported 4 schema items VERIFIED MISSING; Supervisor sonnet caught all 4 as present under different names (`reply_to_id`, columns-on-channel, `channel_member_role` enum, `is_muted`+`muted_until`). Phase 2.5 prompt insufficient for concept-vs-name drift.

---

## 2026-05-17 — Tidslinjen Redesign (Post-Implementation R1)

**Type:** post-implementation
**Verdict:** **APPROVE — with mandatory P2 follow-up sub-sortie**
**Agents consulted:** system-steward (chair, opus), supervisor (opus), system-agent-coordinator (opus, Layer 2 + 4 code-trace), feature-dev:code-reviewer (sonnet, substitute for frontend-designer which is Skill-only)
**Prior verdict held?** Phase 3 APPROVE held — REFINED, not REVERSED. L-0147 2-reviewer threshold NOT met (1 reviewer with new evidence vs 3 holding APPROVE).
**Subject:** 3 commits on `campaign/ui-shell` (`ed3854d33` + `5a236d7d8` + `be0b43a4e`) + side-effect seed cleanup `94888a3f1`. Pushed to origin.

**Phase 2.5 fact-check:** READY-FOR-PHASE-3 with all 7 claims VERIFIED.

**Coverage discovery:** Phase 3 steward + supervisor + coordinator axes (cascade integrity, ADR compliance, telemetry routing, scope, payload-trace) all returned APPROVE. Design + a11y reviewer found 3 concrete defects orthogonal to those axes. **Phase 3 4-reviewer triplet systematically misses token-level design-system violations and a11y semantics.** Sibling of L-0147 (single-axis review insufficient) — different axis (design vs code-trace), same root.

**Chair provenance check (`git blame`):**
| Design finding | Provenance | Verdict |
|---|---|---|
| `TimelineTab.tsx:242` 3× OKLCH literals | `d0deaa6a9a` 2026-05-16 | **Pre-existing** — inherited debt, deferred to ADR-0361 migration sortie |
| `DayTimelineStrip.tsx:481` `animate-pulse` no rm-gate | `5a236d7d82` (sortie) | **Sortie-introduced** — fix in follow-up sub-sortie |
| `ClusterMarker.tsx:213` `focus-visible:outline-none` no ring | `be0b43a4eb` (sortie) | **Sortie-introduced** — fix in follow-up sub-sortie |

Steward also discovered OKLCH-literal pattern is systemic across 6+ files in `apps/web/src/components/day/` (SlotPicker, ApplyTemplateDialog, SavedTimelinesDropdown, SaveTemplateDialog all predate the sortie).

**Decisions:**
- Ship `94888a3f1` as-is on `campaign/ui-shell` (already pushed).
- Open sub-sortie `feat/ui-shell-ui-shell-tidslinjen-a11y-polish` for 2 sortie-introduced fixes (WCAG 2.3.3 + 2.4.11). Effort ~30 min. No new tests, no emit changes.
- Defer `TimelineTab.tsx:242` OKLCH literal to broader Nordic Split token migration sortie driven by ADR-0361.

**ADRs created:** ADR-0361 (proposed) Nordic Split OKLCH literal ban + ESLint rule `nordic-split/no-oklch-literal`. ADR-0363 (proposed) `getPhaseBoundaries` presentation-layer ontology disambiguation. Slots renumbered 0349→0361 and 0351→0363 per outsider-renumber convention (payroll kept 0347-0356 after merging to development first).

**Learnings created:** `learning_phase3_coverage_gap_design_axis` — Phase 3 multi-agent triplet (steward+supervisor+coord) systematically misses token + a11y semantics; mandate design+a11y reviewer when Phase 3 touches `apps/web/src/components/**` visual surfaces.

**Learning extended:** `learning_builder_agent_report_fabrication_2026_05_17` — Path A closure validated (4/4 APPROVE on shipped commits). R1 postscript adds: Phase 3 reviewers did not audit focus-ring tokens or reduced-motion gates; post-implementation council MUST include design+a11y axis distinct from ADR/cascade axis.

**Trust Gate:** SKIP. PR modifies no Server Actions, no TanStack mutations, no capability tools, no emit routing destinations. 3 new UI-only events added to existing posthog+logger routing per ADR-0134 canonical pattern. No trust surface change.

**Files touched in verification:**
- `apps/web/src/components/day/tabs/TimelineTab.tsx:242` (pre-existing debt)
- `apps/web/src/components/day/DayTimelineStrip.tsx:481` (sortie-introduced; fixed in this sub-sortie)
- `apps/web/src/components/day/ClusterMarker.tsx:211-214` (sortie-introduced; fixed in this sub-sortie)
- `apps/web/src/components/day/DayEventList.tsx:44` (canonical `useReducedMotion()` pattern mirrored)
- `packages/design-tokens/src/tokens.css:66-67, 201-202` (`--warn-soft` tokens for future migration)
- `apps/web/src/app/globals.css:358-362` (existing `prefers-reduced-motion` block — covers `animate-glow-pulse` only)

## 2026-05-17 PM — HMS Cluster Polish Read (Post-Implementation R1)

**Type:** post-implementation
**Branch reviewed:** `campaign/ui-shell` @ `430563d27` (sub-sortie `feat/ui-shell-hms-cluster-polish-read` already merged)
**Verdict:** APPROVE WITH CHANGES (3 BLOCKERS + 2 required-this-cluster)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, feature-dev:code-reviewer
**Prior verdict held?** N/A — first council on this sub-sortie. Predecessor: Tidslinjen R1 2026-05-17 AM verdict APPROVE held.

### Key decision

Forward-fix sub-sortie `feat/ui-shell-hms-cluster-polish-fixup` closes 5 gates:

- **G1 BLOCKER:** Wire `emit()` for 4 HMS view events (`hms.umbrella.viewed`, `hms.drift.viewed`, `hms.documents.opened`, `hms.training.viewed`). Registry shipped, call-sites missing — phantom contract (L-0176 sibling). Pattern: `useRef + useEffect + nonEmpty()` mirroring `apps/web/src/app/dashboard/contracts/page.tsx:71-88`.
- **G2 CRITICAL (WCAG 4.1.2):** `HmsSubNav.tsx` Path A — remove `role="tablist"` + `role="tab"`; keep `<nav>` + `<Link>` + `aria-current="page"`. Add focus-visible ring tokens (closes D2 in same hop). Previous G4 HIGH fix (commit `21e066252`) was incomplete — added `role="tab"` without `aria-selected`/`aria-controls`/`tabpanel`.
- **G3 MEDIUM (latent XSS + correctness):** Replace `dangerouslySetInnerHTML` in `LearnFlow.tsx:211` + `ProcedureDetailTabs.tsx:154` with `react-markdown` + `rehype-sanitize` + `remark-gfm`. Migration column comment says "Markdown supported" — current renderer interprets as HTML (intent mismatch + XSS vector). No authoring UI exists yet, so risk is LATENT not active; fix lands before first author UI ships. Severity downgraded HIGH→MEDIUM after write-path investigation showed zero existing data.
- **G4 LOW:** Add `/dashboard/hms/training` to `apps/web/.botsson/site-map.json` (5 hms routes registered, training missing). `tools: []` per HANDOFF Decision #3 L-0287 phantom-contract avoidance.
- **G5 META:** Amend `~/.claude/skills/run-council/SKILL.md:121-133` Phase 0 carve-out paragraph. Documented intentional tool-bridge skips on thin-shell delegating pages ACCEPTABLE; site-map + page header + telemetry view-emit NEVER skippable.

**Chair Self-Reversal (L-0147 6th precedent):** Phase 3 Steward marked HmsSubNav a11y "PARTIAL — focus-visible missing." Phase 5 REVERSED to CRITICAL after Code-Reviewer F-1 surfaced mixed-ARIA pattern (WCAG 4.1.2 fail — `role="tab"` without `aria-selected`/`aria-controls`/`tabpanel`). Falsifying evidence: `HmsSubNav.tsx:34,45,46`. Pattern signature: chair operates on focus-visible-axis Phase 3; reviewer code-traces same surface and finds worse defect. 2nd same-day occurrence of design+a11y Phase 3 coverage gap (1st: Tidslinjen R1 AM).

### Semantic conflict resolution

- **Pair A:** Steward "a11y PARTIAL" vs Code-Reviewer "CRITICAL HmsSubNav" — same surface, different defect, different severity. Two distinct findings. Steward review INCOMPLETE on a11y axis (focus-visible-only vs full ARIA pattern audit).
- **Pair B:** Supervisor "REJECT (Phase 0 BLOCKED on training)" vs Agent-Coord "Acceptable per HANDOFF Decision #3" — partial overlap. Both evidence-based. Rule-correct vs intent-correct. Resolved by G5 carve-out + ADR-0357.
- **Pair C:** Steward Phase 2.5 "site-map ZERO hms entries" vs reality (5 entries) — Steward grep used wrong scope-key pattern (`"scope": "hms.*"` instead of `"path": "/dashboard/hms.*"`). 2nd occurrence of grep-wrong-pattern fact-check failure. Promoted to learning.

### Knowledge captured

- **ADR-0357 (proposed)** — Page-Polish 8-Phase Rule: Documented Intentional Skips. File: `docs/decisions/0357-page-polish-documented-intentional-skips.md`. Codifies G5 at ADR-grade.
- **L-NEW-1** — `learning_telemetry_contract_without_emit_wiring.md` (Claude memory). Sibling L-0176 + L-0177. Trust-gate: grep `emit(` call-sites when reviewing `packages/telemetry/src/registry.ts` PRs.
- **L-NEW-2** — `learning_phase_2_5_grep_wrong_scope_key.md` (Claude memory). 2nd occurrence — ADR-grade rule: VERIFIED-missing requires positive absence-evidence + appropriate grep pattern.
- **L-NEW-3** — `learning_phase3_coverage_gap_design_axis.md` (Claude memory, existing — updated with 2nd occurrence). 2nd same-day occurrence: design+a11y axis mandatory. Already codified in run-council SKILL.md:105-119 after Tidslinjen R1; this confirms the rule.

### Trust Gate

N/A — sub-sortie introduces 0 new mutation tools / 0 Server Actions / 0 TanStack mutations / 0 capability tools / 0 new emit routing destinations. Read-side telemetry event registrations only.

### Phase 9 self-improvement

- **Fact-check methodology hard rule** (promote to SKILL.md Common Mistakes after 3rd occurrence): VERIFIED-missing requires positive schema-aware absence-evidence, not negative literal-string grep absence. 1st: chat-whatsapp 2026-05-16; 2nd: HMS R1 2026-05-17. Watch for 3rd → promote.
- **Design+a11y axis 2nd same-day occurrence** confirms the rule added in run-council SKILL.md:105-119 earlier this session is correctly scoped. No further amendment needed.
- **Page-polish Phase 0 strictness vs cascade intent** resolved via G5 carve-out + ADR-0357. First exercise of the rule; future councils will test it.

### Files referenced (Phase 5 synthesis evidence)

- `apps/web/src/app/dashboard/hms/_components/HmsSubNav.tsx:34,45,46` (G2 ARIA)
- `apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx:210-211` (G3 XSS)
- `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx:148-154` (G3 XSS — pre-existing)
- `apps/web/.botsson/site-map.json:494-825` (G4 — 5 hms entries present, training missing)
- `packages/telemetry/src/registry.ts:2598-2638, 13723-13738` (G1 — 4 events registered, 0 emits)
- `supabase/migrations/20260422300800_hms_procedure_step_training.sql:9` (column comment "Markdown supported")
- `docs/HANDOFF-ui-shell-hms-cluster-polish-read.md` line 70 (Decision #3 L-0287)


## 2026-05-17 PM2 — HMS Cluster Polish R2 verification (Post-Implementation R2)

**Type:** post-implementation, R2 round
**Branch reviewed:** `campaign/ui-shell` @ `9747dba59` (after fixup `ac17ca61e` + SlotPicker refactor)
**Verdict:** APPROVE WITH CHANGES (3 BLOCKERs + 1 maintenance after B2 retraction)
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, feature-dev:code-reviewer
**Prior verdict held?** R1 (2026-05-17 PM) verdict mostly HELD — G1+G2+G3+G5 + capability surface unchanged. G4 DRIFTED on data side (validator caught purpose >140 chars).

### Key decision

Forward-fix sub-sortie `feat/ui-shell-hms-cluster-polish-r2-fixup` closes 3 BLOCKERs + 1 maintenance + 1 retracted:

- **B1 (mechanical):** Trim site-map.json `routes[17].purpose` 165 → 130 chars. Validator was exit=1 with `✗ purpose >140 chars (165) — tighten`; post-fix exit=0.
- **B3 (CRITICAL, WCAG 2.4.11):** Add focus-visible ring tokens to `ProcedureDetailTabs.tsx:106` tab buttons + replace `transition-all` with `transition-colors` (Nordic Split §10.4). Single template covers 4 tab buttons via `.map()`.
- **B4 (CRITICAL, WCAG 2.4.11):** Same fix pattern at `LearnFlow.tsx:79` stage-progress buttons. Covers 5 stage buttons.
- **B5 (maintenance):** Update predecessor HANDOFF Known Issue #3 — animate-spin count `6` → `297 across 180+ files`. Sortie 4 scope reframed as dashboard-wide convention shift.
- **B2 RETRACTED:** R2 chair Phase 5 claimed validator "self-bug — prints ✗ then exits 0." Orchestrator verified with full output + exit code: validator exits 1 correctly. Chair adopted Agent-coord's head-truncated-output misread. Sibling trap class to L-NEW-2 (Phase 2.5 wrong-scope-key). Captured as `learning_head_truncated_output_false_negative.md`.

**Chair Self-Reversal — REFINED (L-0147 7th-class precedent):** Phase 3 Steward verdict G4 "HELD CLOSED" on structural check; Phase 5 REFINED to "DRIFTED in data; validator self-bug masks" after Agent-coord code-trace. But Phase 5 chair claim itself was based on truncated reviewer output — orchestrator re-verified and retracted the "self-bug" portion while keeping the data-DRIFT portion (purpose >140 chars is real). Net: G4 was DRIFTED (data), not validator-bug (process-integrity); chair self-corrected mid-Phase-6 (after user "1" decision).

### R1 → R2 gate closure

| Gate | R1 verdict | R2 verdict | R2 evidence |
|---|---|---|---|
| G1 emit() | HELD | HELD | 4 emit() call-sites verified by chair end-to-end trace through DashboardContext + L-0177 nonEmpty guard |
| G2 HmsSubNav Path A | HELD | HELD | Canonical Path A clean; zero ARIA debris |
| G3 react-markdown | HELD | HELD | Both render sites + data-source hook unchanged |
| G4 site-map | DRIFTED | DRIFTED-MECHANICAL | Purpose 165 chars > 140 cap — closed by B1 trim |
| G5 ADR-0357 + skill | HELD with minor drift | HELD WITH ADDENDUM | v2 page-header inheritance carve-out added to ADR-0357 |
| Capability surface | UNTOUCHED | UNTOUCHED | Zero `packages/ai/`, zero `services/stage-engine/` |

### Semantic conflict resolution

- **Steward "G4 HELD" vs Agent-coord "G4 DRIFTED":** Both partial-true. Data IS out-of-spec (165 > 140), validator DOES exit 1 (Phase 5 chair claim "exits 0" was wrong). DRIFTED-data + validator-correct = real fix needed (B1) but not via validator change.
- **Supervisor "Phase 6 training PARTIAL" vs Steward/Code-Reviewer "Phase 6 PASS":** Supervisor's strict carve-out reading correct on page-file ownership; ADR-0357 v1 didn't anticipate inheritance pattern. Resolution: v2 addendum codifies inheritance pattern; training route PARTIAL → ACCEPTABLE-under-v2.
- **Code-Reviewer "F-2 = 20 occurrences" vs chair "F-2 = 297 occurrences":** Code-Reviewer grep scope was HMS-only; chair grep was dashboard-wide. Same finding, different scope. Truth: 297 is dashboard-wide (correct count for D1 deferral scope).
- **Validator "self-bug" claim (Phase 5 chair) vs orchestrator re-verification:** Phase 5 wrong. Orchestrator captured full output + exit code, validator works. B2 retracted. Promoted to L-NEW-C.

### NEW IMPORTANT findings (pre-existing, deferred Sortie 4)

- **NEW-3 hardcoded Tailwind palette** in TaskCard, SessionSignoffDrawer, OversiktDashboard, OversiktEmployee — 18+ classes
- **NC-1 ProcedureDetailTabs `<Tabs>` vs custom `<button>` consistency** — sibling to B3 fix
- **NIT i18n hardcoded label** ProcedureDetailTabs.tsx:153 (`"Opplaeringsinnhold:"` — also typo, should be "Opplæringsinnhold")

### Knowledge captured

- **ADR-0357 v2 addendum (proposed)** — Page-Header Inheritance Carve-Out for thin-shell delegating pages. Appended to existing file `docs/decisions/0357-page-polish-documented-intentional-skips.md`. Promote to accepted after 2nd independent council exercise.
- **L-NEW-C** — `learning_head_truncated_output_false_negative.md` (Claude memory). 3rd occurrence of output-shaping-misread family (sibling L-NEW-2 Phase 2.5 wrong-scope-key, L-diff-hunk-misled-review). **Threshold met for SKILL.md promotion.**

### Trust Gate

N/A — sub-sortie introduces 0 mutation tools, 0 Server Actions, 0 capability changes, 0 telemetry routing changes. Read-side + UX-polish only.

### Phase 9 self-improvement

- **Promote L-NEW-C to run-council SKILL.md Common Mistakes table:** "Reviewer reports script/validator verdict from truncated output. Always capture full stdout/stderr + explicit exit code." 3rd occurrence threshold met (chat-whatsapp 2026-05-16, HMS R1 2026-05-17 PM, HMS R2 2026-05-17 PM2).
- **Phase 5 chair re-verification step:** for any reviewer claim about validator/script output, chair MUST re-run before adopting into final verdict. Adds ~30 seconds, prevents B2-class false blockers.

### Files referenced

- `apps/web/.botsson/site-map.json:856` (B1)
- `apps/web/scripts/validate-site-map.ts:236-244` (B2 retract — exit code paths verified correct)
- `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx:106` (B3)
- `apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx:79` (B4)
- `docs/HANDOFF-ui-shell-hms-cluster-polish-fixup.md` Known Issue #3 (B5)
- `docs/decisions/0357-page-polish-documented-intentional-skips.md` (v2 addendum)

---

## 2026-05-17 PM3 — campaign/ui-shell Shippability R1

**Type:** post-implementation (campaign promotion gate)
**Verdict:** REJECT — REMEDIATE BEFORE HOP A
**Agents consulted:** system-steward (chair), supervisor, system-agent-coordinator, botsson-harness-builder, feature-dev:code-reviewer + general-purpose (Phase 2.5 fact-check) + narrator (Phase 4)
**Prior verdict held?** N/A — first council on campaign tip; HMS R1 + R2 + Tidslinjen R1 are sub-sortie councils, not campaign-level
**Key decision:** 3 hard blockers (B1 migrations × 2 + IF NOT EXISTS, B2 phantom telemetry × 2) + 4 required-before-promote (J3-J5) + governance gate on tri-campaign scope (world-best-wfm + mobile merged into ui-shell tip)
**Chair self-reversals (L-0147):** 4 — phantom contract (telemetry-contract pipeline), tri-campaign scope drift (merge-ancestry), WCAG 4.1.2 ProcedureDetailTabs, ADR-0349 toothless. 7th per-component L-0147 precedent (component-level ARIA repeats HMS R1 HmsSubNav defect class).
**ADR created:** ADR-0358 (telemetry-registry-requires-emit-wiring, L-NEW-1 2nd occurrence promoted)
**Learnings created:** L-0301 (7th-L-0147-component-ARIA), L-0302 (chair-self-reversal-4-pattern), L-0303 (ADR-to-enforcement-code-receipt-rule)
**Fixup sortie:** feat/ui-shell-r1-fixup (this sortie)

### Blockers identified

| ID | Severity | Description | Status |
|---|---|---|---|
| B1a | HARD | `supabase/migrations/20260514120001_ui_shell_hms_cluster_deviation_event.sql` — missing `IF NOT EXISTS` guards on `CREATE TYPE` + `CREATE TABLE` — not idempotent | Closed by T1 (feat/ui-shell-r1-fixup) |
| B1b | HARD | `supabase/migrations/20260514120002_ui_shell_hms_cluster_handbook_event.sql` — same pattern | Closed by T1 |
| B2 | HARD | `deviation_viewed` + `handbook_chapter_opened` registered in `packages/telemetry/src/registry.ts` — 0 emit() call-sites in `apps/` | Closed by T2 (feat/ui-shell-r1-fixup) |

### Required-before-promote

| ID | Description | Status |
|---|---|---|
| J3 | `/help` Tier 1 polish baseline — page-header + instructions pass smartout-page-polish Phase 6-8 | Addressed by T3 |
| J4 | WCAG a11y fixes — `ProcedureDetailTabs.tsx:98-117` mixed-ARIA pattern + `HmsSubNav` any residual | Addressed by T4 |
| J5 | i18n migration `ProcedureDetailTabs` — hardcoded Norwegian text `"Opplaeringsinnhold:"` (typo) → i18n key | Addressed by T5 |

### Governance question (user-resolved)

Tri-campaign aggregation: campaign/world-best-wfm (31 unique commits) + campaign/mobile (23 unique commits) merged into campaign/ui-shell tip. User confirmed this is intentional — ui-shell is the integration campaign for the promotion wave. No governance block.

### Knowledge captured

- ADR-0358 (proposed) — telemetry-registry-requires-emit-wiring. L-NEW-1 2nd occurrence → ADR-grade promotion threshold met.
- L-0301 — 7th L-0147 component-level ARIA precedent (ProcedureDetailTabs)
- L-0302 — 4 chair self-reversals in single council — Phase 3 blind spots pattern
- L-0303 — ADR-to-enforcement-code receipt rule (toothless ADR class)
- run-council SKILL.md amended: 3 new Phase 3 checks (telemetry-contract, merge-ancestry, ADR-to-enforcement)
- ADR-0238 flipped to accepted (enforcement shipped via ADR-0337 + DomainChatOwnership implementation 2026-05-16)

## 2026-05-17 — Phase 7 Architectural Reframe: Lovdata as Riksavtalen Canonical
**Prior verdict held?** N/A (first council on this topic)
**Reviewers:** system-steward (chair), system-agent-coordinator, supervisor, lovsen
**Verdict:** APPROVE WITH CHANGES + 5-blocker trust gate. Steward Phase 3 self-reversal on Q2 (no new schema field per Coordinator code-trace).
**Key decisions:** Lovdata MCP becomes Riksavtalen canonical (ADR-0347); two-hash model supersedes ADR-0341 §H single-hash (ADR-0348); paragraph-ref translation map at docs/reference/ (ADR-0349); NHO MCP repurposed as employer-interpretive auxiliary; 358 already-cert'd cells re-cert in Phase 7c (dual-lineage transition).
**ADR created:** ADR-0347, ADR-0348, ADR-0349 (proposed). ADR-0342 amended.
**Blockers tracked:** 5 (live curl proof, lovsen rate verify, ADR map review, lovdata-mcp envvar canonicalization, verify_citation_freshness mirror).
**Full audit:** docs/audits/2026-05-17-phase-7-lovdata-reframe-council.md

## 2026-05-17 — Dynamic-MCP-Fetch Architectural Pivot (Phase 7 reframe round 2)
**Type:** architecture (pre-implementation, MAJOR pivot)
**Prior verdict held?** PARTIAL — 2026-05-17 (earlier today) Phase 7 reframe ADRs 0347/0348/0349 SURVIVE; cert-pass model SUPERSEDED.
**Reviewers:** system-steward (chair), system-agent-coordinator, supervisor, lovsen, botsson-harness-builder (5)
**Verdict:** APPROVE WITH CHANGES + DEGRADED-MODE during foundations. Q1=(c) workspace-bootstrap dynamic with materialized snapshot; (b) per-calc fetch REJECTED.
**Chair self-reversals:** 6th L-0147 precedent — (1) ADR-0250 misread (Skatteetaten DEFERRED not workspace-tariff); (2) source-priority — NHO cirkulær official_effective_date PRIMARY, Lovdata verbatim SECONDARY.
**Key decisions:** Q1=(c) chosen. New capability tools `setup_workspace_tariff` + `change_workspace_tariff` + `add_supplement_override` (last gated on policy ADR). 5 new ADRs in Phase 7d. 4 amendments to ADR-0341/0342/0348/0349.
**Cell count corrected:** 895 cert + 182 PENDING (briefing 358+716 stale by 2 days).
**ADR created:** 0350 (bridge), 0351 (floor), 0352 (derive MCP), 0353 (binding lifecycle), 0354 (freshness ops) — all proposed.
**Learnings created:** L-0289, L-0290, L-0291 (see audit doc).
**Blockers tracked:** 3 hottest — bridge ADR delay (HIGH), override floor missing (MEDIUM), is_tariff_bound ownership leak (MEDIUM).
**Full audit:** docs/audits/2026-05-17-dynamic-mcp-fetch-pivot-council.md

## 2026-05-17 — Phase 7d-followup Schema Migration Scope (post-implementation code-trace of ADRs 0350–0354)
**Type:** plan + schema-locking ADR validation (Phase 3 Hard Rules per ADR-0341 council precedent 2026-05-16)
**Prior verdict held?** PARTIAL REVERSAL — earlier today Phase 7d council ratified ADRs 0350–0354 on prose. First code-trace of those ADRs found 5 falsifications. ADR-0353 §A, ADR-0353 §D, ADR-0351 Option C all APPROVED → REVERSED.
**Reviewers:** system-steward (chair), supervisor, system-agent-coordinator, general-purpose+payroll-engine-developer skill, general-purpose+smartout-database-guide skill — 5 reviewers, no degraded mode.
**Verdict:** APPROVE WITH CHANGES + 11 blocking conditions.
**Chair self-reversals (7th L-0147 precedent):**
1. Gap 4 (`is_tariff_bound` vs `active_union_id`): Phase 3 Option (a) derive → Phase 5 Option (b) keep-both-with-trigger. Falsifying evidence: payroll-tracer cited `golden-month.test.ts:81` + `evaluate-supplements.ts:328` + `deviation-checks.ts:458,476,501` + fixture `input/workspace_settings.json`. Classification: REVERSED.
2. Gap 5 (`tariff_snapshot` schema): Phase 3 `public` → Phase 5 `payroll`. Falsifying evidence: payroll-tracer namespace-ownership argument (zero non-payroll consumers; cross-namespace FK ambiguity). Classification: REVERSED.
**Key findings (file:line evidence in agent outputs):**
- `workspace_framework_binding` already exists with cascade D3 shape (`framework_id` FK, `is_active`, auto-seed trigger to `hospitality.no.default.v1`), 8 consumers, 2 dependent FKs. ADR-0353 §A net-new CREATE TABLE conflicts.
- ADR-0351 Option C CHECK constraint is structurally invalid PostgreSQL (cross-table subquery forbidden). TRIGGER required.
- `shift_pay_calculation_event.tariff_binding_id` does NOT exist (4 reviewers explicit). ADR-0353 §D claim fabricated.
- `REFERENCES workspace(id)` in ADR-0353 pseudo-SQL is wrong (real PK is `workspace_id`).
- ADR-0173 frozen-4 violation: payroll capability cross-namespace writes to `public.workspace_union_binding` need delegation pattern (mirrors ADR-0240 journey_authoring fix).
**Key decision (sortie split):**
- Sortie 1: ADR amendments only (no migration code). Writes ADR-0355 + ADR-0356, amends ADR-0353 §A+§D + ADR-0351 Option C, writes L-0292/0293/0294, promotes L-0147 from advisory to SKILL.md hard rule.
- Sortie 2: Migration sortie. New `public.workspace_union_binding` + `payroll.tariff_snapshot` + columns + cache trigger + tariff-floor TRIGGER + `shift_pay_calculation_event.tariff_binding_id` column. Timestamp ≥ `20260618000000`. Golden-month fixture update + determinism re-run.
- Sortie 3: Delegation tools (`cascade.bind_workspace_union` + `cascade.add_supplement_rule`) per ADR-0356. Blocks Phase 7f.
**Phase 7f Agent Trust Gate:** All 3 proposed tools (`setup_workspace_tariff`, `change_workspace_tariff`, `add_supplement_override`) FAIL — blocked on Sortie 3 delegation tools per ADR-0173.
**ADRs to write (slots reserved):** ADR-0355 (workspace_union_binding + cache trigger), ADR-0356 (cascade-namespace delegation pattern).
**ADRs to amend:** ADR-0353 §A + §D, ADR-0351 Option C.
**Learnings to log:** L-0292 (pre-council schema-reality-check pattern), L-0293 (denormalized cache + canonical lifecycle), L-0294 (7th L-0147 precedent + SKILL.md promotion).
**Phase 2.5 fact-check:** 12/12 claims VERIFIED + bonus finding (`tariff_binding_id` column doesn't exist) confirmed false. Briefing was structurally accurate.
**Process improvement:** Pre-council schema-reality-check (read 5 most-cited tables/columns before Phase 2 dispatch) saved this council from at least 5 false-premised ADR claims surviving Phase 3.

## 2026-05-17 — `pnpm ci:local` coverage-check + self-learning loop
**Type:** feature (CI infrastructure + skill enforcement)
**Verdict:** REJECT IN CURRENT FORM → v2 (chair self-reversal precedent #10)
**Agents consulted:** system-steward (chair), supervisor (code-trace), system-agent-coordinator (hook contract)
**Prior verdict held?** n/a — first council on ci:local infrastructure
**Key decision:** Add `coverage-check` (diff-aware path→gate enforcement, 24 rows longest-prefix-wins) + `learning-cross-check` (greps script for 6 captured-learning encodings) + `baseline-check` + `self-learn-write` (JSONL run log + outlier detection). Plus PreToolUse Bash hook at `~/.claude/scripts/pre-gh-pr-create.sh` blocking `gh pr create` unless `.git/.ci-local-green-<HEAD_SHA>` marker exists. Three bypass envs documented.
**ADR created:** ADR-0359 (Enforced CI Coverage Mandate and Self-Learning Loop)
**Learning created:** L-0298 (ci:local mapping fidelity is only caught by code-trace)
**Phase 2.5 fact-check:** skipped (small surface, files recent; risk accepted)
**Process improvement:** Supervisor code-trace caught 9 missing path classes + 3 false mapping claims that Steward concept-review approved. L-0147 family 4th instance. Future: any topic proposing a mapping/coverage table must assign a code-tracer reviewer the explicit "open the source files, verify each row" task. Add this to run-council Phase 3 Hard Rules if pattern recurs once more.
