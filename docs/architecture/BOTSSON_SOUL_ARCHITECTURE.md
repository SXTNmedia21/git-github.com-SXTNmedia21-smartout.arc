---
title: Botsson Soul Architecture — alle attributter som styrer opplevelsen
status: draft
updated: 2026-05-15
created: 2026-05-15
module: agent-system
tags: [botsson, agent, prompt, persona, voice, ux, soul]
---

# Botsson Soul Architecture

> "Sjelen" til Mr. Botsson er ikke ett tall — den er et stablet system av lag som sammen bestemmer **hvem han er, hvordan han høres ut, hva han svarer, og hva han har lov til**. Dette dokumentet beskriver hvert lag, hvilke knapper som finnes, hvor de bor, og hvilken kanal de faktisk påvirker.

---

## Sjelen i ett bilde

```
┌─────────────────────────────────────────────────────────────────┐
│                       BRUKER-SAMTALE                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        ▼                                         ▼
   [CHAT-KANAL]                              [VOICE-KANAL]
   /api/emma/chat                            LiveKit room
   → stage-engine /agent/chat                → voice-agent
                             │
                             ▼
         ┌────────────────────────────────────┐
         │   LAG 1 — Identitet                │  Hvem ER han?
         │   persona × rank × blend           │  (chat: stub │ voice: live)
         ├────────────────────────────────────┤
         │   LAG 2 — Posture                  │  Hvordan oppfører han seg?
         │   personality + adjustments        │  (chat: live │ voice: live)
         ├────────────────────────────────────┤
         │   LAG 3 — Voice Tuning             │  Hvordan høres han ut?
         │   voice_id + temp + speed + …      │  (chat: N/A │ voice: live)
         ├────────────────────────────────────┤
         │   LAG 4 — LLM-modell               │  Hvilken hjerne tenker?
         │   chat=claude-sonnet-4.6           │  (chat: live │ voice: live)
         │   voice=gpt-realtime               │
         ├────────────────────────────────────┤
         │   LAG 5 — Kontekst-injeksjon       │  Hva VET han akkurat nå?
         │   user + workspace + workforce     │  (chat: live │ voice: live)
         ├────────────────────────────────────┤
         │   LAG 6 — Minne                    │  Hva HUSKER han fra før?
         │   engine_memory + activity_trail   │  (chat: live │ voice: live)
         ├────────────────────────────────────┤
         │   LAG 7 — Authority (C4)           │  Hva har han LOV til?
         │   engine_authority_config          │  (chat: live │ voice: live)
         ├────────────────────────────────────┤
         │   LAG 8 — Verktøy (tool-bundle)    │  Hva KAN han gjøre?
         │   capability + page-scope tools    │  (chat: live │ voice: live)
         └────────────────────────────────────┘
                             │
                             ▼
                       SVAR + HANDLING
```

---

## Lag 1 — Identitet (Persona × Rank × Blend)

**Konsept**: Botsson har en valgbar identitet bestående av tre dimensjoner.

| Dimensjon | Verdier | Filer |
|-----------|---------|-------|
| **Persona** | `saga` (rolig forteller), `puls` (utålmodig tempomaker), `gnist` (nysgjerrig oppfinner), `vakt` (varm observatør) | `apps/web/src/app/Botsson/_components/persona-engine.ts` linje 17 |
| **Rank** | `admin`, `manager`, `employee`, `trainee` | `persona-engine.ts:73` |
| **Blend** | 0–10 — `0` = 100% persona, `10` = 100% rank, `5` = 50/50 vekting | `persona-engine.ts:117` |

**Output**: `buildPersonaPrompt(identity)` returnerer en markdown-blokk som påvirker tone, åpning ("Det minner meg om…", "Hva om vi prøver…", "OK, hva brenner?"), og autoritet ("ingen trengs å spørre" vs "fir alt i enkle steg").

