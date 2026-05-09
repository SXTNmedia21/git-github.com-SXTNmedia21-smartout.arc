---
title: "Lærling-kontrakter — Opplæringsloven kap. 4 — datamodell-utvidelse uten ny tabell"
id: ADR-0253
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-04-30
supersedes: []
relates_to:
  - ADR_0001
  - ADR_0241
  - ADR_0244
  - ADR_0245
  - ADR_0252
---

# ADR-0253: Lærling-kontrakter — Opplæringsloven kap. 4 — datamodell-utvidelse uten ny tabell

**Status:** Proposed
**Date:** 2026-04-30

---

## Context and Problem Statement

Hospitality-bransjen — restauranter, hotell, caféer — er blant de største brukerne av lærlingeordningen i Norge. Kokk-lærling, servitør-lærling og resepsjonist-lærling utgjør reelle ansettelsesforhold på Smartout-arbeidsplasser fra dag én. Opplæringsloven kap. 4 (§§4-1 til 4-7) regulerer lærlingeordningen som et særskilt arbeidsforhold med egne rettigheter og plikter: lønnet praktisk opplæring over normalt fire år (to år i skole, to år i bedrift), graduert lønnsskala per Riksavtalen, registrering av lærekontrakten hos fylkeskommune via opplæringskontor, og avsluttende fagprøve for fagbrev.

Smartouts kontrakt-modul blokker for øyeblikket lærlingekontrakter eksplisitt på to nivåer:

1. **ADR-0241 Lovsen amendment 5** (`docs/decisions/0241-contract-schema-migration-foundation.md` linje 79–80): `employment_form='apprentice'` er til stede i enumen men UI-blokker er pålagt inntil skjemautvidelse for opplæringskontor-felter, utdanningsprogram, fagkode og fylkeskommune-tilknytning er gjennomført. Status: ESKALÉR.
2. **ADR-0001-contract-service §"Risks" linje 236** (`docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md`): "Lærlinge-kontrakter (Opplæringsloven kap. 4) — egen ADR senere, men datamodellen må ikke utelukke dem." Dette er den ADR-en.
3. **ADR-0245 §"Open Questions" item 2** (`docs/decisions/0245-employee-contract-mobile-flow.md` linje 242–243): mobil-trigger-kartet mangler `apprentice_milestone_due` og `apprentice.year_advance_due`.
4. **ADR-0252** (Riksavtalen-versjonering, planlagt): tariff-tabellen for lærlingesatser er flagget som åpent spørsmål i samme ADR-batch.

Kjerneproblemet er: `employment_form='apprentice'` eksisterer allerede i `employment_form_enum` i `packages/supabase/src/database.types.ts` (linje 20108–20113) og dermed i live-skjemaet, men verken kontrakttabellen, capability-laget eller mobil-overflaten vet hva de skal gjøre med en lærlingekontrakt. Denne ADR-en beslutter datamodell-utvidelsen, felt-klassifisering, lønnstrinn-mekanikk, trigger-kartet og termineringssemantikk for lærlingekontrakter — uten å legge til ny tabell.

Beslutningen er særlig tidssensitiv fordi:
- `employment_form_enum` ALLEREDE har `apprentice`-verdien — ingen ALTER TYPE nødvendig for grunnleggende opprettelse
- Fase 0a-migrasjonen kan deployes med UI-blokker, men Fase 2 (planlagt) trenger denne ADR-en for å fjerne blokken uten ny tech debt

---

## Decision Drivers

- **ADR-0001-contract-service linje 236** — eksplisitt utsettelse med krav om egen ADR
- **ADR-0241 amendment 5** — UI-blokker blokkerer all apprentice-contract-opprettelse i Fase 1 schema; ADR-0253 er unblockeren for Fase 2
- **ADR-0245 Open Questions item 2** — mobil trigger-kart har hull for lærling-spesifikke hendelser; mobil lærling-kontrakt kan ikke shipes uten at dette er besluttet
- **Opplæringsloven §4-2** — lærekontrakten er en juridisk bindende avtale mellom lærling, arbeidsgiver og opplæringskontor; arbeidsgiveren har registreringsplikt overfor fylkeskommune
- **Opplæringsloven §4-6** — oppsigelse av lærlingekontrakt krever saklig grunn + særskilt varsel; strengere enn ordinær ansettelse
- **Riksavtalen NHO Reiseliv 2024-2026** — lærlingesatser er egne tabellrader (40%/50%/60%/70%/80% av fagarbeider-lønn per opplæringsår); disse MÅ speiles i `framework_rule` + `tariff_rate_table`
- **ADR-0252** (Riksavtalen-versjonering) — tariff-tabellene for lærling er en variant av samme versjoneringsutfordring; løsningen her må samspille med versjoneringsmodellen der
- **ADR-0244 linje 114** (`docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md`) — `is_constructive_dismissal_risk` boolean finnes allerede; lærlingeoppsigelse er alltid høy-risiko og må route inn i dette flagget
- **`employment_form_enum` er allerede korrekt** — `apprentice` er én av fem verdier i live-database-typen; ingen ny enum-migrering trengs (database.types.ts linje 20108–20113)

---

