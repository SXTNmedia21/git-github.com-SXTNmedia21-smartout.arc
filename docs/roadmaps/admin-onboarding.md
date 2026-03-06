---
title: "Admin Onboarding — Steg for steg"
status: draft
updated: 2026-03-05
created: 2026-03-05
module: onboarding
tags: [roadmap, onboarding, admin, ai-agent, scraping]
---

# Admin Onboarding — Steg for steg

> Hva skjer fra det øyeblikket en ny kunde lander på SmartOut til de sitter i dashboardet med en ferdig konfigurert arbeidsplass?

---

## Oversikt

Onboarding er en **fullskjerms scroll-opplevelse** med 8 seksjoner. Adminen velger mellom to moduser:

| Modus                   | Tid     | Hva skjer                                                    |
| ----------------------- | ------- | ------------------------------------------------------------ |
| **Assistert (Botsson)** | ~5 min  | AI-agenten snakker med deg, fyller ut alt, du bare bekrefter |
| **Manuelt**             | ~10 min | Du fyller ut skjemaer selv, ingen AI                         |

Begge moduser bruker samme datapipeline under panseret. Botsson er den tiltenkte hovedveien.

---

## Steg 1: Ankomst og autentisering

**URL:** `/onboarding`

**Hva adminen ser:**

- Fullskjerm hero-seksjon med SmartOut-logo
- To alternativer: Google SSO eller e-post/passord
- Etter innlogging: to knapper — "Assistert (~5 min)" eller "Manuelt (~10 min)"

**Hva systemet gjør:**

- Oppretter `auth.user` → trigger `handle_new_user()` oppretter `user_identity`
- Sjekker om brukeren allerede har en workspace i `onboarding`-status (session resume)

**Botsson-modus:** Klikk "Assistert" → WebRTC-tilkobling til Ultravox → Botsson starter med: _"Hei! Jeg er Botsson — kollegaen din i SmartOut. Hva heter du?"_

---

## Steg 2: Bedriftsinformasjon + Scraping

**Hva adminen gjør:**

- Sier bedriftsnavnet og byen (Botsson-modus), eller skriver det inn (manuelt)

**Hva systemet gjør — den store datahøsten:**

```
Adminen sier: "Lysverket i Bergen"
         │
         ▼
┌─────────────────────────────────────────┐
│  gather-workspace-intelligence          │
│  (Edge Function — orkestrator)          │
│                                         │
│  Fase A (parallelt):                    │
│  ├─ Brønnøysundregistrene (Brreg)      │
│  │  → Navn, org.nr, adresse,           │
│  │    daglig leder, NACE-kode          │
│  │                                      │
│  ├─ Scrapling-tjenesten (Docker)        │
│  │  → Skraper bedriftens nettside       │
│  │  → Henter også "Om oss"-siden        │
│  │  → Finner: e-post, telefon,          │
│  │    lokasjoner, avdelinger,           │
│  │    bilder, sosiale medier,           │
│  │    meny-lenker, bookinglenker        │
│  │                                      │
│  Fase B:                                │
│  └─ Oppretter workspace i               │
│     "onboarding"-status                 │
│                                         │
│  Fase C (parallelt):                    │
│  ├─ Google Places Intelligence          │
│  │  → Rating, anmeldelser, koordinater, │
│  │    åpningstider, prisnivå,          │
│  │    Google Maps-lenke, bilder         │
│  │                                      │
│  └─ Web Search Intelligence             │
│     → Artikler, omtaler, kontekst       │
│                                         │
│  Fase D:                                │
│  └─ Merge alt → workspace.              │
│     intelligence_data                   │
└─────────────────────────────────────────┘
```

**Dataprioritering ved merge:**

- Juridisk navn, org.nr, adresse: Brreg vinner
- Telefon: Scraping vinner
- Nettside: Google Places vinner
- Åpningstider: Google Places vinner (strukturert)
- Rating, koordinater: Kun Google Places
- Logo/bilder: Kun scraping

**Hva adminen ser:**

- BigBoard med 6 paneler som animeres inn felt for felt
- Bedrift, Online-profil, Sesong, Avdelinger, Lokasjoner, Prosedyrer
- Skeleton-loaders mens data hentes, deretter staggered reveal

**Botsson-modus:** Botsson leser opp resultatene: _"Lysverket — en restaurant i Bergen sentrum, org.nr 912 345 678. Daglig leder er Ola Nordmann. Stemmer det?"_ → Oppdaterer felt → Legger til KeyFacts i panelet øverst til venstre.

---

## Steg 3: Sesong

**Hva adminen gjør:**

- Bekrefter eller justerer sesongnavnet, start- og sluttdato
- Valgfritt: legger inn omsetningsmal og margin

**Hva systemet gjør:**

- `suggestSeason()` foreslår basert på måned (Vinter/Vår/Sommer/Høst)
- Lagrer til onboarding-state

**Botsson-modus:** _"Vi er i mars, så jeg foreslår å starte med 'Vår 2026', fra 1. mars til 31. mai. Passer det, eller kjører dere en annen inndeling?"_

---

## Steg 4: Avdelinger

**Hva adminen gjør:**

- Ser foreslåtte avdelinger basert på NACE-kode (f.eks. restaurant → Kjøkken, Service/Floor, Bar)
- Toggler av/på, legger til egne

**Hva systemet gjør:**

- `industry-defaults.ts` mapper NACE-kode til standard avdelinger + posisjoner
- Scrapling-data supplerer (fant "bar" på nettsiden → foreslår Bar-avdeling)

