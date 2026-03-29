---
title: "Database Design"
module: 5
prerequisites: [01-typescript-runtime]
covers:
  [normalization, relations, foreign-keys, junction-tables, migrations, indexes, enums, naming]
smartout_files:
  - supabase/migrations/
  - packages/supabase/src/database.types.ts
  - supabase/migrations/20260418100400_remove_shift_approval_punch.sql
smartout_tables: 66
smartout_migrations: 146
smartout_enums: 47
updated: 2026-03-21
---

# Database Design

> Databasen er fundamentet alt annet hviler på. En feil her forplanter seg gjennom RLS, API-lag, og frontend — og er dyrere å fikse jo lenger den lever.

## Konsepter

### Tabeller er ikke regneark

Et regneark samler alt på ett sted. En database splitter data i tabeller med relasjoner mellom dem. Grunnen er enkel: duplikering dreper. Hvis company-navnet står i 15 tabeller og selskapet skifter navn, har du 15 steder å oppdatere — og garantert glemmer du ett.

**Normalisering** er prosessen med å eliminere duplisering ved å flytte data til egne tabeller og koble dem med relasjoner. Hovedregelen: hvis en verdi kan endre seg uavhengig av resten av raden, bør den være i en egen tabell.

I Smartout er `season_budget` et godt eksempel. Alternativet var å legge 7 budsjettkolonner rett på `season`-tabellen. Problemene med det:

- Season har sin egen livssyklus (draft → active → archived). Budget har en annen (draft → active → locked).
- Mange sesonger har ingen budsjettplan i det hele tatt — 7 tomme kolonner.
- `day_factor` og `hour_factor` refererer til budsjettdata, ikke sesongdata. FK-en skal peke til riktig eier.

Ved å lage en 1:1-relasjon (`season_id UNIQUE` på `season_budget`) får hver tabell ansvar for sitt domene. Tydeligere queries, enklere RLS-policies, og budsjett kan låses uavhengig av sesong.

### Relasjoner: tre typer, alle i Smartout

**One-to-many:** En company har mange workspaces. `workspace` har `company_id` (FK → company). Én rad i company peker til mange rader i workspace.

**Many-to-many via junction table:** En bruker kan være medlem av mange selskaper. Et selskap har mange brukere. `company_member` sitter i midten med `user_id` (FK → user_identity) og `company_id` (FK → company). Junction-tabellen har egne felter: `role`, `is_active`, `joined_at`. Den er ikke bare en kobling — den bærer informasjon om relasjonen.

**One-to-one:** `season` ↔ `season_budget`. Implementert med `UNIQUE` constraint på `season_id` i budget-tabellen. Brukes når data har ulike livssykluser eller når den ene siden er valgfri.

### Foreign keys: databasens sikkerhetsbelte

En foreign key (FK) sier: "denne verdien MÅ finnes i den andre tabellen." `company_member.company_id` peker til `company.company_id`. Prøver du å sette inn en company_member med en company_id som ikke finnes — database sier nei. Prøver du å slette en company som har members — database sier nei (eller cascader, avhengig av policy).

FK-er håndhever dataintegritet på databasenivå. Ingen bug i frontend, ingen feil i en agent, ingen race condition kan lage orphan-rader hvis FK-er er på plass.

### Migrasjoner: versjonskontroll for databasen

En migrasjon er en SQL-fil som endrer databasestrukturen. Hver har et tidsstempel-prefix og kjøres i rekkefølge. 146 migrasjoner betyr 146 kontrollerte steg fra tom database til nåværende tilstand.

Gylne regler: migrasjoner er append-only — du endrer aldri en eksisterende fil, du lager en ny. Destruktive operasjoner (DROP COLUMN, DROP TABLE) bruker alltid `IF EXISTS`. Test migrasjoner lokalt med `supabase db reset` før du pusher.

### Indekser: hastighet der du trenger det

Uten indeks scanner databasen hver rad for å finne resultatet. Med indeks går den rett til riktig sted — som et stikkordregister versus å lese hele boken.

