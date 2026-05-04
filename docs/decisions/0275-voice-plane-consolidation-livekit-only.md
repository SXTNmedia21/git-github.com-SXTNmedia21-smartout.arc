---
title: "Voice Plane Consolidation — LiveKit Everywhere, Ultravox Removed"
id: ADR_0275
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
supersedes: []
amends: [ADR_0135, ADR_0107]
depends_on: [ADR_0058, ADR_0078, ADR_0132, ADR_0133, ADR_0134, ADR_0163, ADR_0186, ADR_0238]
council_review: 2026-05-04
council_verdict: "APPROVE WITH CHANGES — 12 amendments applied per Phase 5 synthesis"
---

# ADR-0275: Voice Plane Consolidation — LiveKit Everywhere, Ultravox Removed

## Context and Problem Statement

Smartout currently runs two voice providers in parallel: Ultravox on web (`apps/web/src/components/voice-assistant.tsx`, `apps/web/src/app/onboarding/hooks/useBotsson.ts`, `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:693` hardcodes `provider: "ultravox"`) and LiveKit on mobile (`apps/mobile/src/hooks/use-botsson-voice-session.ts` + `services/voice-agent/src/agent.ts` LiveKit Agents 1.3.0). ADR-0135 R1 established the dual-plane in 2026-04-17 as a pragmatic mobile unblock.

Two integrity gaps surfaced 2026-05-04 audit:

1. **Web Ultravox client-tools bypass BFF.** `useBotsson.ts` registers 14 client-side `temporaryTool` definitions executed in browser without `gate_action`, classifier, Layer-2 channel guard, or telemetry. ADR-0135 R2 mandates "BFF is the agent control plane" — web Ultravox path violates R2.
2. **Capability-layer divergence.** `services/voice-agent/` uses `buildAllBotssonTools()` server-side (full ADR-0078 + ADR-0099 + ADR-0134 compliance). Web Ultravox client-tools have no equivalent governance — different surface, different integrity contract, same user-facing voice channel.

LiveKit Agents 1.3.0 is feature-complete for web use cases (verified by system-agent-coordinator 2026-05-04): tool surface, transcript routing, VAD tuning, system instructions including ADR-0078 PII redirect. `services/voice-agent/src/agent.ts:102-109` tunes OpenAI Realtime VAD `silence_duration_ms: 250` — parity-capable with Ultravox ~150ms TTFT for hospitality SMB use.

## Decision Drivers

- ADR-0135 R2 (BFF-as-control-plane) currently violated on web
- Capability governance must be uniform across surfaces (ADR-0078 + ADR-0099 + ADR-0134)
- Single-plane reduces maintenance surface — one provider, one tool-calling shape, one transcript contract
- LiveKit Agents 1.3.0 verified ready (system-agent-coordinator verification 2026-05-04)
- 15 client-tools in `useBotsson.ts` must move server-side regardless — they cannot remain Ultravox-bound after consolidation
- Migration cost is bounded — verified at 5-8 days by coordinator code-trace
- 14 month gap on Krisp NC despite ADR-0058 line 46 naming it as feature — single-plane simplifies wiring (apply NC client-side once, voice-agent stays NC-off, no double-processing)

## Considered Options

1. **Keep dual-plane (status quo).** Rejected: violates ADR-0135 R2 on web; ongoing integrity drift; double maintenance.
2. **Build React Native Ultravox shim.** Rejected for same reasons as ADR-0135 (no upstream support, open-ended polyfill work).
3. **Migrate web from Ultravox to LiveKit Agents (single-plane).** Chosen.

## Decision Outcome

Chosen option: **Option 3 — single voice plane via LiveKit Agents on web, mobile, and any future surface.**

This ADR amends ADR-0135. Original R1 ("provider per platform") is revoked. All other ADR-0135 rules (R2 BFF routing, R3 channel enforcement, R4 ADR-0132 dependency) are preserved and apply uniformly.

## Rules & Consequences

### R1 (revised). Single voice plane = LiveKit Agents

