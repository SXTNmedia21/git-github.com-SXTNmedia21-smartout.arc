---
title: "TypeScript & Runtime"
module: 1
prerequisites: []
covers: [types, zod, generics, unknown-vs-any, runtime-vs-compiletime]
smartout_files:
  - apps/web/src/app/join/_lib/validation.ts
  - apps/web/src/app/api/engine-dispatch/route.ts
  - packages/ai/src/schemas/onboarding.ts
  - packages/ai/src/session-context.ts
updated: 2026-03-21
---

# TypeScript & Runtime

> TypeScript er merkesystemet du leser for å forstå hva koden gjør — og sikkerhetssnettet som fanger feil før de treffer produksjon.

## Konsepter

### Types er kontrakter, ikke kode

TypeScript legger merkelapper på data. En variabel markert `string` kan aldri bli et tall — kompilatoren stopper deg. Det viktige: **types forsvinner helt når koden kjører.** De kompileres bort. Ingen bruker laster ned en eneste type. De eksisterer bare for å fange feil under utvikling.

Tenk på det som merking av GN-bakker i et industrikjøkken. En bakke merket "1/1 GN — Allergen: Gluten" endrer ikke maten inni. Men den hindrer noen fra å sette den i feil seksjon, servere den til feil gjest, eller blande den med noe inkompatibelt. Merkingen er borte når gjesten får tallerkenen — men den forhindret feil underveis.

Når du leser agent-output, se etter disse mønstrene:

**Interface og type** er begge blåkopier for dataformer. `type User = { name: string; email: string }` sier: "et User-objekt MÅ ha name (tekst) og email (tekst)." Prøver en agent å tildele et tall til name, stopper kompilatoren umiddelbart. Smartout bruker `type` som standard. Praktisk forskjell fra `interface` er minimal — men `type` er mer fleksibel (unions, intersections, mapped types).

**Union types** (`string | number`) betyr ELLER — verdien kan være én av flere typer. **Intersection types** (`User & WithTimestamps`) betyr OG — verdien må oppfylle alle typene. Union er et menyvalg. Intersection er en kombo.

### Generics: "fungerer med hvilken som helst type X"

Generics er justerbare beholdere. `useState<string>("")` betyr: "denne state-variabelen holder en string." `createClient<Database>()` betyr: "denne Supabase-klienten kjenner strukturen til min database." Du skriver ikke generics — men du leser dem konstant.

Mønsteret er alltid det samme: `NoenFunksjon<DetteErTypenDenJobberMed>`. Vinkelparentesene sier "spesifiser hvilken type." Uten dem gjetter TypeScript — og gjetter noen ganger feil.

### unknown vs any: den viktigste forskjellen

`any` slår av all typesjekking. Det er en blindfold — kompilatoren slutter å passe på. `unknown` er det sikre alternativet: verdien kan være hva som helst, men du MÅ sjekke hva den er før du bruker den. `any` er "stol på meg." `unknown` er "vis meg legitimasjonen."

Når du ser `any` i agent-kode: det er et rødt flagg. Noen ganger nødvendig (se AnySupabaseClient nedenfor), men det skal alltid være dokumentert og begrenset.

### Zod: broen mellom kompilering og kjøretid

Her er problemet TypeScript ikke løser alene: types forsvinner når koden kjører. Når en bruker sender inn et skjema, vet TypeScript ingenting om dataen er gyldig. Zod løser dette ved å validere data i sanntid OG generere TypeScript-types fra skjemaet.

Nøkkelmønsteret: `type Step1Data = z.infer<typeof step1Schema>`. Definer validering én gang med Zod, og TypeScript-typen trekkes ut automatisk. Ingen duplisering, ingen drift mellom valideringsregler og typdefinisjoner.

Zod-metoder du vil se i Smartout:

- `.safeParse()` — validerer uten å kaste feil, returnerer `{ success, data, error }`
- `.transform()` — konverterer data under validering (f.eks. legge til `https://`)
- `.pipe()` — kjeder transformasjoner (transformér først, valider resultatet)
- `.refine()` — custom validering (f.eks. norsk organisasjonsnummer)
- `.describe()` — gir AI-modeller kontekst for strukturert output

### Kompilering vs kjøretid: to ulike verdener

Kompilering er når TypeScript sjekkes og konverteres til JavaScript — før noen bruker ser noe. Kjøretid er når koden faktisk kjører i en browser eller på en server. TypeScript beskytter deg under kompilering. Zod beskytter deg under kjøretid. Du trenger begge.

En type-feil under kompilering er gratis — den stopper deg før deploy. En type-feil under kjøretid er en bug i produksjon. Derfor: **valider alltid data som krysser en grense** — fra bruker, fra API, fra database, fra AI-output.

## I Smartout

**Zod i API-lag:** `apps/web/src/app/api/engine-dispatch/route.ts` bruker `DispatchSchema` med `safeParse()` for å validere innkommende workflow-events. Mønsteret: parse → sjekk success → bruk typed data eller returner 400.

**Zod i onboarding:** `apps/web/src/app/join/_lib/validation.ts` har 6 steg-skjemaer. `step1Schema` viser `.transform()` + `.pipe()` for URL-normalisering (legger til `https://` hvis mangler) og `.refine()` for norsk orgnummer-validering. `z.infer<typeof step1Schema>` genererer `Step1Data`-typen som brukes i React-komponentene.

**Zod for AI-output:** `packages/ai/src/schemas/onboarding.ts` definerer `OnboardingIntelligenceSchema` med `.describe()` på hvert felt. Brukes med `generateObject()` for garantert strukturert output fra Claude. Har 1:1 paritet med Python Pydantic-modell i scrapling-tjenesten.