Indekser er ikke gratis: de tar plass og bremser skrivinger. Legg til indekser der du filtrerer ofte — spesielt `workspace_id` (som er i nesten alle WHERE-clauses via RLS) og kolonnene i dine mest brukte queries.

**Partial indexes** er en kraftig optimalisering: `WHERE status != 'completed'` indekserer bare aktive rader. Indeksen er liten fordi ferdige rader (ofte 90%+) ikke er med.

### Enums: faste verdier, databasehåndhevet

En enum er en type som bare tillater forhåndsdefinerte verdier. `profile_status` kan bare være `trainee`, `active`, `inactive`, eller `offboarding`. Databasen nekter alt annet.

Enums lever i databasen og genereres til TypeScript via `database.types.ts`. Den filen er den eneste kilden til sannhet for enum-verdier i frontend.

## I Smartout

**Lagdelt arkitektur:** 66 tabeller organisert i lag — Identity (user_identity, company, company_member, workspace, profile), Structure (department, location, zone, asset, position, team, season), Governance (policy, protocol, procedure, control_list, routine, runbook, knowledge_test), Schedule (schedule_shift + 8 relaterte tabeller), Operations (department_session, session_hook, session_task, deviation), Engine (engine_missions, engine_stages, engine_sessions, engine_state + relaterte).

**Identity Layer har to nivåer:** Globale tabeller (user_identity, company, company_member) har ingen workspace_id — de lever på tvers av workspaces. Workspace-scoped tabeller (profile, alle andre) har workspace_id og filtreres via RLS.

**company_member som junction:** `company_member_id` (PK), `company_id` (FK → company), `user_id` (FK → user_identity), `role` (enum: owner | admin | member), `is_active`, `joined_at`, `title` (nullable). Kobler en bruker til et selskap med rolle og status. Én bruker kan være medlem i flere selskaper.

**season_budget som 1:1-eksempel:** `season_id` med UNIQUE constraint sikrer maks én budget per sesong. Egne statuser (draft | active | locked), eget PK (`season_budget_id`), egne tall (target_revenue, labor_percentage, avg_hourly_wage). `day_factor` og `hour_factor` FK-er hit, ikke til season.

**Naming conventions:** Alle tabeller snake*case singular (`schedule_shift`, ikke `shifts`). PK alltid `{table}_id`. Booleans alltid `is*`-prefix (`is_active`, `is_deleted`). Timestamps: `created_at`+`updated_at`på alle tabeller.`created_by` der opprettelsen har en aktør.

**47 enums** — fra domene-enums (`industry`: restaurant | hotel | cafe | bar | catering | other) til workflow-statuser (`department_session_status`: upcoming | active | pending_signoff | closed | missed) til lokalisering (`country`: NO | SE | DK | FI; `currency`: NOK | SEK | DKK | EUR).

## Fallgropar

**Season Type Enum Mismatch (Learning-0016).** Frontend brukte `Permanent`/`Temporal`, database forventet `default`/`calendar`. `activate_workspace_v3` RPC feilet med PostgreSQL enum constraint error. Ingen TypeScript-feil — kompilatoren ser bare at begge er strenger. **Tiltak:** Sjekk ALLTID `database.types.ts` etter `supabase gen types` som kilde for enum-verdier. Frontend-labels og DB-verdier er forskjellige ting.

**Destruktiv migrasjon — den ene gangen (migrasjon 20260418100400).** `remove_shift_approval_punch.sql` brukte `DROP COLUMN IF EXISTS` for å fjerne punch_in/punch_out. `IF EXISTS` var der som sikring. Uten den bryter migrasjonen hvis kolonnen allerede er borte (f.eks. ved re-run etter feil). **Regel:** Alle DROP-operasjoner bruker `IF EXISTS`. Alltid.

**Manglende indeks på workspace_id.** RLS-policies filtrerer på `workspace_id` i nesten alle tabeller. Uten indeks betyr dette full table scan på hver query for autoriserte brukere. Partial indexes (`WHERE status != 'completed'`) brukes aktivt for å holde indekser små.

---

