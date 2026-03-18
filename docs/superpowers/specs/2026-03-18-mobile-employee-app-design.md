---
title: "Smartout Employee App — Design Specification"
status: review
updated: 2026-03-18
created: 2026-03-18
module: mobile
tags: [mobile, expo, react-native, employee-app, v1]
---

# Smartout Employee App — Design Specification

> En mobilapp for restaurantansatte. Expo + React Native, i monorepo under `apps/mobile/`.
> Appen konsumerer same backend som dashboardet. Ingenting bygges om. Del det som er rent TypeScript og plattformuavhengig. Bygg alt med `<View>` nytt.

---

## 1. Scope & Avgrensninger

### V1 leverer

- Vaktløkka (før/under/etter/ingen vakt)
- Punch clock (inn/ut via skrivekø)
- Oppgavefeed med universell task-modal
- HACCP-logging (egen tabell)
- Handoff (strukturert overlevering)
- Avviksrapportering
- Tekstchat (Supabase Realtime, same mønster som web)
- Mr. Botsson (tekst-only, Stage Engine, per-profil kontekst)
- Push-varsler (Expo Notifications managed)
- Offline skrivekø (SQLite) + lesecache (MMKV)
- Auth: SMS OTP + magic link fallback + workspace join-kode + søk workspace
- Deep links (smartout:// + Universal Links)
- Ring leder = `Linking.openURL('tel:...')`

### V1 leverer IKKE

- LiveKit / WebRTC / PTT / walkie-talkie
- Voice-Botsson / Ultravox på mobil
- Voice AI-eskalering (utgående samtaler)
- Biometrisk re-auth
- i18n (hardkodet norsk)
- Dark mode toggle (system preference only)
- Trening/gamification/sertifisering (V2)

### Tekniske valg

| Område         | Valg                                                            |
| -------------- | --------------------------------------------------------------- |
| Framework      | Expo + Expo Router (filsystembasert)                            |
| Serverstate    | TanStack Query                                                  |
| Lokal UI-state | Zustand                                                         |
| Skrivekø       | SQLite (`expo-sqlite`)                                          |
| Lesecache      | MMKV (`react-native-mmkv`)                                      |
| UI-komponenter | Egne med StyleSheet + design tokens + `react-native-reanimated` |
| Push           | Expo Notifications (managed APNs/FCM)                           |
| Chat realtime  | Supabase direkte (ingen gateway Edge Function)                  |
| AI             | Stage Engine via same API som web (tekst-only)                  |
| Språk          | Norsk hardkodet                                                 |
| Ring leder     | `Linking.openURL('tel:...')` — vanlig telefonsamtale            |

---

## 2. Designregler

Disse er lov. Om en skjerm bryter en regel, flagg hvilken regel og hvorfor.

1. **5 sekunder.** Hver primær handling fullføres på under 5 sekunder fra app-åpning. Mer enn 2 taps for daglig handling → ifrågasett.
2. **Konteksten gjør jobbet.** Appen vet hva du trenger basert på hvem du er, hvilken vakt, hvilken fase. Ingen menyleting.
3. **Én skjerm, én oppgave.** Hver modal gjør én ting. Aldri fullspekka skjemaer.
4. **Tommelen styrer.** Alt kritisk i thumb zone (nedre halvdelen). Ingenting viktig i øvre venstre hjørne.
5. **Feedback innen 100ms.** Hver touch gir visuell respons + haptic. Stillhet er forbudt.
6. **Operasjonell, ikke sosial.** Ingen infinite scroll, ingen likes. Alt som vises har et formål under vakten.
7. **Tomme tilstander er instruksjoner.** "Ingen oppgaver" → "Alt klart. Neste vakt: fredag 16:00." Aldri en tom side.
8. **Offline er usynlig.** Brukeren tenker aldri på tilkobling. Skrivekøen håndterer alt. Eneste synlige: sync-indikatoren.

---

## 3. Datamodell — Nye tabeller & endringer

### 3.1 Nytt skjema: `timesheet`

```sql
CREATE SCHEMA IF NOT EXISTS timesheet;

CREATE TYPE timesheet.time_entry_status AS ENUM ('clocked_in', 'completed', 'edited');

CREATE TABLE timesheet.time_entry (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id          UUID NOT NULL REFERENCES public.schedule_shift(schedule_shift_id),
  profile_id        UUID NOT NULL REFERENCES public.profile(profile_id),
  workspace_id      UUID NOT NULL REFERENCES public.workspace(workspace_id),
  punch_in          TIMESTAMPTZ NOT NULL,
  punch_out         TIMESTAMPTZ,
  breaks            JSONB,              -- [{start: timestamptz, end: timestamptz}]
  punch_in_location JSONB,              -- {lat, lng} — valgfritt
  status            timesheet.time_entry_status NOT NULL DEFAULT 'clocked_in',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: workspace-scoped (JWT + API key)
-- Indexes: (workspace_id, profile_id), (shift_id)
-- Trigger: set_updated_at()
-- Realtime: enabled
```

Punch-klokka i appen gjør to ting: INSERT (punch_in) og UPDATE (punch_out). Begge via skrivekøen.

`shift_approval` beholder sin rolle — den leser fra `time_entry` og sammenligner mot `schedule_shift`. `calculated_hours` beregnes fra `time_entry`, `planned_hours` fra `schedule_shift`, differansen trigger deviations. Men det er lønnemikrotjenestens jobb — ikke V1.

Migrasjonen fjerner `punch_in`/`punch_out` fra `shift_approval` — de hører ikke hjemme der.

### 3.2 Ny tabell: `haccp_log`

```sql
CREATE TABLE public.haccp_log (
  haccp_log_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id),
  session_id        UUID REFERENCES department_session(department_session_id),
  profile_id        UUID NOT NULL REFERENCES profile(profile_id),
  ccp_reference     TEXT NOT NULL,       -- "Kjøleskap A", "Fryser 2"
  equipment_id      UUID REFERENCES asset(asset_id),
  temperature       NUMERIC(5,2) NOT NULL,
  unit              TEXT NOT NULL DEFAULT '°C',
  is_within_range   BOOLEAN NOT NULL,
  corrective_action TEXT,                -- om utenfor range
  logged_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: workspace-scoped
-- Index: (workspace_id, logged_at DESC)
```

HACCP-logging er lovkrav med revisjonsspor. Data bor i egen tabell — task-modalen trigger inserten, men HACCP er compliance, ikke oppgavelogikk.

### 3.3 Ny kolonne: `workspace.join_code`

```sql
ALTER TABLE workspace ADD COLUMN join_code CHAR(6) UNIQUE;
```

Genereres ved workspace-opprettelse. Manager deler den muntlig. RPC:

```sql
-- lookup_workspace_by_code(code) → {workspace_id, name, logo_url}
-- Anon-tilgjengelig, returnerer bare navn + logo
```

### 3.4 Ny kolonne: `profile.expo_push_token`

```sql
ALTER TABLE profile ADD COLUMN expo_push_token TEXT;
```

Én enhet per person i V1. Oppdateres ved app-start.

### 3.5 Join request (utvidet `invitation`)

```sql
ALTER TABLE invitation ADD COLUMN direction TEXT NOT NULL DEFAULT 'outbound';
-- 'outbound' = admin inviterer
-- 'inbound'  = ansatt ber om tilgang

ALTER TABLE invitation ADD COLUMN requested_by UUID REFERENCES profile(profile_id);
-- NULL for outbound, profil-id for inbound
```

Gjenbruker eksisterende status-logikk (pending → accepted/rejected). Admin ser begge retninger i same liste.

### 3.6 Søkbar workspace-liste

```sql
-- RPC (anon-tilgjengelig, ingen secrets):
-- search_workspaces(query TEXT) → [{workspace_id, name, logo_url}]
-- Returnerer maks 10 treff
-- Eksponerer BARE navn + logo
```

### 3.7 Migrasjon: fjern punch fra shift_approval

```sql
ALTER TABLE shift_approval DROP COLUMN IF EXISTS punch_in;
ALTER TABLE shift_approval DROP COLUMN IF EXISTS punch_out;
```

### 3.8 Sammendrag

| Endring                                            | Type                   |
| -------------------------------------------------- | ---------------------- |
| `timesheet` skjema + `time_entry`                  | Nytt skjema, ny tabell |
| `haccp_log`                                        | Ny tabell              |
| `workspace.join_code`                              | Ny kolonne             |
| `profile.expo_push_token`                          | Ny kolonne             |
| `invitation.direction` + `invitation.requested_by` | Nye kolonner           |
| `shift_approval.punch_in/punch_out`                | Fjernes                |
| `search_workspaces()` RPC                          | Ny funksjon            |
| `lookup_workspace_by_code()` RPC                   | Ny funksjon            |

---

## 4. App-arkitektur & Navigasjon

### 4.1 Filstruktur

```
apps/mobile/
├── app/                          # Expo Router (filsystem)
│   ├── _layout.tsx               # Root layout: providers, auth guard
│   ├── (auth)/                   # Uautentiserte skjermer
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx           # Tre veier inn
│   │   ├── verify.tsx            # SMS OTP / magic link
│   │   └── workspace-select.tsx  # Om >1 profil
│   ├── (app)/                    # Autentiserte skjermer
│   │   ├── _layout.tsx           # Tab-navigasjon + AI FAB
│   │   ├── (home)/
│   │   │   ├── _layout.tsx
│   │   │   └── index.tsx         # Vaktfasebasert feed
│   │   ├── (shifts)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Kommende vakter
│   │   │   └── [id].tsx          # Rikt skiftkort
│   │   ├── (chat)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Kanalliste
│   │   │   └── [id].tsx          # Samtale
│   │   └── (me)/
│   │       ├── _layout.tsx
│   │       └── index.tsx         # Profil, innstillinger
│   └── +not-found.tsx
├── src/
│   ├── components/
│   │   ├── ui/                   # Primitiver (Button, Card, Input, Badge...)
│   │   ├── shift/                # ShiftCard, PunchButton, HandoffSheet...
│   │   ├── task/                 # TaskModal, TaskFeed, HACCPForm...
│   │   ├── chat/                 # MessageBubble, ChannelRow, ReactionBar...
│   │   └── common/               # SyncIndicator, EmptyState, Avatar...
│   ├── hooks/
│   │   ├── queries/              # TanStack Query hooks
│   │   └── stores/               # Zustand stores
│   ├── lib/
│   │   ├── supabase.ts           # Mobil Supabase-klient (SecureStore adapter)
│   │   ├── sync/                 # Skrivekø (SQLite) + sync worker
│   │   ├── cache/                # MMKV lesecache-adapter
│   │   └── push.ts               # Expo Notifications registrering
│   └── constants/                # Statiske verdier, norske strenger
├── metro.config.js               # watchFolders: packages/*
├── app.json
├── tsconfig.json                 # Path alias: @/ → src/
└── package.json
```

Path alias: `@/` → `src/` i tsconfig. Imports blir `@/components/shift/PunchButton`, ikke `../../src/components/...`.

### 4.2 Navigasjon: 4 tabs + AI FAB

```
┌─────────────────────────────┐
│                             │
│        Skjerminnhold        │
│                             │
│                             │
│                             │
├──────────┬──┬───┬───────────┤
│  Hjem  │Vakter│🤖│ Chat │ Meg│
└──────────┴──┴───┴───────────┘
              ↑
         AI FAB (Botsson)
         Sirkulær, hevet over tab-linjen
         Smartout-logo/Botsson-ikon
```

Tab-baren har fire tabs: Hjem, Vakter, Chat, Meg. Sentrert mellom tabs — ikke som en femte tab men som en opphøyd sirkulær knapp — sitter Smartout-logoen (Botsson-ikonet). Den bryter tab-barens linje oppover, visuelt prominent, alltid synlig.

**Tap på FAB** → åpner chat-sheet (Stage Engine, tekst-only V1).

**Swipe-up på FAB** → åpner funksjonsmeny med kontekstavhengige snarveier. Snarveiene endres basert på vaktfase:

| Fase           | Snarveier                             |
| -------------- | ------------------------------------- |
| `during_shift` | Punch ut, Oppgaver, Avvik, Ring leder |
| `before_shift` | Skiftkort, Day brief, Bekreft vakt    |
| `after_shift`  | Handoff, Bekreft timer                |
| `no_shift`     | Neste vakt, Meldinger                 |

Funksjonsmenyen er ikke navigasjon — det er snarveier til handlinger. Hver snarvei åpner rett modal eller scroller til rett seksjon på home.

FAB skjules under:

- Fullskjerms-modaler
- Tastaturet oppe i chat

### 4.3 Tabs

- **Hjem** — Dynamisk basert på vaktfase. Renderer ulikt innhold avhengig av state (se seksjon 5).
- **Vakter** — Flat list med kommende vakter. Hver rad = rikt skiftkort. Tap → detaljvisning med kolleger, ledernotater, daginfo. Bekreft/aksepter inline.
- **Chat** — Kanalliste (department, team, session, DM). Tap → samtale. Supabase Realtime. Ulest-badge på tab.
- **Meg** — Profil, varslingspreferanser, utlogging. V2-seksjon reservert (trening, sertifikater).

---

## 5. Vaktfasemotor & Home-skjerm

### 5.1 Vaktfase som sentral state

Alt i appen kretser rundt én fråga: hvor i vaktsyklusen er du akkurat nå?

```typescript
type ShiftPhase = "no_shift" | "before_shift" | "during_shift" | "after_shift";
```

En Zustand-store (`useShiftPhase`) beregner fasen fra:

- Neste/aktive skift fra TanStack Query (`schedule_shift` WHERE `employee_id = me`)
- Punch-status fra `timesheet.time_entry` (finnes clocked_in-rad uten punch_out?)
- Nåværende tid

Faseberegning (ren funksjon, testbar):

- **`no_shift`** — Intet skift innen 24t framover, intet aktivt
- **`before_shift`** — Neste skift begynner innen X timer (konfigurerbart, default 4t). Hvis skiftet har startet men ingen punch-in → vis påminnelse: "Vakten din begynte for X min siden — stemple inn."
- **`during_shift`** — Aktiv `time_entry` med `status: 'clocked_in'`. Punkt. Skiftets tidsramme uten punch trigger IKKE `during_shift`.
- **`after_shift`** — `time_entry` har `punch_out`, men handoff og/eller timbekreftelse ej gjort

Fasen driver tre ting:

1. Home-skjermens innhold
2. FAB-ens swipe-up snarveier
3. Push-varslers prioritering

### 5.2 Home-skjerm per fase

**`no_shift`**

```
┌─────────────────────────────┐
│ Hei, Anna                   │
│                             │
│ ┌─────────────────────────┐ │
│ │ Neste vakt              │ │
│ │ Fredag 21. mars         │ │
│ │ 16:00–23:00 · Servitør  │ │
│ │ Gulvet · 7t             │ │
│ └─────────────────────────┘ │
│                             │
│ 2 uleste meldinger →       │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🔒 Trening & sertifikat │ │
│ │ Kommer snart            │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

Minimalt. Neste skift-kort, uleste meldinger, låst V2-seksjon.

**`before_shift`**

```
┌─────────────────────────────┐
│ Vakt i dag kl. 16:00       │
│                             │
│ ┌─────────────────────────┐ │
│ │ ✓ Bekreftet             │ │  ← eller [Bekreft vakt]-knapp
│ │ 16:00–23:00 · Servitør  │ │
│ │ Gulvet · med Lars, Ina  │ │
│ │ Leder: Kristian         │ │
│ │ 📋 "Bord 7 nøtteallergi"│ │  ← ledernotat
│ └─────────────────────────┘ │
│                             │
│ Daginfo                     │
│ • 3 bestillinger (1 VIP)   │
│ • Pågående avvik: Kjølerom │
│                             │
│ 2 oppgaver før åpning →    │
└─────────────────────────────┘
```

Rikt skiftkort med alt du trenger. Bekreftelsesknapp om ej bekreftet. Day brief.

Om skiftet har startet men ingen punch-in:

```
┌─────────────────────────────┐
│ ⚠️ Vakten din begynte for   │
│    10 min siden              │
│                             │
│ [══════ STEMPLE INN ══════] │
│                             │
│ (resten av before_shift)    │
└─────────────────────────────┘
```

**`during_shift`**

```
┌─────────────────────────────┐
│ På vakt · 16:00–23:00    ⏱ │  ← tidtaker siden punch-in
│                             │
│ [════════ STEMPLE UT ══════]│  ← full-width, én touch
│                             │
│ Oppgaver (3)                │
│ ┌───────────────────────┐   │
│ │ 🔴 Temperaturlogg 18:00│  │  ← HACCP, forfaller snart
│ │ 🟡 Fylle på bestikk    │  │
│ │ ⚪ Sjekk toaletter     │  │
│ └───────────────────────┘   │
│                             │
│ [Rapporter avvik]  [💬 Chat]│
│                             │
│ 📞 Ring leder              │
└─────────────────────────────┘
```

Stemple ut dominant. Oppgavefeed sortert på prioritet (forfallstid, severity). Snarveier til avvik, chat, ring leder. Alt i thumb zone.

**`after_shift`**

```
┌─────────────────────────────┐
│ Vakt avsluttet              │
│                             │
│ Overlevering                │
│ ┌─────────────────────────┐ │
│ │ Skriv overlevering...   │ │  ← tekstfelt
│ │                         │ │
│ │          [Send]         │ │
│ └─────────────────────────┘ │
│                             │
│ Bekreft timer               │
│ ┌─────────────────────────┐ │
│ │ Planlagt: 7t 00min      │ │
│ │ Registrert: 7t 12min    │ │
│ │ Pause: 30min            │ │
│ │                         │ │
│ │ [Bekreft] [Bestrid]     │ │
│ └─────────────────────────┘ │
│                             │
│ Poeng i dag: +45 ⭐         │
└─────────────────────────────┘
```

Handoff og timbekreftelse vises parallelt. Handoff blokkerer IKKE timbekreftelse. Om ansatt skipper handoff → markeres som "ej innlevert" → flagges til leder. Handoff er sterkt oppmuntret, ikke en gate.

### 5.3 Task-modal (universell)

Hver oppgave i feeden åpner same bottom sheet. Task-typen styrer skjemaet:

| `task_type`    | Skjema         | Felt                                                                                               |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| `haccp`        | Temperaturlogg | CCP-referanse, temperatur (numerisk input), innenfor/utenfor range, korrigerende tiltak om utenfor |
| `checklist`    | Sjekkboksliste | Steg å huke av                                                                                     |
| `confirmation` | Signatur       | Les tekst → bekreft                                                                                |
| `procedure`    | Steg-for-steg  | Aktuelt steg → marker klart → neste                                                                |
| `general`      | Fritekst       | Beskrivelse → marker klar                                                                          |

Én komponent (`TaskModal`), én switch på type, minimalt skjema per type. Hver følger regelen: én skjerm, én oppgave.

---

## 6. Offline-arkitektur

### 6.1 Skrivekø (SQLite)

```sql
CREATE TABLE pending_writes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  action      TEXT NOT NULL,        -- 'punch_in' | 'punch_out' | 'haccp_log' | 'report_deviation' | ...
  payload     TEXT NOT NULL,        -- JSON-serialisert
  row_id      TEXT NOT NULL,        -- UUID generert client-side
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'syncing' | 'synced' | 'failed'
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  synced_at   TEXT
);
```

`action` er en semantisk etikett — synkloopen vet ikke om databaseskjemaer, den vet hvilken funksjon den skal kalle.

### 6.2 Action map

Synkloopen har en `actionMap` — ren mapping fra action til Supabase-kall:

```typescript
const actionMap: Record<string, (payload: unknown) => Promise<void>> = {
  punch_in: (p) => supabase.schema("timesheet").from("time_entry").insert(p),
  punch_out: (p) => supabase.schema("timesheet").from("time_entry").update(p).eq("id", p.id),
  haccp_log: (p) => supabase.from("haccp_log").insert(p),
  report_deviation: (p) => supabase.from("deviation").insert(p),
  send_message: (p) => supabase.from("chat_message").insert(p),
  complete_task: (p) => supabase.from("session_task").update(p).eq("id", p.id),
  confirm_shift: (p) => supabase.from("schedule_shift").update(p).eq("id", p.id),
  submit_handoff: (p) => supabase.from("session_note").insert(p),
  confirm_hours: (p) => supabase.from("shift_approval").update(p).eq("id", p.id),
};
```

Én fil, én map. Nytt action = ny rad.

### 6.3 Hvilke operasjoner køes?

| Operasjon       | Action             | Prioritet         |
| --------------- | ------------------ | ----------------- |
| Stemple inn     | `punch_in`         | Kritisk           |
| Stemple ut      | `punch_out`        | Kritisk           |
| HACCP-logg      | `haccp_log`        | Kritisk (lovkrav) |
| Avviksrapport   | `report_deviation` | Kritisk           |
| Handoff         | `submit_handoff`   | Høy               |
| Timbekreftelse  | `confirm_hours`    | Høy               |
| Vaktbekreftelse | `confirm_shift`    | Høy               |
| Chatmelding     | `send_message`     | Normal            |
| Task fullført   | `complete_task`    | Normal            |

Alt annet (lesninger, navigering, søk) er online-only med MMKV-cache som fallback.

### 6.4 Synkloop

```
App starter
  → SyncWorker.start()
  → Sjekker NetInfo (online/offline)