**AnySupabaseClient-workaround:** `packages/ai/src/session-context.ts` bruker `SupabaseClient<any, any, any>` fordi `@supabase/ssr` har 3 generics og `@supabase/supabase-js` har 4 — umulig å uttrykke en type som dekker begge. Alltid markert med `eslint-disable` + kommentar. Dette er det eneste stedet `any` er akseptert uten diskusjon.

**SessionContext:** En av få klasser i repoen (114 linjer). Wrapper for Supabase-operasjoner i AI-agentflyt. Viser `private`, `public readonly`, og optional properties (`?`).

**Type-kvalitet:** 38 `as any` (nesten alle i mobile sync), 12 eksplisitte `: any` (dokumenterte workarounds), 2 `@ts-ignore`. 38 `as unknown as Json` i 21 filer — nødvendig bridge for JSONB-kolonner. Ingen vill-any.

## Fallgropar

**Record<string, string> under strict mode.** Learning fra contract-enhancements: `Record<string, string>` indeksering returnerer `string | undefined` under strict TypeScript. En `if`-sjekk i seg selv narrower ikke typen for assignment. Fix: trekk ut til en lokal variabel først. Agenter glemmer dette konsekvent — de skriver `if (obj[key])` og bruker `obj[key]` på neste linje, som fortsatt er `string | undefined`.

**Season Type Enum Mismatch (Learning-0016).** Frontend brukte `Permanent`/`Temporal`, database forventet `default`/`calendar`. TypeScript fanger IKKE enum-mismatch mot databasen — det er en kjøretidsfeil. Løsning: alltid sjekk `database.types.ts` for enum-verdier. Frontend-labels og DB-verdier er ofte forskjellige. Zod-validering eller eksplisitt mapping mot `database.types.ts` er den eneste sikre metoden.

**Workspace dependency for dynamic imports (Learning-0004).** Next.js web-appen trenger eksplisitt `@smartout/utils` workspace-dependency selv når pakken bare brukes via dynamisk `import()`. TypeScript trenger typene ved kompilering, selv om importen skjer ved kjøretid. Agenter foreslår dynamic import som "enkel løsning" uten å legge til workspace-dependency.

---

## Referanse

### Type-indikatorer å se etter i code review

| Mønster                                 | Vurdering         | Handling                                                  |
| --------------------------------------- | ----------------- | --------------------------------------------------------- |
| `any` uten kommentar                    | Rødt flagg        | Krev `unknown` eller spesifikk type                       |
| `any` med `eslint-disable` + forklaring | OK hvis begrunnet | Verifiser at begrunnelsen holder                          |
| `as SomeType`                           | Gult flagg        | Spør: hvorfor kan ikke TypeScript inferere dette?         |
| `as unknown as Json`                    | OK i Smartout     | Nødvendig for Supabase JSONB-kolonner                     |
| `@ts-ignore` / `@ts-expect-error`       | Rødt flagg        | Skal nesten aldri brukes. Fiks underliggende type-problem |
| `z.infer<typeof Schema>`                | Best practice     | Type generert fra Zod — ingen duplisering                 |

### Vanlige TypeScript-feil og hva du sier til agenten

| Feil                                                                       | Betyr                             | Instruks til agent                                        |
| -------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------- |
| "Type 'X' is not assignable to type 'Y'"                                   | Feil type på feil sted            | "Type mismatch på denne linjen. Fiks dataflyten."         |
| "Property 'X' does not exist on type 'Y'"                                  | Prøver å lese noe som ikke finnes | "Legg til propertyen i typen, eller bruk riktig objekt."  |
| "Object is possibly null"                                                  | Verdien kan mangle                | "Legg til null-sjekk eller optional chaining (`?.`)."     |
| "Argument of type 'string' is not assignable to parameter of type 'never'" | Ofte: tom array uten type         | "Gi arrayen en eksplisitt type: `useState<string[]>([])`" |

### Zod-metoder oppsummert

| Metode              | Hva den gjør                                     | Smartout-eksempel                        |
| ------------------- | ------------------------------------------------ | ---------------------------------------- |
| `.safeParse(data)`  | Validerer, returnerer `{ success, data, error }` | engine-dispatch Route Handler            |
| `.parse(data)`      | Validerer, kaster feil ved ugyldig               | Sjeldnere brukt — foretrekk safeParse    |
| `.transform(fn)`    | Konverterer data under validering                | URL-normalisering i join-wizard          |
| `.pipe(schema)`     | Kjeder: transformér → valider resultat           | orgNumber: strip spaces → valider format |
| `.refine(fn, msg)`  | Custom validering                                | Norsk organisasjonsnummer                |
| `.describe(text)`   | Metadata for AI structured output                | OnboardingIntelligenceSchema             |
| `z.infer<typeof S>` | Genererer TS-type fra skjema                     | `Step1Data`, alle form-steg              |

### Kompilering vs kjøretid: når bruker du hva

| Grensekrysning                         | Beskyttelse   | Verktøy                           |
| -------------------------------------- | ------------- | --------------------------------- |
| Funksjon → funksjon (intern kode)      | Kompilering   | TypeScript types                  |
| Bruker → server (form submit)          | Kjøretid      | Zod schema + safeParse            |
| Ekstern API → server (webhook)         | Kjøretid      | Zod schema + safeParse            |
| Database → server (query result)       | Kompilering\* | database.types.ts (auto-generert) |
| AI-modell → server (structured output) | Kjøretid      | Zod schema + generateObject()     |

\*database.types.ts gir kompileringstid-beskyttelse, men enum-verdier kan fortsatt mismatch hvis typen ikke regenereres etter migrasjon.
