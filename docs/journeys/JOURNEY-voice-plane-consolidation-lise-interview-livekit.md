---
title: "Journey — Lise Interview Persona on LiveKit InterviewSurface"
feature: voice-plane-consolidation
journey: lise-interview-livekit
status: draft
verified_at: null
e2e_test: null
created: 2026-05-04
updated: 2026-05-04
module: MODULE_BOTSSON
tags: [journey, voice, lise, interview, persona, livekit]
---

# Journey: Lise Interview Persona on LiveKit InterviewSurface

**Role:** new hire / contract-intake interviewee

**Precondition:**
- Contract-intake flow active (`apps/web/src/components/voice-assistant.tsx` REWRITTEN as `<InterviewSurface persona={lisePersona} />`)
- Lise persona config loaded (warm tone, structured cadence, dedicated transcript surface)
- LiveKit Room mintable for interview session

## Happy Path

1. New hire opens contract-intake interview link → InterviewSurface mounts with Lise persona prompt
2. LiveKit Room connects → voice-agent applies Lise persona (system prompt = `lisePersona.systemPrompt`, voice = Lise voice config, VAD `silence_duration_ms: 250` for warm interview cadence)
3. Lise greets in warm structured tone: "Hei, jeg er Lise. Jeg skal ta deg gjennom kontrakten din. Skal vi begynne?"
4. Interview proceeds — Lise asks structured questions, transcripts render on dedicated InterviewSurface (NOT generic Arena transcript)
5. Each interview field maps to `contract_intake.submitFieldGroup` capability tool (existing capability) → `gate_action` → DB write → `emit("contract_intake.field_group_submitted")`
6. Interview completes → `contract_intake.declineIntake` or finalize → workspace state updated

**Postcondition:**
- Lise persona contract preserved (warm tone, structured pace, dedicated visual surface)
- All interview fields persisted via existing contract-intake capability (no new mutation path)
- Recording: `agent_session_recording` row with persona='lise' tag
- Zero Ultravox surface in session-recording trace

## Error Paths

- **Scenario: Lise persona drift** → frontend-designer review at G3 gate flags regression → Pontus approval required before merge
- **Scenario: Interview interrupted** → resume from last `engine_sessions` checkpoint (mode='agent', process_id='contract_intake_v1' or similar)
- **Scenario: PII voice exposure attempt** (e.g., user asks Lise to "lese opp personnummeret mitt") → Lise refuses per ADR-0078 + ADR-0163 — replies with chat redirect
- **Scenario: Network drop mid-interview** → state preserved in engine_sessions → resume on reconnect

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists at `apps/e2e/tests/journey-lise-interview-livekit.spec.ts` and passes
- [ ] Pontus G3 approval gate passed (Lise voice + tone + cadence preserved)
- [ ] InterviewSurface renders dedicated transcript (NOT generic Arena transcript)
- [ ] Recording trace: zero Ultravox, persona='lise' tag present

**Mark `status: verified` in frontmatter when all five boxes are checked.**
