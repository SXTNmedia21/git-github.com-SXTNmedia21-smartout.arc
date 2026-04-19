---
title: "Inngang — Helhetlig Designspec for Login, Registrering og Invitasjon (Web + Mobil)"
id: DESIGN_AUTH_INVITATION_2026_04_19
version: "1.0"
status: draft
layer: spec
created: 2026-04-19
updated: 2026-04-19
author: pontus + claude
supersedes: []
depends_on:
  - ADR-0021
  - ADR-0085
  - ADR-0115
  - ADR-0133
  - ADR-0134
tags:
  - spec
  - auth
  - login
  - signup
  - invitation
  - onboarding
  - nordic-split
  - ux
module: auth
---

# Inngang — Helhetlig Designspec

> Komplett designspec for alle vinduer som håndterer inngangen til Smartout: login, registrering, passord-reset, workspace-valg, onboarding-wizard, workspace-invitasjon og ansatt-invitasjon. Dekker web + mobil, alle roller, alle subdomener.
> **Designramme:** Nordic Split (OKLCH warm hue 40–60, Instrument Serif headings, spring motion stiffness 30–45).
> **Cascade-ramme:** Auth er pre-cascade — I1 industry bootstrap kjører først etter kompanie-opprettelse i `/join`.

---

## 0. TL;DR

- **Tre inngangstyper**, én visuell identitet: (1) selv-signup, (2) magic link, (3) invitasjon (workspace eller ansatt).
- **Subdomene-arkitektur:** `app.smartout.ai` = portal (login, join, workspace-valg). `{slug}.smartout.ai` = arbeidsflate (dashboard). Portalen vet ikke hvilket workspace du skal til — den sender deg dit.
- **Invitasjon er kongeveien.** For ansatte er invitasjon den eneste inngangen. De skal aldri selv finne frem til signup.
- **Fire kanaler per invitasjon:** link, e-post, SMS, QR. Admin velger. Link er alltid tilgjengelig.
- **To modi per invitasjon:** enkelt (1 person, full form) eller bulk (CSV, kolonne-mapping).
- **Gate-basert progresjon:** invitasjon → accept → profile → workspace-redirect → dashboard. Hver gate er auditert (`activity_trail` + telemetri).
- **Mobil som deep-link-konsument.** Mobil tar imot invitasjoner via `smartout://invite/[token]`. Mobil oppretter ikke companies.
- **Nordic Split overalt.** OKLCH-verdier, Instrument Serif, spring-motion med tunge masses (2–2.5).
- **Ingen passord i AI-kontekst.** Invitasjon-tokens regnes som credentials.

---

## 1. Designprinsipper

1. **En inngang per intensjon.** Logge inn = `/login`. Registrere kompani = `/signup` → `/join`. Akseptere invitasjon = `/invite/[token]`. Ingen av disse skal tvinge deg innom de andre.
2. **Identitet før workspace.** Auth oppretter `user_identity`. Workspace-tilknytning skjer separat via `/select-workspace` eller via `company_member`/`profile`. Identity kan leve på tvers av workspaces.
3. **Orkestrert bevegelse.** Overganger mellom login, signup og invitasjon er koreografert (Framer Motion spring, stiffness 35, damping 20, mass 2.2) — ikke page-reload.
4. **Magisk standard, passord som fallback.** Magic link er primær for daglig login. Passord tilbys som fallback, spesielt for offline-scenarier og passord-manager-brukere.
5. **Invitasjon viser kontekst først.** Før ansatt får skjemaet: "Du er invitert av Anna til Café Skuta som servitør." Identitet + rolle + arbeidsplass synlig før hun taster noe.
6. **Progressive disclosure i invitasjons-opprettelse.** Admin ser kun nødvendige felt først; utvidet info (employment profile, team, department) er collapsible.
7. **Status alltid synlig.** Hvilken tilstand er invitasjonen i: pending / sent / opened / accepted / expired / cancelled. Aldri gjette.
8. **Idempotent accept.** Dobbel-klikk på accept-lenke fører ikke til dobbel profil. Tokens er enkelt-bruks med eksplisitt status-sjekk.
9. **Aldri logg passord eller tokens.** Ikke til telemetri, activity_trail, eller chat-kontekst. Tokens censureres til første 8 tegn i audit.
10. **Nordic Split 40%-reduksjon.** Frostet glass, subtile gradients, tunge masses. Ingen bokser i bokser. Typografi og lys bærer hierarkiet.

---

## 2. Informasjonsarkitektur

### 2.1 Subdomene-kart

| Domene | Rolle | Ruter tilgjengelig |
| --- | --- | --- |
| `app.smartout.ai` | Portal (identitet) | `/login`, `/signup`, `/join`, `/reset-password`, `/update-password`, `/welcome`, `/select-workspace`, `/invite/[token]`, `/admin/*` (platform-admin) |
| `{slug}.smartout.ai` | Workspace (arbeid) | `/dashboard/**` |
| `smartout.ai` (root) | Landing | Redirect til Vercel landing-projekt |
| `*.smartout.info` | Public sites | Rewritten til `/public-site/{host}/...` |

### 2.2 Flyt-oversikt

