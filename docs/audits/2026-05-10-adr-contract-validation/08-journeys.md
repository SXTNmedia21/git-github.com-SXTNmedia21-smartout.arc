---
title: "Audit Slice 08 — Journeys"
status: complete
created: 2026-05-10
updated: 2026-05-10
module: audit
adr_cluster: [ADR-0031, ADR-0038]
tags: [audit, journeys, missions, e2e, phase-e]
---

# Audit Slice 08 — Journeys

**Scope:** `docs/journeys/`, `packages/ai/src/journey/`, `packages/ai/src/missions/`, `apps/e2e/`
**ADR cluster:** ADR-0031 (Journey Portal System), ADR-0038 (Journey Agent & Output Generators)
**Date:** 2026-05-10

---

## Summary

7 findings. 0 CRITICAL. 2 HIGH. 3 MEDIUM. 2 LOW. Mission registry is complete and internally
consistent. MISSION_MANIFEST does not leak system prompts. Phase E missions (`lise-interview`,
`mr-botsson`) are fully populated. C1.c Detox E2E deferment is documented inline. Main issues
are stale `status: draft` on Phase-E-complete voice-plane-consolidation journeys, a type naming
mismatch post-LiveKit migration, and two non-standard frontmatter status values.

---

## Findings

### F-JR-01 — Voice-plane-consolidation journeys remain `status: draft` after Phase E close

**Severity:** HIGH

**Files:**
- `docs/journeys/JOURNEY-voice-plane-consolidation-botsson-overlay-voice-livekit.md:5`
- `docs/journeys/JOURNEY-voice-plane-consolidation-krisp-nc-kitchen-noise.md:5`
- `docs/journeys/JOURNEY-voice-plane-consolidation-lise-interview-livekit.md:5`
- `docs/journeys/JOURNEY-voice-plane-consolidation-pii-guard-uniform-web-mobile.md:5`
- `docs/journeys/JOURNEY-voice-plane-consolidation-wizard-onboarding-via-livekit.md:5`

**Observation:** All five voice-plane-consolidation journeys carry `status: draft` and
`verified_at: null` and `e2e_test: null`. Phase E (`feat/botsson-arena-phase-e-cutover`) was
closed with typecheck 48/48 and `HANDOFF-phase-e-cutover.md` written. The parent journey
`JOURNEY-phase-e-cutover.md` is `status: verified`. The five sub-journeys were authored during
Phase E build but were never promoted to `verified` or explicitly marked `deferred`.

**Rule violated:** ADR-0031 — every accepted journey must have `status: verified` or an explicit
deferred state. The five sub-journeys document real implemented behavior (LiveKit Krisp NC, Lise
interview persona, PII guard, wizard onboarding, Botsson orb voice) and are not draft intent.

**Expected:** Either:
- `status: verified` if the journey accurately describes the shipped implementation, OR
- `status: deferred` with a `deferred_until:` field and rationale (Phase F debt)

The `JOURNEY-voice-plane-consolidation-lise-interview-livekit.md` has a five-item verification
checklist, all unchecked — indicating it was planned for post-Phase-E gate sign-off that never
happened. This is the clearest candidate for `status: deferred` with a Phase F note. The other
four match shipped behavior and should be `verified`.

**Remediation:** Review each of the five files against the Phase E handoff; promote matching
journeys to `verified`, mark lise-interview-livekit as `deferred` pending G3 Pontus approval.

---

### F-JR-02 — `UltravoxVoice` type retained after LiveKit migration; `coral` voice not in named set

**Severity:** HIGH

**Files:**
- `packages/ai/src/missions/types.ts:15` — `export type UltravoxVoice = "terrence" | "mark" | "jessica" | "sarah" | "tina" | (string & {})`
- `packages/ai/src/missions/registry.ts:208` — `voice: "coral"` for `lise-interview`
- `packages/ai/src/missions/index.ts:1` — re-exports `UltravoxVoice`

**Observation:** Phase E deleted all Ultravox adapters and migrated to LiveKit Agents 1.3.0. The
type `UltravoxVoice` is still the canonical voice type used in `AgentMission.voice` and
`MissionManifestEntry.voice`. The `lise-interview` mission uses `voice: "coral"` (PO-locked
2026-05-08), which is a LiveKit/OpenAI Realtime voice — not in the Ultravox named set, but
accepted through the `(string & {})` escape hatch.

Two problems:
1. The type name `UltravoxVoice` is semantically wrong post-Phase-E; it documents Ultravox voice
   IDs while the system now uses LiveKit/OpenAI Realtime voices.
2. The named union (`"terrence" | "mark" | "jessica" | "sarah" | "tina"`) documents Ultravox
   built-in voices that no longer apply. `"coral"` is silently valid but undocumented, which will
   confuse future mission authors.

