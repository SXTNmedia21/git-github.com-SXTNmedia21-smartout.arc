---
title: "Design — B2B-kontrakt under onboarding"
status: approved
updated: 2026-03-30
created: 2026-03-30
module: contracts
tags: [contracts, onboarding, docuseal, b2b, kundedokument]
---

# Design — B2B-kontrakt under onboarding

## Syfte

Smartouts B2B-avtal (SaaS-licens) ska skapas och skickas automatiskt till kunden vid workspace-finalisering. Onboardingen inkluderar ett levande kundedokument som fyller sig självt med data från scrape + Lises samtal. Kunden signerar via e-post (DocuSeal) inom 14 dagar. Dashboarden visar påminnelse-banner tills signerat.

## Wow-effekten

Scrapen hittar allt den kan om bedriften. Lise verifierar — ställer inte frågor. Kundedokumentet fylls i live framför kundens ögon. Fälten poppar in automatiskt. Kunden kan redigera allt direkt.

## Kundedokument — tre datanivåer

E-post och förnamn samlas in FÖRE Lise startar. Resten samlas av scrape + Lise.

### MÅ HA (blockerar kontraktet)

| Fält                 | Källa                   | Varför                  |
| -------------------- | ----------------------- | ----------------------- |
| E-post               | Auth/input (pre-Lise)   | Signeringslänk, kontakt |
| Förnamn + Efternamn  | Input (pre-Lise) / Lise | Avtalsparter            |
| Företagsnamn         | Scrape/Lise             | Avtalsparter            |
| Org.nummer           | Scrape/Brreg            | Juridiskt krav          |
| Kontaktperson (namn) | Input/Lise              | Avtalepart              |

### SKA HA (bättre kontrakt, inte blockerande)

| Fält             | Källa        | Varför                      |
| ---------------- | ------------ | --------------------------- |
| Adress           | Scrape/Brreg | Avtalepart-identifikation   |
| Postnr + Ort     | Scrape/Brreg | Avtalepart-identifikation   |
| Telefonnummer    | Input/Lise   | SMS-verifiering, kontakt    |
| Bransch/NACE-kod | Scrape/Brreg | Branschklausuler            |
| Avdelingar       | Lise         | Leveransomfång i kontraktet |

### VILL HA (berikar, samlas löpande)

| Fält            | Källa        | Varför                       |
| --------------- | ------------ | ---------------------------- |
| Hemsida         | Input/Scrape | Intelligensdata              |
| Antal anställda | Lise/Scrape  | Prissättning, dimensionering |
| Säsonginfo      | Lise         | Kontraktsperiod              |
| Specifika behov | Lise         | Anpassning                   |

## Flöde

```
1. Användaren anger e-post + förnamn (pre-Lise input)
2. Auth skapas / Lise startar
3. Scrape körs i bakgrunden (Brreg, hemsida, Google Places)
4. Kundedokumentet (fullskärms-vy) fylls i live:
   - Scrape-data poppar in automatiskt i inputboxar
   - Lise verifierar: "Jeg ser at dere heter X og holder til på Y?"
   - Lise fyller i via agent-verktyg → fälten uppdateras i realtid
   - Kunden kan klicka och redigera alla fält direkt
5. Completeness-indikator visar MÅ HA / SKA HA / VILL HA-status
6. Kunden granskar — gör sista justeringar (namn, detaljer)
7. Kunden klickar "Bekreft kontraktet"
   → DIREKT: API route → contract-service → DocuSeal
     a. Skapa contract-rad med resolved placeholders
     b. POST /contracts/:id/send → DocuSeal → e-post
     c. 📱 Mailet plingar i fickan MEDAN Lise fortfarande pratar
8. Onboardingen scrollar vidare till done-sektionen
9. DoneSection → finalize()
   → finalize-workspace Edge Function
     a. Finalisera workspace (kontraktet finns redan)
     b. workspace.contract_status = 'pending_contract'
10. Kunden redirectas till dashboard
11. Dashboard visar påminnelse-banner ("Signer kontraktet ditt")
12. DocuSeal webhook → signed → workspace.contract_status = 'active'
```

