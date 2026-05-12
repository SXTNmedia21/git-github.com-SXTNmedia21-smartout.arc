---
title: "Mission Template Registry — kode som source-of-truth, DB-seed som deploy-time-derivat, build-time paritets-sjekk"
id: ADR_0272
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
depends_on:
  - ADR-0274 (Mission Run Contract)
---

# ADR-0272: Mission Template Registry — kode som source-of-truth, DB-seed som deploy-time-derivat

## Context and Problem Statement

Welcome Mission V0 introduserer et mønster der `engine_missions.system_prompt` og `engine_stages.personality_override` er viktig prompt-tekst som skal endres via PR, ikke via SQL-direktiv i prod-DB.

I dag er det ingen formalisert kontrakt mellom TypeScript-source og DB-rader for missions. For eksisterende missions (onboarding-interview, season-lifecycle) er DB-raden eneste kilde — ingen TS-ekvivalent. Dette fører til:
- Drifting: DB kan endres uten PR-spor
- Ingen validering av at tekst-innhold er korrekt ved deploy
- Ingen type-safety på stage-IDer eller tool_allowlist

## Decision Drivers

- `system_prompt` er 13-linjes norsk tekst med presise ord ("Du sier aldri: «Først må vi...»") — feil her er UX-disaster
- `personality_override` per stage er hot-swap-target — prompt-tekst må kunne reviewes i PR-diff
- Eksisterende missions er ikke TypeScript-definerte — ingen breaking change for dem

## Considered Options

1. **Option A** — DB-raden er eneste source-of-truth (eksisterende pattern)
2. **Option B** — TypeScript-kode er source-of-truth; DB-rad er deploy-time-derivat; build-time paritets-sjekk (dette ADR)
3. **Option C** — YAML/JSON-filer i repo er source-of-truth; TS + DB derivert

## Decision Outcome

Chosen option: **"Option B"** — TypeScript source-of-truth for `welcome_mission_v1`. DB-seed-migrasjon er deploy-time-derivat av TS-kode. Build-time paritets-test verifiserer synk.

## Teknisk beslutning

### Fil-plassering

```
packages/ai/src/missions/welcome/
  template.ts        ← source-of-truth (exporterer welcomeMissionV1)
  template.test.ts   ← paritets-sjekk kode↔seed
  index.ts           ← re-eksporterer for consumer-bruk
```

### Eierskap-kontrakt

- **Endre tekst:** PR til `template.ts` + tilhørende seed-migrering. Begge endringer i samme commit.
- **Prod hotfix av klønete tekst:** Tillatt via deploy (ny migrasjon med `ON CONFLICT DO UPDATE`), men krever ny versjon (`welcome_mission_v2`) for audit-spor. Direkte SQL-edit på prod er forbudt.
- **Versjonering:** Ny major endring i `system_prompt` eller stage-struktur → ny `welcome_mission_v2`. Ikke edit av v1.

### Paritets-test (template.test.ts)

Testen verifiserer:
1. Mission ID er `'welcome_mission_v1'`
2. 4 stages i korrekt rekkefølge
3. Tool_allowlist per stage matcher template
4. `system_prompt` inneholder ikke forbudte fraser
5. `exit_criteria` er any_of-disjunktiv for alle stages

Testen er IKKE en full DB-roundtrip — den sjekker TS-kode mot forventede konstanter. Full DB-roundtrip er i T6 (E2E-spec).

### Seed-migrering

Seed bruker `ON CONFLICT (id) DO NOTHING` (mission) og `ON CONFLICT (mission_id, stage_id) DO NOTHING` (stages). Dette er idempotent for initial deploy. For tekst-endringer kreves ny migrering med `DO UPDATE`.

### For eksisterende missions

Onboarding-interview, season-lifecycle, etc. forblir DB-only. Dette ADR gjelder kun for missions som trenger PR-sporing av prompt-tekst. Fremtidige missions bør følge dette mønsteret.

## Rules & Consequences

- **Good, because** `personality_override`-endringer er synlige i PR-diff (reviewer kan se prompt-tekst)
- **Good, because** build-time test fanger sync-feil FØR deploy
- **Good, because** type-safety på `WelcomeStageId` og `ExitCriteriaItem` i TS
- **Bad, because** to filer (template.ts + migrasjon) må holdes i sync — risiko for drift mellom deploys
- **Bad, because** prod hotfix krever ny versjon (`v2`) i stedet for direct SQL-edit
- **Agent Impact:** Alle endringer i `system_prompt`, `personality_override`, `exit_criteria` og `tool_allowlist` for welcome mission MÅ gå gjennom `template.ts` → ny migrasjon → PR. Ingen direkte Supabase Studio-editing.

## Implementation notes

- `welcomeMissionV1` eksportert som `const` med `as const` — TypeScript kan validere fullstendighet
- Fremtidig agent: `MissionRegistry`-klasse i `packages/ai/src/missions/registry.ts` som samler alle TS-definerte templates og kan eksponere en sync-command
- V0.1: legg til `personality_override_voice TEXT NULL` kolonne for voice-spesifikke posture-prompts (defer per §10.4 i design)

## Migration strategy

`engine_missions.system_prompt` finnes allerede via `20260318120000_engine_tuning_notes_and_mission_prompt.sql` (B3-fix per PLAN-welcome-mission-rework). Ingen ny kolonne-migrasjon nødvendig.

M6 (seed) er initial deploy. Tekst-endringer i template.ts trigger ny migrasjon med `ON CONFLICT (id) DO UPDATE SET system_prompt = EXCLUDED.system_prompt` (mission) og tilsvarende for stages.

---

> Etter skriving: registrer i `docs/decisions/0000-decision-log.md`
