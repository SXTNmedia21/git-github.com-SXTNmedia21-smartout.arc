---
title: "Plan — Voice Plane Consolidation (Phase E)"
status: draft
updated: 2026-05-04
created: 2026-05-04
module: MODULE_BOTSSON
adr: ADR_0282
phase: E
tags: [livekit, ultravox, voice, botsson, consolidation, voice-agent]
council_verdict: "APPROVE WITH CHANGES — Phase 5 synthesis applied"
---

# Plan — Voice Plane Consolidation (Phase E)

> Branch: campaign/botsson-arena (parent) → sub-sortie `feat/voice-plane-consolidation` (to create)
> ADR: [ADR-0282](../decisions/0282-voice-plane-consolidation-livekit-only.md) — proposed
> Estimate: 5-8 days
> Owner: harness-builder + agent-coordinator (verification)

## Goal

Single voice plane via LiveKit Agents. Kill Ultravox on web. All voice surfaces (web Botsson overlay, web wizard onboarding, web voice-assistant component, mobile Botsson voice session) connect through `services/voice-agent/` (LiveKit Agents 1.3.0). Capability governance uniform across surfaces. Krisp NC wired client-side.

## Falsifiable acceptance criteria

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

## Step sequence (ADR-0282 R6 — independently revertable until E6)

### E1 — Six new server-side capability tools

| Tool | Location | Authority | Channels | Gate |
|---|---|---|---|---|
| `update_business` | `packages/ai/src/capabilities/onboarding/tools.ts` (new capability) | `confirm` (default) | `["chat", "voice"]` | `gate_action` |
| `update_season` | reuse `packages/ai/src/capabilities/season/tools.ts` (exists) | per existing | per existing | per existing |
| `add_departments` | `packages/ai/src/capabilities/onboarding/tools.ts` | `read_only` | `["chat", "voice"]` | NONE — IN-MEMORY wizard state mutation only (Option A per cascade-developer 2026-05-04). Mirror `departments-tools.ts:35` updateState pattern. Single cascade write at `finalize-workspace`. |
| `add_locations` | `packages/ai/src/capabilities/onboarding/tools.ts` | `read_only` | `["chat", "voice"]` | NONE — IN-MEMORY mirror `locations-tools.ts:55-118`. |
| `add_zones` | `packages/ai/src/capabilities/onboarding/tools.ts` | `read_only` | `["chat", "voice"]` | NONE — IN-MEMORY wizard state. |
| `add_key_fact` | reuse `engine_memory` writer (Phase A3 landed) — wrap as `add_key_fact` capability tool delegating to `save_memory` | `suggest` | `["chat"]` (memory persistence sensitive) | `gate_action` |

New capability `onboarding` registered in:
- `packages/ai/src/capabilities/types.ts` `CapabilityName` union
- `packages/ai/src/capabilities/registry.ts`
- `packages/ai/src/router/intent-classifier.ts` enum

Each tool: `defineTool()` shape, `gate_action` before mutation (only for actual DB-writing tools — `update_business`, `update_season`, `add_procedures`), `emit()` after, voice-channel reject if PII. D1-targeted tools (`add_departments`, `add_locations`, `add_zones`) are IN-MEMORY only per Option A — no gate, no emit (wizard state mirror).

### E2 — `getOnboardingState` BFF endpoint

New route `apps/web/src/app/api/emma/session/route.ts` GET handler — derives workspace from session cookie, queries stage-engine session-context, returns onboarding-state shape compatible with current Ultravox client-tool consumer.

### E3 — `BotssonProvider` + `useBotsson.ts` migration

- `BotssonProvider.tsx:693` flip `provider: "ultravox"` → `provider: "livekit"`
- `useBotsson.ts` rewrite: replace `UltravoxSession`/`UltravoxSessionStatus` with `VoiceProvider` abstraction from `packages/agent-sdk/src/types.ts:97-115`. Use existing `providers/livekit.ts`.
- Remove all 14 server-bound `temporaryTool` registrations from `useBotsson.ts` — they are now server-side per E1.
- Keep `advanceToNextSection` as LiveKit data-channel client tool.
- Tool-call wire format: LiveKit Agents → BFF `/api/emma/voice/transcript` → stage-engine `/agent/chat` (already shipped pattern from mobile per `apps/mobile/src/hooks/use-voice-transcripts.ts:36-46`).

### E4 — `voice-assistant.tsx` rewrite or delete

Verify usage: `grep -r "voice-assistant" apps/web/src`. If only used by Lise/onboarding-interview flow, rewrite as thin LiveKit Room wrapper consuming same `services/voice-agent/`. If unused after E3, delete.

### E5 — Wizard `/api/wizard/start` flip

`apps/web/src/app/api/wizard/start/route.ts` lines 100, 128: replace `${stageEngineUrl}/adapters/ultravox/create-call` calls with LiveKit room creation via `supabase/functions/livekit-token/` + room name pattern `{workspaceId}:wizard:{userId}`.

### E6 — Deletions (point of no return)

- Delete `packages/agent-sdk/src/providers/ultravox.ts`
- Delete `services/stage-engine/src/routes/adapters/ultravox.ts` (4 routes: `create-call`, `store`, `fetch`, `advance`)
- Remove `ultravox-client` from `apps/web/package.json` dependencies
- Update `apps/web/src/app/platform-admin/services/_components/service-contracts.ts` — remove Ultravox path entries
- Run `pnpm install` + `pnpm turbo typecheck` — should pass with zero references
- Update `apps/web/src/components/voice-assistant.tsx` final state per E4 outcome

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

| # | Risk | Mitigation |
|---|---|---|
| 1 | Wizard onboarding regression between E3 deploy and E5 stabilization | Feature flag `VOICE_PLANE_LIVEKIT` — flip per env, rollback if issues |
| 2 | Turn-taking latency unacceptable | E9 gates E6; revert `BotssonProvider` if fails |
| 3 | Cascade I1 bootstrap incomplete on onboarding-time → D1 tools blocked | Verify with cascade-developer agent before E1 add_departments/locations/zones |
| 4 | ADR-0107 supersession breaks downstream | Search `grep -r "ADR-0107"` before E8 — coordinate with frontend-designer if BotssonProvider visual contract referenced |
| 5 | Krisp licensing on self-hosted | Verify LiveKit Cloud tier covers Krisp; if self-hosted later, separate license |

## Verification gates (steward + agent-coordinator)

Before E1 starts: cascade-developer agent verifies I1 bootstrap status for D1 cascade-gate-write usage on add_departments/locations/zones.

Between E5 and E6: agent-coordinator runs per-tool Trust Gate table on the 6 new tools — body-level gate + emit + channel guard verified, not docstring.

After E10: steward audits ADR-0282 status flip readiness — all 10 falsifiable acceptance criteria green.

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