All voice surfaces (web Botsson overlay, web wizard onboarding, web voice-assistant component, mobile Botsson voice session, future mobile + future web surfaces) connect through `services/voice-agent/` (LiveKit Agents) via the LiveKit media plane.

`packages/agent-sdk/src/providers/ultravox.ts` is deleted.
`services/stage-engine/src/routes/adapters/ultravox.ts` is deleted.
`apps/web/src/components/voice-assistant.tsx` is deleted or rewritten as a thin LiveKit-Room wrapper.
`apps/web/src/app/onboarding/hooks/useBotsson.ts` is rewritten to use `VoiceProvider` abstraction with `provider="livekit"`.
`BotssonProvider.tsx:693` flips `"ultravox"` → `"livekit"`. ADR-0107 is AMENDED (not superseded) — its `mode→channel` derivation contract is provider-independent and remains load-bearing. See ADR-0276 for amendment.
`apps/web/src/app/api/wizard/start/route.ts` issues LiveKit room tokens via `supabase/functions/livekit-token/`, not Ultravox calls.

### R2 (preserved from ADR-0135). BFF is the agent control plane

LiveKit handles audio media. Tool calls + transcript + reasoning + memory + telemetry route through web BFF → stage-engine → `services/voice-agent/`. No client-side temporaryTool path. No browser-only mutation.

### R3 (preserved from ADR-0135). ADR-0078 channel enforcement applies uniformly

`ctx.channel="voice"` is server-pinned in BFF before any tool-selector dispatch. Capability `allowedChannels` filter (Layer 2) + tool-body guard (Layer 3) + `gate_action` SQL channel param (Layer 1) — all three layers fire identically on web and mobile.

### R4 (REVISED post-council 2026-05-04). Wizard onboarding client-tool migration is the critical-path blocker

The 14 `useBotsson.ts` `temporaryTool` definitions cannot remain client-side post-migration. Classification corrected after harness-builder phantom-trace (Council Phase 3, applies L-0176 hard rule body-trace):

| # | Tool | Migration target | Phantom-trace verdict |
|---|---|---|---|
| 1 | `getOnboardingState` | new `/api/emma/session` BFF reads `engine_sessions` mode='agent' process_id='onboarding_v1' | NEW BFF route |
| 2 | `updateBusiness` | NEW `onboarding` capability tool + `gate_action` | NEW |
| 3 | `updateSeason` | NEW tool — `tools/season/` has create/setRevenue/savePlaybook/getReadiness/learnFactors only, NO `update_season`. Phantom-reuse falsified. | NEW (was claimed reuse) |
| 4 | `addDepartments` | NEW `onboarding` capability — IN-MEMORY wizard state mutation (mirrors `apps/web/src/app/onboarding/steps/tools/departments-tools.ts:35`). NO `cascade_gate_write`. Per cascade-developer FAIL verdict 2026-05-04: onboarding is memory-until-finalize by design; D1 cascade writes happen only at `finalize-workspace` Edge Function. | NEW (in-memory) |
| 5 | `addLocations` | NEW `onboarding` capability — IN-MEMORY wizard state mutation (mirrors `locations-tools.ts:55-118`). NO `cascade_gate_write`. Same cascade-developer reasoning. | NEW (in-memory) |
| 6 | `addZones` | NEW `onboarding` capability — IN-MEMORY wizard state mutation. NO `cascade_gate_write`. Same cascade-developer reasoning. | NEW (in-memory) |
| 7 | `addProcedures` | NEW tool — `governance` has only `check_readiness` (read-only), no `add_procedures`. Phantom-reuse falsified. | NEW (was claimed reuse) |
| 8 | `searchCompany` | reuse `tools/intelligence/INTELLIGENCE_TOOLS[searchCompany]` (`tools/intelligence/index.ts:74`) — needs onboarding-capability bridge wrapper (currently only via business_intelligence godmode) | REUSE-VIA-BRIDGE |
| 9 | `identifyCompany` | reuse `tools/intelligence/INTELLIGENCE_TOOLS[identifyCompany]` (same module, same bridge requirement) | REUSE-VIA-BRIDGE |
| 10 | `scrapeWebsite` | NEW BFF-callable bridge — `tools/intelligence/types.ts:204` only has client-tool returntype. Scraping is BFF call to Python droplet `/api/workspace-intelligence`. Phantom-reuse falsified. | NEW (was claimed reuse) |
| 11 | `advanceToNextSection` | UI-only — stays as LiveKit data-channel client tool | STAYS CLIENT (non-server) |
| 12 | `addKeyFact` | alias to existing `memory.save_memory` (A3 landed) — LLM emits `add_key_fact`, server resolves to `memory.save_memory`. Path A per coordinator Phase 3. Path B (new wrapper in onboarding) violates ADR-0240 cross-namespace. PII gate is content-level (Zod refinement on `value` field), NOT transport-level — `["chat","voice"]` allowed. | ALIAS-TO-EXISTING |
| 13 | `saveMemory` | reuse `memory.save_memory` capability (A3 landed) — direct dispatch | REUSE |
| 14 | `finalizeOnboarding` | reuse `finalize-workspace` Edge Function — needs BFF-bridge from stage-engine context for invocation parity (verify in E1) | REUSE-PARTIAL |