## Considered Options

### A. Skjema-utvidelses-form

#### Alternativ A1: Ny `employment_role`-enum-verdi `apprentice`
Legg til `apprentice` i `employment_role` (i dag: `main | secondary | temporary_supplement`, database.types.ts linje 20114). Lærling er dermed en rolle, ikke en form.

**Forkastet.** `employment_role` beskriver om ansettelsesforholdet er et primærforhold eller et supplement — det er ortogonalinformasjon uavhengig av om man er lærling. En lærling KAN ha `employment_role='main'` (eneste arbeidsgiver). En lærling KAN ha `employment_role='secondary'` (lærling i bedrift A, deltids-jobb i bedrift B). `employment_role` forteller Smartout om parallell-kontrakt-aggregering (ADR-0001 D2, linje 88–93); `employment_form` forteller systemet hva slags arbeidsrettslig form forholdet har. Disse er to separate dimensjoner. Å blande dem ville bryte D2-aggregeringslogikken og gjøre schemaet semantisk inkonsistent.

#### Alternativ A2: Ny `contract_template.template_kind`-diskriminator (`standard | apprentice | commission_only`)
Skille ut lærlingekontrakter på template-nivå i stedet for på kontrakt-nivå. Lærling-template har spesielle felt; standard template har det ikke.

**Forkastet.** Template-nivå er feil skjemaplassering for en juridisk ansettelsesform. `employment_form` på `employment_contract` er en MATERIAL-klassekolonne (ADR-0001 felt-klassifisering, linje 146 og linje 569 i database.types.ts) — endring krever re-signering. En `template_kind`-diskriminator ville ha skapt divergens: kontrakt A er en lærlingekontrakt (fordi dens template er `apprentice`), men `employment_contract.employment_form` er `permanent` (fordi admin glemte å bytte). Videre: lærlingekontrakter kan opprettes fra ulike templates avhengig av fag og opplæringskontor — template_kind ville blitt en per-template-instans-kopi av informasjon som hører hjemme på kontrakten.

#### Alternativ A3 (valgt): `employment_form='apprentice'` — skjemautvidelse direkte på `employment_contract`
`employment_form_enum` har allerede `apprentice`-verdien (database.types.ts linje 20111). Legg til lærling-spesifikke nullable-kolonner direkte på `employment_contract`. Alle kolonner nullable for ikke-lærlingkontrakter. Ingen ny tabell.

**Valgt.** Se begrunnelse nedenfor.

**Begrunnelse for A3:**
- Enum-verdi er allerede korrekt i live-skjemaet; ingen ALTER TYPE kreves
- `employment_form='apprentice'` er MATERIAL-klasse (ADR-0001-contract-service linje 146): endring krever re-signering — konsistent med andre employment_form-verdier
- Lærlingesatser og milestones tilhører semantisk det spesifikke ansettelsesforholdet, ikke en gjenbrukbar template-komponent
- 9 nullable kolonner på én tabell er lineær kostnadsmodell vs. to-tabell extension-pattern (foreign-key JOIN til `apprentice_contract_extension`) som er kvadratisk for RLS og capability-lag
- RLS-modellen forblir uendret — workspace_id er allerede på `employment_contract` (database.types.ts linje 7608); ingen ny RLS-policy trengs

### B. `apprentice_contract_extension`-tabell (B1) kontra kolonner direkte på `employment_contract` (B2/A3)

**B1: Extension-tabell** — normalisert `apprentice_contract_extension` med `contract_id FK`, de 9 lærling-feltene, og egne RLS-policyer.

**Forkastet for v1.** Begrunnelse: prematur normalisering. Extension-tabeller betaler seg når:
(a) data-strukturen er radikalt ulik (forskjellige constraints, index-strategier, tilgangsmodeller),
(b) volumet av extension-rader er stort nok til at de forstyrrer ytelse på hovdtabellen, eller
(c) extension-felter brukes av en separat komponent som aldri trenger hovdetabellen-kolonner.

Ingen av (a)–(c) er oppfylt her. Lærling-feltene følger samme workspace_id-skoped RLS som `employment_contract`. Volumet er lavt (antall lærlingekontrakter er en liten delmengde av totale kontrakter). Capability-laget trenger alltid `employment_contract` pluss lærling-felt i samme operasjon. Extension-tabell ville kreve JOIN i alle capability-verktøy og en ekstra RLS-policy. Nullable kolonner er riktig v1-form; extension-tabell er riktig v3-form dersom felttallet vokser betydelig.

**B2 = A3 (valgt):** Nullable kolonner på `employment_contract`.

---

## Decision Outcome

Valgt: **Alternativ A3 / B2 — nullable kolonner direkte på `employment_contract`**, kombinert med:
- **C** — pay-scale snapshottet ved kontraktopprettelse + auto-step via `engine_event` med annual amendment-forslag
- **D** — apprentice-spesifikke push-trigger-typer registrert i ADR-0245 trigger-kartet
- **E** — `framework_rule` via `rule_id` for lærlingesatser (ingen schema-utvidelse nødvendig på framework_rule)
- **F** — administrativt ansvar for registrering; blocking obligation på `lærekontrakt_registration_ref`
- **G** — fagprøve-fullføring → amendment-flow via ADR-0244
- **H** — termineringsbeskyttelse via ADR-0244 `is_constructive_dismissal_risk = true` alltid for `employment_form='apprentice'`

