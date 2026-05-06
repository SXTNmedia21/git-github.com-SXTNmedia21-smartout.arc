---
title: "ADR-0001 — Kontrakt og lønnsprofil: fundamentale valg før migrasjon"
status: superseded
updated: 2026-04-29
created: 2026-04-29
tags: [adr, contracts, superseded, council]
module: contracts
---

# ADR-0001 — Kontrakt og lønnsprofil: fundamentale valg før migrasjon

**Status:** Superseded 2026-04-29 (Council verdict)
**Superseded by:** ADR-0241 (`0241-contract-schema-migration-foundation.md`), ADR-0242 (`0242-contract-payroll-capability-split.md`), ADR-0243 (`0243-obligation-lifecycle-trigger-semantics.md`), ADR-0244 (`0244-amendment-flow-acknowledgement-as-legal-evidence.md`). Split per Council 2026-04-29.
**Original status:** Proposed
**Dato:** 2026-04-29
**Forfatter:** Pontus Lindroth (utkast med Claude)
**Note:** Module-local ADR — never registered in `docs/decisions/0000-decision-log.md`. Numbering collision with global ADR-0001 (Turborepo, accepted 2026-02-24). Direction approved by Council 2026-04-29 but split into 4 globally-registered ADRs (0241-0244) for proper governance + load-bearing fixes (FK columns, ALTER TYPE, RLS, capability registry, role enum). Renumbered from ADR-0233-0236 to ADR-0241-0244 on 2026-04-29 due to collision with helpdesk-council ADR batch.

---

## Kontekst

Vi bygger `employment_contract` + `employee_payroll_profile` Tripletex-aligned. Tre fundamentale valg blokkerer migrasjonen, fordi feil svar krever omfattende reverse-arbeid senere. I tillegg trenger vi en eksplisitt klassifisering av hvert felt — *hvilke endringer krever re-signering vs admin-endring*. Uten den klassifiseringen får vi inkonsistent praksis og juridisk risiko.

Denne ADR tar tre beslutninger (D1, D2, D3) og fastsetter felt-klassifisering. Andre design-detaljer (snapshot-pattern, contract_obligation, cascade-coupling) ligger utenfor scope og dokumenteres i etterfølgende ADRer.

---

## D1 — Identitets-master: Smartout eller Tripletex?

### Alternativer

**(a) Smartout som master, Tripletex som integrasjonsmål.**
Smartout eier `profile` og alle relaterte ansatt-data. Endringer pushes til Tripletex. Tripletex er én av flere mulige payroll-backender (Visma, Xledger, in-house) i fremtiden.

**(b) Tripletex som master, Smartout som read-replica.**
Tripletex eier ansatt-identitet. Smartout pull'er og denormaliserer. Compliance (A-melding, skattekort) håndteres av Tripletex.

### Beslutning

**(a) Smartout master.** Tripletex er den første integrasjonen, ikke ankeret. Naming og struktur følger Tripletex (D1 i forrige brainstorm), men eierskapet til data er Smartout.

### Begrunnelse

Smartout er det operasjonelle laget — cascade, obligations, vakter. Tripletex er én betalingsmotor. Hvis vi låser oss til Tripletex som master, får vi:

- Avhengighet av Tripletex' release-takt for nye felt
- Vanskelig å bytte payroll-leverandør uten data-tap
- Tripletex' modell mangler noen Smartout-konsepter (workspace-multi-tenancy, multi-arbeidsgiver-coupling)

Med (a) arver vi Tripletex' compliance-mønstre via naming, men beholder full kontroll. Pris: vi må selv håndtere A-melding-rapportering hvis Tripletex-integrasjon faller bort.

### Konsekvens

- `tripletex_employee_id` lagres på `profile` (ikke bare `employee_payroll_profile`), siden den er ekstern identitets-peker.
- Sync-retning: Smartout → Tripletex (push), med reconciliation-pull periodisk for å oppdage drift.
- `sync_status` pr. entitet: `pending | synced | divergent | not_synced`.
- Hvis ansatt opprettes i Tripletex direkte (ikke i Smartout først), trenger vi en import-flow — men det er edge case, ikke default.

---

## D2 — Parallelle kontrakter per profil?

### Alternativer

**(a) Én aktiv kontrakt per profil til enhver tid.**
Sekvensielle kontrakter; bytte stilling = terminere gammel + opprette ny.

**(b) Flere parallelle kontrakter tillatt.**
`employment_role` enum (`main | secondary | temporary_supplement`).

### Beslutning

**(b) Parallelle kontrakter tillatt fra dag én.** UI eksponerer det først ved behov, men datamodellen tåler det.

### Begrunnelse

Reelle case fra hospitality:

- Kelner med 40% fast hos oss, ekstra sommervakter med eget tillegg
- Trainee-overlapp: gammel trainee-kontrakt termineres når fast starter, men det går 2 uker overlap der trainee-vakter er booket
- Intern "kryss-stilling": fast bartender tar enkeltvakter som kjøkkenmedarbeider — andre tariff, andre forpliktelser

