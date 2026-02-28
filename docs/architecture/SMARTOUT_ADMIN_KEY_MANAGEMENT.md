---
title: "Secret & API Key Management (Admin Dashboard)"
id: ADMIN_KEY_MGMT
status: draft
layer: architecture
created: 2026-02-28
updated: 2026-02-28
depends_on:
  - SECRET_API_INFRA
  - CORE_ARCH_V2
  - MODULE_13
  - UI_ARCH
---

# Smartout — Secret & API Key Management (Admin Dashboard)

> **Smartout.io** — Architectural blueprint for migration
> Version 1.0 | February 2026
> **Dependencies:** Secret & API Key Infrastructure doc, Core Architecture v2, Module 13 (Multi-Tenant), UI Architecture

---

## 1. Overview

This document defines how workspace admins, company owners, and Smartout Super-Admins interact with the key management system through the dashboard. It covers the UI structure, user flows, access control, and what each role can see and do.

**Key insight:** A restaurant owner creating an API key for their POS system should feel like connecting an app, not configuring AWS IAM. The UI must abstract complexity behind preset bundles while giving technical users granular control.

### Who Manages What

```
Workspace Admin/Owner
  → Creates, rotates, revokes workspace API keys
  → Manages external service connections (Stripe, DocuSeal)
  → Views usage stats for their workspace keys

Company Owner (multi-workspace)
  → Everything above, across all company workspaces
  → Company-level external service connections

Smartout Super-Admin
  → Views all keys across all workspaces
  → Creates and manages service-to-service keys
  → Emergency revocation
  → Platform-level external service secrets
  → Usage monitoring and anomaly detection
```

---

## 2. Routes & Navigation

### 2.1 Workspace Admin Routes

| Route                                       | Screen                                        | Access       |
| ------------------------------------------- | --------------------------------------------- | ------------ |
| `/settings/integrations`                    | Integration hub — overview of all connections | admin, owner |
| `/settings/integrations/api-keys`           | Workspace API key management                  | admin, owner |
| `/settings/integrations/api-keys/new`       | Create new API key                            | admin, owner |
| `/settings/integrations/api-keys/:id`       | Key details, usage, rotation                  | admin, owner |
| `/settings/integrations/services`           | External service connections                  | owner        |
| `/settings/integrations/services/:provider` | Provider detail (e.g., Stripe connection)     | owner        |

### 2.2 Super-Admin Routes

| Route                            | Screen                             | Access      |
| -------------------------------- | ---------------------------------- | ----------- |
| `/platform-admin/keys`           | All API keys across all workspaces | super_admin |
| `/platform-admin/keys/service`   | Service-to-service key management  | super_admin |
| `/platform-admin/secrets`        | Platform-level external secrets    | super_admin |
| `/platform-admin/keys/anomalies` | Usage anomaly dashboard            | super_admin |

---

## 3. Workspace API Key Management

### 3.1 Key List View (`/settings/integrations/api-keys`)

Displays all API keys for the current workspace. Default view shows active keys only.

```
┌─────────────────────────────────────────────────────────────────────┐
│  API-nøkler                                            [+ Ny nøkkel]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ● POS-integrasjon                              Live   Aktiv        │
│    smo_sk_live_k7Hj...        Opprettet: 14. feb 2026              │
│    Tilgang: Vaktplan (les), Drift (les/skriv)                      │
│    Sist brukt: 2 timer siden · 1 842 forespørsler siste 24t       │
│                                                                     │
│  ● Bookingsystem                                Live   Aktiv        │
│    smo_sk_live_a3Bc...        Opprettet: 3. jan 2026               │
│    Tilgang: Vaktplan (les)                                         │
│    Sist brukt: 12 min siden · 456 forespørsler siste 24t          │
│                                                                     │
│  ○ Gammel POS                                   Live   Tilbakekalt  │
│    smo_sk_live_x9Yz...        Tilbakekalt: 1. feb 2026            │
│                                                                     │
│  Filter: [Alle] [Aktive] [Tilbakekalte]  [Live] [Test]            │
└─────────────────────────────────────────────────────────────────────┘
```

**Key details shown:**

- Name and key prefix (first 20 chars)
- Environment badge (Live / Test)
- Status badge (Aktiv / Roterer / Tilbakekalt)
- Scope summary in plain Norwegian
- Last used timestamp
- Request count last 24 hours

