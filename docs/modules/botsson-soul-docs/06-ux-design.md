---
title: UX Design — Botsson Soul Settings
status: draft
version: 0.2
created: 2026-05-15
updated: 2026-05-15
module: agent-system
tags: [botsson, ux, settings, design]
---

> **Changelog 0.2 (2026-05-15)**: speed-default endret fra `1.0 = Normal` til `1.15 = Effektiv` (matcher eksisterende hardkode 1.35, men dempet til mellom-grunn). Pontus rapporterte "prater litt sakt" på 1.2 → "Effektiv" som ny default. La til migrasjons-note for eksisterende voice-tuning-records.

# UX Design — Botsson Soul Settings

## UX principle

Brukeren skal ikke forstå arkitekturen.

Brukeren skal bare kunne si hvordan Botsson skal være.

---

## Main user question

```txt
Hvordan vil du at Botsson skal hjelpe deg?
```

---

## Primary settings

### 1. Hvordan skal Botsson være?

Preset cards:

| Preset | Beskrivelse |
|---|---|
| Rolig og trygg | Forklarer rolig, tydelig og støttende |
| Rask og direkte | Kort, operativ og besluttsom |
| Kreativ og nysgjerrig | Utforskende, idérik og lærende |
| Operativ brannslukker | Fokusert, tydelig og handlingsorientert |
| Mentor | Pedagogisk og utviklende |
| Strategisk rådgiver | Mer analytisk og overordnet |

Under panseret mapper preset til:

- persona
- rank
- blend
- posture defaults

---

### 2. Hvordan skal Botsson snakke?

Voice settings:

- Stemme
- Hastighet
- Første taler
- Hilsen
- Timeout-melding

Hastighet bør vises som enkel kontroll:

```txt
Rolig  |  Normal  |  Effektiv  |  Rask
0.9       1.0        1.15        1.3
```

**Default = `Effektiv` (1.15)**. Valgt fordi:
- Eksisterende hardkode i `services/voice-agent/src/agent.ts:405` er 1.35 (Pontus' "prater litt sakt"-fix 2026-05-13).
- 1.35 er over "Rask" — for energisk for ny bruker.
- 1.15 er mellom-grunn: snappier enn naturlig norsk-tempo, ikke stresssende.
- Eksisterende brukere som har localStorage `emma-voice-tuning` beholdes (migrasjon respekterer eksplisitt user-set verdi).

### Migrasjon ved første runtime etter rollout

```txt
1. UI leser localStorage["emma-voice-tuning"].speed
   → finnes? bruk verdi.
   → mangler? bruk 1.15 (ny default).

2. Server-persist (P1, etter botsson_user_preference er aktivert):
   → første DB-write fra UI plukker opp localStorage-verdi hvis satt.
   → ingen "stille endring" av eksisterende brukere.
```

---

### 3. Egen instruks

Textarea:

```txt
Fortell Botsson hvordan du vil at han skal svare deg.
```

Eksempler:

- Svar kort og direkte.
- Bruk norsk.
- Foreslå alltid neste konkrete handling.
- Forklar som om jeg er ny i systemet.

---

## Advanced settings

Advanced kan skjules bak en utvidbar seksjon.

Akser:

- Formalitet
- Tydelighet / assertiveness
- Varme
- Humor
- Svarlengde

Ikke vis avansert posture for vanlige employees i v1 hvis det skaper overload.

---

## Recommended screen structure

```txt
Botsson Settings

[Hvordan skal Botsson være?]
Preset cards

[Hvordan skal Botsson snakke?]
Voice + speed

[Egen instruks]
Textarea

[Avansert]
Tone sliders

[Reset to default]
[Save]
```

---

## Routes

Primary:

```txt
/dashboard/settings/botsson
```

Secondary:

```txt
Arena → Settings → Botsson
```

Arena overlay kan deep-linke til full settings route.

---

## Reset behavior

Reset should support:

1. Reset user preference to workspace default.
2. Reset voice only.
3. Reset custom instruction only.

Avoid destructive unclear reset.

---

## Mobile behavior

Mobile UI should prioritize:

1. Preset
2. Voice speed
3. Custom instruction

Advanced settings should be collapsed by default.

---

## UX acceptance criteria

- User can change Botsson preset in under 15 seconds.
- User understands that setting affects both chat and voice.
- User can reset to workspace default.
- User does not see low-level architecture terms unless in advanced mode.
- Settings persist across browser/device.
