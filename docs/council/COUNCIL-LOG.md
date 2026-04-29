---
title: Council Session Log
status: live
updated: 2026-04-27
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
| 2026-04-29 | Lovsen Hospitality Intelligence Member integration (post-council follow-up) | architecture + spec | **REJECT AS SPECIFIED — REDESIGN AS `legal` CAPABILITY** (not agent); 10 lov-amendments folded into ADR-0233/0234/0236 | lovsen (general-purpose persona — norsk arbeidsrett review HØY/MEDIUM/LAV confidence per substansiell påstand, 5 lov-traps + 7 ESKALÉR-flagg arbeidsrettsadvokat-review), system-steward (chair — verified peer agents Skiftleggeren/Vertinnen/Vinkjenneren do NOT exist via grep, ADR-0220 violation, Lovsen IS capability not agent, knowledge base belongs in K1a regulatory_framework not filesystem) | Yes — 2026-04-29 Contract Module Phase 0a council REJECT verdict held; Lovsen integration extends 4-ADR split with norsk arbeidsrett amendments + 1 new learning. | ADR-0233 amended (10 schema additions: trial_period_paused fields, dynamic notice_period, holiday_allowance Riksavtalen-binding, minimum_guaranteed_amount, apprentice blocker, exit_certificate gap, regnskapsår_slutt retention, Aml. §10-6 femte ledd 2024-revisjon, tip reporting code disambig, A-melding missing codes). ADR-0234 amended (GDPR Art. 9 trade_union_* explicit basis, `legal` capability third sibling with per-tool channels, knowledge base K1a not filesystem, Phase 0c implementation). ADR-0236 amended (is_constructive_dismissal_risk Aml. §15-7, PDF-preview obligatorisk Aml. §14-5, regnskapsår_slutt retention Bokføringsloven §13). NEW `docs/architecture/contract-service/CAPABILITY-legal.md` (3 tools: validate_aml_14_6 chat / cite_law chat+voice / classify_amendment server-only). | L-0175 NEW (persona vocabulary doesn't justify agent architecture — Lovsen/Skiftleggeren/Vertinnen/Vinkjenneren = user-facing branding for capability outputs, not separate runtimes; verified peer agents zero hits in grep; pattern signature: spec proposes filesystem `agents/<name>/skills/`, lists peer agents not in code, parallel knowledge base outside cascade K1a/K1b). **Phase 2.5 fact-check addition:** when council briefing proposes new agent, fact-checker MUST grep for proposed peer agents + verify implementation status before Phase 3 dispatch. **Trust Gate impact:** Lovsen does NOT change council REJECT verdict; 4-ADR split holds; Lovsen consumes Phase 0a output as Phase 0c capability. **Lovsen lov-traps (HØY confidence):** prøvetid-pause manglende, oppsigelsesfrist statisk default 1, holiday_allowance feil for hospitality-tariff, apprentice uten Opplæringslov-sperre, fagforeningsdata GDPR Art. 9. User approved verdict 2026-04-29. |
| 2026-04-29 | Contract Module Phase 0a Foundation (ADR-0001-contract-service + ARCHITECTURE-contracts-module + 0001_contracts_module_foundation.sql 525 lines atomic) | architecture + migration | **REJECT — DO NOT DEPLOY** (direction approved-with-major-changes; split into 4 globally-registered ADRs) | system-steward (chair, Phase 3 + Phase 5), supervisor (Layer 3 trigger/constraint code-tracer), system-agent-coordinator (Layer 2+4 capability-consumer trace), botsson-harness-builder (L4 cross-cutting laws), frontend-designer (UX), narrator (orchestrator inline) + general-purpose (Phase 2.5 fact-check, 18 claims: 13 VERIFIED, 2 FALSE, 3 UNVERIFIABLE) | n/a — first council on contract foundation. Multiple prior contract councils (2026-04-07 composition engine, 2026-04-22 hub redesign) held but ADR-0001-contract-service introduced new D1/D2/D3 decisions not previously reviewed. | ADR-0233 NEW (Contract Schema Migration Foundation — supersedes module-local ADR-0001-contract-service; FK column corrections, ALTER TYPE additive enum migration, denorm workspace_id, RLS, trigger SECURITY DEFINER, ON CONFLICT idempotency), ADR-0234 NEW (Contract / Payroll Capability Split — resurrects dead `payroll` enum value for Høy-PII tools; server-only handlers via `gate_action channel='system'`), ADR-0235 NEW (Obligation Lifecycle — drops `field_classification_metadata` table; TS const classification; SECURITY DEFINER + start_date cascade trigger), ADR-0236 NEW (Amendment Flow + AcknowledgementRing — `requires_employee_signature` boolean; per-framework configurable blocks + audit emit; WCAG AAA for §14-6 legal evidence; ContractAmendmentDiff + TariffBadge components). All 4 status `proposed`. Module-local ADR-0001-contract-service marked superseded. | L-0169 (capability registry co-migration trap — ADR-0192 `capability_default_registry` tuple required in same PR as new capability), L-0170 (role enum assumption trap — `payroll_admin` doesn't exist; 3rd chair-self-reversal precedent; promote L-0147 to SKILL.md hard rule), L-0171 (`status` rename blast radius — single most-renamed column; ALTER TYPE ADD VALUE always preferred), L-0172 (trigger SECURITY mode = silent RLS bypass vector; default INVOKER + cross-table SELECT under RLS = silent NULL), L-0173 (DB classification table anti-pattern — TS const + branded type preferred), L-0174 (UX compose vs author verb collision — cascade verb separation: people-page authors, drawer dispatches). **Semantic conflict resolution**: 11 reviewer-pair claims classified. No load-bearing reviewer disagreements. One Steward Phase 3 finding REVERSED (payroll_admin assumption). **Agent Trust Gate**: FAIL — 6 pipelines cannot keep promise. **Phase mapping**: A1 close → 0a-pre (motion-token-sweep + spec amendments) → B6 schema migration (ADR-0233) → B7 capabilities (ADR-0234) → B8 integrations (ADR-0235 + ADR-0236). User approved verdict 2026-04-29. |
| 2026-04-27 | Campaign-PR merge strategy (squash vs merge-commit) | architecture (process + ops) | **APPROVE WITH CHANGES** — Option A (merge-commit at campaign-PR step). Trust Gate PASS for core; CONDITIONAL for reset of existing campaigns. | system-steward (chair, Phase 3 + Phase 5), supervisor (codebase-convention + scope) + general-purpose (Phase 2.5 fact-check, 1 PARTIAL FALSE caught: PR #259 was merge-commit not squash). Skipped: system-agent-coordinator (no AI-system implications), botsson-harness-builder (no L1-L5 pipe), frontend-designer (no UI). 2/5 reviewers — NOT DEGRADED, skips justified by pure-git-workflow scope. | n/a — first council on git merge strategy. ADR-0075 release-flow + CLAUDE.md Git Workflow section silent on squash-vs-merge-commit. | ADR-0213 NEW (`campaign/* → development` PRs MUST merge-commit, never squash; sortie/sub-sortie unchanged; zero tooling change since `close-feature.sh` already uses `--no-ff` locally; GitHub repo settings: disable squash repo-wide + branch protection on `campaign/*` disallowing force-push) | L-0142 (squash-merge erodes ADR falsifiability for multi-phase work — same class as L-0094 phantom emit contracts; 3 observed instances on smartout.ai), L-0143 (pattern claims should be quantified not generalized — Phase 2.5 caught "all squash" was actually dominant-but-not-universal; promotion candidate, 1st occurrence). **Semantic conflict resolution (3 pairs)**: (A) "Pattern is everywhere" vs "Pattern is inconsistent" — DIFFERENT, Supervisor wins on PR #259 evidence; ADR text says "dominant" not "universal". (B) "CLAUDE.md silence is load-bearing" vs "ONE-line rule fix" — SAME concern, complementary framing. (C) "Reset for clean baseline" vs "0 script changes" — DIFFERENT layers (data op vs tooling); reset deferred as separate decision. **Agent Trust Gate**: PASS for core verdict (no new tools, existing merge-commit promise extended); CONDITIONAL for reset (3 conditions: zero active sub-sorties, pre-reset SHA tagged for forensics, Pontus runs not Claude). **Implementation 8 steps**: ADR-0213 written + L-0142 + L-0143 + CLAUDE.md hard-rule + GitHub repo setting (disable squash repo-wide) + GitHub branch protection on campaign/* + close-feature.sh ADR-pointer comment + this council-log entry. **Reset of year-wheel +3538 / botsson-arena +22 deferred** pending `git log --first-parent` analysis to determine real-work vs squash-noise. **GitHub UI changes require Pontus** (cannot be automated by Claude). Pre-existing campaign divergence accepted as historical until reset decision. User approved verdict. |
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