### 3.2 Create Key Flow (`/settings/integrations/api-keys/new`)

Three-step creation wizard optimized for non-technical users.

**Step 1: Name & Environment**

```
┌─────────────────────────────────────────────────────┐
│  Opprett ny API-nøkkel                              │
│                                                     │
│  Navn *                                             │
│  ┌───────────────────────────────────────────┐      │
│  │ POS-integrasjon                           │      │
│  └───────────────────────────────────────────┘      │
│  Gi nøkkelen et beskrivende navn så du husker       │
│  hva den brukes til.                                │
│                                                     │
│  Beskrivelse                                        │
│  ┌───────────────────────────────────────────┐      │
│  │ Kobling mot Lightspeed kassesystem        │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  Miljø                                              │
│  (●) Live — Tilgang til ekte data                   │
│  ( ) Test — Kun treningsdata (sandbox)              │
│                                                     │
│                                    [Neste →]        │
└─────────────────────────────────────────────────────┘
```

**Step 2: Choose Access Level**

Preset bundles first, with an expandable section for granular control:

```
┌─────────────────────────────────────────────────────┐
│  Velg tilgangsnivå                                  │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 📖 Kun lesing                          [Velg]│    │
│  │ Kan lese ansattlister, vaktplaner,           │    │
│  │ driftsdata og rapporter.                     │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🏪 Kassesystem (POS)                  [Velg]│    │
│  │ Kan lese vaktplaner og driftsdata,           │    │
│  │ samt oppdatere oppgavestatus.                │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🌡️ HACCP-system                       [Velg]│    │
│  │ Kan lese og skrive temperaturmålinger        │    │
│  │ og kontrollpunkter.                          │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 🔓 Full tilgang                        [Velg]│    │
│  │ Tilgang til all lesing og skriving.          │    │
│  │ Bruk kun for systemer du stoler fullt på.    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ▸ Tilpass tilgang manuelt                          │
│    (vis checkboxes for individuelle scopes)         │
│                                                     │
│                          [← Tilbake] [Neste →]      │
└─────────────────────────────────────────────────────┘
```

**Expanded granular view** (when "Tilpass tilgang manuelt" is clicked):

```
│  ▾ Tilpass tilgang manuelt                          │
│                                                     │
│  Ansatte                                            │
│    ☑ Lese ansattlister og beredskapsdata            │
│                                                     │
│  Vaktplan                                           │
│    ☑ Lese publiserte vaktplaner                     │
│    ☐ Opprette og endre vakter                       │
│                                                     │
│  Drift                                              │
│    ☑ Lese øktdata og oppgavestatus                  │
│    ☐ Oppdatere oppgavestatus og logge avvik         │
│                                                     │
│  HACCP                                              │
│    ☐ Lese temperaturlogger og kontrollister         │
│    ☐ Skrive temperaturmålinger og kontroller        │
│                                                     │
│  Opplæring                                          │
│    ☐ Lese kompetansematrise og fremgang             │
│                                                     │
│  Rapporter                                          │
│    ☑ Lese aggregerte KPI-er og dashboarddata        │
│                                                     │
│  Kontrakter                                         │
│    ☐ Lese kontraktsmetadata                         │
```

**Step 3: Key Created — Show Once**

```
┌─────────────────────────────────────────────────────┐
│  ✅ API-nøkkel opprettet                             │
│                                                     │
│  ⚠️  Kopier nøkkelen nå — den vises aldri igjen.    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ smo_sk_live_k7HjQ9xM2bP4vR8nL5wYtZ3aF6... │ 📋 │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Bruk denne nøkkelen i headeren til API-kall:       │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ curl -H "x-api-key: smo_sk_live_k7Hj..."   │    │
│  │   https://your-project.supabase.co/         │    │
│  │   functions/v1/public-api/schedules         │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ☐ Jeg har kopiert og lagret nøkkelen              │
│                                                     │
│                                         [Ferdig]    │
└─────────────────────────────────────────────────────┘
```

**"Ferdig" button is disabled** until the user checks the confirmation checkbox. This is a standard pattern from Stripe, GitHub, and AWS.

### 3.3 Key Detail View (`/settings/integrations/api-keys/:id`)

