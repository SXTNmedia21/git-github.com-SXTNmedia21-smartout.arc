---
title: Soul Contract — Botsson Soul
status: draft
version: 0.3
created: 2026-05-15
updated: 2026-05-15
module: agent-system
tags: [botsson, soul, contract, agent]
---

> **Changelog 0.3 (2026-05-15)**: la til "Mission interaksjon"-seksjon — mission-bound stages overstyrer preset for identity+posture, men aldri authority eller channel policy. Resolution Order utvidet med 3.5.
>
> **Changelog 0.2 (2026-05-15)**: fikset Resolution Order så authority er absolutt og kommer SIST (motsa tidligere non-negotiables #3 + #4). Channel policy og safety policy flyttet før authority.

# Soul Contract — Botsson Soul

## Mantra

> Én sjel. Flere kanaler. Samme autoritet. Ulike evner.

---

## Definition

Botssons sjel er en server-kompilert, versjonert og auditérbar runtime-kontrakt.

Den bestemmer:

1. Hvem Botsson er.
2. Hvordan han oppfører seg.
3. Hvordan han høres ut.
4. Hvilken modell han bruker.
5. Hva han vet nå.
6. Hva han husker.
7. Hva han har lov til.
8. Hvilke verktøy han kan bruke.
9. Hva aktiv kanal tillater.

---

## Soul Layers

| Lag | Navn | Ansvar |
|---|---|---|
| 1 | Identity | Hvem Botsson er |
| 2 | Instruction Overlay | Spesifikke bruker/workspace-instruksjoner |
| 3 | Posture | Hvordan Botsson oppfører seg i situasjonen |
| 4 | Voice | Hvordan Botsson høres ut i voice |
| 5 | Model Policy | Hvilken modell som brukes |
| 6 | Context | Hva Botsson vet akkurat nå |
| 7 | Memory | Hva Botsson husker fra før |
| 8 | Authority | Hva Botsson har lov til |
| 9 | Tools | Hva Botsson kan gjøre |
| 10 | Channel Policy | Hva kanalen tillater |

---

## Non-negotiables

### 1. Frontend er ikke autoritativ prompt-kilde

Frontend kan sende preferanser, men ikke autoritativ system-prompt.

Tillatt:

```json
{
  "identity": {
    "persona": "puls",
    "rank": "manager",
    "blend": 7
  },
  "custom_instruction": "Svar kort og direkte."
}
```

Ikke canonical:

```json
{
  "persona_prompt": "You are Botsson..."
}
```

---

### 2. Chat og voice skal dele samme identity

Hvis bruker velger `Brannslukker`, skal både chat og voice bruke samme løste identity.

Ulike kanaler kan ha ulike evner, men ikke ulik sjel uten eksplisitt channel override.

---

### 3. Authority overstyrer alltid persona

Persona kan endre tone, tempo og uttrykk. Persona kan aldri gi mer tilgang.

```txt
Brannslukker + read_only = tydelig forklaring, ingen write-action
Brannslukker + confirm   = forslag, men krever godkjenning
Brannslukker + autonomous = handling innenfor delegert scope
```

---

### 4. Channel policy overstyrer alltid tool availability

Voice skal ikke få risikable chat-only tools bare fordi persona er operativ.

```txt
payroll_export_pdf = chat-only
contract_mutation  = chat-only + confirm/admin
show_shift_status  = chat + voice
```

---

### 5. Memory må være kilde-sporbar

Alle minner injisert i prompt må kunne spores til:

- memory id
- source event/session
- created_at
- confidence
- scope
- visibility

---

### 6. User customization endrer tone, ikke systemgrenser

Bruker kan endre:

- tone
- varme
- tempo
- formalitet
- stemme
- svarlengde
- egen instruks

Bruker kan ikke endre:

- authority level
- role permissions
- safety policy
- auditkrav
- tool restrictions
- workspace policy

---

## Resolution Order

```txt
1. System default
2. Workspace agent profile
3. Role-based defaults
4. User preference
5. Session override
6. Channel constraints
7. Safety/system constraints
8. Authority constraints   ← absolutt, alltid sist
```

**Hvorfor authority er sist**: per non-negotiable #3 (`Authority overstyrer alltid persona`) og #4 (`Channel policy overstyrer tool availability`) — authority må kunne fjerne tools som tidligere lag tillot, uten at noen senere lag kan legge dem tilbake. Channel og safety kommer før authority fordi authority kan trumfe begge ved å disable et tool helt; men hvis channel+safety har tatt det vekk allerede, trenger ikke authority gjøre noe.

Senere lag kan begrense tidligere lag, men aldri svekke authority, audit eller safety. Authority kan kun begrense — aldri utvide.

---

## Canonical Soul Snapshot

Før hver agent-run skal stage-engine produsere et runtime snapshot.

Snapshot må minimum inneholde:

- contract version
- agent key/profile id
- channel
- resolved identity
- resolved instruction overlay
- resolved posture
- voice config, hvis voice
- model policy
- context refs/hashes
- memory refs
- authority summary
- offered tools
- filtered tools
- audit hashes

---

## Mission interaksjon

Smartout kjører Botsson i missions: `mr-botsson` (default chat/voice), `onboarding`, `journey_authoring`, `contract_intake`, `wizard_*`, m.fl. Hver mission har sin egen `system_prompt`, stage-flow, og forventet identitet. Konflikt-spørsmålet: **hvem vinner når brukerens preset sier "Brannslukker" men aktiv mission er `contract_intake`?**

### Regel

```txt
1. Mission-bound stages overstyrer preset for identity + posture.
2. Mission overstyrer ALDRI authority eller channel policy.
3. Kanal-agnostiske runs (default chat, default voice) bruker user preset fritt.
4. Voice-tuning (stemme, hastighet, greeting) respekteres uansett mission — det er talespor, ikke personlighet.
```

### Begrunnelse

Missions er produktdesign-bundne — `onboarding` skal alltid føles trygg og pedagogisk (`vakt × trainee`), ikke "Brannslukker" bare fordi brukeren har det som default. Persona-presets gjelder i den agnostiske støtte-konteksten der mission ikke har en stemme-forventning.

### Resolution-tillegg

Mission-prompt injiseres som `instruction_overlay`-lag (lag 2 i Soul Layers). I `Resolution Order`:

```txt
3. Role-based defaults
3.5. Mission-bound identity override  ← (hvis aktiv mission har voice-bound stage)
4. User preference
```

Hvis missionen er agnostisk (default chat/voice uten stage-binding), hoppes 3.5 over og brukerpreset gjelder.

---

## Final rule

Botsson skal kunne føles levende, men alltid være styrt, sporbar og autorisert.
