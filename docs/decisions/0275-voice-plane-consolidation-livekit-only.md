---
title: "Voice Plane Consolidation — LiveKit Everywhere, Ultravox Removed"
id: ADR_0275
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
supersedes: []
amends: [ADR_0135]
depends_on: [ADR_0058, ADR_0078, ADR_0132, ADR_0133, ADR_0134, ADR_0163, ADR_0186, ADR_0238]
---

# ADR-0275: Voice Plane Consolidation — LiveKit Everywhere, Ultravox Removed

## Context and Problem Statement

Smartout currently runs two voice providers in parallel: Ultravox on web (`apps/web/src/components/voice-assistant.tsx`, `apps/web/src/app/onboarding/hooks/useBotsson.ts`, `apps/web/src/app/Botsson/_components/BotssonProvider.tsx:693` hardcodes `provider: "ultravox"`) and LiveKit on mobile (`apps/mobile/src/hooks/use-botsson-voice-session.ts` + `services/voice-agent/src/agent.ts` LiveKit Agents 1.3.0). ADR-0135 R1 established the dual-plane in 2026-04-17 as a pragmatic mobile unblock.

Two integrity gaps surfaced 2026-05-04 audit:

1. **Web Ultravox client-tools bypass BFF.** `useBotsson.ts` registers 15 client-side `temporaryTool` definitions executed in browser without `gate_action`, classifier, Layer-2 channel guard, or telemetry. ADR-0135 R2 mandates "BFF is the agent control plane" — web Ultravox path violates R2.
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
`BotssonProvider.tsx:693` flips `"ultravox"` → `"livekit"`. ADR-0107 (provider derivation) is moot under this rule and gets superseded or simplified.
`apps/web/src/app/api/wizard/start/route.ts` issues LiveKit room tokens via `supabase/functions/livekit-token/`, not Ultravox calls.

### R2 (preserved from ADR-0135). BFF is the agent control plane

LiveKit handles audio media. Tool calls + transcript + reasoning + memory + telemetry route through web BFF → stage-engine → `services/voice-agent/`. No client-side temporaryTool path. No browser-only mutation.

### R3 (preserved from ADR-0135). ADR-0078 channel enforcement applies uniformly

`ctx.channel="voice"` is server-pinned in BFF before any tool-selector dispatch. Capability `allowedChannels` filter (Layer 2) + tool-body guard (Layer 3) + `gate_action` SQL channel param (Layer 1) — all three layers fire identically on web and mobile.

### R4 (NEW). Wizard onboarding client-tool migration is the critical-path blocker

The 15 `useBotsson.ts` `temporaryTool` definitions cannot remain client-side post-migration. Classification + migration target (verified by code-trace 2026-05-04):

| # | Tool | Migration target | Status pre-migration |
|---|---|---|---|
| 1 | `getOnboardingState` | `/api/emma/session` BFF endpoint reads stage-engine session | new BFF route |
| 2 | `updateBusiness` | `onboarding` capability tool + `gate_action` | new |
| 3 | `updateSeason` | reuse `season` capability (exists) | reuse |
| 4 | `addDepartments` | `onboarding` capability + `cascade_gate_write` (D1) | new |
| 5 | `addLocations` | `onboarding` capability + `cascade_gate_write` (D1) | new |
| 6 | `addZones` | `onboarding` capability + `cascade_gate_write` (D1) | new |
| 7 | `addProcedures` | reuse `governance` capability (exists) | reuse |
| 8 | `searchCompany` | reuse `intelligence/brreg` tool (exists) | reuse |
| 9 | `identifyCompany` | reuse `intelligence` tool (exists) | reuse |
| 10 | `scrapeWebsite` | reuse `intelligence/scrape` tool (exists) | reuse |
| 11 | `advanceToNextSection` | UI-only — stays as LiveKit data-channel client tool | stays client (non-server) |
| 12 | `addKeyFact` | reuse `engine_memory` writer (A3 landed) | reuse |
| 13 | `saveMemory` | reuse `save_memory` capability (A3 landed) | reuse |
| 14 | `finalizeOnboarding` | reuse `finalize-workspace` Edge Function (exists) | reuse |
| 15 | `getOnboardingState` (read variant) | duplicate of #1 | reuse |

Six new server-side tools. Eight reuse existing surface. One stays client-only (UI control, no server state).

### R5 (NEW). Krisp NC wiring rule

Web client (`apps/web/`) + mobile client (`apps/mobile/`) apply `@livekit/krisp-noise-filter` / `@livekit/react-native-krisp-noise-filter` on local participant track. `services/voice-agent/` does NOT enable NC — never double-process per LiveKit docs. Both packages already installed (steward verified 2026-05-04 — `apps/web/package.json:24`, `apps/mobile/package.json:22`); this rule formalizes the wiring.

### R6 (NEW). Migration ordering

Critical-path sequence:

1. Server-side tool migration (R4 items 1-2, 4-6) — six new tools must land before any web Ultravox surface is removed
2. `BotssonProvider` provider-derivation simplification (or ADR-0107 supersession)
3. Wizard onboarding hook migration (`useBotsson.ts`)
4. `voice-assistant.tsx` migration or rewrite
5. Final deletion of `ultravox-client` dependency, adapters, provider files
6. Krisp NC wiring (R5) — can land in parallel any time after step 1

No "big-bang" cutover. Each step is independently revertable until step 5.

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

- [ ] CAMPAIGN-botsson-arena.md scope amendment — line 43 `Out of scope` removes Ultravox clause
- [ ] PLAN-voice-plane-consolidation.md — sortie spec with R4 + R6 sequencing
- [ ] ADR-0107 supersession or amendment after R6 step 2
- [ ] Sync log row in CAMPAIGN charter for 2026-05-04 17-commit dev sync (see merge `72cce715f`)

---

> Registered in `docs/decisions/0000-decision-log.md`. Amends ADR-0135. Depends on ADR-0058, ADR-0132, ADR-0134. Cross-references ADR-0078, ADR-0099, ADR-0107, ADR-0163, ADR-0186, ADR-0238.
