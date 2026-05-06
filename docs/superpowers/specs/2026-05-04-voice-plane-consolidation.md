---
title: "Voice Plane Consolidation — Single-Plane LiveKit, Ultravox Removed"
status: draft
created: 2026-05-04
updated: 2026-05-04
module: MODULE_BOTSSON
campaign: botsson-arena
phase: E
adr: ADR_0282
plan: docs/plans/PLAN-voice-plane-consolidation.md
council_review: 2026-05-04
council_verdict: "APPROVE WITH CHANGES — 12 amendments applied"
tags: [livekit, ultravox, voice, voice-agent, consolidation, botsson, phase-e]
---

# Voice Plane Consolidation — Single-Plane LiveKit, Ultravox Removed

## Summary

Phase E of campaign/botsson-arena. Eliminate dual voice plane (Ultravox web + LiveKit mobile). All voice surfaces consolidate on LiveKit Agents 1.3.0 via `services/voice-agent/`. Migrate 14 `useBotsson.ts` client-tools to server-side capability tools/bridges (8-9 net-new + reuse + 1 client-only). Wire Krisp NC client-side. Amends ADR-0135 R1.

## Authoritative references

- **ADR-0282** `docs/decisions/0282-voice-plane-consolidation-livekit-only.md` — decision document, post-council corrected R4 + R6
- **ADR-0276** (pending) — ADR-0107 amendment (provider-independence note for `mode→channel` derivation contract)
- **ADR-0284** (pending) — Phantom-Reuse Detection in Capability Plans (promotes L-0176 body-trace pattern)
- **PLAN** `docs/plans/PLAN-voice-plane-consolidation.md` — sortie spec with E1-E10 sequencing
- **CAMPAIGN** `docs/plans/CAMPAIGN-botsson-arena.md` Phase E section

## Spec scope

This spec is the contract surface for Phase E. ADR-0282 is the decision record; PLAN is the execution sequence; this spec ties them with falsifiable journey contracts. Implementation details live in PLAN, not here.

## Out of scope

- Mobile voice (already on LiveKit per ADR-0135 R1; Phase E does not change mobile)
- B1 SS-4 dual-gate orchestrator migration (separate sortie; Phase E uses direct `gate_action`)
- Helpdesk voice (Phase B3 sortie; depends on Phase E completion)
- Outbound SIP / PSTN (post-Phase-E roadmap)

## Phase E sequence (per ADR-0282 R6 corrected)

E1: 8-9 net-new tools/bridges in `onboarding` capability + classifier + authority seed
E2: `/api/emma/session` BFF route reads `engine_sessions` mode='agent'
E3: BotssonProvider provider flip + useBotsson rewrite + apiParams translation contract
E4: voice-assistant.tsx REWRITE as `<InterviewSurface persona={...} />` (Lise persona preserved)
E5: wizard /api/wizard/start LiveKit token flip (≤1 deploy cycle after E3)
E6: Deletions — 12+ Ultravox surfaces (full grep scope per AC #1)
E7: Krisp NC wiring + 3-state pill UI on BotssonSticky
E8: ADR-0107 amendment land
E9: VAD parity gate — `services/voice-agent/scripts/vad-bench.ts`, P50 ≤ 600ms, P95 ≤ 900ms
E10: HANDOFF + ADR-0282 status flip + SYSTEM-MAP update

See PLAN for per-step detail.

## Open items

- [ ] cascade-developer pre-flight verification: I1 industry intelligence bootstrap fires on workspace creation BEFORE D1 cascade writes (add_departments/locations/zones)
- [ ] Authority levels per tool — recommendation in ADR open items
- [ ] Pontus Lise voice approval gate (G3 review)
