---
title: "User Journeys — Guardian Dashboard"
status: done
updated: 2026-03-29
created: 2026-03-29
module: ai
tags:
  [guardian, monitoring, stage-engine, websocket, journeys, state-machine, cron, engine-dispatch]
---

# User Journeys — Guardian Dashboard

> Guardian-dashboardet gir plattformadministratorer sanntidsinnsyn i Stage Engine-sesjoner, hendelser og agentoppforsel.

---

## Journey: Godmode Admin — Overvaker aktive sesjoner

**Precondition:** Admin har `is_godmode = true`. Stage Engine kjorer. Guardian-dashboardet er tilgjengelig pa `/platform-admin/guardian`.

1. Admin navigerer til `/platform-admin/guardian` -> System rendrer GuardianDashboard med 3 faner: Oversikt, Live, Analyse
2. System oppretter WebSocket-tilkobling via `useGuardianSocket` hook -> Tilkoblingsstatus vises (gronn prikk = tilkoblet, rod = frakoblet)
3. Admin ser **Oversikt**-fanen (standard) -> `GuardianOverview` viser:
   - Sesjonsstatistikk (SessionStats): totale sesjoner, aktive, ferdige
   - Varselliste (AlertsList): aktive `guardian_signal`-poster med severity-badges
   - Hendelseslogg (EventFeed): siste hendelser fra `guardian_log`
4. Admin klikker pa en varsellinje -> System viser detaljer (signal_type, domain, beskrivelse, data)

**Postcondition:** Admin har oversikt over Stage Engine-helsen og aktive varsler.

**Error paths:**

- WebSocket-tilkobling feiler -> Status viser "Frakoblet" med rod indikator, data lastes via REST-fallback
- Ingen sesjoner finnes -> Tom tilstand med "Ingen aktive sesjoner"
- Ikke-godmode bruker -> Redirectes til `/dashboard`

---

## Journey: Godmode Admin — Folger sesjoner live

**Precondition:** Admin er pa Guardian-dashboardet. Minst en aktiv Stage Engine-sesjon finnes.

1. Admin klikker **Live**-fanen -> `GuardianMonitor` rendres med sesjonsliste (SessionList) til venstre og detaljer til hoyre
2. Admin ser sesjonsliste med: sesjons-ID, profil, modus (agent/mission), starttidspunkt, status
3. Admin klikker en sesjon -> System kaller `subscribe(sessionId)` via WebSocket -> Detaljer vises:
   - SessionDetails: sesjonsmetadata, varighet, meldingsteller
   - EventFeed: sanntidshendelser for denne sesjonen (fra `guardian_log`)
4. Nye hendelser dukker opp i sanntid via WebSocket -> Ingen manuell oppdatering nodvendig
5. Admin skriver i WhisperInput-feltet -> Sender en "whisper" til agenten via WebSocket -> Agenten mottar instruksjonen uten at brukeren ser den

**Postcondition:** Admin overvaker en spesifikk sesjon live og kan pavirke agenten via whisper.

**Error paths:**

- Sesjon avsluttes mens admin ser pa -> Hendelseslisten fryses, status oppdateres til "ferdig"
- WebSocket faller ut -> Hendelser bufres i `guardian_log`, vises ved gjentilkobling

---

## Journey: Godmode Admin — Analyserer agentytelse

**Precondition:** Admin er pa Guardian-dashboardet. Historiske sesjonsdata finnes.

1. Admin klikker **Analyse**-fanen -> `GuardianAnalytics` rendres
2. System laster:
   - `useSessionHistory`: Historiske sesjoner med statistikk
   - `useStageAnalysis`: Stadieanalyse for mission-sesjoner (StageAnalysis-komponent)
   - `useToolUsageStats`: Verktoybruksstatistikk (ToolUsageTable)
3. Admin ser:
   - Sesjonshistorikk med varighet, meldingsteller, og resultat
   - Stadiefordeling: hvilke stadier tar lengst tid, hvor brukere dropper av
   - Verktoybruk: hvilke tools agenten kaller oftest, suksessrate
4. Admin kan filtrere pa tidsperiode og workspace

**Postcondition:** Admin har innsikt i agentens prestasjoner og kan identifisere forbedringspunkter.

**Error paths:**

- Ingen historiske data -> Tom tilstand med "Ingen sesjonshistorikk tilgjengelig"
- Storrelsesbegrensning pa queries -> Paginering via hooks

