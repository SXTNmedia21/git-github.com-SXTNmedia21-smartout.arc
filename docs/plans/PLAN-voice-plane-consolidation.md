---
title: "Plan — voice-plane-consolidation (sub-sortie)"
feature: voice-plane-consolidation
spec: docs/superpowers/specs/2026-05-04-voice-plane-consolidation.md
status: draft
updated: 2026-05-04
created: 2026-05-04
module: MODULE_BOTSSON
campaign: botsson-arena
phase: E
adr: ADR_0282
council_verdict: "APPROVE WITH CHANGES — 12 amendments applied"
tags: [plan, livekit, ultravox, voice, voice-agent, consolidation]
---

# Plan — voice-plane-consolidation

> Branch: `feat/botsson-arena-voice-plane-consolidation` | Worktree: `/home/sxtnl/dev/smartout.ai-botsson-arena-wt-2` | Base: `campaign/botsson-arena` | Module: MODULE_BOTSSON | Started: 2026-05-04
> Sub-sortie of campaign/botsson-arena Phase E
> Estimate: 5-8 days
> Owner: harness-builder + agent-coordinator (verification)

**Spec:** [Voice Plane Consolidation](../superpowers/specs/2026-05-04-voice-plane-consolidation.md)
**Decision:** [ADR-0282](../decisions/0282-voice-plane-consolidation-livekit-only.md) (proposed, council-approved with changes 2026-05-04)
**Master plan:** `docs/plans/PLAN-voice-plane-consolidation.md` at campaign root — referenced for sub-sortie context

## Journeys (the contract)

- [JOURNEY-voice-plane-consolidation-wizard-onboarding-via-livekit](../journeys/JOURNEY-voice-plane-consolidation-wizard-onboarding-via-livekit.md) — Wizard onboarding voice flow runs on LiveKit single-plane via voice-agent
- [JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit](../journeys/JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit.md) — Web Botsson overlay voice routes through voice-agent (BFF→stage-engine→/agent/chat)
- [JOURNEY-voice-plane-consolidation-lise-interview-livekit](../journeys/JOURNEY-voice-plane-consolidation-lise-interview-livekit.md) — Lise interview component preserves persona on LiveKit InterviewSurface
- [JOURNEY-voice-plane-consolidation-pii-guard-uniform-web-mobile](../journeys/JOURNEY-voice-plane-consolidation-pii-guard-uniform-web-mobile.md) — PII channel guard 3-layer fires identically on web + mobile
- [JOURNEY-voice-plane-consolidation-krisp-nc-kitchen-noise](../journeys/JOURNEY-voice-plane-consolidation-krisp-nc-kitchen-noise.md) — Krisp NC client-side reduces kitchen noise; voice-agent NC-off verified

## Goal

Single voice plane via LiveKit Agents 1.3.0 across web + mobile. Ultravox removed. Per ADR-0275 R1 amendment.

## Acceptance Criteria (ADR-0282 R6 corrected)

1. `grep -r "ultravox" apps/web/src packages/agent-sdk/src services/stage-engine/src` returns zero hits (excluding `docs/`, comments referencing historical state, and migrations).
2. `apps/web/package.json` no longer lists `ultravox-client`.
3. `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` line previously hardcoded `provider: "ultravox"` now uses `provider: "livekit"` (or removes provider field entirely if VoiceProvider abstraction defaults).
4. Wizard onboarding voice flow (`/onboarding`) creates LiveKit room via `supabase/functions/livekit-token/` and connects to `services/voice-agent/`.
5. All 14 `useBotsson.ts` `temporaryTool` definitions accounted for (CORRECTED post-council 2026-05-04 phantom-trace):
   - 7 NEW capability tools/bridges: `update_business`, `update_season`, `add_departments`, `add_locations`, `add_zones`, `add_procedures`, `scrape_website`
   - 1 NEW BFF route: `/api/emma/session` (`getOnboardingState`)
   - 2 REUSE-VIA-BRIDGE: `searchCompany`, `identifyCompany` (existing `INTELLIGENCE_TOOLS` in `tools/intelligence/index.ts:74`, need standalone exposure)
   - 1 ALIAS-TO-EXISTING: `add_key_fact` → `memory.save_memory` (LLM emits alias, server resolves)
   - 2 REUSE: `saveMemory` direct, `finalizeOnboarding` partial-bridge
   - 1 STAYS-CLIENT: `advanceToNextSection`
   - Total: 8-9 net-new + ~4 reuse + 1 client-only = 14 ✓
   - Original ADR-0282 R4 "7 reuse" overstated by 3-4 — phantom-trace (L-0176 hard rule body-trace) falsified `update_season`, `add_procedures`, `scrape_website` reuse claims