```
┌─ NY BRUKER (SELF-SIGNUP) ─────────────────────────────┐
│                                                       │
│  /signup → magic link ELLER passord                   │
│     │                                                 │
│     ▼                                                 │
│  /api/auth/callback?next=/join                        │
│     │                                                 │
│     ▼                                                 │
│  /join (wizard) → I1 bootstrap → workspace opprettet  │
│     │                                                 │
│     ▼                                                 │
│  {slug}.smartout.ai/dashboard                         │
└───────────────────────────────────────────────────────┘

┌─ EKSISTERENDE BRUKER (LOGIN) ─────────────────────────┐
│                                                       │
│  /login → magic link ELLER passord ELLER Google       │
│     │                                                 │
│     ▼                                                 │
│  Hvor mange workspaces?                               │
│     │                                                 │
│     ├── 0 → /join (ny kompani-wizard)                 │
│     ├── 1 → {slug}.smartout.ai/dashboard              │
│     └── 2+ → /select-workspace                        │
└───────────────────────────────────────────────────────┘

┌─ INVITERT BRUKER (INVITASJON) ────────────────────────┐
│                                                       │
│  Åpner lenke /invite/[token] (web eller mobil)        │
│     │                                                 │
│     ▼                                                 │
│  Token-validering (get_invitation_by_token RPC)       │
│     │                                                 │
│     ├── invalid/expired/accepted → feilside           │
│     │                                                 │
│     └── pending + valid → split:                      │
│         │                                             │
│         ├── e-post finnes i auth.users                │
│         │   → "Logg inn for å akseptere"              │
│         │   → accept-invitation edge fn               │
│         │   → workspace-redirect                      │
│         │                                             │
│         └── e-post finnes ikke                        │
│             → utfyll form (navn, tlf, passord)        │
│             → accept-invitation (oppretter auth user) │
│             → auto-login                              │
│             → /welcome eller workspace-redirect       │
└───────────────────────────────────────────────────────┘
```

### 2.3 Layout-mønster (alle portal-sider)

Nordic Split to-panel:

```
┌───────────────────────────────────────────────────────────────┐
│  ┌─ Venstre (brand-panel) ──┐  ┌─ Høyre (form-panel) ───────┐ │
│  │                          │  │                            │ │
│  │   Smartout wordmark      │  │   [Contextual heading]     │ │
│  │   (Instrument Serif)     │  │                            │ │
│  │                          │  │   [Form]                   │ │
│  │   Ambient orb            │  │                            │ │
│  │   (radial-gradient)      │  │   [Primary CTA]            │ │
│  │                          │  │                            │ │
│  │   Tagline / brand story  │  │   [Secondary link]         │ │
│  │                          │  │                            │ │
│  └──────────────────────────┘  └────────────────────────────┘ │
│  background: warm OKLCH gradient + noise overlay              │
└───────────────────────────────────────────────────────────────┘
```

Koreografi:
- Veksling login ↔ signup: venstre-panel utvider/krymper, høyre-panel form-swap med stagger.
- Vellykket login: venstre-panel mørkner og ekspanderer; høyre-panel fader ut før redirect.
- Invitasjon-accept: brand-panel viser workspace-navn og inviter-navn (personalisert).

---

## 3. Login-flaten

### 3.1 Rute og formål

- **Rute:** `app.smartout.ai/login`
- **Formål:** Enkel, rask inngang for eksisterende brukere.
- **Auth-metoder:** passord, magic link (OTP), Google SSO.

### 3.2 Layout — to tabs

```
┌─ Høyre panel: /login ───────────────────────────────────┐
│                                                         │
│  Hei igjen.                                             │
│  Logg inn for å fortsette                               │
│                                                         │
│  [ Passord ]  [ Magisk lenke ]                          │
│  ────────                                               │
│                                                         │
│  ┌─ Passord-tab ─────────────────────────────────────┐ │
│  │  [  Fortsett med Google  ]                        │ │
│  │  ── eller ──                                      │ │
│  │  E-post: [                              ]         │ │
│  │  Passord: [                             ] 👁       │ │
│  │              [ Glemt passord? ]                    │ │
│  │                                                   │ │
│  │  [  Logg inn  ]                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Ikke registrert? [ Opprett konto ]                     │
└─────────────────────────────────────────────────────────┘
```

Magic link-tab har kun e-post + "Send kode"-knapp → OTP-verifisering (6-siffer auto-advance).

### 3.3 Tilstander

| Tilstand | Visuell respons |
| --- | --- |
| `idle` | Form synlig, CTA enabled |
| `submitting` | CTA viser spinner, form disabled |
| `otp_sent` | Tab viser "Vi sendte en kode til {email}" + OTP-input |
| `error` | Alert-banner under form med klartekst (ikke tekniske koder) |
| `logging-in` | Form fader ut, brand-panel ekspanderer — deretter redirect |
| `network_failure` | Banner: "Kunne ikke nå Smartout. Sjekk nett og prøv igjen." + retry |

### 3.4 Feilmeldinger — menneskelige

| Supabase-feil | Vises som |
| --- | --- |
| `Invalid login credentials` | "E-post eller passord stemmer ikke." |
| `Email not confirmed` | "Vi har ikke bekreftet e-posten din ennå. Sjekk innboksen." |
| `Too many requests` | "For mange forsøk. Prøv igjen om noen minutter." |
| Network timeout | "Vi når ikke Smartout. Sjekk forbindelsen." |

Ingen "HTTP 401", ingen stack traces, ingen Supabase-URL-er i UI.

### 3.5 Redirect-logikk post-login

Middleware (`apps/web/src/middleware.ts`) styrer redirect:
1. Hent `company_member`-rader for `auth.uid()`.
2. Hvis 0 → `/join`.
3. Hvis 1 aktiv workspace → `{slug}.smartout.ai/dashboard`.
4. Hvis 2+ workspaces → `/select-workspace`.
5. Hvis `force_password_reset` metadata → `/reset-password` (Bubble-migrerte brukere).

---

## 4. Signup-flaten

### 4.1 Rute og formål

- **Rute:** `app.smartout.ai/signup`
- **Formål:** Oppretter `user_identity` for person som vil starte _ny_ kompani.
- **Ikke for ansatte.** Ansatte skal aldri havne her — de bruker invitasjon.

### 4.2 Layout

```
┌─ Høyre panel: /signup ──────────────────────────────────┐
│                                                         │
│  Opprett konto                                          │
│  Start ny arbeidsplass i Smartout                       │
│                                                         │
│  [ Magisk lenke ]  [ Passord ]                          │
│                                                         │
│  ┌─ Magic link-tab (default) ────────────────────────┐ │
│  │  E-post: [                              ]         │ │
│  │                                                   │ │
│  │  [  Send lenke  ]                                 │ │
│  │                                                   │ │
│  │  Vi sender deg en magisk lenke. Ingen passord.    │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ⓘ Er du invitert av en arbeidsgiver?                   │
│     Bruk invitasjons-lenken du fikk på e-post.          │
│                                                         │
│  Har du konto? [ Logg inn ]                             │
└─────────────────────────────────────────────────────────┘
```