Shows metadata, usage chart, and actions for a single key.

```
┌─────────────────────────────────────────────────────────────┐
│  POS-integrasjon                                   Live     │
│  smo_sk_live_k7Hj...                                       │
│                                                             │
│  ┌──────────┬──────────────────────────────────────────┐    │
│  │ Detaljer │ Bruk │ Innstillinger │                   │    │
│  ├──────────┴──────────────────────────────────────────┤    │
│  │                                                     │    │
│  │  Status:        ● Aktiv (gjeldende)                │    │
│  │  Opprettet:     14. februar 2026                   │    │
│  │  Opprettet av:  Pontus                             │    │
│  │  Rotasjon nr:   3                                  │    │
│  │  Sist brukt:    2 timer siden                      │    │
│  │  Utløper:       Aldri                              │    │
│  │                                                     │    │
│  │  Tilgang:                                          │    │
│  │  ┌──────────────┐ ┌──────────────┐                 │    │
│  │  │ vaktplan:les │ │ drift:les    │                 │    │
│  │  └──────────────┘ └──────────────┘                 │    │
│  │  ┌────────────────┐ ┌──────────────┐              │    │
│  │  │ drift:skriv    │ │ rapporter:les│              │    │
│  │  └────────────────┘ └──────────────┘              │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Handlinger                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ 🔄 Roter     │  │ ✏️ Endre tilgang │  │ 🗑️ Tilbakekall│ │
│  └──────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**"Bruk" tab** shows:

- Line chart: requests per hour over last 7 days
- Error rate percentage
- Top endpoints called
- Response time distribution

### 3.4 Rotation Flow

When admin clicks "Roter":

```
┌─────────────────────────────────────────────────────┐
│  Roter API-nøkkel                                   │
│                                                     │
│  Den nåværende nøkkelen (smo_sk_live_k7Hj...)       │
│  vil fortsette å fungere i en overgangsperiode.     │
│                                                     │
│  Overgangsperiode:                                  │
│  ┌─────────────────────────────────┐                │
│  │ 48 timer (anbefalt)         ▼  │                │
│  └─────────────────────────────────┘                │
│  Alternativer: 24 timer, 48 timer, 7 dager         │
│                                                     │
│  Etter overgangsperioden blir den gamle nøkkelen    │
│  automatisk deaktivert.                             │
│                                                     │
│           [Avbryt]  [Roter og vis ny nøkkel →]      │
└─────────────────────────────────────────────────────┘
```

After confirming → same "show once" modal as creation.

### 3.5 Revocation Flow

```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Tilbakekall API-nøkkel                         │
│                                                     │
│  Er du sikker på at du vil tilbakekalle              │
│  "POS-integrasjon" (smo_sk_live_k7Hj...)?          │
│                                                     │
│  Dette vil umiddelbart stoppe all tilgang for        │
│  systemer som bruker denne nøkkelen.                │
│                                                     │
│  Siste 24 timer: 1 842 forespørsler                │
│  Sist brukt: 2 timer siden                          │
│                                                     │
│  ⚠️  Dette kan ikke angres.                         │
│                                                     │
│         [Avbryt]  [Tilbakekall permanent]            │
└─────────────────────────────────────────────────────┘
```

The warning shows recent usage stats to prevent accidental revocation of active keys.

---

## 4. External Service Management

### 4.1 Service Connection Hub (`/settings/integrations/services`)

Overview of all connected and available external services.

```
┌─────────────────────────────────────────────────────────────┐
│  Tilkoblede tjenester                                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 💳 Stripe                                  Tilkoblet │   │
│  │    Sist rotert: 45 dager siden                       │   │
│  │    ⚠️  Anbefalt å rotere innen 45 dager              │   │
│  │                              [Administrer →]         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📝 DocuSeal                                Tilkoblet │   │
│  │    Sist rotert: 12 dager siden                       │   │
│  │    ✅ Alt i orden                                     │   │
│  │                              [Administrer →]         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Tilgjengelige integrasjoner                                │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📱 Twilio (SMS)                      [Koble til →]  │   │
│  │ 📧 Resend (E-post)                   [Koble til →]  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Service Detail View (`/settings/integrations/services/:provider`)