Online:
  → Hent eldste pending_writes WHERE status = 'pending' (FIFO)
  → Marker som 'syncing'
  → Kall actionMap[action](payload)
  → Lykkes → marker 'synced', lagre synced_at
  → Feiler → retry_count++
    → retry_count < 5: tilbake til 'pending', exponential backoff (2^n sek, maks 60s)
    → retry_count >= 5: marker 'failed', vis i UI

Offline:
  → Kø normalt, ingen synk-forsøk
  → NetInfo listener: når online → flush køen

Ingen polling. Event-drevet: NetInfo-change + ny write trigger synk.
```

### 6.5 Lesecache (MMKV)

MMKV lagrer serialiserte TanStack Query-svar som `placeholderData`:

```typescript
useQuery({
  queryKey: ["my-shifts"],
  queryFn: fetchMyShifts,
  placeholderData: () => {
    const cached = MMKV.getString("cache:my-shifts");
    return cached ? JSON.parse(cached) : undefined;
  },
});
```

Brukeren ser cachet data umiddelbart. TanStack Query henter fersk data i bakgrunnen. Om offline → cachet data vises, ingen lastespinnere.

| Data                          | Cache-key            | Stale-time |
| ----------------------------- | -------------------- | ---------- |
| Mine skift (7 dager fremover) | `cache:my-shifts`    | 5 min      |
| Aktiv time_entry              | `cache:active-punch` | 30s        |
| Oppgavefeed (i dag)           | `cache:my-tasks`     | 2 min      |
| Kanalliste                    | `cache:channels`     | 5 min      |
| Siste 50 meldinger per kanal  | `cache:chat:{id}`    | 1 min      |
| Min profil                    | `cache:profile`      | 30 min     |
| Workspace-kontekst            | `cache:workspace`    | 60 min     |

### 6.6 Sync-indikator

Zustand-store `useSyncStatus`:

```typescript
type SyncStatus = {
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  lastSyncedAt: Date | null;
};
```

| State                           | Utseende                                      |
| ------------------------------- | --------------------------------------------- |
| `pendingCount > 0 && isOnline`  | Gul: "Synkroniserer 2 poster..."              |
| `pendingCount > 0 && !isOnline` | Oransje: "2 poster venter — ingen tilkobling" |
| `failedCount > 0`               | Rød: "1 post mislyktes — [Prøv igjen]"        |
| `pendingCount === 0`            | Grønn: "Alt synkronisert" → toner ut etter 3s |

Indikatoren tar ingen plass når alt er synket. Dukker bare opp ved ventende writes eller problemer.

### 6.7 Konflikthåndtering (V1)

V1 har ingen konflikter å løse:

- Punch inn/ut = én person, én enhet, én rad
- HACCP/avvik/handoff = INSERT only
- Chatmeldinger = INSERT only (append-only log)
- Vaktbekreftelse = én person bekrefter sin egen vakt

Om Supabase returnerer conflict (409/duplicate) → marker som synket (dataen finnes allerede). Om auth error (401) → re-autentiser, retry. Alt annet → retry med backoff.

---

## 7. Chat

### 7.1 Kanaltyper

| Type         | Opprettes av                 | Deltakere                                | Levetid                            |
| ------------ | ---------------------------- | ---------------------------------------- | ---------------------------------- |
| `department` | Automatisk per avdeling      | Alle med profil i avdelingen             | Permanent                          |
| `team`       | Automatisk per team          | Alle teammedlemmer                       | Permanent                          |
| `session`    | Automatisk ved session-start | Alle med vakt den dagen i den avdelingen | Dør ved session-close              |
| `dm`         | Bruker                       | 2 personer                               | Permanent                          |
| `ai`         | Automatisk per profil        | Profil + Botsson                         | Permanent (Stage Engine-historikk) |

`department`, `team` og `session`-kanaler opprettes automatisk — ansatte oppretter aldri gruppekanaler. De kan starte DM-er.

### 7.2 Skjermer

**Kanalliste** (`(chat)/index.tsx`):

- Seksjonert: "Aktiv vakt" (session-kanal øverst om `during_shift`), "Kanaler", "Direktmeldinger"
- Hver rad: kanalnavn, siste melding (trunkert), tidsstempel, ulest-badge
- Ulest-count driver tab-badge

**Samtale** (`(chat)/[id].tsx`):

- Meldingsliste (FlatList, inverted, paginert — eldre meldinger lastes oppover)
- Input-felt med send-knapp
- Langtrykk på melding → reaksjoner (emoji-rad, maks 6 valg)
- Reply: swipe høyre på melding → setter reply-context i input
- Ingen typing indicators i V1
- Ingen read receipts i V1

### 7.3 Realtime

```typescript
supabase
  .channel(`chat:${conversationId}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "chat_message",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      queryClient.setQueryData(["messages", conversationId], (old) => [...old, payload.new]);
    },
  )
  .subscribe();
```

Abonnement aktivt når samtalen er åpen. Kanallisten abonnerer på alle brukerens kanaler for ulest-count.

### 7.4 Offline

Sende melding offline → køes i `pending_writes` med `action: 'send_message'`. Meldingen vises direkte i listen med klokke-ikon (ej synket). Når synket → ikonet forsvinner.

---

## 8. Auth-flyt

### 8.1 Tre veier inn

```
┌─────────────────────────────────┐
│         Velkommen til           │
│          Smartout               │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Jeg har en invitasjon  →  │  │  Vei 1
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Jeg har en kode        →  │  │  Vei 2
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Finn min arbeidsplass  →  │  │  Vei 3
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Vei 1 — Invitasjon:**

1. Bruker åpner invite-lenke (`app.smartout.ai/invite/[token]`)
2. Universal Link → appen åpner → validerer token mot `invitation`-tabellen
3. Token gyldig → viser workspace-navn + logo: "Bli med i {workspace}?"
4. Bekreft → verifiseringsskjerm (SMS OTP eller magic link)
5. OTP korrekt → konto opprettes (eller logg inn om allerede finnes) → workspace satt → inn i appen

**Vei 2 — Workspace-kode:**

1. Bruker skriver 6-tegns kode
2. `lookup_workspace_by_code(code)` → workspace navn + logo
3. "Er dette riktig? {workspace}" → Ja
4. Verifiseringsskjerm (SMS OTP / magic link)
5. OTP korrekt → invitation opprettes automatisk (direction: 'outbound', status: 'accepted') → inn i appen

**Vei 3 — Søk + join request:**

1. Bruker skriver workspace-navn
2. `search_workspaces(query)` → liste med navn + logoer
3. Velg workspace → "Send forespørsel til {workspace}?"
4. Bekreft → verifisering (SMS OTP / magic link) → konto opprettes
5. `invitation` INSERT med `direction: 'inbound'`, `status: 'pending'`
6. Venteskjerm: "Forespørsel sendt. Du får beskjed når admin godkjenner."
7. Admin ser varsling i dashboardet → aksepterer/avslår
8. Aksept → push-varsel til ansatt → appen åpner → inn i workspace

### 8.2 Post-auth

```
Auth klar
  → Hent profiler: SELECT * FROM profile WHERE user_id = auth.uid()
  → 1 profil  → direkte inn
  → >1 profil → workspace-velger: "Hvilken arbeidsplass?"
  → 0 profiler (join request pending) → venteskjerm
```

### 8.3 Sesjonshandtering

- Token lagres i Expo SecureStore (kryptert, sandboxet)
- Supabase `onAuthStateChange` lytter på token-refresh
- App i bakgrunn > 30 min → ved retur: stille token-sjekk, ingen re-auth
- Token utgått → tilbake til velkomstskjerm
- Ingen biometrisk re-auth i V1

---

## 9. Mr. Botsson (AI FAB)

### 9.1 Hva Botsson er

Botsson er Stage Engine med per-profil kontekst og tilgangsnivå. Hver profil har sin egen kontekst — rolle, avdeling, vaktfase, readiness-nivå, trainee-status. Det bestemmer hva Botsson vet, hva den kan gjøre, og hvordan den svarer.

Same backend som webben. Mobilappen konsumerer Stage Engine via same API. Eneste forskjellen er UI-laget: bottom sheet i stedet for webbens chattvindu.

### 9.2 UI

Tap på FAB → bottom sheet (70% av skjermhøyden):

```
┌─────────────────────────────┐
│ ─── (drag handle) ───       │
│                             │
│ Mr. Botsson                 │
│                             │
│ ┌─────────────────────────┐ │
│ │ Hei Anna! Du er på vakt │ │
│ │ på Gulvet. Hva trenger  │ │
│ │ du hjelp med?           │ │
│ └─────────────────────────┘ │
│                             │
│                             │
│ ┌─────────────────────────┐ │
│ │ Skriv melding...    [→] │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### 9.3 Kontekst per melding

```typescript
{
  profile_id,
  workspace_id,
  role,                    // employee | manager
  department_id,
  shift_phase,             // no_shift | before_shift | during_shift | after_shift
  active_shift_id,         // om during_shift
  active_session_id,       // om during_shift
  trainee_status,          // true/false
  pending_tasks_count,     // antall uavsluttede oppgaver
}
```

Stage Engine bruker konteksten til å:

- Svare med relevant info ("Du har 2 oppgaver igjen — skal jeg vise dem?")
- Tilpasse tone (trainee → mer veiledende, erfaren → mer kortfattet)
- Begrense capabilities basert på `engine_authority_config`

### 9.4 V1-capabilities

Tekst-only. Botsson kan:

- Svare på spørsmål om arbeidsplassen (håndbok, policyer via `match_workspace_docs()`)
- Vise oppgavestatus
- Forklare prosedyrer
- Gi påminnelser om hva som må gjøres

Botsson kan IKKE i V1:

- Utføre handlinger (punch, fullføre oppgaver, rapportere avvik)
- Stemmeinteraksjon
- Proaktivt initiere samtale

---

## 10. Push-varsler

### 10.1 Registrering

Ved app-start (etter auth):

1. `Notifications.getExpoPushTokenAsync()` → token
2. Sammenlign med `profile.expo_push_token` — om nytt, oppdater
3. Be om tillatelse om ikke allerede gitt (iOS krever eksplisitt samtykke)

### 10.2 Dispatch: Postgres trigger → Edge Function

Når en relevant hendelse inntreffer (INSERT/UPDATE på riktig tabell) → Postgres trigger kaller `push-dispatch` Edge Function via `net.http_post()`.

Edge Function:

1. Henter `profile.expo_push_token` for mottakerprofilen
2. Om token finnes → POST til Expo Push API (`https://exp.host/--/api/v2/push/send`)
3. Om token mangler + kritisk event → fallback til SMS via Twilio

### 10.3 Events som trigger push

| Event                            | Trigger                                           | Prioritet | SMS-fallback |
| -------------------------------- | ------------------------------------------------- | --------- | ------------ |
| Vakt publisert                   | `schedule_shift` INSERT med `is_published = true` | Normal    | Nei          |
| Vakt endret                      | `schedule_shift` UPDATE (tid/dato)                | Høy       | Nei          |
| Ubekreftet vakt (påminnelse)     | Cron: 24t før skift uten bekreftelse              | Høy       | Ja           |
| Oppgave tildelt                  | `session_task` INSERT/UPDATE med `assigned_to`    | Normal    | Nei          |
| HACCP forfaller snart            | Cron: 30 min før deadline                         | Høy       | Nei          |
| Ny chatmelding                   | `chat_message` INSERT (om mottaker offline)       | Normal    | Nei          |
| Avvik rapportert (til leder)     | `deviation` INSERT                                | Høy       | Ja           |
| Join request (til admin)         | `invitation` INSERT med `direction = 'inbound'`   | Normal    | Nei          |
| Handoff ej innlevert (til leder) | Cron: 1t etter skiftslutt uten handoff            | Normal    | Nei          |

### 10.4 Meldingsformat

| Event             | Tittel              | Body                                |
| ----------------- | ------------------- | ----------------------------------- |
| Vakt publisert    | Ny vakt             | Fredag 21. mars, 16:00–23:00        |
| Ubekreftet vakt   | Bekreft vakten din  | Fredag 16:00 — trykk for å bekrefte |
| Oppgave tildelt   | Ny oppgave          | Temperaturlogg kjøleskap A          |
| Ny melding        | {avsendernavn}      | {første 50 tegn av meldingen}       |
| Avvik (til leder) | ⚠️ Avvik rapportert | {severity}: {title} — {department}  |

Deep link i hvert push-varsel → åpner rett skjerm via Expo Router.

---

## 11. Delte pakker & monorepo-integrasjon

### 11.1 Pakker som konsumeres direkte

| Pakke                            | Import i mobile               | Hva som brukes                    |
| -------------------------------- | ----------------------------- | --------------------------------- |
| `@smartout/types`                | Alle typede hooks/komponenter | Database types, entity types      |
| `@smartout/design-tokens/native` | `src/components/ui/*`         | Farger, spacing, radius           |
| `@smartout/telemetry`            | Alle mutasjoner               | `emit()` ved hver skriveoperasjon |
| `@smartout/utils`                | Diverse                       | Datoformatering, validering       |

### 11.2 Pakker som trenger adapter

| Pakke                | Adapter               | Grunn                                                                       |
| -------------------- | --------------------- | --------------------------------------------------------------------------- |
| `@smartout/supabase` | `src/lib/supabase.ts` | Bytt cookie-auth → SecureStore. `createClient()` med custom storage adapter |

### 11.3 Pakker som IKKE konsumeres

| Pakke                    | Grunn                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| `@smartout/ui`           | Web-only (shadcn/ui, Radix). Mobilappen bygger egne RN-komponenter |
| `@smartout/walkAi`       | Web voice UI. V1.5                                                 |
| `@smartout/walkieTalkie` | Tom stub. V1.5                                                     |
| `@smartout/agent-sdk`    | Ultravox/LiveKit providers. V1.5 voice                             |

### 11.4 Metro config

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
```

### 11.5 State-flyt

```
Supabase (source of truth)
    ↕ TanStack Query (serverstate, stale-while-revalidate)
    ↕ MMKV (placeholderData — cachet siste svar)

Zustand (lokal UI-state)
    → activeShiftPhase, activeChannelId, syncQueueCount...

SQLite (skrivekø)
    → pending_writes tabell
    → SyncWorker: FIFO → Supabase kall → marker synket
    → Retry med exponential backoff
```

---

## 12. Avvikelser mellom brief og repo

| Brief antok             | Repo-virkelighet                                                               | Konsekvens                                                             |
| ----------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Punch clock finnes      | `shift_approval` har punch-felt, ingen UI, ingen dedikert tabell               | Ny `timesheet.time_entry`-tabell bygges                                |
| Chat-kanaler finnes     | Migrasjon `20260320120000` med `conversation`, `chat_message`, `chat_reaction` | Backend finnes, migrasjonsdato i fremtiden — verifiser at den er kjørt |
| Walkie-talkie (LiveKit) | `packages/walkieTalkie/` er tom stub                                           | Utsatt til V1.5                                                        |
| HACCP-logging           | Ingen `haccp_log`-tabell                                                       | Ny tabell bygges                                                       |
| Handoff-workflow        | `session_note` med `note_type: handoff` finnes                                 | Backend klart, trenger synlighetslogikk                                |
| Offline-støtte          | Null offline-støtte i kodebasen                                                | Bygges fra bunnen (SQLite + MMKV)                                      |
| Push-varsler            | Email/SMS i notifications-pakke, ingen push                                    | Expo Notifications + `push-dispatch` Edge Function bygges              |
| SMS OTP auth            | Web har email/password + Google OAuth                                          | Supabase SMS OTP aktiveres                                             |
| Workspace join-kode     | Finnes ikke                                                                    | Ny kolonne + RPC bygges                                                |
| Voice AI-eskalering     | Ultravox + Twilio nevnt, ikke implementert                                     | Utsatt til V1.5                                                        |
| Dark mode               | Design tokens har light/dark, `isDark`-context virker buggy                    | System preference only i V1                                            |