**Presets**: `LISA_PERSONALITIES` (`types.ts:135`) gir 6 ferdige kombinasjoner — Dagsjef, Mentor, Nysgjerrig kollega, Trygg start, Strategisk rådgiver, Brannslukker.

**Wire-status**:
- Lagring: `localStorage["emma-identity"]` (per browser, ingen sync)
- Voice: sendes som `persona_prompt` til voice session-create → leses i `session-manager.ts:324`
- Chat: 🔴 **ikke koblet** — `/api/emma/chat/route.ts:250-271` dropper `persona_prompt` i proxy til stage-engine. Chat bruker mission-default `mr-botsson`.

---

## Lag 2 — Posture (Personality 5-faktor)

**Konsept**: 5 numeriske personlighets-akser (0.0–1.0) som modifiseres dynamisk per situasjon.

| Akse | Hva |
|------|-----|
| `formality` | Formell ↔ uformell |
| `assertiveness` | Veiledende ↔ besluttsom |
| `warmth` | Kjølig ↔ varm |
| `humor` | Tørr ↔ leken |
| `verbosity` | Knapp ↔ utfyllende |

**Dynamiske justeringer** (`packages/ai/src/prompts/posture.ts`):

| Trigger | Effekt |
|---------|--------|
| `role=trainee` | warmth +0.15, verbosity +0.2, formality −0.15 |
| `role=admin` | formality +0.05, assertiveness −0.05 |
| `situation=haccp` | assertiveness +0.2, humor −0.2, warmth −0.1 |
| `situation=communication` | warmth +0.3, formality −0.2 |
| `authority=read_only` | assertiveness −0.3, formality +0.1 |
| `authority=autonomous` | assertiveness +0.1 |
| `relationshipScore>0.6` | formality −0.1, humor +0.1 (jo bedre kjent, desto mer ledig) |
| `relationshipScore<0.2` | formality +0.1, humor −0.05 (ukjent = mer korrekt) |

**adaptFlags**: hvert lag (role/situation/authority) kan slås av/på per agent — kontrollert av agent-profil i DB.

**Wire-status**: ✅ live på chat (`buildBotssonPromptFromContext` linje 126 — `Vaer ${postureToText(resolvedPosture)}.`). Voice arver via samme prompt-bygger når mission-default brukes.

---

## Lag 3 — Voice Tuning (kun voice-kanal)

**Konsept**: alt som styrer hvordan stemmen oppfører seg i realtime-samtale.

| Attributt | Type | Default | Beskrivelse |
|-----------|------|---------|-------------|
| `voice_id` | UUID | `Emma` (norsk kvinne) | Velg fra 6 stemmer: Lise Botsson, Emma, Johannes (NO), Sanna, Adam (SE), Mathias (DK) |
| `temperature` | 0–1 | 0.3 | LLM-kreativitet. 0.2=presis, 0.5=balansert, 0.7=kreativ |
| `speed` | 0.5–1.5 | **1.35** | Tale-hastighet (hardkodet i `voice-agent/src/agent.ts:405`) |
| `maxDuration` | sek-streng | `"1800s"` | Maks samtale-lengde |
| `firstSpeaker` | `user` \| `agent` | `user` | Hvem snakker først ved oppkobling |
| `greeting` | streng | "" | Tekst agent leser hvis `firstSpeaker=agent` |
| `inactivityTimeout` | sek-streng | `"15s"` | Tid før timeout-melding |
| `inactivityMessage` | streng | "Er du fortsatt der?" | Hva sies ved timeout |
| `timeExceededMessage` | streng | "Vi har dessverre gått tom for tid." | Når maxDuration nås |
| `turnDetection` | server_vad | threshold 0.5, prefix 200ms, silence 250ms | VAD-følsomhet (hardkodet) |
| `modalities` | text+audio | begge på | Tekst-transkripsjon + lyd |

**Lagring**: `localStorage["emma-voice-tuning"]` + `localStorage["emma-voice-id"]` (per browser).