```
┌─────────────────────────────────────────────────────────────┐
│  💳 Stripe                                                  │
│                                                             │
│  Status:           ✅ Tilkoblet                              │
│  Miljø:            Live                                     │
│  Sist rotert:      14. januar 2026 (45 dager siden)        │
│  Rotert av:        Pontus                                   │
│  Sist verifisert:  I dag kl 08:14 (automatisk)             │
│                                                             │
│  ⚠️  Denne nøkkelen bør roteres. Vi anbefaler rotasjon     │
│  hver 90. dag.                                              │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │ 🔄 Oppdater nøkkel│  │ 🔍 Verifiser tilkobling    │    │
│  └──────────────────┘  └──────────────────────────────┘    │
│                                                             │
│  Historikk                                                  │
│  ├─ 14. jan 2026 — Nøkkel oppdatert av Pontus             │
│  ├─ 1. nov 2025 — Nøkkel oppdatert av Pontus              │
│  └─ 15. aug 2025 — Første tilkobling av Pontus            │
└─────────────────────────────────────────────────────────────┘
```

**"Oppdater nøkkel" flow:**

1. Admin goes to Stripe dashboard, rolls the key
2. Admin copies the new key
3. Admin clicks "Oppdater nøkkel" in Smartout
4. Paste dialog appears → admin pastes new key
5. Smartout calls `upsert_secret()` to store in Vault
6. Smartout calls Stripe API with new key to verify it works
7. If verification succeeds → update `last_rotated_at`, show success
8. If verification fails → rollback to old key, show error

```
┌─────────────────────────────────────────────────────┐
│  Oppdater Stripe API-nøkkel                         │
│                                                     │
│  1. Gå til stripe.com/dashboard → API Keys          │
│  2. Klikk "Roll key" for å få en ny nøkkel         │
│  3. Lim inn den nye nøkkelen her:                   │
│                                                     │
│  ┌───────────────────────────────────────────┐      │
│  │ sk_live_                                  │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  Smartout vil automatisk verifisere at nøkkelen     │
│  fungerer før den lagres.                           │
│                                                     │
│                 [Avbryt]  [Lagre og verifiser]       │
└─────────────────────────────────────────────────────┘
```

---

## 5. Super-Admin Dashboard