6. `services/stage-engine/src/routes/adapters/ultravox.ts` deleted.
7. `packages/agent-sdk/src/providers/ultravox.ts` deleted.
8. Krisp NC active on web local participant (`@livekit/krisp-noise-filter`) and mobile local participant (`@livekit/react-native-krisp-noise-filter`); `services/voice-agent/src/agent.ts` does NOT enable NC.
9. Golden-transcript eval (ADR-0073) green on LiveKit single-plane.
10. Channel guard 3-layer verification: voice + PII intent → tool-selector filters PII capability → `gate_action(p_channel='voice')` denies → tool-body returns ADR-0078 redirect message. All three layers fire on web LiveKit path identical to mobile path.

## Tasks (sub-sortie tracks, ADR-0282 R6 — independently revertable until E6)

### Track 1 — Capability Build (E1)

- [ ] **T1.1** Build new `onboarding` capability skeleton: `packages/ai/src/capabilities/onboarding/{index.ts,tools.ts,gate.ts}` (template: `business-intelligence` capability per ADR-0270)
- [ ] **T1.2** Add `"onboarding"` to `CapabilityName` union (`types.ts:7-69`)
- [ ] **T1.3** Register in `packages/ai/src/capabilities/registry.ts`
- [ ] **T1.4** Add `onboarding` to `intent-classifier.ts` z.enum() AND system prompt (lines 143-183) bullet with example phrases
- [ ] **T1.5** Authority seed migration `supabase/migrations/<timestamp>_onboarding_capability_authority_seed.sql` (timestamp > dev HEAD max per L-0042)
- [ ] **T1.6** Implement 7 NEW tools (Option A per cascade-developer FAIL verdict 2026-05-04):
  - `update_business`, `update_season`, `add_procedures`: real DB-writing tools with `gate_action` + `emit()`
  - `scrape_website`: BFF-callable read-only bridge to Python droplet `/api/workspace-intelligence`
  - `add_departments`, `add_locations`, `add_zones`: **IN-MEMORY wizard state mutations only** (mirror `apps/web/src/app/onboarding/steps/tools/departments-tools.ts:35` + `locations-tools.ts:55-118` `updateState` pattern). NO `cascade_gate_write`. NO DB writes. Single cascade-write remains `finalize-workspace`. Per ADR-0282 R4 corrected.
- [ ] **T1.7** Implement 2 REUSE-VIA-BRIDGE tools: `searchCompany`, `identifyCompany` (wrap `INTELLIGENCE_TOOLS`)
- [ ] **T1.8** Implement `add_key_fact` ALIAS to `memory.save_memory` (Path A — alias resolution server-side, content-level PII gate via Zod refinement)
- [ ] **T1.9** Register new event names in `packages/telemetry/src/registry.ts` BEFORE first emit() (per L-0184)
- [ ] **T1.10** Per-tool body-trace verification (NOT docstring per L-0176) — gate_action / cascade_gate_write / emit() present

### Track 2 — BFF + Wizard Flip (E2-E3, E5)

- [ ] **T2.1** New `apps/web/src/app/api/emma/session/route.ts` GET handler — derives workspace from session cookie, queries `engine_sessions` mode='agent' process_id='onboarding_v1'
- [ ] **T2.2** `BotssonProvider.tsx:693` flip `provider:"ultravox"` → `provider:"livekit"`
- [ ] **T2.3** `useBotsson.ts` rewrite — replace `UltravoxSession` with `VoiceProvider` abstraction. Remove all 13 server-bound `temporaryTool` registrations, keep `advanceToNextSection` only.
- [ ] **T2.4** apiParams translation contract in `packages/agent-sdk/src/providers/livekit.ts` — map `voice`, `language_hint`, `first_speaker`, `inactivity_timeout` to LiveKit Agents config
- [ ] **T2.5** `apps/web/src/app/api/wizard/start/route.ts` lines 100, 128: replace Ultravox `create-call` with LiveKit token mint via `supabase/functions/livekit-token/`. Room name `{workspaceId}:wizard:{userId}`.
- [ ] **T2.6** Wizard fallback "Neste" button rendered when LiveKit session unavailable (deploy-window mitigation)