**Wire-status**: ✅ live på voice via voice session-create payload (`BotssonProvider.tsx:814-819`). N/A for chat.

**Stemme-registry**: `VOICE_OPTIONS` (`types.ts:110`) — Ultravox voice-IDer mappes server-side til OpenAI Realtime stemmer (`mark`, `coral`, etc.) i voice-agent.

---

## Lag 4 — LLM-modell

| Kanal | Modell | Hvor |
|-------|--------|------|
| Chat | `anthropic/claude-sonnet-4.6` (via OpenRouter) | `services/stage-engine/src/core/agent-router.ts:753` |
| Voice | `gpt-realtime` (OpenAI Realtime API) | `services/voice-agent/src/agent.ts:400` |

**Hvorfor to modeller**:
- Chat = tool-bundle på 50+ verktøy, krever sterk reasoning + tool-calling → Claude Sonnet.
- Voice = lav latens + audio-tokens + interrupt → OpenAI Realtime obligatorisk.

**Konsekvens**: voice-Botsson og chat-Botsson tenker bokstavelig talt med to forskjellige hjerner. Persona-prompt brukes til å gi dem samme "person" på toppen.

---

## Lag 5 — Kontekst-injeksjon

Kontekst som ligger i system-prompten ved hver tur (oppdateres dynamisk).

### 5a. User context
- Rolle, status, avdeling, navn, foretrukket språk
- Aktiv vakt (hvis pågående)
- Personlige tasks
- Henter fra `assembleBotssonContext` (`apps/web/src/lib/botsson-context-snapshot.ts`)

### 5b. Workspace context
- Sesong, framework (Riksavtalen / ubundet), planning-cycle
- Workspace-navn, industri-niche

### 5c. Workforce context (D2+D6, ADR-0297)
- Employees-liste (whitelisted PII)
- Shifts neste 7 dager
- Aktive sesjoner + fravær
- Eliminerer `query_smartout`-roundtrip → latens 6–15s → 0.87–1.31s

### 5d. Route context
- Hvilken side brukeren er på (`page_route`)
- Fokusert entitet (employee_id, shift_id, etc.)
- Aktiverer page-scope verktøy (ADR-0327)

### 5e. Page context
- Path-streng (`page_context`) som hint til intent-classifier

### 5f. Onboarding context
- Hvis `priorOnboarding` finnes: dato + innsamlede data injiseres så Botsson ikke spør om ting brukeren allerede har sagt

### 5g. Relationship score
- 0.0–1.0 — påvirker posture (se Lag 2)
- Persistert i `engine_memory`

### 5h. World state (`<world_state>`)
- Live aggregat fra `engine_world` (ADR-0281/0290)
- Heartbeat-publisher oppdaterer hvert 60s
- Gir Botsson "hva skjer i workspace akkurat nå"-følelse

---

## Lag 6 — Minne

Tre minnesystemer side om side:

| System | Hva | Levetid |
|--------|-----|---------|
| `engine_memory` | Faktaer om brukeren, lærte preferanser, key facts | Permanent |
| `engine_sessions.collected_data` | Pågående samtale-state | Sesjons-levetid |
| `activity_trail` | Hva som faktisk har skjedd (audit) | Permanent, immutabel |

**Auto-summary**: når en sesjon ender (expired/abandoned) skrives sammendrag til `engine_memory` automatisk (`session-manager.ts:writeSessionSummary`).

**Search**: `relevantMemories` injiseres i prompt — `buildBotssonPromptFromContext` linje 87–90. Embedding-basert retrieval (pgvector).

---

## Lag 7 — Authority (C4 — "Confident ≠ Authorized")

**Konsept**: hvert verktøy har en autoritets-rad i `engine_authority_config` som bestemmer hva agenten har lov til.

| Authority Level | Effekt |
|-----------------|--------|
| `autonomous` | Verktøyet kjøres direkte, ingen menneskelig godkjenning |
| `confirm` | Verktøyet foreslår, mennesket godkjenner |
| `suggest` | Verktøyet kan kun foreslå (lavest) |
| `read_only` | Kun lese-tilgang, ingen skriving |
| `disabled` | Verktøyet er av |

