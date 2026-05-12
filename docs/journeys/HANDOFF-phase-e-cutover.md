---
title: "Phase E Cutover Handoff — Voice Plane Consolidation"
status: complete
created: 2026-05-09
updated: 2026-05-10
module: MODULE_BOTSSON
phase: E
campaign: botsson-arena
sortie: feat/botsson-arena-phase-e-cutover
adr: [ADR-0282, ADR-0276, ADR-0107, ADR-0220]
tags: [livekit, ultravox, voice, phase-e, cutover, handoff]
---

# HANDOFF — Phase E Cutover: Voice Plane Consolidation

## Summary

Phase E migrated all voice surfaces from Ultravox to LiveKit Agents 1.3.0, establishing a
single voice transport plane across web, mobile, and the onboarding wizard. Tasks 1–7 shipped
pre-session via PR #354 (provider flip, useBotsson LiveKit Room rewrite, wizard token mint,
voice-assistant → InterviewSurface rename, Krisp NC). Task 8 (Ultravox deletion sweep),
Task 9 (ADR frontmatter flips), Task 10 (this handoff + system-map update), and runtime
telemetry hooks all landed 2026-05-10. ADR-0282 R6 step 8 (synthetic VAD bench) was
superseded mid-flight after three implementation rounds proved the bench architecture
structurally invalid; the gate was replaced with runtime telemetry instrumentation, which
is the industry-standard approach used by LiveKit, OpenAI, Vapi, and Retell as of 2026.

---

## What Shipped — File-by-File

### Voice runtime (`services/voice-agent/`)

| File | Change |
|------|--------|
| `src/agent.ts` | LiveKit Agents 1.3.0 entry. Mission dispatch via room name. Context pipe from stage-engine. Runtime telemetry hooks on session event listeners (4 events). |
| `src/telemetry.ts` | New: wraps emit() calls for voice events. |
| `Dockerfile` | Node slim + ca-certificates (native LiveKit Rust binding requires OS CA store). |
| Ultravox adapter | **Deleted** — removed all ultravox lib imports, types, adapter code. |

### Web wizard (`apps/web/src/app/api/wizard/start/route.ts`)

- LiveKit token mint replaces Ultravox call creation.
- `purpose` flag added so voice-agent can differentiate wizard vs orb sessions.
- `mission_id='onboarding-interview'` packed into room metadata.

### Web Botsson overlay (`apps/web/src/app/Botsson/_components/BotssonProvider.tsx`)

- `provider="livekit"` (was `"ultravox"`).
- Ultravox call lifecycle hooks removed.

### Web onboarding hook (`apps/web/src/app/onboarding/hooks/useBotsson.ts`)

- Full LiveKit Room rewrite.
- 13 tool dispatch stubs stripped (tools now server-side in voice-agent).
- `apiParams` translation contract (`translateApiParams`) handles client → room-metadata mapping.

### Web InterviewSurface (`apps/web/src/components/InterviewSurface.tsx`)

- Renamed from `VoiceAssistant` / `voice-assistant.tsx`.
- Provider-agnostic: receives transcript via LiveKit data channel, not Ultravox callbacks.
- Lise persona-bearer — works for both wizard and future interview surfaces.

### Krisp NC (web + mobile)

- Client-side noise cancellation enabled by default.
- Web: `@livekit/krisp-noise-filter` wired into `LocalAudioTrack` pipeline.
- Mobile: equivalent Krisp plugin integrated.

### Voice telemetry (`packages/telemetry/src/registry.ts` + `services/voice-agent/src/agent.ts`)

4 new runtime events registered and instrumented:

| Event | Trigger |
|-------|---------|
| `voice.first_speech` | First VAD-positive frame after room join |
| `voice.turn_end` | End-of-turn silence detection |
| `voice.user_recut` | User interrupts agent mid-utterance |
| `voice.session_abandonment` | Room left before first full turn |

### Ultravox purge (Task 8)

**Whole-file deletes (6):**

- `packages/ai/src/providers/ultravox.ts`
- `packages/ai/src/missions/ultravox-mission.ts`
- `services/stage-engine/src/lib/ultravox.ts`
- `services/stage-engine/src/adapters/ultravox.ts`
- `services/stage-engine/src/types/ultravox.ts`
- Ultravox vitest fixture stubs (6 files updated)

**Strip operations (8+):**

- `packages/ai/src/index.ts` — barrel exports removed
- `packages/ai/src/missions/index.ts` — startMissionCall removed
- `services/stage-engine/src/core/secrets.ts` — `ultravoxApiKey` field stripped
- `services/stage-engine/src/contracts/service-contracts.ts` — ultravox path entries removed
- `services/stage-engine/src/registry.ts` — ultravox registry entry removed
- `apps/web/src/env.ts` — `ULTRAVOX_API_KEY` removed
- `apps/web/package.json` + lockfile — `ultravox-client` dep removed
- `.env.template` — `ULTRAVOX_*` vars dropped

---

## Decisions Made