### Track 3 — Persona Preservation + NC UI (E4, E7)

- [ ] **T3.1** `apps/web/src/components/voice-assistant.tsx` REWRITE as provider-agnostic `<InterviewSurface persona={...} prompt={...} />` — Lise persona-bearer, NOT delete
- [ ] **T3.2** Krisp NC 3-state pill on `BotssonSticky.tsx` — clean / elevated / off, gated on `noiseLevel` prop
- [ ] **T3.3** Wire Krisp filter on web LiveKit Room creation site
- [ ] **T3.4** Wire Krisp filter on mobile `use-botsson-voice-session.ts`
- [ ] **T3.5** Verify `services/voice-agent/src/agent.ts` does NOT enable NC (lint/grep test)

### Track 4 — Cleanup + Deletion (E6 — gated by T1-T3 stable)

- [ ] **T4.1** Delete `packages/agent-sdk/src/providers/ultravox.ts`
- [ ] **T4.2** Delete `services/stage-engine/src/routes/adapters/ultravox.ts`
- [ ] **T4.3** Delete `services/stage-engine/src/types/ultravox.ts`
- [ ] **T4.4** Delete `services/stage-engine/src/lib/ultravox.ts`
- [ ] **T4.5** Remove `ultravox-client` dep from `apps/web/package.json`
- [ ] **T4.6** Remove `ultravoxApiKey` field from `services/stage-engine/src/secrets.ts:11,53,61,68,76-77,88`
- [ ] **T4.7** Remove Ultravox path entries from `service-contracts.ts:169-193` + `service-registry.ts:94-95`
- [ ] **T4.8** Update `apps/web/src/app/onboarding/components/BotssonAvatar.tsx:5` — replace `UltravoxSessionStatus` import
- [ ] **T4.9** Update 6 test fixtures setting `ultravoxApiKey: null`
- [ ] **T4.10** Verify `grep -r "ultravox\|UltravoxSession\|UltravoxSessionStatus" apps/ packages/ services/` returns zero hits in code

### Track 5 — VAD Bench + Recording (E9)

- [ ] **T5.1** `services/voice-agent/scripts/vad-bench.ts` — measures turn-taking latency on 10 hospitality-Norwegian conversation traces
- [ ] **T5.2** P50 ≤ 600ms, P95 ≤ 900ms, false-end-of-turn ≤ 5%
- [ ] **T5.3** Voice-agent D1 session-recorder hooks (extend ADR-0184 coverage to voice path)
- [ ] **T5.4** Golden-transcript eval (ADR-0073) regression — green on LiveKit single-plane

### Track 6 — Verify + Handoff (E10)

- [ ] **T6.1** All 10 falsifiable acceptance criteria audit (steward)
- [ ] **T6.2** ADR-0275 status flip `proposed` → `accepted` in `docs/decisions/0000-decision-log.md`
- [ ] **T6.3** ADR-0276 (ADR-0107 amendment) lands
- [ ] **T6.4** ADR-0277 (Phantom-Reuse Detection) lands
- [ ] **T6.5** `docs/architecture/BOTSSON-SYSTEM-MAP.md` voice-plane row 🟡 → 🟢
- [ ] **T6.6** `docs/HANDOFF-voice-plane-consolidation.md` written
- [ ] **T6.7** Sync log entry in `CAMPAIGN-botsson-arena.md`

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] All 10 ADR-0275 falsifiable acceptance criteria green
- [ ] Decision log updated for ADR-0275, ADR-0276, ADR-0277
- [ ] At least one E2E test exists per journey (5 journeys = 5 E2E tests minimum)

## Dependencies / Pre-flight

- [ ] cascade-developer agent verifies I1 industry intelligence bootstrap fires on workspace creation BEFORE T1.6 D1 cascade tools (add_departments/locations/zones)
- [ ] B1 SS-4 awareness — Phase E uses direct `gate_action`, not orchestrator. SS-4 batches `onboarding` capability migration later.

### E7 — Krisp NC wiring

