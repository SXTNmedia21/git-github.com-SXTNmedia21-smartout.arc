---
title: "Team CSV Mapping Architecture — Steg 5 Wizard"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: wizard
tags: [team, csv, mapping, import, wizard]
---

# Team CSV Mapping Architecture — Steg 5 Wizard

## Bakgrunn

TeamSetupStep (steg 5 i workspace setup wizard) har i dag en CSV-import med hardkodet kolonnemapping. Den gjetter kolonnenavn (fornavn/first_name/firstname osv.) og kaster bort alt den ikke gjenkjenner. Brukeren har ingen kontroll over mappingen.

## Konsept: Bruker-drevet kolonnemapping

Etter CSV-opplasting får brukeren en mapping-visning der de kobler CSV-kolonner til profilfelt. Umappede kolonner lagres i et JSON-felt.

## Flyt

```
1. Bruker klikker "Last opp CSV"
   → CSV parses med papaparse (header: true)
   → System viser mapping-steg

2. Mapping-steg viser:
   ┌─────────────────────────────────────────────┐
   │  CSV-kolonne        →   Smartout-felt        │
   │  ─────────────────────────────────────────── │
   │  "Namn"             →   [Fornavn ▾]          │
   │  "Efternamn"        →   [Etternavn ▾]        │
   │  "Mail"             →   [E-post ▾]           │
   │  "Tlf"              →   [Telefon ▾]          │
   │  "Avd"              →   [Avdeling ▾]         │
   │  "Lönetyp"          →   [-- Hopp over -- ▾]  │
   │  "Anteckningar"     →   [-- Hopp over -- ▾]  │
   └─────────────────────────────────────────────┘

   Forhåndsvisning: 3 første rader med mappet data

3. System auto-gjetter mapping basert på kolonnenavn
   → Bruker kan overstyre alle valg
   → "Hopp over" = lagres i extra_data JSON

4. Bruker bekrefter → rader opprettes med mappede verdier
   → Umappede kolonner samles i extra_data per rad
```

## Tilgjengelige mapping-felt

| Felt             | Nøkkel           | Type   | Obligatorisk | Kilde               |
| ---------------- | ---------------- | ------ | ------------ | ------------------- |
| Fornavn          | `firstName`      | tekst  | ja           | profile             |
| Etternavn        | `lastName`       | tekst  | ja           | profile             |
| E-post           | `email`          | tekst  | ja           | invitation          |
| Telefon          | `phone`          | tekst  | nei          | profile             |
| Avdeling         | `departmentId`   | lookup | nei          | department          |
| Stilling         | `positionId`     | lookup | nei          | position            |
| Ansettelsesform  | `employmentForm` | lookup | nei          | employment policy   |
| Timelønn         | `hourlyRate`     | tall   | nei          | payroll policy      |
| Startdato        | `startDate`      | dato   | nei          | profile             |
| Stillingsprosent | `positionPct`    | tall   | nei          | profile             |
| Fødselsdato      | `birthDate`      | dato   | nei          | profile             |
| Personnummer     | `ssn`            | tekst  | nei          | profile (kryptert)  |
| Adresse          | `address`        | tekst  | nei          | profile             |
| Kontonummer      | `bankAccount`    | tekst  | nei          | profile (kryptert)  |
| -- Hopp over --  | `_skip`          | —      | —            | lagres i extra_data |

## Auto-gjetting av kolonnemapping

System forsøker å matche CSV-kolonnenavn til Smartout-felt basert på kjente synonymer:

```typescript
const COLUMN_SYNONYMS: Record<string, string[]> = {
  firstName: ["fornavn", "first_name", "firstname", "förnamn", "namn"],
  lastName: ["etternavn", "last_name", "lastname", "efternamn", "surname"],
  email: ["e-post", "epost", "email", "mail", "e-mail"],
  phone: ["telefon", "phone", "tlf", "mobil", "mobilnummer"],
  departmentId: ["avdeling", "department", "dept", "avd"],
  positionId: ["stilling", "position", "rolle", "role", "title"],
  employmentForm: ["ansettelsesform", "employment", "type", "anställningsform"],
  hourlyRate: ["timelønn", "lønn", "hourly_rate", "timlön", "lön"],
  startDate: ["startdato", "start_date", "startdatum", "tiltredelse"],
  positionPct: ["stillingsprosent", "stillingsandel", "prosent", "pct", "%"],
  birthDate: ["fødselsdato", "birth_date", "født", "dob", "födelsedatum"],
  ssn: ["personnummer", "fødselsnummer", "fnr", "personnr", "ssn"],
  address: ["adresse", "address", "bosted"],
  bankAccount: ["kontonummer", "konto", "bank", "bank_account"],
};
```

## Lookup-felt

Noen felt er ikke fritekst, men må matches mot eksisterende data:

| Felt            | Matcher mot             | Strategi                       |
| --------------- | ----------------------- | ------------------------------ |
| Avdeling        | `department.name`       | case-insensitiv match          |
| Stilling        | `position.name`         | case-insensitiv match          |
| Ansettelsesform | employment policy forms | match mot `type` eller `label` |

Verdier som ikke matcher vises som advarsel i forhåndsvisningen. Brukeren kan velge å opprette nye avdelinger/stillinger, eller hoppe over.

## Lagring av umappede data

Alle CSV-kolonner som er satt til "Hopp over" samles i `extra_data`:

```json
{
  "extra_data": {
    "Lönetyp": "Fastlön",
    "Anteckningar": "Jobbar bara helger",
    "Allergi": "Nötter"
  }
}
```

Dette lagres som del av InviteRow og sendes med til `create-invitation` Edge Function. Foreløpig lagres det i `invitation.metadata` (JSONB). Når vi bygger ut profilmodulen kan det konverteres.

## Datamodell (InviteRow — utvidet)

```typescript
type InviteRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  employmentForm: string;
  positionId: string;
  hourlyRate: number;
  // Nye felt:
  startDate: string; // ISO date
  positionPct: number; // 0-100
  birthDate: string; // ISO date
  ssn: string; // krypteres før lagring
  address: string;
  bankAccount: string; // krypteres før lagring
  extraData: Record<string, string>; // umappede kolonner
  // Status:
  status: "pending" | "sending" | "sent" | "error";
  validationErrors: string[];
};
```

## UX-komponenter

### CsvMappingDialog

Modal/drawer som vises etter CSV-opplasting:

1. **Kolonneliste** — venstre: CSV-kolonnenavn, høyre: dropdown med Smartout-felt
2. **Forhåndsvisning** — tabell med 3 første rader, mappede verdier
3. **Advarsler** — lookup-felt som ikke matcher (ukjent avdeling, stilling)
4. **Bekreft** — "Importer X rader" knapp

### Sikkerhet

- `ssn` og `bankAccount` vises aldri i klartekst etter import
- Disse feltene krypteres før lagring (Vault eller app-level kryptering)
- CSV-filen holdes kun i minne, aldri lagret

## Åpne spørsmål

1. Skal umappede data lagres i `invitation.metadata` eller et eget felt?
2. Skal brukeren kunne opprette nye avdelinger/stillinger direkte fra mapping-steget?
3. Maks antall rader per CSV-import?