Passord-tab har e-post + passord × 2 + validering (min 8 tegn, match).

### 4.3 Bekreftelse-tilstander

Etter submit:
```
✓ Sjekk innboksen
Vi sendte en lenke til {email}. Klikk den for å fullføre.
[ Send på nytt ] [ Endre e-post ]
```

### 4.4 Offline-fallback

Hvis nettverk feiler: lagre e-post i `localStorage.PENDING_SIGNUP_KEY`. Neste gang bruker åpner `/signup`, prefil + varsel: "Ser ut til at din forrige signup feilet. Prøv igjen?"

### 4.5 Post-signup

Alle paths redirecter til `/join` (wizard) for kompani-opprettelse. `auth.users.id` eksisterer, men `user_identity`, `company`, `workspace` gjør det ikke før wizard er fullført.

---

## 5. `/join` — Onboarding Wizard

### 5.1 Rolle

Oppretter hele den pre-cascade identitets-kjeden i rekkefølge:
1. `user_identity` — personlig profil (navn, tlf)
2. `company` — juridisk enhet
3. `company_member` — eier-tilknytning
4. `workspace` — første arbeidsplass
5. `profile` — owner-profil i workspace
6. **I1 Industry Bootstrap** — seeder D1-D6 for valgt vertikal (hospitality, retail, etc.)

### 5.2 Struktur

10 seksjoner per `apps/web/src/app/onboarding/` + 14 UI-komponenter + WizardContext + 3 hooks (`useOnboardingState`, `useScrollProgress`, `useBotsson`).

Høynivå-seksjoner:
1. Velkommen (brand-panel ekspandert)
2. Om deg (navn, tlf)
3. Om kompaniet (org.nr, navn, adresse)
4. Bransje (hospitality / retail / annet) — styrer I1 bootstrap
5. Første arbeidsplass (workspace navn + slug-forslag)
6. Avdelinger (default-sett fra industripakken, redigerbart)
7. Åpningstider (default fra industripakken)
8. Regelverk (Riksavtalen / Virke / annen) — hvis hospitality
9. Bekreft (sammendrag + TOS)
10. Fullført (redirect til `{slug}.smartout.ai/dashboard`)

### 5.3 Designkrav

- **Scroll-basert progresjon**, ikke step-numbers. Bruker scroller, seksjoner snapper inn.
- **Botsson (AI-assistent) i sidebar.** Svarer på spørsmål i real-time om feltene. Stille hvis ikke tilkalt.
- **Ingen "Neste/Tilbake" før siste seksjon.** Bruker navigerer fritt, men submit-knappen aktiveres først når alle påkrevde felt er utfylt.
- **Live validering.** Org.nr sjekkes mot Brønnøysund-register (scraping-service). Slug-forslag genereres fra kompani-navn og sjekkes mot eksisterende.
- **Industri-default sparker inn visuelt** — når bruker velger "Restaurant", oppdateres åpningstider, avdelinger, roller med animasjon som viser hva som ble autofylt.

### 5.4 I1-bootstrap

Når bruker submit'er siste seksjon:
1. Transaction oppretter `company` + `workspace` + `profile`.
2. `applyIndustryBootstrap(workspace_id, 'restaurant')` kjører `supabase/templates/restaurant/_apply.sql`.
3. Dette seeder: avdelinger, operating_hours, framework, tariff_rates, default payroll profiles, default protocols.
4. Telemetri: `onboarding completed` (activity_trail + engine_event).
5. Redirect til workspace-dashboard.

### 5.5 Feil-håndtering

Hvis bootstrap feiler midt i: transaction rulles tilbake. Bruker ser: "Noe gikk galt under oppsett. Vi har ikke opprettet arbeidsplassen. Prøv igjen eller kontakt support." Wizard-state bevares i localStorage.

---

## 6. Passord-reset

### 6.1 To-trinn

**Trinn A — `/reset-password`:**
```
┌─────────────────────────────────────────┐
│  Glemt passord?                         │
│  Vi sender deg en lenke for å sette    │
│  et nytt.                               │
│                                         │
│  E-post: [                       ]      │
│                                         │
│  [  Send lenke  ]                       │
│                                         │
│  [ Tilbake til login ]                  │
└─────────────────────────────────────────┘
```

**Trinn B — `/update-password` (via e-post-lenke):**
```
┌─────────────────────────────────────────┐
│  Sett nytt passord                      │
│                                         │
│  Nytt passord:    [                ] 👁  │
│  Bekreft:         [                ] 👁  │
│  Styrke: ●●●○○   (8+ tegn, stor bokstav) │
│                                         │
│  [  Lagre og logg inn  ]                │
└─────────────────────────────────────────┘
```

### 6.2 Migrasjons-tilfelle

Bubble-migrerte brukere har `user_metadata.force_password_reset = true`. Middleware sender dem direkte til `/update-password` ved login. Banner øverst: "Du må sette et nytt passord første gang du logger inn i den nye Smartout."

---

## 7. `/welcome` — Post-signup / Post-invite

### 7.1 Formål

Mikro-onboarding for nye brukere. Kort, 3 skjermbilder maks. Skal føles som et håndtrykk, ikke et kurs.

### 7.2 Skjermbilder

1. **"Du er inne."** — Stort brand-visuell, navn personalisert, "Slik kommer du i gang"-knapp.
2. **Hva kan du gjøre her?** — 2–3 rolle-spesifikke kort (for employee: "Se vaktene dine", "Fullfør opplæring", "Stemple inn i morgen").
3. **Mobil-nudge** — "Last ned mobil-appen for å få beskjed om endringer" — QR-kode og App Store/Play Store-ikoner.

Hopp over-lenke synlig hele tiden. Redirect til dashboard etter.

---

## 8. `/select-workspace`