---

### Seksjon 1: Nye nullable-kolonner på `employment_contract`

Følgende 9 kolonner legges til via separat migrasjonsfil (`supabase/migrations/<YYYYMMDDHHMMSS>_apprentice_contract_fields.sql`). Alle nullable — eksisterende ikke-lærlingerader påvirkes ikke.

| Kolonne | Type | Constraint | Klasse | Notat |
|---|---|---|---|---|
| `apprentice_program_code` | `text` | nullable | MATERIAL | Fagkode fra Utdanningsdirektoratet (f.eks. `NAT3002` Kokk og servitørfaget). Nullable fordi opplæringskontor kan registrere programkode separat. |
| `apprentice_training_office_ref` | `text` | nullable | ADMIN | Referanse til opplæringskontoret (fritekst i v1 — opplæringskontor er IKKE modellert som workspace; se Open Questions §4.1). |
| `apprentice_year` | `smallint` | `CHECK (apprentice_year BETWEEN 1 AND 4)`, nullable | MATERIAL | Inneværende opplæringsår (1–4). Nullabe for kontraktopprettelse; settes til 1 ved aktivering. |
| `apprentice_pay_scale_pct` | `numeric(4,1)` | `CHECK (apprentice_pay_scale_pct IN (40.0, 50.0, 60.0, 70.0, 80.0, 100.0))`, nullable | MATERIAL | Snapshottet lønnsandel av fagarbeider-lønn. 40% = år 1, 50% = år 2, 60% = år 3, 70% = år 4 første halvår, 80% = år 4 andre halvår (per Riksavtalen NHO Reiseliv 2024–2026 lærling-tabell). 100% tillatt etter fagprøve-passering. |
| `apprentice_curriculum_milestones` | `jsonb` | nullable | ADMIN | Array av `{title: text, due_at: timestamptz, completed_at: timestamptz \| null, description: text}` per Forskrift om læretid kap. 11 kompetansemål. Oppdateres av admin uten amendment; ansatt informeres. |
| `lærekontrakt_registered_at` | `timestamptz` | nullable | ADMIN | Tidspunkt for registrering hos fylkeskommune. Settes manuelt av admin. |
| `lærekontrakt_registration_ref` | `text` | nullable | ADMIN | Fylkeskommunens referansenummer for lærekontrakten. Blocking obligation inntil satt (se Seksjon 6). |
| `fagprøve_scheduled_at` | `timestamptz` | nullable | ADMIN | Planlagt fagprøvedato registrert av opplæringskontor. |
| `fagprøve_passed_at` | `timestamptz` | nullable | ADMIN | Tidspunkt for bestått fagprøve. Setter i gang amendment-flow til `permanent` (Seksjon 7). |

**Constraint for employment_form-validering:**
```sql
CONSTRAINT apprentice_fields_require_apprentice_form CHECK (
  employment_form = 'apprentice'
  OR (
    apprentice_program_code IS NULL AND
    apprentice_training_office_ref IS NULL AND
    apprentice_year IS NULL AND
    apprentice_pay_scale_pct IS NULL AND
    apprentice_curriculum_milestones IS NULL AND
    lærekontrakt_registered_at IS NULL AND
    lærekontrakt_registration_ref IS NULL AND
    fagprøve_scheduled_at IS NULL AND
    fagprøve_passed_at IS NULL
  )
)
```

Dette er en "inverted NULL guard": lærlingfelter kan kun settes dersom `employment_form='apprentice'`. Ikke-lærlingekontrakter kan ikke ved uhell få lærlingedata.

**Felt-klassifisering begrunnelse:**
- `apprentice_program_code` og `apprentice_year` er MATERIAL fordi de definerer hva slags opplæring ansettelsesforholdet gjelder — vesentlig innhold i lærekontrakten per Opplæringsloven §4-2.
- `apprentice_pay_scale_pct` er MATERIAL fordi den er direkte lønnsdrivende per ADR-0001-contract-service linje 194 (`rate_value (base)` = MATERIAL).
- Øvrige kolonner er ADMIN (administrative registreringer, milestones, datoer) — ansatt informeres men consent kreves ikke.

---

### Seksjon 2: Pay-scale-interaksjon med `contract_pay_rule`

#### Situasjon

Riksavtalen NHO Reiseliv har egne lærlingesatser:
- Opplæringsår 1: 40% av fagarbeider-grunnlønn
- Opplæringsår 2: 50%
- Opplæringsår 3: 60%
- Opplæringsår 4 (første halvår): 70%
- Opplæringsår 4 (andre halvår): 80%

Disse er per-tariff-revisjon og endres ved Riksavtalen-forhandling (normalt hvert andre år). ADR-0252 (Riksavtalen-versjonering) har ansvar for versjonering av selve satsene i `tariff_rate_table`; denne ADR-en beslutter HVORDAN lærlingekontrakter kobler seg til disse satsene.

#### Tre alternativer vurdert

