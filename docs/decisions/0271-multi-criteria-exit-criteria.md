---
title: "Multi-criteria Exit Criteria — exit_criteria_jsonb shape, evaluator-protokoll, back-compat fallback"
id: ADR-0271
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
depends_on:
  - ADR-0274 (Mission Run Contract)
---

# ADR-0271: Multi-criteria Exit Criteria — exit_criteria_jsonb, evaluator-protokoll, back-compat

## Context and Problem Statement

`engine_stages` har i dag kun `success_criteria TEXT` — en fri-tekst beskrivelse av hva som er "ferdig". Dette er ikke maskinlesbart. Stage-manager kan ikke avgjøre advance deterministisk; det er overlatt til LLM-self-eval eller manuelt trigger via `/advance`-ruten.

For Welcome Mission V0 trenger vi:
- **Tid-basert** exit: stage avanserer automatisk etter N sekunder
- **Event-basert** exit: stage avanserer når spesifikt event observeres i session-stream
- **Signal-basert** exit: stage avanserer når et felt i `collected_data` er satt

Og vi trenger **bakover-kompatibilitet**: eksisterende stages som kun har `success_criteria` TEXT skal fortsette å fungere.

## Decision Drivers

- LLM-self-eval på exit-tidspunkt er non-deterministisk og drift-sårbar
- Welcome mission har 4 stages med ulike exit-mønstre
- Eksisterende 5+ missions (onboarding-interview, season-lifecycle, etc.) har `success_criteria` TEXT — ingen breaking change tillatt
- Test-krav (T1 i spec): pure-function test av evaluator uten DB-avhengigheter

## Considered Options

1. **Option A** — Kun tid-basert exit (enkel, ufullstendig)
2. **Option B** — `exit_criteria_jsonb` med any_of-disjunktiv + back-compat fallback til `success_criteria` (dette ADR)
3. **Option C** — Separat `stage_exit_rule`-tabell per kriterium

## Decision Outcome

Chosen option: **"Option B"** — ny `exit_criteria_jsonb JSONB NULL`-kolonne på `engine_stages`, evaluert disjunktivt (ett oppfylt kriterium = advance), med explicit fallback til `success_criteria` TEXT for stages uten jsonb.

## Teknisk beslutning

### Schema for `exit_criteria_jsonb`

```json
{
  "any_of": [
    { "type": "time",   "seconds": 180 },
    { "type": "event",  "name": "user.asked_question" },
    { "type": "signal", "name": "user.declared_intent" }
  ]
}
```

Gyldige `type`-verdier:
- `"time"` — sekunder siden `engine_sessions.stage_started_at`
- `"event"` — event-navn observert i session-stream siden stage startet. Opsjonelt felt: `threshold_seconds` (bruker spoke_continuously i stage 3)
- `"signal"` — felt i `engine_sessions.collected_data` som er `true` eller `"achieved"`

### Evaluerings-protokoll

```typescript
function shouldAdvanceStage(stage, session, elapsedSeconds, recentEvents): boolean {
  if (!stage.exit_criteria_jsonb) {
    // Fallback: success_criteria er tekstuell — stage bruker tid-threshold fra target_duration_seconds
    return stage.target_duration_seconds != null && elapsedSeconds >= stage.target_duration_seconds;
  }
  for (const c of stage.exit_criteria_jsonb.any_of) {
    if (c.type === "time"   && elapsedSeconds >= c.seconds)           return true;
    if (c.type === "event"  && recentEvents.includes(c.name))         return true;
    if (c.type === "signal" && collectedData[c.name] == "achieved")   return true;
  }
  return false;
}
```

Funksjonen er **pure** (ingen DB-kall) og kan enhetstestes direkte (T1 i spec).

### Back-compat

- `exit_criteria_jsonb IS NULL` → evaluator faller tilbake til `target_duration_seconds`-logikk
- `target_duration_seconds IS NULL` → ingen automatisk advance (eksisterende oppførsel: manuell advance via `/advance`-route)
- `success_criteria` TEXT beholdes for alle stages — bakover-kompatibelt + brukes som display-string i Guardian-admin-UI

### Tool_allowlist-kolonne

Bundlet inn her siden begge kolonner er på `engine_stages` og krever ADR:

`tool_allowlist TEXT[] NOT NULL DEFAULT '{}'` — empty array = ingen restriksjon. Tool-selector filtrerer hard (ikke soft) mot allowlist når array er ikke-tom. Se tool-selector impl i spec §2.11.

## Schema-endringer

Se `IMPLEMENTATION_SPEC_welcome_mission_v0.md` M2 for full SQL.

Nye kolonner på `engine_stages`:
- `tool_allowlist TEXT[] NOT NULL DEFAULT '{}'`
- `target_duration_seconds INTEGER NULL`
- `exit_criteria_jsonb JSONB NULL`

## Rules & Consequences

- **Good, because** pure-function evaluator er testbar uten DB (T1 grønt)
- **Good, because** eksisterende missions bryter ikke (NULL exit_criteria_jsonb → fallback)
- **Good, because** `tool_allowlist` er bakover-kompatibel (tom array = ingen restriksjon)
- **Bad, because** event-stream (`recentEvents`-array) må propageres til evaluator — ny parameter i stage-manager
- **Bad, because** signal-evaluering fra `collected_data` er statisk (sist-kjent state, ikke sanntids-stream)
- **Agent Impact:** Stage-manager må hente `recentEvents` fra session-stream og sende til `shouldAdvanceStage`. Guardian-evaluator trenger samme parameter ved periodic eval.

## Implementation notes

- Event-stream for en session: `guardian_log`-rader med `session_id = X` siden `stage_started_at`
- `recentEvents` = `guardian_log.event_type`-verdier filtrert på stage-tidspunkt
- Minimum implementasjon for V0: kun `time`-kriterier er fully automated; `event` og `signal` krever at noe faktisk emitter disse events til guardian_log

## Migration strategy

M2 er additive (ALTER TABLE ADD COLUMN). Ingen eksisterende data endres. `DEFAULT '{}'` og `NULL` defaults er bakover-kompatible.

---

> Etter skriving: registrer i `docs/decisions/0000-decision-log.md`
