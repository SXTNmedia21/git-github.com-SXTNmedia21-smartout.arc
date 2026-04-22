---
id: L-0106
title: "Whisper ≠ takeover — metadata injection is a legitimate C4 control surface"
status: accepted
date: 2026-04-22
module: MODULE_BOTSSON
tags: [learning, authority, c4, agent-control, channel-restriction, adr-0078]
---

# L-0106 — Whisper ≠ takeover

## Context
2026-04-22 council split 2-2 på "Platform Admin intervention":
- Steward + Supervisor: read + flag only (konservativt, forkastet takeover)
- Coordinator + Frontend: read + flag + whisper + force-stop (aktiv)

Konflikten ble løst ved at Coordinator definerte **whisper**: admin injiserer metadata i neste turn's system-prompt via `<admin_note>`-block. Aldri rendered til bruker, honorerer ADR-0078 (channel restriction).

## Learning

**Det finnes et mellomrom mellom "takeover" og "read-only" som ikke er åpenbart:**

- Takeover = admin prater som Emma → bryter "confident ≠ authorized", ansvarsuklar, ADR-0078-risk
- Read-only = admin ser men kan ikke påvirke → utilstrekkelig for "håndteres derfra"
- **Whisper = admin gir kontekst til Emma som hun kan anvende eller avvise → legitim C4 control surface**

Whisper er metadata, ikke conversation. Den lever i system-prompt, ikke i assistant-output. CI-enforcer at `<admin_note>` aldri lekker til bruker-facing rendering.

## Rule

Når en intervention-overflate foreslås:

1. **Klassifiser:** er dette metadata eller conversation?
2. **Hvis metadata:** hvor lever den (system-prompt, authority-config, memory)? Hvordan sikres at den ikke lekker til user-facing?
3. **Hvis conversation:** krever det takeover? Da: sannsynligvis feil modell.

Whisper-mønsteret kan generaliseres:
- Guardian → agent: auto-whisper på tidligere feil
- K1b workspace-memory → agent: workspace-specific adjustments
- Admin → agent: direkte kontekst

Alle er varianter av "metadata-injection into system-prompt", alle må passere samme CI-gate ("aldri rendered").

## How to apply

- Før noen ADR/design foreslår intervention-tools → spør: "er dette whisper-form eller takeover-form?"
- Whisper-form implementer via `<admin_note>` system-prompt block + prompt-builder enforcement
- Takeover-form: avvis som default; kreves eksplisitt ADR med separate authority-tier

## References
- ADR-0185 §Whisper
- ADR-0078 (channel restriction)
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-22