**Alt. C1: Snapshot ved kontraktopprettelse (statisk rate på `contract_pay_rule`)**
`contract_pay_rule.rate_value = framework_rule.full_rate × apprentice_pay_scale_pct / 100` beregnes ved opprettelse og lagres som absolutt verdi. Endringer i Riksavtalen krever manuell amendment.

**Alt. C2: Auto-step ved årsdag (engine_event auto-appliserer ny rate)**
`engine_event` på `employment_contract.start_date + N year` setter automatisk ny `contract_pay_rule.rate_value` og oppdaterer `apprentice_year`. Ingen amendment-flow — endringen skjer uten ansatt-consent.

**Alt. C3 (valgt): Snapshot + engine_event genererer amendment-forslag**
`contract_pay_rule.rate_value` snapshottes ved kontraktopprettelse. Et `engine_event`-abonnement på årsdag genererer et `contract_amendment`-utkast med ny `rate_value` beregnet fra oppdatert tariff-basis × ny `apprentice_pay_scale_pct`. Administratoren bekrefter og sender til signering via ADR-0244 amendment-flow.

**Begrunnelse for C3:**
- Lønnsjustering er MATERIAL-klasse per ADR-0001-contract-service linje 194 (`rate_value (base)` = MATERIAL) — endring krever re-signering. Dette er ikke forhandlingsbart: Aml. §14-6 krever at arbeidsavtalen viser lønn, og at endringer meddeles skriftlig.
- C2 (auto-apply) ville stiltiende endre et MATERIAL-felt uten amendment-flow — direkte brudd på ADR-0244-semantikken.
- C1 (statisk snapshot, manuell amendment) er trygt men brukervennlig svakt: admin må manuelt huske årsdag + Riksavtalen-revisjon. C3 legger til `engine_event`-hjelp uten å bryte jus-modellen.
- C3 gir compliance som biprodukt av systemhendelse: `engine_event` på `start_date + N year` utløser `fire-delayed-triggers`-pattern (per eksisterende `engine_delayed_trigger`-infrastruktur) → amendment-utkast opprettes → admin varsles → amendment sendes til signering.

**Teknisk implementasjon av C3:**
1. Ved opprettelse av lærlingekontrakt: `contract_pay_rule.rate_value = current_framework_rate × 0.40` (år 1).
2. Migrasjonen legger til en `engine_delayed_trigger`-rad: `{trigger_at: start_date + 1 year, event_type: 'apprentice.year_advance_due', payload: {contract_id, new_year: 2, new_pay_scale_pct: 50.0}}`.
3. `fire-delayed-triggers` (eksisterende Edge Function) plukker opp hendelsen og oppretter et `contract_amendment`-utkast med `requires_employee_signature = true` (MATERIAL-endring) og `change_summary: "Opplæringsår 2 — lønnstrinn fra 40% til 50% av fagarbeider-lønn"`.
4. Admin bekrefter, signering trigges via ADR-0244 amendment-flow.
5. Ved år 4 halvvegsskifte: manuell registrering (50%→80% split skjer halvveis i år 4, ikke ved årsdag — cron-trigger vil ikke matche uten eksplisitt halvvegsdato, som ikke er et standardfelt). Flagges i Open Questions §4.3.

**Snapshotting av tariff-basis ved revisjon (ADR-0252-interaksjon):**
Når Riksavtalen reforhandles og `tariff_rate_table`-rader endres, skal EKSISTERENDE lærlingekontrakter IKKE automatisk re-beregnes. `contract_pay_rule.rate_value` er snapshot — verdien som lå i kontrakten er den som gjelder inntil amendment. Dette er konsistent med ADR-0252 snapshot-semantikk og det generelle prinsippet at historiske kontrakter er immutable.

---

### Seksjon 3: Tariff-håndtering og `framework_rule`

Riksavtalen NHO Reiseliv har eksplisitte lærlingesatser som per `target`-felt på `framework_rule` (database.types.ts linje 8927–8944). `framework_rule`-skjemaet har kolonnene `code` (text), `category` (text), `rule_type` (framework_rule_type enum: `gate | constraint | advisory | commercial`), `framework_id` FK og `evaluation_config` (jsonb).

**Konklusjon:** `framework_rule` kan holde lærlingesatser uten schema-utvidelse:
- `code`: f.eks. `'RIKSAVTALEN_LAERLING_AAR_1'`
- `category`: `'laerling_lonnssats'`
- `rule_type`: `'commercial'` (lønns-nivå)
- `evaluation_config`: `{"pay_scale_pct": 40.0, "basis": "fagarbeider_grunnlonn", "opplaeringsaar": 1}`
- `source_reference`: `'Riksavtalen NHO Reiseliv 2024-2026 §X lærling-tabell'`

Disse radene seedes i en separat seed-migrasjon (ikke i denne ADR-en — se Seksjon 5 Konsekvenser). `contract_pay_rule.framework_rule_id` på lærlingekontrakten peker til relevant `framework_rule`-rad for det aktuelle opplæringsåret. Ingen schema-utvidelse på `framework_rule` kreves.

---

### Seksjon 4: Apprentice-milestone trigger-kart (ADR-0245 §E utvidelse)