### 8.1 Formål

Når bruker har 2+ aktive workspaces, må hun velge hvilken hun vil inn i.

### 8.2 Layout

```
┌─ /select-workspace ─────────────────────────────────────┐
│  Hvor vil du inn?                                       │
│                                                         │
│  ┌────────────────────┐  ┌────────────────────┐         │
│  │ Café Skuta         │  │ Bistro Nord        │         │
│  │ Servitør           │  │ Admin              │         │
│  │ Sist: 2 min siden  │  │ Sist: 3 dager      │         │
│  │ ●● aktive vakter   │  │ 12 ansatte         │         │
│  └────────────────────┘  └────────────────────┘         │
│                                                         │
│  ┌────────────────────┐                                 │
│  │ + Ny arbeidsplass  │                                 │
│  └────────────────────┘                                 │
└─────────────────────────────────────────────────────────┘
```

Kort viser: workspace-navn, brukerens rolle der, siste aktivitet, rask status. Klikk → redirect til `{slug}.smartout.ai/dashboard`.

### 8.3 Husk-valg

Checkbox "Husk dette workspace-et" setter cookie `preferred_workspace_slug`. Neste login hopper over `/select-workspace`, men pre-fyller ved spørsmål.

---

## 9. Invitasjon-flaten — opprettelse (admin-side)

### 9.1 Hvor

Dashboard → Personer → "Inviter"-knapp (øverst til høyre på `/dashboard/people`).

### 9.2 Dialog — to modi

```
┌─ Inviter ───────────────────────────────────────────────┐
│  [ Enkelt ]  [ Bulk (CSV) ]                             │
│                                                         │
│  ┌─ Enkelt-fane ─────────────────────────────────────┐ │
│  │  Navn: [Fornavn]  [Etternavn]                     │ │
│  │  E-post: [                            ]           │ │
│  │  Telefon: [+47                        ]           │ │
│  │                                                   │ │
│  │  Avdeling: [Kjøkken ▾]                            │ │
│  │  Rolle:    [Servitør ▾]                           │ │
│  │                                                   │ │
│  │  Kanaler: [✓] Lenke  [✓] E-post  [ ] SMS  [ ] QR │ │
│  │                                                   │ │
│  │  Ansettelsestype: [● Ansatt] [○ Gjest]            │ │
│  │                                                   │ │
│  │  ▾ Utvidet (ansettelsesprofil)                    │ │
│  │    • Lønnsmal: [Servitør heltid ▾]                │ │
│  │    • Timer per uke: [37.5]                        │ │
│  │    • Startdato: [01.07.2026]                      │ │
│  │                                                   │ │
│  │  [  Send invitasjon  ]                            │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 9.3 CSV-modus

```
┌─ CSV-fane ───────────────────────────────────────────────┐
│  1. [ Last opp CSV ]  (drag-drop også støttet)          │
│  2. Kolonne-mapping:                                    │
│     Fornavn    ← [column A ▾]                           │
│     Etternavn  ← [column B ▾]                           │
│     E-post     ← [column C ▾]                           │
│     Telefon    ← [column D ▾]                           │
│     Avdeling   ← [column E ▾]  (valgfri)                │
│  3. Forhåndsvisning: 47 rader, 2 feil                   │
│     ⚠ Rad 12: Mangler e-post                            │
│     ⚠ Rad 29: Ugyldig e-post-format                     │
│  4. Kanaler: [✓] Lenke (alltid)  [ ] E-post  [ ] SMS   │
│  5. [ Rett opp feil ] [ Importer 45 gyldige ]           │
└──────────────────────────────────────────────────────────┘
```

### 9.4 Etter-opprettelse

**Enkelt:** modal viser generert lenke med "Kopier"-knapp + kanal-status ("E-post sendt ✓", "SMS feilet ✗ — ugyldig nummer"). Admin kan resende per kanal.

**Bulk:** modal viser oppsummering ("47 opprettet, 3 feilet") + mulighet for å eksportere feil-liste som CSV.

### 9.5 Status-list (invitation index)

Under "Inviter"-knappen, tabell med alle aktive invitasjoner:

```
┌──────────────────────────────────────────────────────────┐
│  Status    │ Navn          │ E-post         │ Sendt    │ │
├──────────────────────────────────────────────────────────┤
│  ● Pending │ Anna Kok      │ anna@...       │ 3t siden │ │
│  ● Åpnet   │ Bjørn Servi   │ bjorn@...      │ 1d siden │ │
│  ● Godtatt │ Carl Andersen │ carl@...       │ 2d siden │ │
│  ● Utløpt  │ Dina Test     │ dina@...       │ 8d siden │ │
└──────────────────────────────────────────────────────────┘
Handlinger: [Resend] [Kopier lenke] [Kanseller]
```

Status-badger er fargekodet via Nordic Split semantiske tokens:
- Pending → `bg-muted text-muted-foreground`
- Åpnet (opened) → `bg-primary/10 text-primary`
- Godtatt → `bg-success/10 text-success`
- Utløpt → `bg-warning/10 text-warning`
- Kansellert → `bg-destructive/10 text-destructive`

### 9.6 Telemetri ved opprettelse

| Event | Felt |
| --- | --- |
| `invitation created` | `{ invitation_id, channels: ["link","email"], invite_type: "employee" }` |
| `invitation dispatched` | `{ invitation_id, channel: "email", outcome: "sent"|"failed", reason? }` per kanal |
| `invitation cancelled` | `{ invitation_id, reason }` |
| `invitation resent` | `{ invitation_id, channel }` |

---

## 10. Invitasjon-flaten — accept (invitert person)

### 10.1 Inngang

URL: `app.smartout.ai/invite/[token]` (web) eller `smartout://invite/[token]` (mobil deep link).

### 10.2 Token-validering

Side kaller `get_invitation_by_token(p_token)` RPC. Fire utfall:

| Utfall | Visning |
| --- | --- |
| `invalid` (token finnes ikke) | Feilside: "Denne lenken er ikke gyldig." |
| `expired` (past `expires_at`) | Feilside: "Lenken har utløpt. Be om ny." + "Kontakt arbeidsgiver"-knapp |
| `accepted` | "Du har allerede akseptert. Logg inn for å fortsette." |
| `cancelled` | "Invitasjonen er kansellert." |
| `pending` + valid | Vis form (se under) |

### 10.3 Kontekst-header (alltid øverst)

```
┌────────────────────────────────────────┐
│  [Café Skuta logo]                     │
│                                        │
│  Anna Olsen har invitert deg           │
│  til Café Skuta som Servitør           │
│                                        │
│  Du starter 1. juli 2026.              │
└────────────────────────────────────────┘
```

Dette er **ikke** valgfritt. Kontekst før form er kjerneprinsipp.

### 10.4 Form — to varianter

**A — E-post eksisterer i `auth.users`:**
```
┌────────────────────────────────────────┐
│  Bekreft identiteten din               │
│                                        │
│  Navn:   [Per] [Hansen]                │
│  E-post: per@... (låst)                │
│  Telefon: [+47                  ]      │
│  Passord: [                     ]      │
│                                        │
│  [  Aksepter invitasjon  ]             │
│                                        │
│  Glemt passord? [ Logg inn via kode ]  │
└────────────────────────────────────────┘
```

**B — E-post finnes ikke:**
```
┌────────────────────────────────────────┐
│  Opprett konto                         │
│                                        │
│  Navn:     [Per] [Hansen]              │
│  E-post:   [per@...]                   │
│  Telefon:  [+47                  ]     │
│  Passord:  [                     ] 👁   │
│  Bekreft:  [                     ] 👁   │
│                                        │
│  [ ] Jeg godtar vilkår og personvern  │
│                                        │
│  [  Opprett konto og aksepter  ]       │
└────────────────────────────────────────┘
```

### 10.5 Submit → backend

Kaller `accept-invitation` Edge Function (service role):
1. Dobbelt-sjekk invitation status (mot race conditions).
2. Variant B: `auth.admin.createUser({ email, password, user_metadata })`.
3. Opprett `user_identity` (hvis ikke finnes).
4. Opprett `profile` med `workspace_id`, `department_id`, `role`, `status = 'trainee'`.
5. Upsert `company_member` (rolle = invitation.role).
6. Generer unikt `profile_code` (6 tegn, alfanum).
7. Opprett `team_member`-rader hvis `team_ids` i invitation.
8. Oppdater invitation.status = 'accepted', `accepted_at = now()`.
9. Emit `invitation accepted` + `profile created` + `user signed_up` (variant B).

### 10.6 Post-accept redirect

- Variant A (eksisterende bruker): `{slug}.smartout.ai/dashboard` — hun har identitet, kun nytt workspace.
- Variant B (ny bruker): `/welcome` → `{slug}.smartout.ai/dashboard`.

### 10.7 Idempotens

Dobbel-klikk eller dobbel-submit:
- Backend sjekker `status = 'pending'` før endring. Hvis allerede `accepted`, returnerer suksess uten dupliserte skriv.
- Frontend disabler submit-knapp på første klikk.
- Token er enkelt-bruks; re-accept med samme token returnerer "already accepted".

---

## 11. Mobil-parity

### 11.1 Rolle per ADR-0133

Mobil er konsument for invitasjoner (D6+C4), ikke produsent (D1–D5). Mobil:
- ✅ Tar imot invitasjoner via deep link
- ✅ Viser `/welcome`
- ✅ Logger inn / ut
- ❌ Oppretter ikke kompanier
- ❌ Har ikke `/join`-wizard
- ❌ Oppretter ikke invitasjoner

### 11.2 Mobil auth-entry

`apps/mobile/app/(auth)/welcome.tsx` har tre inngangspunkter:
1. **"Jeg har en invitasjon"** → limer inn lenke eller åpner camera for QR-skann.
2. **"Finn min arbeidsplass"** → søk etter workspace-navn / slug → sender magic link.
3. **"Logg inn direkte"** → e-post + passord.

### 11.3 Deep link-flow

```
smartout://invite/[token]
   │
   ▼
(a) Mobil app installert → /(auth)/invite/[token] native screen
(b) Ikke installert → Fallback til web /invite/[token] → "Last ned appen" prompt
```

Native invite-screen har samme kontekst-header (logo, inviter, rolle) og samme form-varianter (A/B) som web.

### 11.4 QR-kode-kanal

Når admin oppretter invitasjon med kanal "QR":
- Generer QR med `app.smartout.ai/invite/[token]` (universal link).
- iOS/Android åpner app hvis installert, ellers web.
- Web-fallback tilbyr "Last ned appen" eller "Fortsett i nettleser".

---

## 12. Middleware — regler og gates

### 12.1 Subdomene-logikk

`middleware.ts` (413 linjer) må:
1. Parse `host` header → avgjør domene-type (portal / workspace / landing / public).
2. For workspace-subdomener: sett `x-workspace-slug` header.
3. For portal: tillat public routes uten auth; krev auth for resten.
4. Refresh Supabase-session unntatt på public routes (for å unngå 429-storm).

### 12.2 Public routes (ingen auth-sjekk)

```ts
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/join",
  "/reset-password",
  "/update-password",
  "/api/auth/callback",
  "/invite/", // prefix match
];
```

### 12.3 Gate-sjekker (rekkefølge)

1. Public route? → passerer.
2. Autentisert? Hvis ikke → redirect til `/login?next={originalUrl}`.
3. `force_password_reset`? → redirect til `/update-password`.
4. Sandbox-ruter (`/dashboard/settings/api-keys`, `/dashboard/team/invite`) + unverified workspace → 403.
5. Platform-admin-ruter + ikke `is_godmode` → 404.
6. Ellers → passerer.

### 12.4 Godmode-cache

`user_identity.is_godmode` caches 30 sekunder per request-chain (Supabase-kall ville ellers drepe ytelse). Cache invaliderer på login/logout.

---