This is not a runtime bug (TypeScript accepts `"coral"` via the escape hatch), but it creates
incorrect IDE autocomplete and false implicit documentation.

**Remediation:** Rename `UltravoxVoice` to `VoiceId` (or `LiveKitVoice`) and update the named
union to reflect LiveKit/OpenAI Realtime voices in use: `"coral" | "mark" | "alloy" | "echo"` etc.
Update `MissionManifestEntry`, `AgentMission`, and `index.ts` re-export accordingly. This is a
one-file rename with no runtime impact.

---

### F-JR-03 — Phase-E journey narrative discrepancy: wizard → mission ID

**Severity:** MEDIUM

**Files:**
- `docs/journeys/JOURNEY-phase-e-cutover.md:39-40` — describes wizard room → `"lise-interview"`
- `apps/web/src/app/api/wizard/start/route.ts:39` — `missionId = body.mission_id || "onboarding-interview"`
- `services/voice-agent/src/agent.ts:44` — `if (roomName.includes(":wizard:")) return "lise-interview"`

**Observation:** The Phase E journey (J1) states: "voice-agent → `resolveMissionIdFromRoomName(":wizard:")` → `"lise-interview"`". This is accurate at the voice-agent level — the agent resolves mission from room name, not from the `mission_id` body field. However, the wizard/start route defaults `missionId` to `"onboarding-interview"` and logs it; this value is packed into room metadata but is not what the agent uses for mission resolution.

The journey narrative implies a clean single-source mapping. In practice there are two parallel mission IDs in flight: `"onboarding-interview"` (wizard API default, session-start telemetry) and `"lise-interview"` (agent runtime, mission registry). These diverge in the telemetry payload — `voice.session_start` events will log `mission_id: "onboarding-interview"` while the agent actually runs the `lise-interview` persona.

This creates a telemetry ambiguity: dashboards filtering by `mission_id` will not find Phase E wizard sessions under `"lise-interview"`.

**Remediation:** Either (a) update `wizard/start/route.ts` default to `"lise-interview"` to align body metadata with agent runtime, or (b) document the deliberate two-ID pattern in both the route and the journey, with a note on which ID governs telemetry vs agent behavior. Option (a) is simpler and removes the divergence.

---

### F-JR-04 — Non-standard frontmatter status values on 2 journeys

**Severity:** MEDIUM

**Files:**
- `docs/journeys/JOURNEY-agent-harness.md:3` — `status: ready_for_merge`
- `docs/journeys/JOURNEY-cascade-gate-write.md:3` — `status: ready-for-merge`

**Observation:** The CLAUDE.md YAML frontmatter convention defines valid status values as:
`draft | in_progress | review | done | archived`. Neither `ready_for_merge` nor `ready-for-merge`
is in this set. These values break status-based tooling (e.g. the journey portal status changer,
ADR-0031 13-status lifecycle, any `grep status: done` queries).

Additionally the two values use different casing (`ready_for_merge` vs `ready-for-merge`),
indicating they were set independently without a convention check.

**Remediation:** Normalize both to `status: review` (closest canonical equivalent) or advance to
`status: done` if the features have shipped. Update `docs/decisions/0000-decision-log.md` if
either journey introduced decisions that are not yet registered.

---

### F-JR-05 — `botsson-session` mission has empty `systemPrompt` with no schema constraint

**Severity:** MEDIUM

**Files:**
- `packages/ai/src/missions/registry.ts:397` — `systemPrompt: ""`
- `packages/ai/src/missions/types.ts:33` — `systemPrompt: string` (no optional marker)

**Observation:** `botsson-session` intentionally ships with an empty system prompt — the persona
engine injects `context.persona_prompt` at runtime via the `botsson-context` data channel. This
is by design per the mission description. However:

1. `AgentMission.systemPrompt` is typed as `string`, not `string | ""` with a discriminant; any
   consumer that checks `if (mission.systemPrompt)` will silently skip injection for this mission,
   which is correct behavior — but unintentional for any future mission that accidentally ships
   with `systemPrompt: ""`.
2. No comment or discriminant field (e.g. `usesPersonaEngine: true`) marks this mission as
   deliberately using runtime prompt injection, making it indistinguishable from an accidentally
   empty prompt.
3. `agentDisplayName: "Emma"` is a hardcoded fallback that may not match the active persona
   engine's display name in all contexts.

**Remediation:** Add an optional field `personaEngineControlled?: boolean` to `AgentMission`, set
`true` on `botsson-session`. Add a code comment in registry.ts pointing to the context injection
flow. This is a documentation/type safety improvement, not a runtime fix.