---

## Databasetabeller

| Tabell            | Formal                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `guardian_signal` | Varsler generert av guardian-sweep. Severity: info/warning/critical. Status: active/acknowledged/resolved/dismissed |
| `guardian_log`    | Hendelseslogg for alle guardian-events. Brukes for historikk og replay                                              |
| `engine_sessions` | Stage Engine-sesjoner med mode (agent/mission), status, meldinger                                                   |

## Nøkkelkomponenter

| Komponent          | Fil                                 | Formal                                       |
| ------------------ | ----------------------------------- | -------------------------------------------- |
| GuardianDashboard  | `_components/GuardianDashboard.tsx` | Hoved-layout med 3 faner                     |
| GuardianOverview   | `_components/GuardianOverview.tsx`  | Oversiktsfane: stats + varsler + hendelser   |
| GuardianMonitor    | `_components/GuardianMonitor.tsx`   | Live-fane: sesjonsliste + detaljer + whisper |
| GuardianAnalytics  | `_components/GuardianAnalytics.tsx` | Analyse-fane: historikk + stadier + verktoy  |
| WhisperInput       | `_components/WhisperInput.tsx`      | Whisper-inputfelt for a instruere agenten    |
| useGuardianSocket  | `_hooks/useGuardianSocket.ts`       | WebSocket-hook for sanntidskommunikasjon     |
| useGuardianSignals | `_hooks/useGuardianSignals.ts`      | TanStack Query for guardian_signal-data      |
| useGuardianHealth  | `_hooks/useGuardianHealth.ts`       | Helsemetrikker for Stage Engine              |

---

## Guardian-systemet: Tilstandsmaskin, hendelser og cron

### Stage Engine — Sesjonslivssyklus (tilstandsmaskin)

Engine-sesjoner (`engine_sessions`) folger denne tilstandsmaskinen:

```
active --> complete    (alle stadier fullfort, eller mission i free-mode avsluttet)
active --> expired     (expires_at passert, oppdaget av cleanup-jobb eller getSession)
active --> abandoned   (klient kaller DELETE /sessions/:id)
```

**Statusverdier:** `active` | `complete` | `expired` | `abandoned`

**Sesjonsmodus:** `mission` (sekvensielle stadier) | `agent` (fri samtale)

**Kanaler:** `voice` | `sms` | `chat` | `email` | `autonomous`

### Stage Engine — Stadieavansering

Stadier navigeres basert pa misjonsmodus:

| Modus        | Logikk                                               |
| ------------ | ---------------------------------------------------- |
| `sequential` | Folger `stage.next_stage`-kjeden                     |
| `free`       | Klienten sender `next_stage_id`                      |
| `hybrid`     | Sekvensielt for pakrevde stadier, fritt for valgfrie |

Nar ingen neste stadie finnes, markeres sesjonen som `complete`. Callbacks sendes via `sendWebhook` ved `stage.changed` og `session.completed`.

### Guardian Event Bus

`guardian-bus.ts` er kjernen i sanntidssystemet. Alle viktige hendelser emitteres gjennom `emitGuardianEvent()`:

| Event type                 | Emittert fra            | Nar                                                |
| -------------------------- | ----------------------- | -------------------------------------------------- |
| `session.started`          | `session-manager.ts`    | Ny sesjon opprettet                                |
| `session.completed`        | `stage-manager.ts`      | Alle stadier fullfort                              |
| `session.abandoned`        | `session-manager.ts`    | Klient avslutter sesjon                            |
| `stage.changed`            | `stage-manager.ts`      | Sesjon avanserer til nytt stadie                   |
| `guardian.auto_advance`    | `guardian-evaluator.ts` | Guardian auto-avanserer (data komplett)            |
| `guardian.nudge`           | `guardian-evaluator.ts` | Guardian gir nudge om manglende felter (etter 60s) |
| `guardian.nudge_confirm`   | `guardian-evaluator.ts` | Guardian ber om bekreftelse for avansering         |
| `guardian.timeout`         | `guardian-evaluator.ts` | Hard timeout pa stadie overskredet                 |
| `guardian.timeout_warning` | `guardian-evaluator.ts` | 80% av max-varighet nadd                           |
| `admin.whisper`            | `guardian.ts` (WS-rute) | Admin sender whisper til agent                     |
| `admin.stage_change`       | `guardian.ts` (WS-rute) | Admin tvinger stadiebytte                          |