**min_role**: hvert verktøy har en `min_role`-grense (employee → manager → admin → owner). Tool-selector filtrerer ut verktøy brukeren ikke har autoritet for.

**Posture-effekt**: authority-nivå justerer også posture (Lag 2) — `read_only` gjør Botsson mindre assertiv og mer formell.

**Filer**:
- `services/stage-engine/src/core/authority.ts` — reducer fra DB-rader
- `packages/ai/src/router/min-role.ts` — rolle-gate i tool-selector
- `public.gate_action` RPC — per-call autoritets-sjekk (ADR-0099)

---

## Lag 8 — Verktøy (tool-bundle)

Verktøyene som tilbys i hver tur er en dynamisk merge:

```
finalTools = capabilityTools (per intent)
           + pageScopeTools (per page_route, ADR-0327)
           + clientTools (browser-shipped, BotssonProvider)
           − minRoleFiltered (authority gate)
           − channelFiltered (chat-only / voice-only)
           − disabledByAuthority
```

**Intent-klassifisering** først (light LLM-call), så tool-bundle bygges per intent — ikke alle 50+ verktøy serveres hver tur.

**Channel-gating**: chat-only verktøy (payroll, AML-validering, kontrakt-mutasjoner) avvises på voice-kanalen (ADR-0078, Layer 3 channel guard).

---

## Kanal-matrise — hva som faktisk treffer hver kanal

| Lag | Chat | Voice | Notat |
|-----|------|-------|-------|
| 1. Identitet (persona/rank/blend) | 🔴 ikke wired | ✅ live | Chat bruker mission-default; UI-valg påvirker kun voice |
| 2. Posture (5-faktor) | ✅ live | ✅ live | Resolved fra agent-profile + role + situation + authority |
| 3. Voice tuning | N/A | ✅ live | Kun voice |
| 4. LLM-modell | Claude Sonnet 4.6 | gpt-realtime | Hardkodet per kanal |
| 5. Kontekst-injeksjon | ✅ live | ✅ live | Samme `user_context`, `workspace_context`, `workforce_context` |
| 6. Minne | ✅ live | ✅ live | Begge skriver/leser `engine_memory` |
| 7. Authority | ✅ live | ✅ live | Samme C4-gate |
| 8. Verktøy | ✅ chat-bundle | ✅ voice-bundle (subset) | Channel-policy filtrerer |

**Konsekvens av 🔴 i rad 1**: når brukeren velger "Brannslukker"-preset i Innstillinger, endrer det kun voice. Chat-Botsson oppfører seg uendret. Dette skaper opplevd dissonans — brukeren tror han har tunet hele Botsson, men har bare tunet voice-halvdelen.

---

## Hvor Pontus kan tune i dag

| Hva | Hvor i UI | Effekt-kanal |
|-----|-----------|--------------|
| Persona-preset (Lisa-presets) | Arena → Settings → Identity-tab | Voice ✅ / Chat 🔴 |
| Persona alene | Arena → Settings → Identity → persona-grid | Voice ✅ / Chat 🔴 |
| Rank | Arena → Settings → Identity → rank-velger | Voice ✅ / Chat 🔴 |
| Blend (0–10) | Arena → Settings → Identity → slider | Voice ✅ / Chat 🔴 |
| Egen instruks (customPrompt) | Arena → Settings → Identity → textarea | Voice ✅ / Chat 🔴 |
| Stemme-ID | Arena → Settings → Voice → stemme-grid | Voice ✅ |
| Temperature | Arena → Settings → Voice → slider | Voice ✅ |
| First speaker | Arena → Settings → Voice → toggle | Voice ✅ |
| Greeting | Arena → Settings → Voice → tekst | Voice ✅ |
| Inactivity-timeout/message | Arena → Settings → Voice | Voice ✅ |
| Max-duration | Arena → Settings → Voice | Voice ✅ |
| Speed (tale-hastighet) | ❌ ikke i UI (hardkodet 1.35) | Voice ✅ kun via kode |
| Posture-faktorer | ❌ ikke eksponert | Begge — kun via agent-profil i DB |