## 13. Edge Functions — kontrakt

### 13.1 `create-invitation`

**Auth:** Autentisert (JWT), admin-rolle.

**Input:**
```ts
// Enkelt-modus
{
  workspace_id: string;
  invite_type: "employee" | "guest";
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: "employee" | "manager" | "admin";
  department_ids?: string[];
  team_ids?: string[];
  channels: Array<"link" | "email" | "sms" | "qr">;
  employment_profile?: { template_id, weekly_hours, start_date, ... };
}

// Bulk-modus
{
  workspace_id: string;
  invites: Array<{...samme som enkelt uten channels}>;
  channels: Array<...>;
  skip_dispatch?: boolean;
}
```

**Output:**
```ts
{
  invitation_id: string; // eller array i bulk
  token: string;
  dispatched: Array<{ channel, outcome: "sent" | "failed", reason? }>;
  failed: Array<...>; // kun bulk
}
```

### 13.2 `accept-invitation`

**Auth:** Unauthenticated (bruker service role internt). Token er credentialen.

**Input:**
```ts
{
  token: string;
  first_name: string;
  last_name: string;
  email?: string;    // kun hvis variant B
  phone?: string;
  password?: string; // kun hvis variant B
}
```

**Output:**
```ts
{
  success: boolean;
  user_created: boolean; // true = variant B, false = variant A
  workspace_slug: string;
  redirect_url: string;
  session?: { access_token, refresh_token }; // variant B auto-login
}
```

### 13.3 `send-login-code`

**Auth:** Unauthenticated.

**Input:** `{ email }`
**Output:** `{ sent: boolean, expires_at }`

---

## 14. Telemetri — auth/invitasjon-registry

Følgende må eksistere i `packages/telemetry/src/registry.ts`. Sjekkliste for implementering:

| Event | Kategori | Destinasjoner | Entity |
| --- | --- | --- | --- |
| `user signed_up` | auth | activity_trail, engine_event, posthog | user_identity |
| `user signed_in` | auth | activity_trail, posthog | user_identity |
| `user signed_out` | auth | activity_trail, posthog | user_identity |
| `user password_reset_requested` | auth | activity_trail | user_identity |
| `user password_reset_completed` | auth | activity_trail | user_identity |
| `onboarding step_completed` | onboarding | activity_trail, posthog | — |
| `onboarding completed` | onboarding | activity_trail, engine_event, posthog | workspace |
| `invitation created` | people | activity_trail, engine_event | invitation |
| `invitation dispatched` | people | activity_trail | invitation |
| `invitation opened` | people | activity_trail, posthog | invitation |
| `invitation accepted` | people | activity_trail, engine_event | invitation |
| `invitation cancelled` | people | activity_trail | invitation |
| `invitation expired` | people | activity_trail (system actor) | invitation |
| `invitation resent` | people | activity_trail | invitation |
| `profile created` | people | activity_trail, engine_event | profile |
| `workspace selected` | navigation | posthog | workspace |

### Payload-krav

- `actor_id`: profile_id hvis tilgjengelig, ellers user_identity_id, aldri tomstreng (ADR-0134).
- `workspace_id`: påkrevd unntatt for `user signed_up` (før workspace finnes).
- Sensitive felt som `password`, `token`, `otp_code` **må aldri** komme med i `properties.data`. Tokens logges sensurert (første 8 tegn).

---

## 15. Nordic Split — designtokens

### 15.1 Palett

Kun OKLCH CSS-variabler. Eksempler fra login-flaten:

```css
--brand-orange: oklch(0.65 0.22 40);
--foreground: oklch(0.15 0.01 50);
--muted-foreground: oklch(0.52 0.01 52);
--background: oklch(0.98 0.01 55);
--border: oklch(0.92 0.02 55);
--success: oklch(0.7 0.15 145);
--warning: oklch(0.75 0.15 70);
--destructive: oklch(0.6 0.22 25);
```

Alle auth/invite-sider bruker `bg-background`, `text-foreground`, `border-border`, `bg-muted`, `text-muted-foreground` — aldri `zinc-*`, `slate-*`, `gray-*`.

### 15.2 Typografi

- Primære overskrifter (inviter/login-header): `font-heading text-4xl leading-tight` (Instrument Serif)
- Underoverskrifter: `font-heading text-xl`
- Form-labels: `font-sans text-sm font-medium`
- Form-inputs: `font-sans text-base`
- Hjelpetekst: `font-sans text-sm text-muted-foreground`
- Feil-meldinger: `font-sans text-sm text-destructive`
- Monospace for koder (OTP, invitasjons-token-preview): `font-mono text-lg tracking-widest`

### 15.3 Motion — springs

Alle transitions bruker springs (stiffness 30–45, damping 20–24, mass 2–2.5):

| Overgang | Stiffness | Damping | Mass |
| --- | --- | --- | --- |
| Panel-resize (login↔signup) | 35 | 20 | 2.2 |
| Form-swap (tab-veksling) | 40 | 22 | 2.0 |
| Brand-panel ekspander (post-login) | 30 | 24 | 2.5 |
| Modal entrance (invite dialog) | 40 | 22 | 2.0 |
| Error-banner slide | 45 | 24 | 2.0 |

Min 500ms entrance, min 250ms exit. Ingen abrupt transitions.

### 15.4 Glassmorphism-oppskrift (reset-password, welcome)

```tsx
<div className="bg-background/80 backdrop-blur-xl border border-border/50
                rounded-2xl shadow-[0_0_40px_-10px_oklch(0.65_0.22_40/0.1)]">
  {/* innhold */}
</div>
```

Tynn gradient-border (lys øverst-venstre), diskret orange glow i stedet for tung skygge.

### 15.5 Orb (brand-panel ambient lys)

Radial gradient, ikke blur-blob:
```css
background:
  radial-gradient(circle at 30% 40%, oklch(0.75 0.18 45 / 0.4), transparent 50%),
  radial-gradient(circle at 70% 70%, oklch(0.7 0.15 55 / 0.3), transparent 60%),
  oklch(0.15 0.01 50);
```