**Botsson-modus:** _"Basert på det jeg ser, har dere kjøkken, sal og bar. Har dere noen flere avdelinger — kanskje en uteservering eller en egen cocktailbar?"_ → `addDepartments(["Uteservering"])`

---

## Steg 5: Lokasjoner

**Hva adminen gjør:**

- Legger til fysiske lokasjoner (hovedlokale, uteservering, satellitt)
- Legger til soner innenfor hver lokasjon

**Hva systemet gjør:**

- Scrapling har allerede foreslått lokasjoner basert på nøkkelord (terasse → "Uteservering / Terrace")
- Lagrer med type: main/outdoor/satellite/other

**Botsson-modus:** _"Jeg foreslår hovedlokalet og uteserveringen. Soner i hovedlokalet — har dere for eksempel en bar-sone, en spisesone og en privat seksjon?"_ → `addLocations(...)` → `addZones(...)`

---

## Steg 6: Rutiner og prosedyrer

**Hva adminen gjør:**

- Ser forhåndsvalgte prosedyrer basert på bransje
- Checkbox-liste: åpningsrutine, stengerutine, allergisjekk, temperaturlogg, kassaoppgjør...
- Kan legge til egne

**Hva systemet gjør:**

- `industry-defaults.ts` gir bransjespesifikke prosedyrer per NACE-kode
- Teller og lagrer valgte prosedyrer

**Botsson-modus:** _"For en restaurant er dette standard: åpningsrutine, stengerutine, allergisjekk, temperaturlogg, og kassaoppgjør. Vil du ha alle fem, eller er det noe som ikke passer?"_ → `addProcedures([...])`

---

## Steg 7: Kontraktsmal

**Hva adminen ser:**

- Forhåndsvisning av kontraktsmal med bedriftsnavn, org.nr, adresse
- Beskrivelse: dekker Arbeidsmiljøloven, personalhandbok, GDPR, taushetserklæring
- To knapper: "Bekreft" eller "Tilpass senere"

**Hva systemet gjør:**

- Viser statisk preview (ingen faktisk kontraktgenerering ennå)
- Markerer seksjon som fullfort

**Botsson-modus:** _"Kontraktsmalen er klar. Den dekker arbeidsmiljøloven, GDPR og taushetserklæring. Du kan tilpasse den senere i innstillinger. Skal vi gå videre?"_

---

## Steg 8: Oppsummering og aktivering

**Hva adminen ser:**

- Full oppsummeringskort:
  - Bedrift: navn, bransje, by
  - Sesong: navn og datoer
  - Avdelinger: antall
  - Lokasjoner: antall + soner
  - Prosedyrer: antall
  - Kontraktsmal: "Klar"-merke
- Stor CTA: **"Gå til dashboardet"**

**Hva systemet gjør ved aktivering:**

```
finalize-workspace Edge Function:
├─ Verifiserer at brukeren eier workspace
├─ Kaller finalize_onboarding_workspace RPC:
│   ├─ Oppretter company-rad
│   ├─ Oppretter departments med positions
│   ├─ Oppretter locations med zones
│   ├─ Oppretter procedures
│   ├─ Oppretter season
│   ├─ Setter contract_status = 'active'
│   └─ Returnerer workspace slug
├─ Oppretter agent_profile (Mr. Botsson) for workspace
└─ Redirect → /dashboard
```

**Botsson-modus:** _"Alt ser bra ut. Lysverket i Bergen — 3 avdelinger, 2 lokasjoner, 5 prosedyrer, vår-sesong fra mars til mai. Er du klar til å aktivere?"_ → Venter på eksplisitt "ja" → `finalizeOnboarding()`

---

## Etter onboarding: Første møte med dashboardet

Adminen lander i dashboardet med:

| Ferdig       | Hva                                                    |
| ------------ | ------------------------------------------------------ |
| Workspace    | Aktivert, med slug (f.eks. `lysverket.smartout.ai`)    |
| Bedriftsdata | Navn, org.nr, adresse, kontaktinfo, bransje            |
| Avdelinger   | Med posisjoner (kokk, servitor, bartender...)          |
| Lokasjoner   | Med soner                                              |
| Prosedyrer   | Bransjespesifikke, klare for å knyttes til protokoller |
| Sesong       | Aktiv sesong med datoer                                |
| Kontraktsmal | Preview klar                                           |
| Mr. Botsson  | AI-agent tilgjengelig i dashboardet                    |

**Neste steg for adminen:**

1. Invitere ansatte (→ de får trainee mode)
2. Opprette protokoller fra prosedyrene
3. Sette opp skift/schedule
4. Konfigurere session hooks for daglig drift

---

## Teknisk arkitektur

```
Browser (Next.js)
├─ useOnboardingState (state management)
├─ useBotsson (Ultravox WebRTC)
│   └─ 13 client-side tools
├─ WizardContext (bro mellom Botsson + UI)
└─ 8 scroll-snap seksjoner

Edge Functions (Supabase)
├─ gather-workspace-intelligence (orkestrator)
├─ search-brreg
├─ identify-company
├─ scrape-website
├─ google-places-intelligence
├─ web-search-intelligence
├─ finalize-workspace
└─ activate-workspace (legacy)

Services (Docker)
├─ scrapling (Python/FastAPI, port 8000)
│   ├─ /extract (strukturert)
│   └─ /scrape-raw (rå)
└─ stage-engine (Hono, port 5010)
    └─ /adapters/ultravox/create-call
```