### 5.1 All Keys Overview (`/platform-admin/keys`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Platform API-nøkler                  Søk: [________________] 🔍   │
│                                                                     │
│  Filter: [Alle typer ▼] [Alle miljø ▼] [Alle statuser ▼]          │
│                                                                     │
│  Workspace          Nøkkel           Type     Status   Sist brukt  │
│  ─────────────────────────────────────────────────────────────────  │
│  Hotel Fjord Oslo   smo_sk_live_k7.. workspace Aktiv   2t siden    │
│  Hotel Fjord Oslo   smo_sk_live_a3.. workspace Aktiv   12m siden   │
│  Villa Mat Bergen   smo_sk_live_p1.. workspace Aktiv   I går       │
│  Villa Mat Bergen   smo_sk_test_b2.. workspace Aktiv   3d siden    │
│  —                  smo_svc_live_n8. service   Aktiv   5m siden    │
│  —                  smo_svc_live_vc. service   Aktiv   1t siden    │
│  Hotel Fjord Oslo   smo_sk_live_x9.. workspace Revoked 28d siden   │
│                                                                     │
│  Totalt: 24 aktive nøkler · 3 tilbakekalte · 2 tjenestenøkler     │
│                                                                     │
│  [+ Ny tjenestenøkkel]                                             │
└─────────────────────────────────────────────────────────────────────┘
```

Super-admin actions per key:

- View key details (same as workspace admin view)
- Emergency revoke (immediate, no grace period)
- View workspace context (jump to workspace)

### 5.2 Anomaly Dashboard (`/platform-admin/keys/anomalies`)

Automated alerts shown as cards:

```
┌─────────────────────────────────────────────────────────────┐
│  Varsler                                                    │
│                                                             │
│  🔴 Uvanlig høy trafikk                                    │
│  smo_sk_live_k7.. (Hotel Fjord Oslo)                       │
│  812% økning i forespørsler siste timen                    │
│  Normalt: ~50/time · Nå: 456/time                          │
│                                              [Undersøk →]  │
│                                                             │
│  🟡 Nøkkel ikke brukt på 30 dager                          │
│  smo_sk_live_q4.. (Café Grünerløkka)                      │
│  Siste aktivitet: 1. februar 2026                          │
│                                       [Kontakt eier →]     │
│                                                             │
│  🟡 Rotasjonsvarsel                                        │
│  3 eksterne tjenester har nøkler eldre enn 90 dager        │
│                                           [Se detaljer →]  │
└─────────────────────────────────────────────────────────────┘
```

Alert triggers (configurable):

- Traffic spike: >500% increase over hourly average
- Unused key: no requests in 30 days
- High error rate: >25% 4xx/5xx responses in an hour
- Rotation overdue: external service key older than `rotation_reminder_days`
- Failed verification: external service API call returned auth error

---

## 6. Access Control Matrix

| Action                            | Employee | Manager | Admin | Owner | Super-Admin |
| --------------------------------- | -------- | ------- | ----- | ----- | ----------- |
| View workspace API keys           | —        | —       | ✅    | ✅    | ✅          |
| Create workspace API key          | —        | —       | ✅    | ✅    | ✅          |
| Rotate workspace API key          | —        | —       | ✅    | ✅    | ✅          |
| Revoke workspace API key          | —        | —       | ✅    | ✅    | ✅          |
| View external service connections | —        | —       | —     | ✅    | ✅          |
| Update external service secret    | —        | —       | —     | ✅    | ✅          |
| View usage stats                  | —        | —       | ✅    | ✅    | ✅          |
| Create service-to-service key     | —        | —       | —     | —     | ✅          |
| Emergency revoke any key          | —        | —       | —     | —     | ✅          |
| View anomaly dashboard            | —        | —       | —     | —     | ✅          |
| View all keys cross-workspace     | —        | —       | —     | —     | ✅          |

---

## 7. Plan-Tier Gating

| Feature                | Trial | Starter | Professional | Enterprise    |
| ---------------------- | ----- | ------- | ------------ | ------------- |
| Max workspace API keys | 1     | 2       | 10           | Unlimited     |
| Test keys              | —     | 1       | 5            | Unlimited     |
| Preset bundles only    | ✅    | ✅      | —            | —             |
| Granular scope control | —     | —       | ✅           | ✅            |
| IP restrictions        | —     | —       | ✅           | ✅            |
| Custom rate limits     | —     | —       | —            | ✅            |
| Usage analytics        | Basic | Basic   | Full         | Full + export |
| Rotation reminders     | —     | ✅      | ✅           | ✅            |

When a workspace hits its key limit, the "Ny nøkkel" button shows an upgrade prompt instead.

---

## 8. Notification Triggers

| Event                            | Notification                                                 | Channel        | Recipient                     |
| -------------------------------- | ------------------------------------------------------------ | -------------- | ----------------------------- |
| Key created                      | "Ny API-nøkkel opprettet: {name}"                            | In-app + email | Workspace owners              |
| Key rotated                      | "API-nøkkel rotert: {name}. Gammel nøkkel gyldig i {grace}." | In-app + email | Workspace admins              |
| Key revoked                      | "API-nøkkel tilbakekalt: {name}"                             | In-app + email | Workspace admins              |
| Grace period ending              | "API-nøkkel {name} utløper om 4 timer"                       | In-app         | Workspace admins              |
| External key rotation due        | "Stripe-nøkkelen bør roteres (sist: {date})"                 | In-app         | Workspace owner               |
| Usage anomaly                    | "Uvanlig aktivitet på {key_prefix}"                          | In-app + email | Workspace owner + super-admin |
| Key unused 30 days               | "API-nøkkel {name} har ikke vært brukt på 30 dager"          | In-app         | Key creator                   |
| External key verification failed | "Stripe-tilkoblingen feilet — sjekk nøkkelen"                | In-app + email | Workspace owner               |

---

## 9. UI Components

### 9.1 Shared Components

| Component               | Used In               | Description                                             |
| ----------------------- | --------------------- | ------------------------------------------------------- |
| `ApiKeyListItem`        | Key list view         | Single key row with status badge, prefix, scopes, usage |
| `ScopeBundleSelector`   | Create/edit key       | Preset cards + expandable granular checkboxes           |
| `KeyRevealModal`        | Create/rotate         | Show-once key with copy button and confirmation         |
| `RotationDialog`        | Key detail            | Grace period selector + confirmation                    |
| `RevocationDialog`      | Key detail            | Warning with recent usage stats + permanent action      |
| `ServiceConnectionCard` | Service hub           | Provider logo, status, rotation age, warning badge      |
| `SecretUpdateDialog`    | Service detail        | Paste field + auto-verification                         |
| `UsageChart`            | Key detail "Bruk" tab | Recharts line chart, hourly/daily toggle                |
| `AnomalyCard`           | Super-admin           | Alert card with spike details and action buttons        |

### 9.2 State Management

Key management state uses TanStack Query with these query keys:

```typescript
// Query keys
const queryKeys = {
  apiKeys: (workspaceId: string) => ["api-keys", workspaceId],
  apiKey: (keyId: string) => ["api-key", keyId],
  apiKeyUsage: (keyId: string, period: string) => ["api-key-usage", keyId, period],
  externalSecrets: (workspaceId: string) => ["external-secrets", workspaceId],
  allKeys: (filters: object) => ["platform-keys", filters], // super-admin
  anomalies: () => ["key-anomalies"], // super-admin
};
```

---

## 10. Edge Function Endpoints

| Endpoint                 | Method | Auth         | Description                                |
| ------------------------ | ------ | ------------ | ------------------------------------------ |
| `api-key-create`         | POST   | JWT (admin+) | Generate key, return plaintext once        |
| `api-key-rotate`         | POST   | JWT (admin+) | Rotate key, return new plaintext           |
| `api-key-revoke`         | POST   | JWT (admin+) | Immediate revocation                       |
| `api-key-update`         | PATCH  | JWT (admin+) | Update scopes, rate limit, IP restrictions |
| `api-key-list`           | GET    | JWT (admin+) | List keys for workspace (metadata only)    |
| `api-key-usage`          | GET    | JWT (admin+) | Usage stats for a key                      |
| `external-secret-upsert` | POST   | JWT (owner)  | Store/update secret in Vault               |
| `external-secret-verify` | POST   | JWT (owner)  | Test an external service connection        |
| `external-secret-list`   | GET    | JWT (owner)  | List external service connections          |

All endpoints validate that the requesting user has the correct role in the target workspace via RLS.

---

## 11. Implementation Sequence

| Phase                           | Scope                                                            | Duration |
| ------------------------------- | ---------------------------------------------------------------- | -------- |
| **1. Database & functions**     | Migrations, enums, tables, indexes, RLS, Vault wrappers, pg_cron | Week 1   |
| **2. Auth middleware**          | Dual-auth middleware, `set_config` pattern, scope checking       | Week 1-2 |
| **3. Edge Functions**           | Create, rotate, revoke, list, usage endpoints                    | Week 2   |
| **4. Key list & create UI**     | List view, create wizard with bundles, show-once modal           | Week 3   |
| **5. Key detail & rotation UI** | Detail view, usage chart, rotation flow, revocation              | Week 3-4 |
| **6. External secrets UI**      | Service hub, provider detail, update flow with verification      | Week 4   |
| **7. Super-admin**              | Cross-workspace key view, service keys, anomaly dashboard        | Week 5   |
| **8. Notifications**            | Rotation reminders, anomaly alerts, unused key warnings          | Week 5-6 |
| **9. Rate limiting**            | Upstash Redis integration, per-key limits                        | Week 6   |

---

## 12. Integration Points

| Module                        | Integration                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------- |
| **UI Architecture**           | Settings/Integrations section added to sidebar for admin+ mode                   |
| **Module 13 (Multi-Tenant)**  | Key management tables scoped by workspace. Super-admin has cross-workspace view. |
| **Module 9 (Communication)**  | Notification triggers for key events                                             |
| **Core Architecture (Roles)** | Access control follows Role × Workspace pattern                                  |
| **Stripe subscription**       | Plan tier gates max keys, features, and rate limits                              |

---

_API key management in Smartout should feel like plugging in a cable — name it, choose what it accesses, get the key, done. The system handles rotation reminders, usage monitoring, and cleanup automatically. Restaurant owners shouldn't need to understand cryptography to safely connect their POS system._