Flere lag for dybde. Ambient — aldri interaktivt.

### 15.6 Ikoner

Kun Lucide React:
- `Mail` — e-post-input
- `Lock` — passord-input
- `Eye` / `EyeOff` — passord-synlighet
- `CheckCircle2` — suksess
- `AlertCircle` — feil
- `Clock` — utløper
- `Send` — sendt
- `Copy` — kopier lenke
- `QrCode` — QR-kanal
- `ArrowRight` — primær CTA

Ingen emojis i UI. Ingen andre ikon-biblioteker.

---

## 16. Tilstandsmaskin — invitasjon

### 16.1 Full lifecycle

```
                            cancelled (admin handling)
                                ▲
                                │
   created ──▶ pending ──▶ opened ──▶ accepted
                   │                      │
                   │ time > expires_at    │
                   ▼                      ▼
                expired              profile_created
                                          │
                                          ▼
                                      workspace_active
```

### 16.2 DB-kolonner

`invitation`:
- `status: invite_status` — `pending | opened | accepted | expired | cancelled`
- `opened_at: timestamptz` — satt ved første GET på `/invite/[token]`
- `accepted_at: timestamptz`
- `cancelled_at: timestamptz`
- `expires_at: timestamptz` default 7 dager

### 16.3 Automatiseringer

- **Opened-tracking:** `/invite/[token]` page gjør en `opened` RPC-kall ved første view. Idempotent — setter `opened_at` kun hvis null.
- **Expiry-cron:** Scheduled edge function (`invitation-expire-cron`) kjører daglig, markerer alle `pending` med `expires_at < now()` som `expired`. Emit `invitation expired`.
- **Ny lenke:** "Resend" oppretter ny `invitation`-rad (ny token) og arkiverer gammel som `cancelled`. Ansatt kan ikke ha to åpne invitasjoner samtidig (unique constraint `(workspace_id, email, status)` der status = 'pending').

---

## 17. Sikkerhet og personvern

### 17.1 Token-håndtering

- UUIDv4, 128-bit entropi.
- URL-path-parameter (ikke query), gjør det usannsynlig at de lekker via referer.
- Enkelt-bruks: status flyttes til `accepted` ved første vellykket accept.
- 7-dagers default-expiry. Admin kan konfigurere per workspace (P2).

### 17.2 Rate limiting

- `/login` med passord: 5 forsøk per 5 min per e-post (Supabase default).
- `/signup`: 3 per 10 min per IP.
- `send-login-code`: 5 per time per e-post.
- `accept-invitation`: 10 per time per token (burde aldri skje, men lim).

### 17.3 PII i loggene

- Aldri log rå e-post i klartekst i feil-meldinger til frontend-console.
- Activity trail lagrer e-post i `properties.data` — dette er innenfor audit, men må omfattes av GDPR-slettings-rutiner.
- Telefonnummer sensureres til `+47 ••• ••123` i UI unntatt for eier.

### 17.4 ADR-krav

Ny ADR-utkast: **ADR-NEXT-AUTH-01 — Invitation tokens er credentials.** Tokens må:
- Aldri logges i fulltekst (kun første 8 tegn i audit).
- Aldri sendes til AI-kontekst (stage-engine, Botsson).
- Genereres med `crypto.randomUUID()`, ikke predictable counters.

---

## 18. Komponent-inventar og endringer

### 18.1 Eksisterende filer (stikk-oversikt)

| Fil | Status | Endring |
| --- | --- | --- |
| `apps/web/src/app/login/page.tsx` (931 linjer) | Fungerer | Split til under-komponenter for lesbarhet; tabs til `LoginMethodTabs`, form til `PasswordLoginForm` / `OtpLoginForm` |
| `apps/web/src/app/signup/page.tsx` (527 linjer) | Fungerer | Samme splitting; "Invitert?"-banner mer prominent |
| `apps/web/src/app/join/page.tsx` (16 linjer) | Wrapper | Wizard-sektioner må få Nordic Split-audit |
| `apps/web/src/app/invite/[token]/page.tsx` (488 linjer) | Fungerer | Kontekst-header må gjøres prominent; split form-varianter til sub-komponenter |
| `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx` (1103 linjer) | Fungerer | Ekstremt stor — split til `SingleInviteForm`, `CsvImportView`, `GeneratedLinkView`, `EmploymentProfileCollapsible`, `ChannelSelector` |
| `apps/web/src/middleware.ts` (413 linjer) | Fungerer | Add `/invite/` i public routes prefix |
| `apps/web/src/components/auth/OtpVerificationForm.tsx` | Fungerer | Tokens/OTP censurering ved telemetry |
| `apps/web/src/app/reset-password/page.tsx` | Uaudert | Nordic Split-audit |
| `apps/web/src/app/welcome/page.tsx` | Uaudert | Nordic Split-audit + rolle-spesifikt innhold |

### 18.2 Nye komponenter (for spec)

| Komponent | Formål |
| --- | --- |
| `AuthLayout.tsx` (i `packages/ui` eller `apps/web/src/components/auth/`) | Felles to-panel-layout for alle portal-sider (login, signup, reset, invite, welcome). Eliminerer duplisert brand-panel-kode. |
| `InvitationContextHeader.tsx` | Logo + "{inviter} har invitert deg til {workspace} som {role}"-komponent brukt på invite-accept web og mobil. |
| `InvitationStatusBadge.tsx` | Gjenbrukbar badge for pending/opened/accepted/expired/cancelled. |
| `InvitationStatusList.tsx` | Tabell over aktive invitasjoner under `/dashboard/people`. |
| `CsvMappingDialog.tsx` | Finnes; formaliser grensesnitt og state-maskin. |
| `ChannelSelector.tsx` | Checkbox-gruppe for link/email/sms/qr med dispatch-status. |
| `WorkspaceCard.tsx` | Kort brukt i `/select-workspace` med rolle, siste aktivitet, status. |
| `PasswordStrengthMeter.tsx` | Brukes i signup og update-password. |