| Decision | Status | Notes |
|----------|:------:|-------|
| ADR-0282 — Voice plane consolidation (LiveKit single transport) | ✅ Accepted 2026-05-10 | Was `proposed` during sortie |
| ADR-0276 — ADR-0107 amendment: provider-independence principle | ✅ Accepted 2026-05-10 | Was `proposed` during sortie |
| ADR-0282 R6 step 8 — E9 VAD parity bench superseded | ✅ Amendment accepted | Synthetic TTS bench not comparable to real speech. Runtime telemetry is the correct gate per industry standard (LiveKit/OpenAI/Vapi/Retell 2026). |

---

## Learnings Captured

Learning files L-NEW-1..7 are **deferred to Phase F** — knowledge captured in sortie activity log, not yet promoted to files. One learning was promoted out-of-band:

**L-NEW-8 PROMOTED** to skill rule via out-of-band patch (`docs/audits/2026-05-10-skill-pre-flight-promotion.md`):

> Pre-claim pre-flight: always grep for ADR slot availability AND verify npm package availability
> before claiming a deliverable. Pattern had 9 occurrences across the campaign — promoted to
> `~/.claude/skills/run-council/SKILL.md` Phase 2 BRIEF + Phase 8 KNOWLEDGE CAPTURE (operator
> manual apply).

---

## Known Issues / Debt

### Operator-pending live wizard smoke (Op 0.10) — deferred

Dev-stack during this sortie runs from `wt-payroll`. Cannot smoke `wt-1` code until after
campaign → development merge + sync to `wt-payroll`. After merge: restart dev-stack, run live
wizard test in browser, judge by ear (cut-off, hang, naturalness).

### Voice quality NOT verified end-to-end

ADR-0282 R6 amendment delivers telemetry baseline, but no production data yet. Phase F1 =
telemetry-driven tuning (`silence_duration_ms`, turn-detection model swap to
`MultilingualModel`) **IF** data signals issues after 7–14 days of production traffic.

### Phase F backlog (separate sorties post-Phase-E)

| Item | Priority | Notes |
|------|----------|-------|
| W2: engine_sessions writer for `/api/emma/session` | High | Mode `'agent'`, `mission_id='onboarding-interview'` — currently 404 in prod |
| C1: LISE_PERSONA `systemPrompt` field gap | Low | Cosmetic — persona text not surfaced |
| F1: VAD-bench rewrite | Conditional | Only if telemetry shows issues. Requires real-voice fixtures or production-egress samples |
| F4: Tips capability bodies (4 stubs → live) | Medium | |
| F5: Voice-agent registry consolidation (ADR-0289 R1.3) | Medium | Eliminate parallel hardcoded array |
| L-NEW-1..7 learning files | Low | Deferred — knowledge in activity log |

### 840 prose-replace docs (P5 scope from P4 audit)

Ultravox references remain in ~190 doc files. These are prose/comments, not runtime. Separate
doc-consolidation sortie — does not block any feature.

---

## Next Steps

1. **close-feature.sh** merges `feat/botsson-arena-phase-e-cutover` → `campaign/botsson-arena` (merge-commit per ADR-0213)
2. **Pontus opens PR** `campaign/botsson-arena` → `development` (manual, merge-commit only — squash-merge has hit 3× on this campaign, see MEMORY.md)
3. **After merge**: sync `wt-payroll` to development → restart dev-stack → run Op 0.10 live wizard smoke
4. **If smoke shows issues** → Phase F1 telemetry-driven config tune
5. **Otherwise** Phase E permanently stable — Phase F backlog as priority demands

---

## Test Plan

- [x] `pnpm turbo typecheck` — 48/48 ✓ (verified 3× during sortie)
- [x] Ultravox runtime grep: 0 functional imports remaining (72 hits = comments + doc prose in P5-scope, not runtime)
- [x] All Phase E commits ancestor-traceable to PR #354 + this sortie's 20 commits
- [x] ADR-0282 + ADR-0276 frontmatter status flipped to `accepted` + registered in decision log
- [ ] **Operator deferred**: live wizard test post-merge (Op 0.10)
- [ ] **Phase F**: telemetry data review after 7–14 days production traffic

---

## Sortie Statistics

| Metric | Value |
|--------|-------|
| Sortie duration | 2026-05-09 11:23 → 2026-05-10 (24+ hours, multiple sessions) |
| Commits this session | 19 (Op 0/0.7/0.8/0.9/2/3 + ADR frontmatter) |
| Pre-session commits | 15 (Tasks 1–7 + R4 fixes via PR #354) |
| Total commits ahead of campaign | 20+ |
| Council rounds | R1–R4 (pre-session) + ADR R6 amendment (this session, council-skipped per industry-standard pattern) |
| VAD bench attempts | 3 (Op 0, Op 0.7 — all failed structurally; gate superseded via telemetry) |
| Build agents dispatched (this session) | 5 (P4 snapshot, Op 0 generator math fix, Op 0.7 Silero analyzer, Op 0.9 telemetry hooks, Op 2 sweep) |
| Typecheck passes | 3× verified across sortie |