- Web: `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` (or wherever LiveKit Room is created) — `import { KrispNoiseFilter } from "@livekit/krisp-noise-filter"` + apply via `room.localParticipant.setMicrophoneEnabled(true, { processor: KrispNoiseFilter() })`.
- Mobile: `apps/mobile/src/hooks/use-botsson-voice-session.ts` — same pattern with `@livekit/react-native-krisp-noise-filter`.
- Voice-agent: verify `services/voice-agent/src/agent.ts` does NOT call any NC plugin (LiveKit docs: never double-process).
- Test: noise floor measurement A/B before/after on hospitality-noise sample; ≥15dB SNR improvement.

### E8 — ADR-0107 supersession or amendment

After E3 lands, ADR-0107 (Botsson provider derivation) is moot — `BotssonProvider.tsx` no longer derives, just hardcodes LiveKit. Either:
- (a) Supersede ADR-0107 with ADR-0282 amendment note, OR
- (b) Amend ADR-0107 to "always = livekit" (one-line decision, leaves audit history intact).

### E9 — Golden-transcript eval (ADR-0073) gate

Run golden-transcript eval against LiveKit single-plane. Verify turn-taking latency (Ultravox ~150ms TTFT vs LiveKit Agents ~250ms VAD silence) within hospitality SMB tolerance. Block E6 deletions until green.

### E10 — Sortie HANDOFF + decision-log

- Write `docs/HANDOFF-voice-plane-consolidation.md`
- Flip ADR-0282 status `proposed` → `accepted` in `docs/decisions/0000-decision-log.md`
- Update `docs/architecture/BOTSSON-SYSTEM-MAP.md` — voice-plane row 🟡 → 🟢
- Sync log entry in `CAMPAIGN-botsson-arena.md`

## Cross-cutting laws (per harness-builder verification checklist)

- **Workspace scope (Law 1)**: every E1 tool scopes by `ctx.workspaceId`
- **gate_action first (Law 2)**: every E1 mutation calls `gate_action` (or `cascade_gate_write` for D1) before write
- **Channel guard (Law 3)**: `update_business`, `add_key_fact` reject `ctx.channel === "voice"` if returning PII; D1 cascade tools accept voice (no PII surface)
- **Telemetry (Law 4)**: every E1 mutation `emit()`s with non-empty workspaceId + profileId per ADR-0134
- **No client DB access (Law 5)**: `useBotsson.ts` post-rewrite touches no Supabase client; all data goes via BFF
- **Mobile boundary (Law 6)**: N/A — web composing flow

## Risks

| Risk | Mitigation |
|---|---|
| Phantom-trace catches more false reuse claims mid-T1 | Body-trace each "reuse" before importing; expand R4 if found |
| LiveKit Agents function-calling diverges from Ultravox tool-call shape | T1 integration test against voice-agent fail-fast |
| Wizard onboarding regression mid-E3 to E5 deploy gap | T2.6 fallback Neste button + ≤1 deploy cycle gap rule |
| Lise persona drift in T3.1 rewrite | Pontus approval gate (G3) + frontend-designer self-cert |
| VAD parity fails E9 gate | Council escalation per coordinator finding |

## Council escalation triggers

Before E1 starts: cascade-developer agent verifies I1 bootstrap status for D1 cascade-gate-write usage on add_departments/locations/zones.

Between E5 and E6: agent-coordinator runs per-tool Trust Gate table on the 6 new tools — body-level gate + emit + channel guard verified, not docstring.

After E10: steward audits ADR-0282 status flip readiness — all 10 falsifiable acceptance criteria green.

### Specific escalation conditions

1. I1 bootstrap not wired into workspace creation
2. Phantom-trace catches additional false claims (e.g., `add_procedures` requires governance schema not budgeted)
3. VAD parity fails P50 ≤ 600ms or P95 ≤ 900ms
4. Lise persona regression flagged at G3
5. Krisp double-processing detected during E7
6. B1 SS-4 collides with Phase E mid-execution

## Related

- ADR-0282 (this decision)
- ADR-0135 (amended)
- ADR-0058 (LiveKit chosen)
- ADR-0078 + ADR-0163 (channel guard)
- ADR-0099 (gate_action)
- ADR-0107 (provider derivation — supersession candidate)
- ADR-0132 (mobile thin client)
- ADR-0134 (telemetry contract)
- ADR-0238 (Botsson surface disambiguation)
- ROADMAP-ai-harness.md
- BOTSSON-SYSTEM-MAP.md