### 18.3 Nye hooks

| Hook | Formål |
| --- | --- |
| `useInvitationToken(token)` | RPC-wrapping for validering + status-retur. |
| `useAcceptInvitation()` | Mutation-wrap rundt `accept-invitation` edge function. |
| `useCreateInvitation()` | Mutation-wrap rundt `create-invitation`. |
| `useInvitationList(workspace_id)` | Query for status-liste. |
| `useWorkspacePicker()` | Henter brukerens workspaces for `/select-workspace`. |

---

## 19. ADR-behov

| ADR-utkast | Tema | Grunn |
| --- | --- | --- |
| ADR-NEXT-AUTH-01 | Invitasjons-tokens er credentials | Sikkerhet: aldri i AI-kontekst, sensurert i logs |
| ADR-NEXT-AUTH-02 | Portal-subdomene (`app.smartout.ai`) som kanonisk auth-flate | Formaliserer subdomene-delingen |
| ADR-NEXT-AUTH-03 | Magisk lenke som default auth-metode | Passord som fallback — redusert passord-risiko |
| ADR-NEXT-AUTH-04 | Invitasjon har unik constraint på `(workspace_id, email, pending)` | Unngår parallelle gyldige invitasjoner |
| ADR-NEXT-AUTH-05 | `AuthLayout` som delt komponent på tvers av portal-sider | Reduserer duplisert kode og brand-drift |
| ADR-NEXT-AUTH-06 | Invitasjons-expiry-cron som scheduled edge function | Formaliserer automatisk status-transisjon |

---

## 20. Åpne spørsmål

1. **Workspace-invitasjon (admin→admin) som egen flyt?** Nå går det gjennom samme `invitation`-tabellen med `role: "admin"`. Er det tilstrekkelig, eller trenger vi egen `workspace_invitation` med fler felt (f.eks. seat-lisens-referanse)? Forslag: **samme tabell** for P1. Seat-billing legges på `profile.created_at` trigger.
2. **Magic link som enest-metode?** Passord er en risiko og brukeropplevelse-friksjon. Kan vi fjerne passord helt i P2 for nye signups, og la eksisterende beholde det? Forslag: **P2 eksperiment.** Start med å måle adoptions-ratio.
3. **QR-kode på-site-onboarding?** Kan admin stille ut en statisk QR i lunsjrommet som leder til en åpen-registrering-form som krever manager-godkjenning? Forslag: **P3** — ny `open_invitation` (workspace + rolle, ingen identifier), scanner oppretter invitation på stedet.
4. **Magic link mobil-deep-link?** Når bruker klikker magic link i iOS-e-post, skal den åpne Smartout-appen eller web? Forslag: **Universal link** — åpner app hvis installert, ellers web; begge løser samme session.
5. **SSO utover Google?** Apple, Microsoft, BankID? Forslag: **P2** for Apple (iOS-krav), **P3** for Microsoft (B2B). BankID er overkill for vår use case.
6. **Reinvitation-policy ved `cancelled`?** Hvis admin kansellerer og så re-inviterer, skal tidligere accept-historikk være synlig? Forslag: **Ja** — show timeline i admin-UI, men kansellering fjerner aktiv tilgang umiddelbart.
7. **CSV-import med feil: delvis-commit eller alt-eller-ingenting?** Forslag: **delvis-commit** med eksplisitt feil-rapport. Brukeren har valgt "Importer 45 gyldige" med full intensjon.

---

## 21. Implementeringsrekkefølge

**P0 — Før denne spec'en er akseptert:**
1. Nordic Split-audit på `reset-password`, `welcome`, onboarding-wizard-seksjoner.
2. Sikre at `AuthLayout` brukes konsistent.
3. Idempotens-test på `accept-invitation`.

**P1 — Spec-delivery:**
4. `InvitationContextHeader` implementert og brukt i web + mobil invite-accept.
5. `InvitationStatusList` i `/dashboard/people`.
6. Status-lifecycle (opened-tracking, expiry-cron).
7. Channel-dispatch-feedback (per-kanal status i modal).
8. Nye telemetri-events registrert og emitt.
9. Token-censurering i activity_trail.
10. `AuthLayout` ekstrahert og delt.

**P2 — Etter stabilisering:**
11. QR-kanal-implementering.
12. Magic link som default (eksperiment).
13. Bulk resend og bulk cancel.
14. Per-workspace konfigurerbar expiry.
15. Apple SSO.

**P3 — Fremtidig:**
16. Open invitation / on-site QR-onboarding.
17. Microsoft SSO for B2B.
18. Sesjons-policy (tvunget re-auth etter N dager).

---

## 22. Referanser

- **Middleware:** `apps/web/src/middleware.ts`
- **Login:** `apps/web/src/app/login/page.tsx`
- **Signup:** `apps/web/src/app/signup/page.tsx`
- **Join-wizard:** `apps/web/src/app/join/page.tsx` + `apps/web/src/app/onboarding/`
- **Invite-accept:** `apps/web/src/app/invite/[token]/page.tsx`
- **Invite-creation:** `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`
- **Edge functions:** `supabase/functions/create-invitation/`, `accept-invitation/`, `send-login-code/`
- **Migration:** `supabase/migrations/00011_employee_invitations.sql`
- **Mobil:** `apps/mobile/app/(auth)/welcome.tsx`, `apps/mobile/app/(auth)/invite/[token].tsx`
- **Design-tokens:** `packages/design-tokens/src/tokens.ts`, `tokens.css`
- **Styleguide:** `docs/design/ren-og-varm-styleguide.html`
- **ADR-0021:** DashboardShell pattern
- **ADR-0115:** RSC migration pattern
- **ADR-0133:** Mobile Surface Boundary
- **ADR-0134:** Mobile Telemetry Contract

---

## Changelog

| Dato | Versjon | Endring | Forfatter |
| --- | --- | --- | --- |
| 2026-04-19 | 1.0 | Initial draft — helhetlig designspec for alle auth/invitation-flater | Pontus + Claude |