**Truthful counts (corrected per phantom-trace 2026-05-04):**
- 7 NEW capability tools / bridges: `update_business`, `update_season`, `add_departments`, `add_locations`, `add_zones`, `add_procedures`, `scrape_website`
- 1 NEW BFF route: `/api/emma/session`
- 2 REUSE-VIA-BRIDGE: `searchCompany`, `identifyCompany` (existing INTELLIGENCE_TOOLS need standalone exposure)
- 1 ALIAS-TO-EXISTING: `add_key_fact` → `memory.save_memory`
- 2 REUSE: `saveMemory` direct, `finalizeOnboarding` partial-bridge
- 1 STAYS-CLIENT: `advanceToNextSection`

**Total build cost: 8-9 net-new tools/bridges, NOT 6.** Original "7 reuse" overstated by 3-4 — phantom-trace (L-0176) caught the inflation.

### R5 (NEW). Krisp NC wiring rule

Web client (`apps/web/`) + mobile client (`apps/mobile/`) apply `@livekit/krisp-noise-filter` / `@livekit/react-native-krisp-noise-filter` on local participant track. `services/voice-agent/` does NOT enable NC — never double-process per LiveKit docs. Both packages already installed (steward verified 2026-05-04 — `apps/web/package.json:24`, `apps/mobile/package.json:22`); this rule formalizes the wiring.

### R6 (REVISED post-council). Migration ordering

Critical-path sequence:

1. **E1**: Server-side tool migration — 8-9 net-new tools/bridges land via `onboarding` capability + intelligence bridges + `scrape_website` BFF bridge. Includes:
   - Adding `"onboarding"` to `CapabilityName` union (`packages/ai/src/capabilities/types.ts:7-69`)
   - Adding `onboarding` to registry.ts
   - Adding `onboarding:` bullet to intent-classifier system prompt (`intent-classifier.ts:143-183`) with example phrases — without this, capability is dead on arrival
   - Adding `onboarding` to z.enum() in intent-classifier
   - `engine_authority_config` seed migration (timestamp > dev HEAD max per L-0042) — without seed, `gate_action` returns advisory and tools silently 403
   - Use direct `gate_action` (not `gatedMutation` orchestrator until B1 SS-4 flag-on)
