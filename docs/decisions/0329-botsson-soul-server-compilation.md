---
title: "Botsson Soul — server-compiled, not frontend-asserted"
id: ADR_0329
status: proposed
layer: decision
created: 2026-05-15
updated: 2026-05-15
---

# ADR-0329: Botsson Soul — server-compiled, not frontend-asserted

**Status:** Proposed
**Date:** 2026-05-15

## Context and Problem Statement

Botsson har i dag inkonsistent oppførsel på tvers av kanaler. UI lar bruker velge persona, rank, blend og custom instruction. Voice-kanalen (LiveKit + OpenAI Realtime) mottar disse som `persona_prompt` og bruker dem. Chat-kanalen (`/api/emma/chat` → stage-engine `/agent/chat`) dropper dem helt — chat bruker mission-default. Resultat: bruker tror Botsson er tunet, men kun voice-halvdelen endrer seg. Tillit brytes.

Den naive løsningen er å videresende `persona_prompt`-strengen fra browser til stage-engine også for chat. Men det åpner en authority-bakdør: en kompromittert klient eller manipulert localStorage kan injisere en system-prompt som overstyrer mission-prompt, posture, channel-policy, eller (verre) får agenten til å late som han har høyere autoritet enn brukeren faktisk har.

## Decision Drivers

- Brukeren skal oppleve samme Botsson i chat og voice (tillit).
- Frontend-state kan ikke være canonical prompt-kilde (sikkerhet / authority).
- `engine_authority_config` + `gate_action` (C4-systemet) er allerede source of truth for tilgang — Soul-laget kan ikke utvide det.
- Audit-pipe må kunne forklare hvorfor agenten svarte som han gjorde (Soul Snapshot, se [ADR-0330](0330-botsson-soul-snapshot-audit.md)).
- Channel-policy (chat-only / voice-only verktøy per ADR-0078) må fortsatt være absolutt.

## Considered Options

1. **Frontend sender ferdig `persona_prompt`-streng** (naiv fiks for chat-dissonans). Rejected — authority-bakdør, ingen versjonering, ingen audit.
2. **Frontend sender preferanse-payload (persona/rank/blend/custom_instruction); stage-engine kompilerer canonical Soul Contract**. Chosen.
3. **Persona kun via DB-default, ingen runtime-input fra UI**. Rejected — fjerner brukervalg, ikke kompatibelt med UX-mål.

## Decision Outcome

Botssons sjel er en **server-kompilert, versjonert runtime-kontrakt**. Frontend sender preferanse-input (`identity`, `custom_instruction`, `voice_input`, `page_route`); stage-engine resolver mot:

1. System default
2. Workspace agent profile (`botsson_profile`)
3. Role-based defaults
4. User preference (`botsson_user_preference`)
5. Session override
6. Channel constraints
7. Safety/system constraints
8. Authority constraints (absolutt, alltid sist)

Authority er aldri user-overridable. Channel policy er alltid absolutt. Custom instruction validerers + maks-lengde 2000 tegn + avvises hvis den prøver å gi authority/bypass audit/disable safety.

## Rules & Consequences enforced for Agents

- **Good, because** chat og voice deler samme resolved identity, posture, context, memory, authority envelope.
- **Good, because** authority-systemet (C4) bevares uendret — Soul-laget er rent presentasjons-/tone-lag.
- **Good, because** all preferanse-kompilering er auditbar via Soul Snapshot ([ADR-0330](0330-botsson-soul-snapshot-audit.md)).
- **Bad, because** introduserer ~4 nye tabeller (`botsson_profile`, `botsson_user_preference`, `botsson_workspace_policy`, `botsson_soul_snapshot`).
- **Bad, because** krever rewrite av `/api/emma/chat` body-schema for å akseptere `identity` + `custom_instruction` istedenfor `persona_prompt`.

**Agent Impact:**
- `system-agent-coordinator` + `botsson-harness-builder` må lese full spec-pakke under `docs/modules/botsson-soul-docs/` før implementasjon.
- Capability-tools beholdes uendret — Soul-laget treffer kun system-prompt-konstruksjon + posture-resolve.
- `engine_authority_config` er fortsatt eneste authority-kilde.

## Cross-references

- `docs/modules/botsson-soul-docs/` — full spec-pakke (7 dokumenter, v0.2)
- `docs/architecture/BOTSSON_SOUL_ARCHITECTURE.md` — 8-lags overview
- [ADR-0078](0078-channel-pinning-policy.md) — channel-pinning for tool-availability
- [ADR-0151](0151-server-derived-actor-identity.md) — actor identity derived server-side, never client-asserted (same prinsipp anvendt på persona)
- [ADR-0244](0244-capability-boundary-discipline.md) — capability-boundaries
- [ADR-0327](0327-harness-adapter-unified-llm-consumer.md) — HarnessAdapter (Soul Resolver bygger på samme contract-tankegang)
- [ADR-0330](0330-botsson-soul-snapshot-audit.md) — audit-paret til denne ADRen
