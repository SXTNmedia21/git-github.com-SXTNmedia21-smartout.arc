---
title: Admin Onboarding Journey
status: draft
updated: 2026-03-05
created: 2026-03-05
module: onboarding
tags: [journey, admin, onboarding, botsson, scraping]
---

# Admin Onboarding Journey

## Package Identity

- Package ID: `JP-R001-ADMIN-ONBOARDING`
- Roadmap ID: `R-001`
- Journey ID: `J-001`
- Mission ID: `M-001`
- License ID: `L-001`

Related package docs:

- `docs/Roadmaps/Admin onboarding/Mission.md`
- `docs/Roadmaps/Admin onboarding/Lisence.md`
- `docs/engines/system-inteligence/09-gold-package-admin-onboarding.md`

## Oversikt

En ny admin registrerer seg, oppretter workspace og setter opp bedriften sin — guidet av Botsson (AI-assistent) som samtaler, scraper og fyller ut data automatisk.

**Mål:** Fra 0 → operativ workspace med avdelinger, lokasjoner, prosedyrer og kontraktmal på ~5 minutter.

---

## Steg-for-steg

### 1. Registrering

**Bruker:** Går til smartout.ai → klikker "Kom i gang" → signup-side
**System:** Oppretter auth-bruker + user_identity (trigger)
**Bruker ser:** Login/signup med e-post eller Google SSO

**Etter innlogging:**

- Ingen workspaces → select-workspace viser "Velkommen til Smartout!"
- Klikker "Opprett workspace" → navigerer til `/onboarding`

---

### 2. Hero — Velg modus

**Bruker ser:** "Velkommen til Smartout" med to valg:

- **Assistert** (~5 min) — Botsson styrer samtalen via stemme
- **Manuelt** (~10 min) — Fyller ut skjema selv

**Assistert modus:** Starter Ultravox voice-session med Botsson.
Botsson har tilgang til disse verktøyene:

- `searchCompany` — Søk i Brønnøysund (Brreg) etter bedriftsnavn + by
- `identifyCompany` — Hent full bedriftsinfo fra org.nr (Brreg + Google Places)
- `scrapeWebsite` — Skrape bedriftens nettside for kontaktinfo, lokaler, meny
- `advanceToNextSection` — Gå videre til neste steg når data er komplett

---

### 3. Business — Finn bedriften

**Botsson spør:** "Hva heter arbeidsplassen din, og hvilken by ligger den i?"

**Hva som skjer bak kulissene:**

1. Botsson kaller `searchCompany("Sjøbris", "Trondheim")`
2. Brreg returnerer kandidater med org.nr, bransje, adresse
3. Botsson presenterer toppresultatet: "Er dette Sjøbris AS i Trondheim, org.nr 912 345 678?"
4. Bruker bekrefter → Botsson kaller `identifyCompany("912345678")`
5. System henter:
   - **Brreg:** Juridisk navn, adresse, NACE-kode, ansatte
   - **Google Places:** Bilder, åpningstider, rating, koordinater
6. Hvis nettside funnet → `scrapeWebsite("https://sjobris.no")` henter:
   - E-post, telefon, menyer, lokaler (ute/inne), beskrivelse

**Resultat:** BigBoard viser all samlet data. Bruker bekrefter eller korrigerer.

**Manuelt modus:** Bruker skriver bedriftsnavn + by → "Finn bedriften" → samme pipeline.

---

### 4. Season — Sesongoppsett

**Botsson sier:** "Basert på bransjen din foreslår jeg en vår-sesong fra april til september."

**System:** `suggestSeason()` bruker NACE-kode for å foreslå fornuftige datoer.

**Bruker:** Bekrefter eller justerer navn, start/slutt, forventet omsetning.

---

### 5. Departments — Avdelinger

**System:** `getDepartmentsForIndustry(naceCode)` genererer bransjetilpassede avdelinger.

- Restaurant → Kjøkken, Bar, Servering, Renhold
- Hotell → Resepsjon, Housekeeping, F&B, Konferanse