---

## Hvor sjelen "bor" i koden — leselig rekkefølge

1. `apps/web/src/app/Botsson/_components/types.ts` — alle UI-typer + presets
2. `apps/web/src/app/Botsson/_components/persona-engine.ts` — persona × rank-blending
3. `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` — localStorage-state + voice session payload
4. `apps/web/src/app/Botsson/_components/EmmaProfile.tsx` — settings UI (706 linjer, 3 tabs)
5. `apps/web/src/app/api/emma/chat/route.ts` — BFF som proxyer chat til stage-engine **(her dropper persona-prompt)**
6. `services/voice-agent/src/agent.ts` — LiveKit voice entry, RealtimeModel-konfig
7. `services/stage-engine/src/core/session-manager.ts` — `personaPrompt = context.persona_prompt ?? mission.system_prompt`
8. `services/stage-engine/src/core/prompt-builder.ts` — stage-prompt-assembler
9. `packages/ai/src/prompts/mr-botsson.ts` — system-prompt mal (Rolle-tilganger her)
10. `packages/ai/src/prompts/posture.ts` — 5-faktor justerings-matriser
11. `services/stage-engine/src/core/authority.ts` — C4-reducer

---

## Identifiserte huller (P0 → P3)

| P | Hull | Fix |
|---|------|-----|
| P0 | Chat-kanal ignorerer persona/rank/customPrompt | Forward `persona_prompt` + `custom_prompt` i `/api/emma/chat` payload |
| P1 | Settings lagres kun i localStorage (per browser, ingen sync) | Persist til `engine_authority_config` eller egen `agent_user_preferences` tabell |
| P1 | Tale-hastighet (`speed=1.35`) hardkodet, ikke eksponert i UI | Add `speed` til VoiceTuning + voice-agent les fra session-payload |
| P2 | Posture-faktorer (formality/warmth/humor/…) ikke eksponerbare for sluttbruker | Vurder å eksponere som "Tone"-akser i forenklet UI |
| P2 | EmmaProfile 706 linjer / 3 tabs er kognitiv overload | Flat ut til én skjerm: Personlighet, Stemme, Egen instruks |
| P3 | Ingen reset-knapp på toppnivå | Add "Tilbakestill"-knapp som tømmer localStorage |
| P3 | Settings ikke synlig via egen URL — kun via Arena overlay | Add `/dashboard/settings/botsson` route |

---

## Anbefalt rekkefølge for forenkling

1. **Wire chat-path først** (P0) — `/api/emma/chat` forward `persona_prompt` + `custom_prompt`. Det får Settings til å faktisk gjøre noe i chat. 30 min.
2. **Flat ut UI** (P2) — erstatt 3 tabs med én skjerm: Personlighet-slider, Stemme-grid, Egen instruks-textarea. 1–2 dager.
3. **Server-persist** (P1) — flytt fra localStorage til DB (per-workspace default + per-user override). 1 sortie.
4. **Eksponer speed + posture-akser** (P1/P2) — "Hastighet" og "Tone (formell ↔ vennlig)"-slidere som mapper til kjente knapper. 1 dag.
5. **Egen URL** (P3) — `/dashboard/settings/botsson` med deep-link fra sidebar. 2 timer.

---

## Mantra

> **Personlighet er hvem han ER. Posture er hvordan han OPPFØRER seg. Voice er hvordan han HØRES ut. Authority er hva han har LOV til. Kontekst er hva han VET. Verktøy er hva han KAN.**
>
> Brukeren skal aldri trenge å forstå alle lagene — men hvert lag må kunne styres bevisst når vi ønsker det.