ADR-0245 Seksjon E (`docs/decisions/0245-employee-contract-mobile-flow.md` linje 149–162) definerer push-notifikasjons-trigger-kartet for kontrakt-hendelser. Lærlingekontrakter trenger fire tilleggshendelser.

**Tillegg til ADR-0245 §E trigger-tabell:**

| Trigger-hendelse | Payload-tittel (no) | Payload-CTA (no) | Payload body | Deep link |
|---|---|---|---|---|
| `apprentice.milestone_due` | "Praksis-mål nærmer seg frist" | "Se detaljer" | Milestone TITTEL (ikke PII) + antall dager til frist | `smartout://contract/obligation/${obligation_id}` |
| `apprentice.year_advance_due` | "Lønnstrinn-oppstigning klar for godkjenning" | "Se endringen" | "Opplæringsår {N} — nytt lønnstrinn {X}%" + "Admin må godkjenne" | `smartout://contract/amendment/${amendment_id}` |
| `apprentice.fagprøve_scheduled` | "Fagprøve-dato fastsatt" | "Se dato" | Fagprøvedato (dato, ikke PII) | `smartout://contract/detail/${contract_id}` |
| `apprentice.fagprøve_passed` | "Gratulerer med fagbrev!" | "Se kontrakt" | "Du er nå fagarbeider" + bedriftsnavn | `smartout://contract/detail/${contract_id}` |

**Trigger-kilde:**
- `apprentice.milestone_due`: cron-jobb leser `employment_contract.apprentice_curriculum_milestones[*].due_at` og sender trigger N dager i forveien (konfigurerbart per workspace, default 14 dager).
- `apprentice.year_advance_due`: `fire-delayed-triggers`-pattern fra `engine_delayed_trigger`-raden opprettet ved kontraktopprettelse (Seksjon 2 C3).
- `apprentice.fagprøve_scheduled`: `UPDATE`-trigger på `fagprøve_scheduled_at IS NOT NULL AND old.fagprøve_scheduled_at IS NULL`.
- `apprentice.fagprøve_passed`: `UPDATE`-trigger på `fagprøve_passed_at IS NOT NULL AND old.fagprøve_passed_at IS NULL`.

**ADR-0078-sjekk:** Ingen personnummer, bankdata, skattedata eller lønnssats i push-payload. Fagprøvedato er dato — ikke PII per definisjon. Lønnstrinn-prosentsats (f.eks. "50%") er ikke individuell lønn; prosentsats er tariff-standard-informasjon.

---

### Seksjon 5: Riksavtalen-satser seed-oppgave

Riksavtalen NHO Reiseliv lærlingesatser MÅ lastes inn i `framework_rule` og `tariff_rate_table` som egne rader for at `contract_pay_rule.framework_rule_id`-kobling skal fungere. Dette er en separat seed-migrasjon-oppgave:

- **Ikke i denne ADR-en** — ADR-0253 beslutter datamodell; seed-data er en build-agent-oppgave
- **Avhengighet**: ADR-0252 (Riksavtalen-versjonering) bestemmer kolonne-modell for `tariff_rate_table`; seed-oppgaven kan ikke starte før ADR-0252 er implementert
- **Konfidensnotat**: Riksavtalen NHO Reiseliv 2024–2026 lærlingesatser er 40/50/60/70/80% av fagarbeider-grunnlønn. Dette er tariff-standard. Absolutte kronesatser varierer per fagarbeider-tariff og reforhandling. Seed-oppgaven MÅ verifisere mot gjeldende Riksavtalen-tekst. ESKALÉR til arbeidsrettsadvokat for bekreftelse av presise satser og progresjonstrinn.

---

### Seksjon 6: Lærekontrakt-registrering og blocking obligation

Opplæringsloven §4-2 krever at lærekontrakten inngås mellom lærling, arbeidsgiver og opplæringskontor og registreres hos fylkeskommune. Smartout integrerer IKKE direkte med fylkeskommunens systemer i v1 — dette er admins ansvar.

**Beslutning:**
- `lærekontrakt_registration_ref` (nullable text) er et ADMIN-klassekolonne på `employment_contract`.
- Opprettelse av lærlingekontrakt legger automatisk til en `contract_obligation`-rad av typen `lærekontrakt_registrering` med `is_blocker = true` og `due_at = start_date + 30 dager`.
- Obligationen markeres `completed` av admin når `lærekontrakt_registration_ref` settes til en ikke-null verdi.
- Ansatt (`profile`) MÅ IKKE kunne starte vakt før `lærekontrakt_registration_ref` er satt — dette enforces via ADR-0243 `is_blocker`-flagg i obligation-lifecycle-trigger-semantikk (`docs/decisions/0243-obligation-lifecycle-trigger-semantics.md`).
- Smartout-plattformen er eksplisitt IKKE ansvarlig for registreringen; admins attesterer ved å sette referansen.

**Rationale:** Full fylkeskommuneintegrasjon er utenfor scope for v1 og krever sertifiseringsløype. Blocking obligation er minimalt invasivt og juridisk korrekt: Opplæringsloven §4-2 krever registrering, og Smartout kan ikke operasjonalisere lærlingeforholdet uten dokumentasjon på at dette er gjort.