## Referanse

### Tabelllag-oversikt

| Lag               | Tabeller                                                                                  | workspace_id | Formål                                  |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------ | --------------------------------------- |
| Identity (global) | user_identity, company, company_member                                                    | Nei          | Hvem er du, hva er selskapet            |
| Identity (scoped) | workspace, profile                                                                        | Ja (profile) | Fysisk arbeidssted, brukerens rolle der |
| Structure         | department, location, zone, asset, position, team, season, invitation                     | Ja           | Organisering av arbeidsplassen          |
| Governance        | policy, protocol, procedure, control_list, routine, runbook, knowledge_test, confirmation | Ja           | Regler, opplæring, compliance           |
| Schedule          | schedule_shift + 8 relaterte                                                              | Ja           | Vaktplaner og bemanning                 |
| Operations        | department_session, session_task, deviation, shift_approval                               | Ja           | Daglig drift                            |
| Engine            | engine_missions → engine_state_step (8 tabeller)                                          | Ja           | Workflow-motor                          |

### Relasjonstyper og implementering

| Type         | Implementering              | Smartout-eksempel                          |
| ------------ | --------------------------- | ------------------------------------------ |
| One-to-many  | FK på "mange"-siden         | company → workspace (workspace.company_id) |
| Many-to-many | Junction table med to FK-er | user_identity ↔ company via company_member |
| One-to-one   | FK med UNIQUE constraint    | season ↔ season_budget (season_id UNIQUE)  |

### Naming conventions

| Element     | Konvensjon                  | Eksempel            |
| ----------- | --------------------------- | ------------------- |
| Tabellnavn  | snake_case singular         | `schedule_shift`    |
| Primary key | `{table}_id`                | `company_member_id` |
| Foreign key | `{referenced_table}_id`     | `company_id`        |
| Boolean     | `is_`-prefix                | `is_active`         |
| Timestamps  | `created_at` + `updated_at` | Alle tabeller       |
| Aktør       | `created_by`                | Der relevant        |

### Enum-guide: nytt vs gjenbruk

| Situasjon                                   | Handling                                          | Eksempel                                                   |
| ------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| Standard livssyklus (draft → active → done) | Gjenbruk eksisterende status-enum hvis det passer | `season_status`, `budget_status`                           |
| Domene-spesifikke verdier                   | Lag ny enum                                       | `deviation_severity` (low → critical)                      |
| Land/valuta/bransje                         | Gjenbruk alltid                                   | `country`, `currency`, `industry`                          |
| Frontend trenger andre labels               | Map i frontend, ALDRI endre DB-enum               | `season_type`: DB har `default`, frontend viser "Standard" |

### Migrasjons-checkliste

| Steg            | Sjekk                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| Ny tabell       | PK er `{table}_id`, har `created_at` + `updated_at`, har `workspace_id` hvis scoped |
| Ny FK           | Peker til gyldig PK, ON DELETE er bevisst valg (CASCADE vs RESTRICT)                |
| Ny enum         | Verdier sjekket mot eksisterende enums, `database.types.ts` regenerert              |
| Ny indeks       | workspace_id + mest brukte filtrekolonner, vurder partial index                     |
| DROP-operasjon  | `IF EXISTS` alltid. Kjør `supabase db reset` lokalt først                           |
| Etter migrasjon | Kjør `supabase gen types typescript` for å oppdatere `database.types.ts`            |

### Indeks-patterns

| Mønster          | SQL                                                            | Når                                         |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------- |
| RLS-performance  | `CREATE INDEX idx_{table}_workspace ON {table} (workspace_id)` | Alle workspace-scoped tabeller              |
| Composite filter | `CREATE INDEX idx_x ON t (col_a, col_b)`                       | Queries som filtrerer på begge              |
| Partial index    | `CREATE INDEX idx_x ON t (col) WHERE status != 'completed'`    | Store tabeller der flest rader er "ferdige" |
| Timestamp range  | `CREATE INDEX idx_x ON t (workspace_id, created_at DESC)`      | Sorterte lister med workspace-filter        |