**Nyckelinsikt:** Kontraktet skickas FÖRE workspace finaliseras. Workspace behöver inte existera för att skapa kontraktet — contract-raden kopplas till workspace_id i efterhand vid finalisering.

## Kundedokument-vy (CustomerDocumentView)

Fullskärms-vy som ersätter/kompletterar business-sektionen i onboardingen.

### Layout

```
┌─────────────────────────────────────────────────┐
│  KUNDEDOKUMENT              ██████░░ 75% klart  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ● MÅ HA                                       │
│  ┌───────────────────────────────────────────┐  │
│  │ Bedriftsnavn    [Spåtind Fjellstue     ]  │  │
│  │ Org.nummer      [929 620 291           ]  │  │
│  │ Kontaktperson   [Pontus Lindroth       ]  │  │
│  │ E-post          [pontus@smartout.ai    ]  │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ● SKA HA                                       │
│  ┌───────────────────────────────────────────┐  │
│  │ Adresse         [Spåtindvegen 102      ]  │  │
│  │ Postnr/sted     [2636 Øyer             ]  │  │
│  │ Telefon         [                      ]  │  │
│  │ Bransje         [Hotell og overnatting  ]  │  │
│  │ Avdelinger      [Resepsjon, Kjøkken    ]  │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ○ VILL HA                                      │
│  ┌───────────────────────────────────────────┐  │
│  │ Nettside        [www.spatind.no         ]  │  │
│  │ Antall ansatte  [~25                    ]  │  │
│  │ Sesong          [Vintersesong 2025/26   ]  │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [Lise pratar i hörnet]              [Bekreft →]│
└─────────────────────────────────────────────────┘
```

### Beteende

- **Inputboxar:** Alla fält är redigerbara textinputs
- **Auto-fill:** När scrape-data kommer in, animeras värdena in i fälten (typing-animation eller fade-in)
- **Lise-fill:** När Lise samlar data via agent-verktyg, uppdateras motsvarande fält i realtid
- **Completeness:** Progressbar visar andel MÅ HA som är ifyllt. MÅ HA-sektionen markeras grön/röd.
- **Fältstatus:** Varje fält visar källa (scrape-ikon, Lise-ikon, manuellt-ikon)
- **Validering:** MÅ HA-fält måste vara ifyllda för att "Bekreft" ska aktiveras

## Beslut

| Beslut         | Val                                               | Alternativ                                      | Motivering                                           |
| -------------- | ------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Timing         | Direkt vid bekräftelse i onboarding               | Vid finalisering, inline-signering              | Mailet plingar medan Lise pratar — wow-effekt        |
| Trigger        | API route från ContractSection → contract-service | Edge Function, cron                             | Snabbast möjliga leverans, omedelbar feedback        |
| Mall           | Basmal + branschklausuler via NACE-kod            | Separata mallar per bransch, enkel standardmall | Skalbar utan mallexplosion, NACE-koder redan finns   |
| Mottagare      | Onboarding-användarens auth-e-post                | Företagets kontakt-e-post                       | Personen som registrerar sig = ansvarig att signera  |
| Post-signering | Mjuk blockering (banner)                          | Hård blockering, ingen blockering               | Kunden kan börja använda systemet direkt men påminns |
| Datainsamling  | Scrape + Lise verifierar                          | Formulär, rent scrape                           | Wow-effekt: "vi vet redan allt om er"                |
| Dokument-vy    | Fullskärm med redigerbara inputs                  | Sidopanel, sektion                              | Stort och imponerande, kunden ser allt               |

## Databasändringar

### clause_library — ny kolumn

```sql
ALTER TABLE clause_library ADD COLUMN industry_codes text[] DEFAULT '{}';
```

- Tomma = universella klausuler (gäller alla branscher)
- Exempel: HACCP → `{'56.10', '56.21', '56.30'}`, Alkohol → `{'56.30'}`
- Query: `WHERE industry_codes = '{}' OR industry_codes && ARRAY['56.10']`

### contract_template — ny kolumn (framtidssäkring)

```sql
ALTER TABLE contract_template ADD COLUMN industry_group text DEFAULT NULL;
```