**Hendelsesflyt:** Event -> broadcast til WebSocket-klienter (filtert pa workspace + sesjon) -> persist til `guardian_log` (fire-and-forget)

### Guardian Evaluator — Proaktiv overvaking

`guardian-evaluator.ts` kjorer hvert **30. sekund** (interval i `index.ts`) og evaluerer alle aktive sesjoner med tilknyttet journey:

```
evaluateAllActiveSessions()
  |-- For hver aktiv sesjon med journey_id:
  |     |-- Last sesjon fra engine_sessions
  |     |-- Last stadier fra engine_stages
  |     |-- Last tilhorende journey_step
  |     |-- Sjekk datakomplettering (required fields vs. collected_data)
  |     |-- Evaluering:
  |     |     1. Alle data samlet + min_duration nadd -> auto-advance (eller nudge for bekreftelse)
  |     |     2. Hard timeout overskredet (max_duration_seconds) -> timeout-whisper
  |     |     3. 80% av timeout -> timeout-warning-whisper
  |     |     4. Manglende felter etter 60s -> nudge-whisper
  |     |-- Resultat: none | advance | nudge | timeout | off_topic | silence
```

**Whisper-mekanisme:** Whispers lagres i `engine_sessions.collected_data._whispers[]` og `guardian_whisper_count` oppdateres. Agenten leser whispers fra collected_data og folger instruksjonene uten at sluttbrukeren ser dem.

### Guardian WebSocket-kommandoer

Dashboard-klienter sender JSON-kommandoer over WebSocket (`/guardian/ws`):

| Kommando       | Payload                           | Handling                                       |
| -------------- | --------------------------------- | ---------------------------------------------- |
| `subscribe`    | `{ session_id }`                  | Abonnerer pa hendelser for en spesifikk sesjon |
| `unsubscribe`  | `{ session_id }`                  | Avslutter abonnement                           |
| `change_stage` | `{ session_id, target_stage_id }` | Tvinger sesjon til et nytt stadie              |
| `whisper`      | `{ session_id, message }`         | Sender usynlig instruksjon til agenten         |

**Autentisering for WebSocket:** Stotter 3 metoder: `x-api-key` header (API-nokkel), `Authorization: Bearer <jwt>` header, eller `?token=<jwt>` query parameter. Kun admin/owner-roller far tilgang.

### Domain Process Engine (engine-dispatch)

Separat fra Stage Engine. Handler domeneprosesser via event-trigger-modellen.

**Tabeller:**

| Tabell                   | Formal                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| `engine_process`         | Gjenbrukbare prosesstemplater (f.eks. "daily_close")                     |
| `engine_step`            | Ordnede steg innenfor en prosess. `step_group` muliggjor parallelkjoring |
| `engine_trigger`         | Matcher event_type til en prosess. Kan ha `delay_seconds`                |
| `engine_event`           | Immutabel hendelseslogg med idempotency_key                              |
| `engine_state`           | Kjorende prosessinstanser med tilstandssporing                           |
| `engine_delayed_trigger` | Tidskø for forsinkede triggere. Polles av pg_cron                        |

**engine_state tilstandsmaskin:**

```
pending --> active       (prosess startet, forste steg kjores)
active  --> waiting      (steg er wait_for_event, venter pa matchende event)
active  --> complete     (alle steg fullfort)
active  --> failed       (ukjent action_type eller feil)
active  --> escalated    (fremtidig: steg eskalert)
waiting --> active       (matchende event ankom, neste steg kjores)
waiting --> complete     (matchende event ankom, ingen flere steg)
```

**Stegtyper (action_type):**

| Type                  | Status                                    |
| --------------------- | ----------------------------------------- |
| `wait_for_event`      | Implementert — setter state til `waiting` |
| `assign_task`         | Skjelett — logger og avanserer            |
| `send_notification`   | Skjelett — logger og avanserer            |
| `update_entity`       | Skjelett — logger og avanserer            |
| `create_deviation`    | Skjelett — logger og avanserer            |
| `validate_settlement` | Skjelett — logger og avanserer            |
| `lock_checkout`       | Skjelett — logger og avanserer            |
| `schedule_control`    | Skjelett — logger og avanserer            |
| `start_process`       | Skjelett — logger og avanserer            |