**Botsson:** "Jeg har foreslått disse avdelingene basert på bransjen din. Stemmer det?"

**Bruker:** Toggler av/på, legger til egne.

---

### 6. Locations — Lokasjoner og soner

**System:** Hvis scraping fant lokaler (uteplass, selskapslokale) → forhåndsutfylt.

**Botsson:** "Jeg fant en uteplass og et hovedlokale på nettsiden deres. Har dere flere?"

**Bruker:** Legger til/fjerner lokasjoner og soner (bar, terrasse, VIP).

---

### 7. Procedures — Prosedyrer

**System:** `getProceduresForIndustry(naceCode)` foreslår standard prosedyrer.

- Åpningsrutine, Lukkerutine, Varemottak, HACCP-kontroll, Kassaoppgjør

**Botsson:** "Her er standard prosedyrer for restaurantdrift. Hvilke bruker dere?"

**Bruker:** Toggler av/på, legger til egne.

---

### 8. Contract — Kontraktmal

**System:** Genererer kontraktmal basert på bedriftsdata (bransje, avdelinger, land).

**Botsson:** "Kontraktmalen er klar. Den dekker arbeidsavtale, prøvetid og oppsigelse etter norsk lov."

**Bruker:** Ser forhåndsvisning, bekrefter.

---

### 9. Welcome — Ferdigstilling

**System:** Kaller `finalize-workspace` Edge Function som:

1. Oppretter workspace med all data (eller oppdaterer onboarding-workspace)
2. Oppretter avdelinger, lokasjoner, soner, prosedyrer, sesong
3. Setter contract_status = 'active'
4. Oppretter admin-profil med role=owner

**Bruker ser:** "Alt er klart! Velkommen til [Bedriftsnavn]."

**Navigerer til:** Dashboard (`/dashboard` eller `{slug}.smartout.ai/dashboard`)

---

## Datakjelder

| Kilde                         | Hva vi henter                                       | Når                             |
| ----------------------------- | --------------------------------------------------- | ------------------------------- |
| Brønnøysundregisteret (Brreg) | Org.nr, juridisk navn, adresse, NACE, ansatte       | searchCompany / identifyCompany |
| Google Places API             | Bilder, rating, åpningstider, koordinater, prisnivå | identifyCompany                 |
| Web scraping (Scrapling)      | E-post, telefon, meny, lokaler, beskrivelse         | scrapeWebsite                   |
| Brukerinput                   | Korreksjoner, tillegg, preferanser                  | Hele flyten                     |
| Bransjedefaults               | Avdelinger, prosedyrer, sesongforslag               | Etter identifisering            |

---

## AI-agentens rolle (Botsson)

Botsson er ikke bare en guide — han er en aktiv deltaker som:

1. **Samtaler** — Stiller spørsmål, bekrefter data, forklarer valg
2. **Søker** — Bruker Brreg for å finne bedriften
3. **Identifiserer** — Henter full profil fra org.nr + Google Places
4. **Scraper** — Henter data fra bedriftens nettside
5. **Foreslår** — Avdelinger, prosedyrer og sesong basert på bransje
6. **Husker** — Lagrer kontekst via `saveMemory()` for fremtidige samtaler
7. **Navigerer** — Flytter brukeren gjennom stegene via `advanceToNextSection()`

**Stemmeinteraksjon:** Ultravox-basert, norsk, ~5 min total varighet.
**Fallback:** Manuelt skjema for alt Botsson gjør.

---

## Feilhåndtering

| Scenario                    | Håndtering                                   |
| --------------------------- | -------------------------------------------- |
| Brreg finner ikke bedriften | Botsson ber om nettside eller org.nr direkte |
| Nettside utilgjengelig      | Hopp over scraping, bruk kun Brreg + Places  |
| Google Places ingen treff   | Fortsett uten bilder/rating                  |
| Bruker avbryter midtveis    | Onboarding-workspace lagres, kan gjenopptas  |
| Nettverksfeil               | Retry + feilmelding                          |