Ej aktiv än — möjliggör branschspecifika basmallar i framtiden.

## Komponenter

### 1. CustomerDocumentView (NY)

Fullskärms React-komponent i onboarding-flödet:

- Renderar alla tre nivåer (MÅ HA / SKA HA / VILL HA) som sektioner
- Inputboxar för varje fält, bundna till onboarding state
- Progressbar baserad på ifyllda MÅ HA-fält
- Animerad auto-fill (fälten fylls i live)
- Lise-avatar/widget i hörnet
- "Bekreft"-knapp aktiveras när alla MÅ HA-fält är ifyllda

### 2. Agent-verktyg (updateCustomerDocument)

Lise-tool som uppdaterar specifika fält i kundedokumentet:

- Mappar till befintliga `updateBusiness` / `updateSeason` actions
- Nytt tool: `updateCustomerField(field, value, source)`
- Ger Lise möjlighet att fylla i fält direkt under samtalet

### 3. finalize-workspace Edge Function

Utöka med:

- Hämta auth-användarens e-post
- Välj systemkontraktsmall (SaaS Lisens: `c0000002-0000-0000-0000-000000000002`)
- Hämta universella + branschspecifika klausuler från `clause_library`
- Skapa `contract`-rad via Supabase insert (resolved placeholders)
- HTTP POST till contract-service `/contracts/:id/send`
- Uppdatera `workspace.contract_status = 'pending_contract'`

### 4. ContractSection.tsx (uppgradering)

Uppgradera från statisk lista till dynamisk förhandsvisning av kontraktet:

- Visar klausuler baserat på bransch
- Visar "Kontraktet sendes til din e-post etter registreringen"
- Behåll "Bekreft" / "Tilpass senere" CTAs

### 5. DocuSeal webhook-handler

Lägg till: när `contract.status` → `signed`, uppdatera `workspace.contract_status` → `active`.
Befintlig handler: `apps/web/src/app/api/webhooks/docuseal/route.ts`

### 6. Dashboard-banner (ContractPendingBanner)

Ny komponent i DashboardShell:

- Visas när `workspace.contract_status === 'pending_contract'`
- Visar: "Du har et usignert kontrakt. Sjekk e-posten din eller signer nå."
- CTA: Öppna signeringslänk direkt
- Försvinner när kontraktet signeras

### 7. Branschklausul-seed

Uppdatera befintliga 24 klausuler med `industry_codes`-mappning.
Gruppering:

- 55.x (Hotell) → rumsstädning, nattevakt, brannsikkerhet
- 56.x (Servering) → HACCP, alkoholservering, matallergier
- 47.x (Dagligvare) → varemottak, kassarutiner
- Universella → GDPR, arbeidsmiljø, HMS

## Befintlig infrastruktur som återanvänds

| Komponent              | Fil                                               | Status                     |
| ---------------------- | ------------------------------------------------- | -------------------------- |
| contract-service       | `services/contract-service/`                      | Fullt fungerande           |
| DocuSeal-integration   | `contract-service/src/lib/docuseal.ts`            | Klar                       |
| Signing pages          | `apps/web/src/app/sign/[token]/`                  | Klara                      |
| DocuSeal webhook       | `apps/web/src/app/api/webhooks/docuseal/route.ts` | Klar                       |
| Klausulbibliotek       | `clause_library` tabell (24 klausuler)            | Behöver industry_codes     |
| Contract lifecycle     | `supabase/functions/contract-lifecycle/`          | Klar (expiration watchdog) |
| Placeholder resolution | `contract-service/src/lib/placeholders.ts`        | Klar                       |
| Intelligence pipeline  | `gather-workspace-intelligence` Edge Function     | Klar                       |
| Onboarding state       | `useOnboardingState.ts`                           | Klar, behöver utökas       |

## Icke-mål (YAGNI)

- Ingen inline-signering under onboardingen (signering sker via e-post)
- Ingen AI-generering av kontraktsinnehåll
- Ingen anställningskontrakt-integration (framtida feature)
- Ingen kortregistrering i denna iteration