---

### Seksjon 7: Fagprøve-fullføring og `contract_status`-overgang

Når `fagprøve_passed_at` settes (ADMIN-endring av admin eller opplæringskontor):

1. En DB-trigger på `employment_contract.fagprøve_passed_at` (`IS NOT NULL AND old.fagprøve_passed_at IS NULL`) oppretter automatisk et `contract_amendment`-utkast med:
   - `change_type: 'employment_form_change'`
   - `proposed_employment_form: 'permanent'`
   - `proposed_apprentice_pay_scale_pct: 100.0`
   - `requires_employee_signature: true` (MATERIAL — employment_form er MATERIAL per ADR-0001 linje 146)
   - `change_summary: "Fagbrev bestått — overgang fra lærlingeforhold til fast ansettelse"`
2. Amendment-flow via ADR-0244 håndterer re-signering.
3. Etter signert amendment: `employment_form` endres til `permanent` (eller `temporary` dersom arbeidsgiver tilbyr midlertidig stilling), `apprentice_*`-kolonner beholdes for historikk men er nå inaktive (ingen nye endringer tillatt).
4. `apprentice_pay_scale_pct` settes til `100.0` etter fagbrev — dette er fagarbeider-sats, ikke lærlingesats.

**Nullstilling av lærlingefelt:** Etter overgang til `permanent` nullstilles IKKE `apprentice_*`-kolonner — de er historisk dokumentasjon av opplæringsforholdet og underlagt Bokføringsloven §13 5-års-retention per ADR-0244 linje 131–141.

---

### Seksjon 8: Termineringsbeskyttelse og constructive-dismissal routing

Opplæringsloven §4-6 og Aml. §15-12 gir lærlingekontrakter særskilt oppsigelsesvern:
- Oppsigelse av lærlingekontrakt krever saklig grunn (Aml. §15-7) + skriftlig varsel (Aml. §15-1) + mulighet til å uttale seg.
- Lærlingeforholdet er i tillegg rammet av Opplæringsloven §4-6 som gir opplæringskontoret innsigelsesrett og som pålegger arbeidsgiver meldeplikt.
- Aml. §15-12 (diskriminerings-vern) treffer ekstra hardt for lærlinger fordi aldersdiskriminering (de aller fleste lærlinger er 16–24 år) er en reell risiko.

**Beslutning:**
Enhver termineringshendelse (`contract_status`-overgang til `terminated`) på en kontrakt med `employment_form='apprentice'` SETTER `is_constructive_dismissal_risk = true` (ADR-0244 linje 114) automatisk via DB-trigger. Dette er IKKE valgfritt — det er ALLTID sant for lærlingekontrakter.