Tripletex har `employmentType: secondaryEmployment` av samme grunn. Hvis vi designer 1:1 nå, må vi migrere bort fra det innen 6 måneder. Smerte tatt på forskudd.

### Konsekvens

- `employment_contract.employment_role` (enum) fra første migrasjon
- D2 cascade resource-aggregering: `agreed_weekly_hours` per profil = sum over aktive kontrakter (ikke bare main)
- D4 demand-budget: må vekte mot kombinert stillingsprosent
- Botsson-svar: må disambiguere "din kontrakt" når flere finnes
- Lønnskjøring: hvert contract_pay_rule scopet til contract_id, ikke profile_id — allerede riktig i brainstormen
- Material constraint: kun **én** `main`-kontrakt aktiv per profil ad gangen (DB-constraint)

---

## D3 — Overtid-tak: hvor enforces de?

### Alternativer

**(a) Per kontrakt, via `contract_pay_rule`.**
Hver kontrakt har egne tak.

**(b) I shift-engine globalt, lov-hardkodet.**
Aml. §10-6 (10t/uke, 25t/4uker, 200t/år) er engine-default.

**(c) Hybrid: engine eier juridiske tak, kontrakt kan utvide innenfor lov-grenser.**
Aml. tillater opp til 20/50/300 ved særlig tilfelle, og lokal avtale kan utvide ytterligere innenfor lov.

### Beslutning

**(c) Hybrid.** Engine eier defaults, kontrakt kan override oppover (men aldri over absolutt lov-grense).

### Begrunnelse

(a) er feil fordi de juridiske takene gjelder uavhengig av kontrakt — kan ikke "glemmes" eller settes av admin per ansatt.
(b) er for stivt — Riksavtalen og lokale avtaler har legitime utvidelser.
(c) speiler den faktiske jus-strukturen.

### Konsekvens

- Engine har en `overtime_cap_default` per workspace (eller per tariff_id) basert på lov + standard
- Kontrakt har valgfri `overtime_cap_policy_id` som peker til en policy som *utvider* default
- Engine bruker `min(absolute_legal_max, max(default, contract_override))` ved evaluering
- `engine_event` ved nær-tak (f.eks. 80% av månedlig) går til ansatt + leder
- contract_pay_rule eier *satser* (50% / 100%), engine eier *grenser*. Ikke bland disse.

---

## Felt-klassifisering: amendment vs admin vs derived

Hver felt klassifiseres som:

- **MATERIAL** — endring krever re-signering (amendment + ansatt-consent)
- **ADMIN** — admin kan endre uten consent, men ansatt informeres
- **DERIVED** — beregnet eller hentet fra ekstern kilde, aldri direkte redigerbart
- **SYSTEM** — kun infrastruktur (id, timestamps, sync-flagg)

### `employment_contract`

| Felt | Klasse | Notat |
|---|---|---|
| `id`, `created_at`, `signed_at` | SYSTEM | |
| `profile_id` | SYSTEM | Bytte ansatt = ny kontrakt |
| `job_title` / stilling | MATERIAL | Stillingsendring krever consent |
| `employment_form` | MATERIAL | permanent ↔ temporary = stort juridisk skille |
| `employment_role` (main/secondary) | MATERIAL | |
| `start_date` (før signering) | ADMIN | |
| `start_date` (etter signering) | MATERIAL | |
| `end_date` (hvis temporary) | MATERIAL | |
| `end_date_reason` | ADMIN | A-melding-kode ved opphør |
| `working_hours_scheme` | MATERIAL | Skift vs ikke-skift |
| `agreed_weekly_hours` | MATERIAL | |
| `employment_percentage` | DERIVED | Beregnes fra weekly_hours / workspace baseline |
| `monthly_salary` | MATERIAL | |
| `hourly_rate` | MATERIAL | |
| `remuneration_type` | MATERIAL | |
| `tariff_id` | MATERIAL | Tariff-bytte = consent påkrevd |
| `trial_period_months` (ved opprettelse) | MATERIAL | |
| `trial_period_months` (forlengelse) | MATERIAL | Kan ikke forlenge ensidig — kun ved sykefravær iht. lov |
| `notice_period_months` | MATERIAL | |
| `break_minutes_per_day` | ADMIN | Hvis følger workspace-standard; MATERIAL hvis avvik |
| `training_rights` | ADMIN | Informasjonsplikt, ikke avtalt-pålagt |
| `occupation_code` (STYRK-08) | ADMIN | Reklassifisering, statistisk |
| `contract_status` | SYSTEM | active/superseded/terminated |
| `superseded_by_contract_id` | SYSTEM | |

### `employee_payroll_profile`