> **MERK:** Kun `wait_for_event` har reell implementasjon. Alle andre stegtyper logger fullforelse og avanserer til neste steg uten faktisk sideeffekt. Handlere for hver type er planlagt.

**Betingelsessystem (condition evaluator):**

| Operator      | Eksempel                                         | Forklaring                             |
| ------------- | ------------------------------------------------ | -------------------------------------- |
| `match`       | `{"match": {"department": "kitchen"}}`           | Alle felter ma matche context          |
| `step_status` | `{"step_status": {"step": 1, "is": "complete"}}` | Sjekker resultat fra et spesifikt steg |
| `all`         | `{"all": [cond1, cond2]}`                        | AND — alle betingelser ma vaere sanne  |
| `any`         | `{"any": [cond1, cond2]}`                        | OR — minst en betingelse ma vaere sann |

### Periodiske jobber og cron

| Jobb                    | Plassering                         | Frekvens                                                        | Handling                                                                                                          |
| ----------------------- | ---------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Session cleanup**     | Stage Engine `index.ts`            | Hvert 5. minutt (konfigurerbart via `CLEANUP_INTERVAL_MINUTES`) | Ekspirerer aktive sesjoner der `expires_at < now()`                                                               |
| **Memory cleanup**      | Stage Engine `index.ts`            | Hvert 5. minutt (sammen med sesjon-cleanup)                     | Sletter utlopte `engine_memory`-rader                                                                             |
| **Guardian evaluation** | Stage Engine `index.ts`            | Hvert 30. sekund                                                | Evaluerer alle aktive sesjoner med journey, auto-avanserer eller sender whispers                                  |
| **Watchdog uptime**     | Edge Function `watchdog-uptime`    | Cron (ekstern scheduler)                                        | Sjekker helseendepunkter for web og landing (`/api/health`)                                                       |
| **Watchdog integrity**  | Edge Function `watchdog-integrity` | Cron (ekstern scheduler)                                        | 4 sjekker: foreldrelose company_members, stale department_sessions (>24t), tomme workspaces, utlopte invitasjoner |
| **Cleanup API keys**    | Edge Function `cleanup-api-keys`   | Cron (ekstern scheduler)                                        | Kaller `cleanup_expired_api_keys()` RPC                                                                           |
| **Contract lifecycle**  | Edge Function `contract-lifecycle` | Cron (ekstern scheduler)                                        | 3 operasjoner: trial -> suspended, grace -> deactivated, utlopte kontrakter                                       |
| **Delayed triggers**    | `engine_delayed_trigger`-tabell    | pg_cron (planlagt, IKKE implementert enna)                      | Poller `fire_at < now() AND fired = false`, kjorer engine-dispatch                                                |

> **MERK om pg_cron:** `engine_delayed_trigger` er designet for pg_cron-polling (kommentar i migrasjonen), men selve pg_cron-jobben er IKKE konfigurert i `supabase/config.toml` enna. Watchdog-funksjonene og cleanup-funksjonene autentiseres med `WATCHDOG_CRON_SECRET` Bearer-token og krever en ekstern scheduler (f.eks. n8n, GitHub Actions, eller Supabase Cron).

### Guardian Signal — Varselsystem

`guardian_signal`-tabellen brukes for strukturerte varsler:

| Felt       | Verdier                                                |
| ---------- | ------------------------------------------------------ |
| `domain`   | `readiness` / `workspace_maturity` / `agent_behavior`  |
| `severity` | `info` / `warning` / `critical`                        |
| `status`   | `active` -> `acknowledged` -> `resolved` / `dismissed` |

**MERK:** `guardian-sweep` Edge Function (som genererer signaler) er referert i migrasjonens kommentar men finnes IKKE som Edge Function enna. Signaler kan opprettes via `service_role` (RLS-policy tillater det).

### Manglende Guardian-komponenter

Folgende Guardian-relaterte deler er planlagt men IKKE implementert:

1. **`guardian-sweep` Edge Function** — Periodisk sweep som evaluerer workspace-helse og oppretter `guardian_signal`-rader
2. **pg_cron for `engine_delayed_trigger`** — Timer-kø polling for forsinkede prosess-triggere
3. **Steg-handlere i engine-dispatch** — Alle `action_type` unntatt `wait_for_event` mangler reelle sideeffekter
4. **engine_state.escalated** — Eskaleringstilstand er definert i CHECK-constraint men ingen kode setter den