**Implementasjon:**
```sql
-- I migrasjonsfilen eller som trigger på contract_amendment
CREATE OR REPLACE FUNCTION enforce_apprentice_dismissal_risk()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'terminated' THEN
    -- Hent employment_form fra employment_contract
    IF EXISTS (
      SELECT 1 FROM employment_contract ec
      WHERE ec.contract_id = NEW.contract_id
        AND ec.employment_form = 'apprentice'
    ) THEN
      NEW.is_constructive_dismissal_risk := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

Dette trigger Lovsen-review-flyten i kontrakts-capabilitylaget (ADR-0249 §"legal capability") og blokkerer direkte termineringsfullføring uten admin-bekreftelse av saklig grunn.

---

## Rules & Consequences

### Positive konsekvenser

- **ADR-0241 unblokket:** Apprentice enum-blokker UI (amendment 5, linje 79–80) kan fjernes i Fase 2 implementering etter at denne ADR-en er `accepted` og migrasjonen er deployet.
- **ADR-0245 mobil-trigger-kart komplett:** Fire nye apprentice-spesifikke trigger-typer (Seksjon 4) fyller hull identifisert i ADR-0245 Open Questions item 2 (linje 242–243).
- **Ingen ny tabell:** Migrasjonskostnad er 9 nullable kolonner + constraint + 3 triggers + 1 blocking obligation-seed. Eksisterende RLS-policyer på `employment_contract` dekker lærlingedata uten endring.
- **`employment_form_enum` allerede korrekt:** `apprentice` er én av fem verdier i live-skjemaet (`database.types.ts` linje 20111); ingen ALTER TYPE-trinn nødvendig.
- **Termineringsvern hardkodet:** Aml. §15-12 + Opplæringsloven §4-6 enforces via `is_constructive_dismissal_risk = true` alltid for lærlingekontrakter — zero-config compliance for admin.
- **Pay-scale snapshottet + engine_event varsel:** MATERIAL-klasse-endring i lønn er ivaretatt per ADR-0244; admin slipper manuell årsdag-tracking.

### Negative konsekvenser

- **Seed-avhengighet:** Riksavtalen-satser i `framework_rule` + `tariff_rate_table` MÅ eksistere før lærlingekontrakt kan opprettes med korrekt `contract_pay_rule`-binding. Seed-oppgaven er en blokker for Fase 2. Avhenger av ADR-0252 implementasjon.
- **År-4-halvvegsskiftet (40%→80% via 70%):** To progresjonstrinn i år 4 (opplæringsår 4 første halvår = 70%, andre halvår = 80%) krever at admin registrerer halvvegsdato manuelt — eller at Smartout introduserer en dedikert kolonne `apprentice_year4_midpoint_date` i en fremtidig ADR. Halvvegsdato er ikke standardisert og varierer per lærling. Se Open Questions §4.3.
- **Opplæringskontor ikke modellert:** `apprentice_training_office_ref` er fritekst-referanse. Multi-lærling-opplæringskontor-scenario (Seksjon 4 Open Questions §4.1) er utenfor scope; admin-friction for arbeidsgivere med mange lærlinger er høyere enn nødvendig.
- **Fagprøvedato split:** `fagprøve_scheduled_at` og `fagprøve_passed_at` er admin-satte nullable-felter. Det finnes ingen integrasjon mot prøvenemnda; admin må manuelt registrere begge. Risiko for drift mellom system og virkelighet.

### Agent Impact

- **Build-agenter**: Alle kontrakt-oppretter-flows MÅ sjekke `employment_form` og aktivere lærling-felt-validering dersom `'apprentice'`. ALDRI sett `apprentice_*`-kolonner på ikke-lærlingekontrakter — DB-constraint (`apprentice_fields_require_apprentice_form`) vil avvise dette med en `CHECK constraint violation`.
- **Capability-agenter**: `contract`-capability-verktøy som lister kontrakter eller snapshoter `framework_snapshot` MÅ inkludere `apprentice_pay_scale_pct` og `apprentice_year` i snapshot-payload dersom `employment_form = 'apprentice'`.
- **Migrasjonsforfatter**: Migrasjonsfilen MÅ: (a) bruke `ALTER TABLE employment_contract ADD COLUMN IF NOT EXISTS ...` for alle 9 kolonner; (b) legge til constraint `apprentice_fields_require_apprentice_form` via `ADD CONSTRAINT IF NOT EXISTS`; (c) legge til `enforce_apprentice_dismissal_risk`-trigger med `SECURITY DEFINER SET search_path`; (d) IKKE forsøke å CREATE TYPE `employment_form_enum` — enum eksisterer allerede med `apprentice`-verdi.
- **Lovsen-agenter**: Alle terminerings-reviews for `employment_form='apprentice'` SKAL flagge Opplæringsloven §4-6 og Aml. §15-12 som aktive beskyttelsesgrunnlag i tillegg til standard Aml. §15-7.
- **Steward (Trust Gate)**: Ethvert PR som berører `employment_contract`-writes og `employment_form` MÅ verifisere at lærlingekontrakter (a) setter blocking obligation for `lærekontrakt_registration_ref`, (b) setter `engine_delayed_trigger` for year-advance, (c) bruker `contract_pay_rule.framework_rule_id` mot en apprentice-sats-rad, og (d) IKKE setter `is_constructive_dismissal_risk = false` manuelt for lærlingekontrakter.

---

## Open Questions

### 4.1 Opplæringskontor som workspace (multi-arbeidsgiver-scenario)
Et opplæringskontor kan ha 50 lærlinger fordelt på 30 kafeer/restauranter. Dersom opplæringskontoret ønsker å bruke Smartout som administrativt verktøy for oppfølging på tvers av arbeidsgivere, krever dette at opplæringskontor er en entitet i Smartout — muligens som en workspace eller som en plattform-administrator-rolle. Dette er ute av scope for v1. Flagges for fremtidig ADR dersom markedsdemand oppstår. Konsekvens av avgrensningen: `apprentice_training_office_ref` er fritekst i v1 — opplæringskontoret kan ikke se lærlingedata i Smartout uten tilgang til arbeidsgiverens workspace.

### 4.2 Multi-fag-lærlinger (lærlingeforhold i to fag parallelt)
Svært sjelden, men juridisk mulig: en lærling kan i unntakstilfeller ha to aktive lærekontrakter. ADR-0001 D2 tillater parallelle kontrakter (`employment_role = 'secondary'`). Multi-fag-scenario er utenfor scope for v1; flagges. Konsekvens: Smartout UI bør advare (ikke blokkere) dersom admin forsøker å opprette en andre `employment_form='apprentice'`-kontrakt for samme profil.

### 4.3 År-4-halvvegsskifte (70% → 80%)
Riksavtalen har to lønnstrinn i opplæringsår 4 (70% første halvår, 80% andre halvår). Halvvegsdato er ikke standardisert — den er 12 måneder etter start av år 4 (dvs. 42 måneder etter `start_date`). Alternativt: arbeidsgivers kalenderår-grense. Anbefaling for fremtidig ADR: legg til `apprentice_year4_midpoint_date date`-kolonne, eller beregn automatisk som `start_date + 42 months`. Utenfor scope for denne ADR-en — midlertid løsning er manuell admin-registrering av halvvegsskiftet via eksisterende amendment-flow.

### 4.4 Voksenopplæring (voksne som tar fagbrev uten standard lærlingeløp)
Voksenopplæring per Opplæringsloven §4A-3 har en annen lønnsskala og forkortet opplæringsperiode. Lønnsatsen er typisk 80–100% av fagarbeider-lønn fra dag én (ikke gradert 40–80%). Fagbrev er sluttmål, men løpet er kortere og uten standardisert progresjon. Dette krever en egen ADR; `employment_form='apprentice'` er semantisk feil for voksenopplæring. Anbefaler å reservere en fremtidig `employment_form_enum`-verdi `adult_training` dersom dette materialiserer seg.

### 4.5 NAV apprentice-tilskudd (lærlingtilskudd)
NAV og fylkeskommune gir lærlingtilskudd til arbeidsgiver per opplæringsår. Tilskuddet er ikke et lønnselement for ansatt men inntekt for arbeidsgiver. Smartout har ikke en kostnads-/inntektsmodul for arbeidsgivertilskudd. NAV-integrasjon er en separat ADR med separat sertifiseringsløype. Flagges.

### 4.6 Feriepenger for lærlingekontrakter
Ferieloven §10 nr. 3 gjelder for lærlinger. Riksavtalen Hospitality 5. ferieuke-trigger (ADR-0241 Lovsen amendment 3, linje 75) gjelder også lærlingekontrakter. `holiday_allowance_pct`-defaulten bør trigges til 14.30% for tariff-bundne lærlingekontrakter. Dette er implementert via den generelle ADR-0241 amendment 3-triggeren, men ESKALÉR-flagg fra ADR-0241 gjelder: arbeidsrettsadvokat MÅ bekrefte at Riksavtalen-tilknytning er tilstrekkelig for lærlinger (ikke alle lærlingekontrakter er eksplisitt Riksavtalen-bundne).

---

## References

### ADR-filer (alle lest og linjenummer verifisert)

- **ADR-0001-contract-service** — `docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md` — §"Risks" linje 236 (lærlingedeferral); D2 linje 88–93 (parallelle kontrakter); felt-klassifisering linje 139–205 (MATERIAL/ADMIN); §"Open Questions" linje 231–237 (lærlingekontrakter eksplisitt utsatt)
- **ADR-0241** — `docs/decisions/0241-contract-schema-migration-foundation.md` — Lovsen amendment 5 linje 79–80 (apprentice enum-blocker, ESKALÉR-flagg); `employment_form_enum` eksisterer allerede (linje 47–48); required migration changes linje 38–60
- **ADR-0244** — `docs/decisions/0244-amendment-flow-acknowledgement-as-legal-evidence.md` — `requires_employee_signature` boolean linje 46; `is_constructive_dismissal_risk` linje 114; AcknowledgementRing per-framework blocks linje 35–37; Bokføringsloven §13 retention linje 131–141
- **ADR-0245** — `docs/decisions/0245-employee-contract-mobile-flow.md` — Open Questions item 2 linje 242–243 (lærling trigger-kart gap); trigger-tabell §E linje 149–162; ADR-0078 push-payload PII-forbud linje 160–161
- **ADR-0252** — Riksavtalen-versjonering (planlagt, ikke fil ennå) — tariff-tabellinteraksjon flagget som åpent spørsmål i samme ADR-batch; lærlingesatser avhenger av versjoneringsmodellen der

### `database.types.ts` verifiserte linjenummer
- `employment_form_enum` definisjon med `'apprentice'` inkludert: linje 20108–20113
- `employment_role: "main" | "secondary" | "temporary_supplement"`: linje 20114
- `employment_contract.Row`-definition (kolonner inkludert eksisterende nullable-felter): linje 7555–7609
- `framework_rule.Row`-definition: linje 8925–8944

### Norsk lov og tariff
- **Opplæringsloven kap. 4** (§§4-1 til 4-7): Lærlingeordningen — partene i lærekontrakten, registreringsplikt, rettigheter og plikter, oppsigelse
- **Opplæringsloven §4-6**: Særskilt oppsigelsesvern for lærlingekontrakter; meldeplikt til opplæringskontor
- **Forskrift om læretid kap. 11**: Kompetansemål og milestone-struktur i opplæringsperioden
- **Arbeidsmiljøloven §15-1**: Skriftlig varsel ved oppsigelse
- **Arbeidsmiljøloven §15-7**: Saklig grunn for oppsigelse (gjelder lærlingekontrakter)
- **Arbeidsmiljøloven §15-12**: Diskrimineringsvern — relevant for unge lærlinger (aldersdiskriminering)
- **Riksavtalen NHO Reiseliv 2024–2026**: Lærlingesatser (40/50/60/70/80% gradert per opplæringsår); 5. ferieuke (14.30% feriepenger) for tariff-bundne ansatte inkl. lærlinger
- **Ferieloven §10 nr. 3**: Feriepenger for lærlinger

---

> Registrert i `docs/decisions/0000-decision-log.md` ved commit. Promoveres til `accepted` når: (a) migrasjonen `..._apprentice_contract_fields.sql` er deployet på `development`, (b) ADR-0241 Lovsen amendment 5 UI-blokker er fjernet i Fase 2 build, (c) ADR-0252 Riksavtalen-seed for lærlingesatser er deployet, (d) ADR-0245 trigger-kart er utvidet med fire apprentice-hendelser per Seksjon 4.