2. **E2**: `getOnboardingState` BFF endpoint reads `engine_sessions` mode='agent' process_id='onboarding_v1' (reuse, no new table)
3. **E3**: `BotssonProvider.tsx:693` flip + `useBotsson.ts` rewrite to `VoiceProvider` abstraction. Translation contract for Ultravox-shaped apiParams (`voice`, `language_hint`, `first_speaker`, `inactivity_timeout`) → LiveKit Agents config in `packages/agent-sdk/src/providers/livekit.ts`
4. **E4**: `voice-assistant.tsx` REWRITE as provider-agnostic `<InterviewSurface persona={...} prompt={...} />` — Lise persona-bearer, NOT delete. Dedicated interview transcript surface preserved.
5. **E5**: Wizard `/api/wizard/start` flips to LiveKit token mint. **Deploy gap E3-E5 ≤1 cycle, no overnight gap** — voice silently fails between hooks. Wizard needs visible "Neste"-knapp fallback.
6. **E6**: Final deletion of `ultravox-client` dep + 12+ surfaces (full grep scope per AC #1 below)
7. **E7**: Krisp NC wiring + 3-state pill UI on `BotssonSticky` (clean/elevated/off, gated on `noiseLevel` prop from LiveKit local participant audio stats)
8. **E9 VAD parity gate**: `services/voice-agent/scripts/vad-bench.ts` measures turn-taking latency. P50 ≤ 600ms, P95 ≤ 900ms, false-end-of-turn ≤ 5%. Golden-transcript framework measures intent accuracy only — VAD parity is separate.

No "big-bang" cutover. Each step independently revertable until E6.

**AC #1 — full Ultravox grep scope (corrected after supervisor Phase 3):**
- `apps/web/src/components/voice-assistant.tsx`
- `apps/web/src/app/onboarding/components/BotssonAvatar.tsx:5`
- `apps/web/src/app/onboarding/hooks/useBotsson.ts`
- `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:693`
- `apps/web/src/app/api/wizard/start/route.ts:100,128`
- `apps/web/src/app/platform-admin/services/_components/service-contracts.ts:169-193`
- `apps/web/src/app/platform-admin/keys/_components/service-registry.ts:94-95`
- `services/stage-engine/src/secrets.ts:11,53,61,68,76-77,88` (ultravoxApiKey field)
- `services/stage-engine/src/types/ultravox.ts` (whole file delete)
- `services/stage-engine/src/lib/ultravox.ts` (whole file delete)
- `services/stage-engine/src/routes/adapters/ultravox.ts` (whole file delete)
- `packages/agent-sdk/src/providers/ultravox.ts` (whole file delete)
- 6 test fixtures setting `ultravoxApiKey: null`
- `apps/web/package.json` `ultravox-client` dep removal

After E6: `grep -r "ultravox\|UltravoxSession\|UltravoxSessionStatus" apps/ packages/ services/` returns zero hits in code (excluding `docs/`, comments, migrations).

### Agent Impact

- **Build agents:** all voice work imports from `packages/agent-sdk` LiveKit provider. References to `ultravox-client`, `UltravoxSession`, `UltravoxSessionStatus`, or `/adapters/ultravox/*` routes flag as drift.
- **Coordinator:** voice-related capability tests run against single LiveKit path. No dual-provider integration tests.
- **Harness builder:** R4 client-tool migration is in scope of botsson-arena campaign as new Phase E — see CAMPAIGN charter amendment.
- **Steward:** verifies R4 tool migration completeness before R5 deletions are approved.

## Consequences

- **Good:** closes ADR-0135 R2 violation on web; uniform capability governance across surfaces; single tool-calling shape; single transcript contract; reduced maintenance; Krisp NC unblocked
- **Good:** voice-agent (LiveKit Agents 1.3.0) becomes the single integration point for VAD tuning, turn-taking, system prompts, tool surface — easier to audit and improve
- **Bad:** 5-8 day sortie cost; 11 surface deletions or rewrites; ADR-0107 needs supersession or simplification
- **Bad:** wizard onboarding voice gets a brief regression window between R6 step 3 deploy and step 4 stabilization
- **Migration cost:** 5-8 days (system-agent-coordinator estimate 2026-05-04)
- **Risk:** turn-taking latency delta — Ultravox ~150ms TTFT vs LiveKit Agents 250ms VAD silence threshold. Hospitality SMB tolerance acceptable per coordinator; verify with golden-transcript eval (ADR-0073) before R5 deletions

## Open Items

- [x] CAMPAIGN-botsson-arena.md scope amendment — done in commit `48e47452d`
- [x] PLAN-voice-plane-consolidation.md — done in commit `48e47452d`
- [ ] ADR-0276 ADR-0107 amendment (provider-independence note) — to write
- [ ] ADR-0277 (proposed): "Phantom-Reuse Detection in Capability Plans" — promotes L-0176 body-trace from per-tool to per-plan scope
- [x] Sync log row in CAMPAIGN charter — done in commit `48e47452d`

## Cascade Pre-flight Verdict (2026-05-04, post-council)

System-steward cascade-developer pre-flight verification ruled FAIL on T1.6 cascade_gate_write D1 mutations during `/onboarding` draft state. Evidence:

- Current onboarding flow is **memory-until-finalize** by design (`apps/web/src/app/onboarding/steps/tools/departments-tools.ts:35`, `locations-tools.ts:55-118` — both call `updateState(patch)` only, zero DB writes)
- I1 industry intelligence bootstrap (`bootstrap-cascade` Edge Function) runs AFTER `finalize_onboarding_workspace` writes D1 dimensions (`supabase/functions/finalize-workspace/index.ts:78-88`)
- `cascade_gate_write` requires framework binding which only exists post-finalize (`migrations/20260512100200_cascade_gate_write_assert.sql:49-59`)
- T1.6 cascade-write would create double-write OR framework-binding bypass

**Decision (Option A chosen by Pontus 2026-05-04):** Phase E preserves the memory-until-finalize contract per control-gate rules 9-11. T1.6 D1 tools (`addDepartments`/`addLocations`/`addZones`) are IN-MEMORY wizard state mutations only. Single cascade write remains `finalize-workspace`. R4 corrected above.

Option B (incremental cascade-bootstrap mid-wizard) deferred — separate ADR + ADR-0091 amendments would be required.

## Council Review (2026-05-04)

Verdict: APPROVE WITH CHANGES — 12 amendments applied (originally 13; supervisor's #1 "phantom onboarding registration" was false-claim — `"onboarding"` lives in `Situation` type at `types.ts:157`, NOT `CapabilityName` union).

Reviewers:
- system-steward (chair) — PASS WITH CONDITIONS, self-reversed Phase 3 condition #6 sequencing per L-0147 protocol
- supervisor — APPROVE WITH CHANGES (1 critical claim falsified by post-council fact-check)
- system-agent-coordinator — PASS WITH CONDITIONS (per-tool Trust Gate table, Path A `add_key_fact` alias)
- botsson-harness-builder — READY-WITH-CONDITIONS (phantom-trace caught 3-4 inflated reuse claims in R4)
- frontend-designer — APPROVE WITH DESIGN CONDITIONS (Lise persona preservation, Krisp NC pill, deploy gap)

Core synthesis findings:
1. Phantom-trace (L-0176) caught 3 false reuse claims: `update_season`, `add_procedures`, `scrape_website` — all marked NEW in revised R4
2. `searchCompany`/`identifyCompany` exist as `INTELLIGENCE_TOOLS` but need standalone bridge — REUSE-VIA-BRIDGE in revised R4
3. `add_key_fact` is ALIAS-TO-EXISTING `memory.save_memory` (Path A) — content-level PII gate, NOT transport-level
4. ADR-0107 AMENDS not supersedes — `mode→channel` derivation is provider-independent (preserved load-bearing)
5. Self-reversal on B1 SS-4 sequencing: Phase E lands first with direct `gate_action`, B1 SS-4 batches `onboarding` later (mirror `legal/`+`payroll/` precedent)

Council session log: `docs/council/COUNCIL-LOG.md` 2026-05-04 entry.

---

> Registered in `docs/decisions/0000-decision-log.md`. Amends ADR-0135. Depends on ADR-0058, ADR-0132, ADR-0134. Cross-references ADR-0078, ADR-0099, ADR-0107, ADR-0163, ADR-0186, ADR-0238.