---

### F-JR-06 — C1.c Detox E2E deferred — documented inline but no HANDOFF frontmatter field

**Severity:** LOW

**Files:**
- `docs/journeys/JOURNEY-phase-e-cutover.md:135` — inline postcondition note
- `docs/journeys/JOURNEY-phase-e-cutover.md:151` — operator-deferred checklist item (unchecked)
- `docs/journeys/HANDOFF-phase-e-cutover.md` — references deferred items but no structured `deferred` frontmatter field

**Observation:** The audit spec requires "C1.c Detox E2E deferred 2026-05-10 — verify deferment
is documented in JOURNEY frontmatter or HANDOFF." The deferment is documented in two inline
locations within the journey body and the handoff narrative, but neither the journey frontmatter
nor the HANDOFF frontmatter carries a structured `deferred_items:` or `open_items:` field. This
makes machine querying of deferred items difficult (requires body text search, not frontmatter
parse).

The deferment is clearly stated and attributed (Phase F entry), so this is a documentation
structure issue, not a missing acknowledgment.

**Remediation:** Add `deferred_items: ["C1.c Detox E2E mobile voice", "Op 0.10 live wizard smoke"]`
to `JOURNEY-phase-e-cutover.md` frontmatter. This makes the deferred state queryable by tooling.

---

### F-JR-07 — `in_progress` journeys (7) lack explicit deferred-state annotation

**Severity:** LOW

**Files (7):**
- `docs/journeys/JOURNEY-helpdesk-mobile.md`
- `docs/journeys/JOURNEY-helpdesk-web.md`
- `docs/journeys/JOURNEY-handover-migration.md`
- `docs/journeys/JOURNEY-helpdesk-shared-primitives.md`
- `docs/journeys/JOURNEY-journey-control-center.md`
- `docs/journeys/JOURNEY-e2e-wizard-validation.md`
- `docs/journeys/JOURNEY-progressive-channel-schema.md`

**Observation:** These 7 journeys carry `status: in_progress`. Per ADR-0031, the 13-status
lifecycle expects `in_progress` to be a transient state for active development, not a long-term
state. Without a `stale_since:` or `blocked_by:` frontmatter field, it is not possible to tell
whether these are actively being worked, blocked, or effectively deferred indefinitely. The
`journey-control-center` and `helpdesk-*` journeys appear to be features that shipped partial
implementations but have open completions.

**Remediation:** Review each `in_progress` journey; either advance to `done`/`verified` if
shipped, or add a `blocked_by:` or `stale_since:` frontmatter annotation. No immediate code risk,
but these will skew journey portal status counts.

---

## Passing Checks

- **Mission registry completeness:** All 7 missions in `MISSIONS` (`onboarding-interview`,
  `landing-demo`, `lise-interview`, `mr-botsson`, `haccp-inspector`, `shift-assistant`,
  `botsson-session`) are registered in `MissionIdSchema`. No orphaned IDs. ✓
- **MISSION_MANIFEST client-safe:** `manifest.ts` projects only `id, agentDisplayName, greeting,
  uiDescription, voice, language` — no `systemPrompt` exposed. ✓
- **Phase E missions present and populated:** `lise-interview` has `voice: "coral"`,
  `agentDisplayName: "Lise"`, `greeting` populated, `firstSpeaker: "agent"`. `mr-botsson` has
  `greeting: ""` (Jarvis-mode, intentional), `firstSpeaker: "user"`. Both match journey narrative.
  ✓
- **Agent mission resolution:** `resolveMissionIdFromRoomName` in `services/voice-agent/src/agent.ts:44`
  correctly maps `:wizard:` → `"lise-interview"` and `:dashboard:` → `"mr-botsson"`. ✓
- **JOURNEY-phase-e-cutover.md status:** `status: verified` with `updated: 2026-05-10`. ✓
- **C1.c Detox deferment acknowledged:** Present in Journey 3 postcondition and as an unchecked
  operator-deferred item at file line 151. Acknowledged, not forgotten. ✓
- **E2E coverage for engine-world journeys:** `apps/e2e/tests/engine-world/` has three specs
  matching the three `JOURNEY-engine-world-*` journey docs, all `status: done`. ✓
- **Route mission map integrity:** `DashboardShell.tsx` ROUTE_MISSION_MAP uses only valid
  `MissionId` values from the registry (`mr-botsson`, `shift-assistant`, `onboarding-interview`,
  `haccp-inspector`). TypeScript type enforces this at compile time. ✓
- **`compile.ts` correctness:** Journey compiler is a pure function with no DB access. Interface
  types are well-defined. No ADR-0031/0038 violations in the compile path. ✓