| Felt | Klasse | Notat |
|---|---|---|
| `tax_table_number` | DERIVED | Hentes fra Skatteetaten API |
| `tax_card_type` | DERIVED | Skatteetaten |
| `tax_percentage` | DERIVED | Skatteetaten |
| `tax_card_fetched_at` | SYSTEM | |
| `holiday_allowance_pct` | ADMIN | Låst per år; endring oppover må gjelde alle |
| `extra_holiday_week` | ADMIN | Kan utvides, ikke fjernes ensidig |
| `pension_scheme_id` | ADMIN | Ansatt skal informeres; opt-in/out separat felt |
| `trade_union_member` | ADMIN | Ansatt initierer endring |
| `trade_union_fee_amount` | ADMIN | |
| `payday_regular` | ADMIN | Workspace-standard normalt |
| `employee_number` | ADMIN | |
| `tripletex_employee_id` | SYSTEM | |
| `seniority_start_date` | MATERIAL | Påvirker ansiennitet-baserte tillegg |

### `contract_pay_rule`

| Felt | Klasse | Notat |
|---|---|---|
| `rule_type` | MATERIAL | base/overtime/supplement/tip skiller intent |
| `salary_type_code` | MATERIAL | |
| `trigger_condition` | MATERIAL | Når regelen utløses påvirker forventet lønn |
| `rate_type` | MATERIAL | |
| `rate_value` (base) | MATERIAL | |
| `rate_value` (tariff-knyttet) | ADMIN | Endres ved tariff-revisjon, propageres |
| `effective_from` (frem i tid) | ADMIN | Planlagt endring |
| `effective_from` (bakover-virkende) | MATERIAL | Krever ansatt-consent |
| `framework_rule_id` | SYSTEM | Peker til snapshot-versjon |

### `contract_tip_rule`

Hele tabellen behandles som **MATERIAL**. Endring av tipsregel påvirker forventet inntekt — selv om mekanikken er operasjonell, dropp den juridiske risikoen og krev consent.

Unntak: `taxable` og `reporting_method` er ADMIN — drevet av lov, ikke avtale.

### Implementasjons-mønster

Klassifiseringen kodes som metadata i en konfigurasjonsfil eller `field_classification`-tabell, ikke som magisk kunnskap i kode. Når admin endrer et MATERIAL-felt: UI presenterer "Dette krever amendment — ansatt må signere på nytt" og blokkerer commit til amendment-flow er fullført.

---

## Konsekvenser samlet

Hvis ADR aksepteres:

1. **Fase 0a-migrasjon utvides** med:
   - `contract_status` + `superseded_by_contract_id` (D2-konsekvens)
   - `employment_role` enum (D2)
   - `tripletex_employee_id` på `profile` (D1)
   - `tax_card_fetched_at` på `employee_payroll_profile` (klassifisering)
   - `overtime_cap_policy_id` på `employment_contract` (D3, valgfri FK)

2. **Skatteetaten-integrasjon er en go-live-blocker** for produksjon. Lønnsprofil med manuelt tastet skattetabell er compliance-risiko. Kan utsettes til etter Fase 0, men før første ekte lønnskjøring.

3. **Engine-arbeid** flyttes opp i prioritet. Overtid-tak må enforce'es før Botsson kan gi pålitelige lønnssvar. Ny ADR for `shift_pay_calculation` + audit-trail-tabell trengs (5 års lagring per Bokføringsloven).

4. **Amendment-flow** er prerequisite for Fase 1. UI for "endre kontrakt" må kalle amendment-handler hvis MATERIAL-felt røres.

5. **D2 cascade aggregering** må oppgraderes til multi-contract-aware før obligations enforces.

## Åpne spørsmål for oppfølging

- Skatteetaten-integrasjon: hvilken sertifiserings-løype, og hvem håndterer feilet skattekort-respons?
- Tariff-versjonering: når Riksavtalen reforhandles, hvordan migreres aktive `contract_pay_rule`-rader?
- Prøvetid-pause ved sykefravær (Aml. §15-6 4. ledd) — automatisk eller manuell registrering?
- Lærlinge-kontrakter (Opplæringsloven kap. 4) — egen ADR senere, men datamodellen må ikke utelukke dem
- A-melding-koder for `end_date_reason` — bruk offisiell kodeliste fra Skatteetaten, ikke håndholdt enum

---

## Beslutningssjekkliste

Før Fase 0a-migrasjon merge'es, må følgende være signert av:

- [ ] D1 — Smartout som master, Tripletex som integrasjonsmål
- [ ] D2 — Parallelle kontrakter tillatt, `employment_role` fra dag én
- [ ] D3 — Overtid-tak hybrid (engine eier juridisk grense, kontrakt kan utvide)
- [ ] Felt-klassifisering — godkjent slik som tabellene over, eller med endringer notert
- [ ] Skatteetaten-integrasjon — eier og tidsplan utpekt (kan være senere fase, men eier nå)