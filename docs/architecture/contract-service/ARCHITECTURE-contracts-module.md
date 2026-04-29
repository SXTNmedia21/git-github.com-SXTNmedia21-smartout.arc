# Architecture — Contracts Module

**Status:** Draft
**Dato:** 2026-04-29
**Forutsetning:** [ADR-0001](./ADR-0001-kontrakt-og-lonnsprofil-fundament.md) godkjent
**Eier:** Pontus Lindroth

---

## 1. Formål og avgrensning

Contracts-modulen er den autoritative kilden i Smartout for alt som beskriver *forholdet mellom arbeidsgiver og ansatt*: juridisk avtale, operasjonelle forpliktelser, lønns-regler og koblinger til hverdagsdrift. Modulen erstatter ikke kontrakts-PDF, den *genererer* den.

**I scope:**

- Juridisk kontrakt (§14-6) — opprettelse, signering, endring, terminering
- Lønnsprofil (Tripletex-aligned) — skatt, feriepenger, pensjon, fagforening
- Lønns-regler per kontrakt (`contract_pay_rule`) — base, overtid, tillegg, tips, provisjon
- Operasjonelle forpliktelser (`contract_obligation`) — opplæring, sertifisering, aktivitetskrav
- Maler og arv (`contract_template`)
- Amendment-flow ved materielle endringer
- Cascade-coupling mot D2/D4/C3/C4

**Ikke i scope (egne moduler):**

- Shift-engine og shift_pay_calculation (egen ADR senere)
- Tariff-forhandling og Riksavtalen-versjonering (egen modul)
- Pension scheme management (separat tabell, men UI/admin er egen modul)
- A-melding-rapportering (egen integrasjons-modul)
- Skatteetaten-integrasjon (egen integrasjons-modul, blocker for go-live)

---

## 2. Designprinsipper

**P1 — Strukturert data er sannhet, PDF er output.**
PDF-kontrakten genereres ved signering fra strukturerte felt. Endring i strukturen = ny generering. Vi parser aldri PDF tilbake.

**P2 — Tre lag, eksplisitt skille.**
Juridisk minimum (§14-6) → operasjonelle forpliktelser → cascade-konsumert hverdag. Hver lag har egen tabell, eget eier-felt, egen endringspolitikk.

**P3 — Snapshot ved signering, amendment ved endring.**
Kontrakten fryser sin tilstand ved signering. Senere endringer i mal eller policy = tilbud om amendment, ikke silent overskriving. Lov krever consent for materielle endringer (jf. felt-klassifisering i ADR-0001).

**P4 — Lønnsprofil er live, ikke snapshot.**
Skattetabell, pensjon, feriepenger endres uten ny kontrakt-signering. Hører ikke hjemme i kontrakt-PDF.

**P5 — Kontrakt arver fra rolle, ikke kopierer.**
`role_capability` (I1 industry intelligence) definerer baseline. Mal arver baseline, kontrakt-instans får snapshot ved signering. Ingen direkte live-link til rolle.

**P6 — Cascade konsumerer, eier ikke.**
Cascade-lagene (D2/D4/C3/C4) leser kontrakt-felt og lønnsprofil. De skriver aldri tilbake. Endring skjer kun via Contracts-modulens egne flows.

---

## 3. Datamodell

### 3.1 Oversikt

```
┌──────────────────────────────────────────────────────────────────────┐
│                          profile                                     │
│  id, display_name, personal_number, bank_account,                    │
│  tripletex_employee_id ←── ekstern ID (D1)                           │
└──────────────────────────────────────────────────────────────────────┘
              │
              │ 1:N (parallelle kontrakter, D2)
              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    employment_contract                               │
│  §14-6 felt + employment_role + contract_status                      │
│  + superseded_by_contract_id + overtime_cap_policy_id                │
└──────────────────────────────────────────────────────────────────────┘
       │              │                │                  │
       │ 1:N          │ 1:N            │ 1:N              │ 1:1
       ▼              ▼                ▼                  ▼
┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ contract_   │ │ contract_    │ │ contract_    │ │ contract_        │
│ obligation  │ │ pay_rule     │ │ tip_rule     │ │ amendment        │
└─────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘
       │              │
       │ peker til    │ peker til (snapshot)
       ▼              ▼
┌─────────────┐ ┌──────────────────────┐
│ policy /    │ │ framework_rule       │
│ protocol    │ │ (versjonert)         │
└─────────────┘ └──────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                  employee_payroll_profile (1:1 med profile)          │
│  Skatt, feriepenger, pensjon, fagforening, lønningsdag,              │
│  Tripletex-mapping                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 `employment_contract`

Eksisterende 18 felt + utvidelse fra ADR-0001 og brainstorm.

| Felt | Type | Kilde | Notat |
|---|---|---|---|
| `id` | uuid PK | system | |
| `profile_id` | uuid FK | profile | |
| `employment_role` | enum | ADR D2 | `main` / `secondary` / `temporary_supplement` |
| `contract_status` | enum | ADR D2 | `draft` / `active` / `superseded` / `terminated` / `expired` |
| `superseded_by_contract_id` | uuid FK | ADR D2 | self-referential |
| `job_title` | text | §14-6 | |
| `employment_form` | enum | §14-6 | permanent / temporary / apprentice / practice / freelance |
| `working_hours_scheme` | enum | Tripletex | notShiftWork / shiftWork / offshoreWork / continuousShiftWork335 / rotation336 |
| `start_date` | date | §14-6 | |
| `end_date` | date NULLABLE | §14-6 | hvis temporary |
| `end_date_reason` | text | A-melding | enum-låst mot offisiell kodeliste |
| `agreed_weekly_hours` | numeric(4,1) | §14-6 | |
| `employment_percentage` | numeric(5,2) GENERATED | derived | fra weekly_hours / workspace_baseline |
| `monthly_salary` | numeric(10,2) NULLABLE | §14-6 | |
| `hourly_rate` | numeric(8,2) NULLABLE | §14-6 | |
| `remuneration_type` | enum | Tripletex | monthlyWage / hourlyWage / commissionOnly |
| `tariff_id` | uuid FK NULLABLE | tariff | |
| `trial_period_months` | smallint NULLABLE | §14-6 | |
| `notice_period_months` | smallint | §14-6 | |
| `break_minutes_per_day` | smallint | §14-6 post juli 2024 | |
| `training_rights` | text | §14-6 post juli 2024 | |
| `occupation_code` | text | A-melding | STYRK-08 |
| `variable_hours_arrangement` | text NULLABLE | §14-6 | hvis variabel arbeidstid |
| `overtime_cap_policy_id` | uuid FK NULLABLE | ADR D3 | hvis avvik fra engine-default |
| `signed_at` | timestamptz NULLABLE | system | |
| `signed_by_employee_at` | timestamptz NULLABLE | system | |
| `signed_by_employer_at` | timestamptz NULLABLE | system | |
| `pdf_url` | text NULLABLE | system | snapshot av generert PDF |
| `created_at`, `updated_at` | timestamptz | system | |

**Constraints:**

- Kun én aktiv `main`-kontrakt per profil (partial unique index på `profile_id` WHERE `employment_role = 'main' AND contract_status = 'active'`)
- `end_date` påkrevd hvis `employment_form = 'temporary'`
- `monthly_salary` eller `hourly_rate` påkrevd basert på `remuneration_type`
- `superseded_by_contract_id` kun satt hvis `contract_status = 'superseded'`

### 3.3 `employee_payroll_profile`

1:1 med `profile`. Live-objekt, ikke snapshot.

Eksisterende felt + nye fra brainstorm:

| Felt | Type | Klasse (ADR-0001) |
|---|---|---|
| `salary_type`, `tariff_category`, `agreed_weekly_hours` | (eksisterende) | — |
| `sector_experience_years`, `has_fagbrev`, `seniority_start_date` | (eksisterende) | MATERIAL (seniority) |
| `tariff_override_id` | (eksisterende) | — |
| `payday_regular` | smallint (1–31) | ADMIN |
| `holiday_allowance_pct` | numeric(4,2) | ADMIN |
| `extra_holiday_week` | boolean | ADMIN |
| `tax_table_number` | text | DERIVED |
| `tax_card_type` | enum (`percentage` / `table` / `freecard`) | DERIVED |
| `tax_percentage` | numeric(4,2) NULLABLE | DERIVED |
| `tax_card_fetched_at` | timestamptz NULLABLE | SYSTEM |
| `pension_scheme_id` | uuid FK NULLABLE | ADMIN |
| `pension_opt_out` | boolean | ADMIN (ansatt-initiert) |
| `trade_union_member` | boolean | ADMIN |
| `trade_union_fee_amount` | numeric(10,2) NULLABLE | ADMIN |
| `employee_number` | text NULLABLE | ADMIN |
| `tripletex_employee_id` | integer NULLABLE | SYSTEM |
| `sync_status` | enum | SYSTEM |
| `last_synced_at` | timestamptz NULLABLE | SYSTEM |

**Merknad PII:** `tax_table_number` og `personal_number` (på profile) er sensitive. Row-level security må begrense til admin med "payroll_admin"-rolle. Audit-log på all lese-aksess.

### 3.4 `contract_pay_rule`

Lønns-regler per kontrakt. Tripletex `salaryType`-aligned.

| Felt | Type | Notat |
|---|---|---|
| `id` | uuid PK | |
| `contract_id` | uuid FK | |
| `rule_type` | enum | `base` / `overtime` / `supplement` / `tip` / `commission` / `other` |
| `salary_type_code` | enum FK → `salary_type` | låst mot Tripletex-enum-tabell |
| `trigger_condition` | jsonb | f.eks. `{"time_range": "18:00-22:00", "day_type": ["weekday"]}` |
| `rate_type` | enum | `percent_of_base` / `fixed_per_hour` / `fixed_per_shift` / `fixed_amount` |
| `rate_value` | numeric(10,4) | |
| `source_text` | text | f.eks. "Riksavtalen §3.2" — vist til ansatt |
| `framework_rule_id` | uuid FK NULLABLE | versjonert peker (ikke JSONB-snapshot) |
| `effective_from` | date | |
| `effective_until` | date NULLABLE | |
| `created_at`, `updated_at` | timestamptz | |

**Index:** `(contract_id, rule_type, effective_from)` for raskt lookup ved shift-evaluering.

**Trigger-condition shape — versjonsstyrt JSON:**
```json
{
  "version": 1,
  "time_range": "18:00-22:00",
  "day_type": ["weekday"],
  "min_shift_hours": 4,
  "stacks_with": ["weekend_supplement"]
}
```

Validering via JSON-schema lagret separat. Endring i schema = ny version + migrasjon.

### 3.5 `contract_tip_rule`

Egen tabell — tips har distinkt distribusjons-mekanikk som ikke passer i pay_rule.

| Felt | Type | Notat |
|---|---|---|
| `id` | uuid PK | |
| `contract_id` | uuid FK | |
| `distribution_method` | enum | `per_shift_hours` / `per_position` / `fixed_percentage` / `pool` |
| `tip_share` | numeric(3,2) | 0.00–1.50 (ikke enum — ADR-0001 critique) |
| `tip_share_modifier` | text NULLABLE | f.eks. "trial_period_reduced" — sporbart hvorfor share avviker |
| `tip_pool_id` | uuid NULLABLE | hvis `distribution_method = 'pool'` |
| `taxable` | boolean DEFAULT true | A-melding-kompatibel |
| `reporting_method` | text | A-melding-kode 911 typisk |
| `effective_from` | date | |
| `effective_until` | date NULLABLE | |

### 3.6 `contract_obligation`

Operasjonelle forpliktelser — lag 2 i 3-lagsmodellen.

| Felt | Type | Notat |
|---|---|---|
| `id` | uuid PK | |
| `contract_id` | uuid FK | |
| `obligation_type` | enum | `training_required` / `certification_required` / `activity_required` / `attendance_required` |
| `policy_id` | uuid FK NULLABLE | governance-policy som *definerer* kravet |
| `protocol_id` | uuid FK NULLABLE | protocol som *fulfills* kravet |
| `due_within_days` | smallint NULLABLE | frist fra start_date |
| `is_blocker` | boolean DEFAULT false | true = kan ikke jobbe shift før fullført |
| `reference_text` | text | norsk: "Ifølge §3 i kontrakt skal du fullføre HMS-opplæring innen 14 dager" |
| `status` | enum | `pending` / `in_progress` / `completed` / `overdue` / `waived` |
| `started_at`, `completed_at`, `waived_at` | timestamptz NULLABLE | |
| `waived_reason` | text NULLABLE | krever admin-rolle |

**Viktig avgrensning:** Aktivitetskrav som "logge inn 2 ganger/uke" hører **ikke** hjemme her. Det er KPI/forventning, ikke juridisk forpliktelse. Lag separat `expectation`-tabell hvis behov oppstår.

### 3.7 `contract_amendment`

Sporing av materielle endringer.

| Felt | Type | Notat |
|---|---|---|
| `id` | uuid PK | |
| `contract_id` | uuid FK | |
| `amendment_date` | date | |
| `change_summary` | text | menneskelesbar oppsummering |
| `field_changes` | jsonb | strukturert diff: `[{"field": "monthly_salary", "from": 32000, "to": 34000}]` |
| `requires_resigning` | boolean | kalkulert fra felt-klassifisering |
| `signed_by_employee_at` | timestamptz NULLABLE | |
| `signed_by_employer_at` | timestamptz NULLABLE | |
| `pdf_url` | text NULLABLE | |
| `created_by_user_id` | uuid FK | audit |

### 3.8 `contract_template`

Eksisterer — utvides med:

| Felt | Type | Notat |
|---|---|---|
| `obligations_template` | jsonb | array av obligation-definitions (uten contract_id) |
| `default_pay_rules` | jsonb | array av pay-rule-templates |
| `default_tip_rule` | jsonb NULLABLE | |
| `version` | integer | mal-versjon |
| `superseded_by_template_id` | uuid FK NULLABLE | |

### 3.9 `pension_scheme` (ny)

Workspace-level pensjonsordninger.

| Felt | Type | Notat |
|---|---|---|
| `id` | uuid PK | |
| `workspace_id` | uuid FK | |
| `name` | text | "OTP 2% — Storebrand" |
| `provider` | text | |
| `employer_contribution_pct` | numeric(4,2) | min 2.0 per OTP-loven |
| `employee_contribution_pct` | numeric(4,2) | |
| `is_default` | boolean | |

---

## 4. Komponenter og avhengigheter

### 4.1 Modul-grenser

```
┌────────────────────────────────────────────────────────────┐
│                   Contracts Module                         │
│                                                            │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │ contract-   │   │ payroll-    │   │ obligation- │       │
│  │ service     │   │ profile-    │   │ service     │       │
│  │             │   │ service     │   │             │       │
│  └─────────────┘   └─────────────┘   └─────────────┘       │
│         │                  │                  │            │
│         └──────────┬───────┴──────────────────┘            │
│                    ▼                                       │
│         ┌──────────────────────┐                           │
│         │ amendment-handler    │                           │
│         │ (felt-klassifisering)│                           │
│         └──────────────────────┘                           │
└────────────────────────────────────────────────────────────┘
        │              │                │
        ▼              ▼                ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│ profile     │ │ Tripletex   │ │ Skatteetaten    │
│ (D2)        │ │ (sync)      │ │ (skattekort)    │
└─────────────┘ └─────────────┘ └─────────────────┘
        │              │
        ▼              ▼
┌─────────────┐ ┌─────────────┐
│ shift-      │ │ engine_     │
│ engine      │ │ event       │
│ (overtime,  │ │ (obligation │
│ pay calc)   │ │ enforcement)│
└─────────────┘ └─────────────┘
```

### 4.2 Tjenester

**`contract-service`**
- CRUD på `employment_contract`
- Statusoverganger (draft → active → superseded/terminated)
- Signering-flow + PDF-generering
- Tariff-resolusjon

**`payroll-profile-service`**
- CRUD på `employee_payroll_profile`
- Skatteetaten-integrasjon for skattekort
- Tripletex-sync
- Pensjon, fagforening, feriepenger

**`obligation-service`**
- CRUD på `contract_obligation`
- Status-tracking (pending/in_progress/completed/overdue)
- engine_event ved frist-nær / frist-overskredet
- Blocker-evaluering ved shift-tildeling

**`amendment-handler`**
- Klassifiserer endring som MATERIAL / ADMIN / DERIVED / SYSTEM
- Genererer `contract_amendment`-rad ved MATERIAL
- Trigger re-signering-flow
- Audit-log

### 4.3 Avhengigheter til andre moduler

| Modul | Bruk |
|---|---|
| `profile` (D2) | profile_id som primær FK; tripletex_employee_id |
| `policy` / `protocol` (C4 governance) | obligation pekere |
| `role_capability` (I1) | baseline-arv ved mal-opprettelse |
| `framework_rule` | versjonert snapshot for pay_rule |
| `engine_event` | obligation-status, amendment-trigger, frist-varsler |
| `shift-engine` | leser pay_rule + overtime_cap |
| `tariff` | tariff_id på kontrakt |
| `pdf-renderer` | genererer kontrakt-PDF fra strukturert data |

---

## 5. Nøkkelflyt

### 5.1 Opprette kontrakt

1. Admin velger ansatt + mal i drawer (2 steg, ikke 5)
2. `contract-service.compose(profile_id, template_id)`:
   - Henter mal
   - Kopierer §14-6-felt + tariff-baseline
   - Genererer `contract_obligation`-rader fra `obligations_template`
   - Genererer `contract_pay_rule`-rader fra `default_pay_rules`
   - Setter `contract_status = 'draft'`
3. Admin redigerer i preview (lønn, prosent, custom obligations)
4. `contract-service.send_for_signing(contract_id)`:
   - Lønnsprofil må eksistere (auto-opprettes hvis ikke)
   - PDF genereres fra strukturert data
   - Status: `draft` → `pending_signature`
5. Ansatt signerer i app
6. Status: `pending_signature` → `active`
7. Engine_event publiseres: `contract.activated`
8. Sync-job pusher til Tripletex

### 5.2 Signering

Signering = ansatt commit'er til operasjonelle regler, ikke bare leser tekst (P1).

- Ansatt ser strukturerte fakta i app, ikke PDF som primær view
- Eksplisitt aksept av:
  - §14-6 minimum
  - Liste over obligations med frister
  - Tariff og pay-rules
- PDF lastes ned hvis ønsket
- BankID eller intern e-signering (avhengig av workspace-config)
- Begge signaturer (employer + employee) kreves før `active`

### 5.3 Amendment

1. Admin redigerer felt i UI
2. `amendment-handler.classify_change(field, old_value, new_value)` returnerer klasse
3. Hvis MATERIAL:
   - `contract_amendment`-rad opprettes med `requires_resigning = true`
   - Endringer holdes i pending-state, ikke applisert på live kontrakt
   - Ansatt får varsel: "Forslag til kontrakts-endring"
   - Ved aksept: endringer applies + ny PDF genereres
   - Ved avslag: amendment markeres `rejected`, kontrakt uendret
4. Hvis ADMIN:
   - Endring applies direkte
   - `contract_amendment`-rad opprettes med `requires_resigning = false` (audit)
   - Ansatt informeres via varsel, ikke krever consent
5. Hvis DERIVED:
   - Direkte oppdatering, ingen amendment-rad (kommer fra ekstern kilde)
6. Hvis SYSTEM:
   - Audit-log, ingen synlighet for ansatt

### 5.4 Endring av stilling (eksempel på sammensatt amendment)

Stillingsendring trigger flere MATERIAL-felt samtidig: `job_title`, ofte `monthly_salary`, ofte `tariff_id`, ofte nye obligations.

**Flow:**
- Admin starter "endre stilling"-flow (egen knapp, ikke fri felt-redigering)
- System gir to alternativer:
  - **(a) Amendment** — samme kontrakt, oppdaterte felt, ansatt re-signerer
  - **(b) Ny kontrakt** — gammel termineres, ny opprettes; brukes ved store endringer (f.eks. trainee → fast)
- Default: (a) hvis stilling er innen samme tariff og prosent uendret; (b) ellers
- Ved (b): `superseded_by_contract_id` settes på gammel; obligations migreres ikke automatisk

### 5.5 Terminering

1. Admin klikker "Si opp" eller ansatt initierer
2. System krever `end_date_reason` (A-melding-kode)
3. `notice_period_months` evalueres → faktisk siste arbeidsdag
4. Engine_event: `contract.termination_initiated`
5. Outstanding obligations: hva skjer? Konfigurerbart per workspace:
   - Slett (default for fjernede ansatte)
   - Behold som overdue (audit)
   - Waive med begrunnelse
6. Ved siste arbeidsdag: `contract_status = 'terminated'`
7. A-melding-rapport genereres (ekstern modul)

### 5.6 Obligation enforcement

To enforcement-punkter:

**Ved shift-tildeling:**
- Shift-engine spør `obligation-service.is_employee_blocked(profile_id)`
- Service sjekker alle aktive kontrakter for `is_blocker = true AND status IN ('pending', 'overdue')`
- Hvis blokker: shift kan ikke tildeles, melding til admin med kontrakt-referanse

**Ved frist-overgang:**
- Daglig cron eller engine-tick
- Obligations med `due_at < now() AND status = 'pending'` → status `overdue`
- Engine_event: `obligation.overdue` med kontrakt + ansatt + tekst
- Botsson kan referere: "Ifølge kontrakt din skulle X være fullført innen Y"

### 5.7 Lønns-evaluering ved shift

Cross-modul (Contracts → Shift-engine):

1. Shift starter/lukkes
2. Shift-engine henter alle aktive `contract_pay_rule` for ansatt
3. Filtrerer på `effective_from <= shift_date AND effective_until IS NULL OR > shift_date`
4. Evaluerer `trigger_condition` mot shift-data
5. Stacker satser hvor `stacks_with` tillater
6. Validerer mot overtime-cap (hybrid, ADR D3)
7. Skriver til `shift_pay_calculation` (egen tabell, audit-trail 5 år)
8. Botsson kan svare: "Du tjente X på vakt Y — fordi Z (ifølge contract_pay_rule rule_id ABC, kilde: Riksavtalen §3.2)"

---

## 6. Cascade-coupling

Contracts-modulen *populerer* eksisterende cascade-dimensjoner — ingen ny cascade-mekanikk.

| Cascade-lag | Konsumerer fra Contracts |
|---|---|
| **D2 Resource** | profile har 1..n aktive kontrakter; aggregering av agreed_weekly_hours |
| **D4 Demand** | employment_percentage påvirker hour-budget per ansatt |
| **D6 Production** | shift-evaluering henter pay_rule + tip_rule |
| **C1 Calibration** | KPI-mål bundet til employment_percentage |
| **C3 Commercial** | shift-cost = pay_rule-beregning |
| **C4 Governance** | trial_period-flagg + obligation-blocker begrenser autonomi |
| **K1b Memory** | Botsson refererer kontrakt-felt og obligations |

---

## 7. Eksterne integrasjoner

### 7.1 Tripletex (push)

- Smartout master (D1)
- Push ved: kontrakt-aktivering, lønnsprofil-endring, ansatt-opprettelse
- Sync-status pr. entitet
- Reconciliation-pull ukentlig for å oppdage drift
- Konflikt-håndtering: Smartout vinner, men admin varsles om divergens

### 7.2 Skatteetaten (pull)

- **Go-live blocker** for produksjon
- Skattekortforespørsel-API (sertifisering kreves)
- Pull årlig (januar) per ansatt + on-demand ved ny ansettelse
- Cache i `employee_payroll_profile.tax_*` med `tax_card_fetched_at`
- Failed lookup: admin-varsel, ikke blokkering av lønn (bruk forrige kort + flag)

### 7.3 A-melding (push)

- Egen modul, ikke direkte i Contracts
- Contracts leverer kildedata via stable API: stilling, lønn, opphør, koder
- A-melding-modul rapporterer månedlig

### 7.4 BankID / e-signering

- Workspace-konfigurert leverandør
- Returnerer signert PDF + audit-bevis
- Signed_at-felt populeres ved callback

---

## 8. Compliance og audit

**Bokføringsloven (5 års lagring):**
- `shift_pay_calculation` (egen modul, ikke contracts)
- `contract_amendment` audit-trail
- All sletting er soft-delete; hard delete kun etter 5 år

**§14-6:**
- Validation gate ved kontrakt-aktivering: alle påkrevde felt utfylt
- PDF inkluderer alle §14-6-punkter selv om ikke alle er endret
- Endringer post-juli 2024-revisjon dekkes (break_minutes, training_rights, variable_hours_arrangement)

**Personopplysningsloven / GDPR:**
- `personal_number` og `tax_table_number` row-level security
- Audit-log på lese-aksess
- Data-portabilitet: ansatt kan eksportere alle egne kontrakts-data
- Sletting ved offboarding: anonymisering etter 5 år, ikke før

**Aml. §10-6 (overtid):**
- Engine eier juridiske tak (D3 hybrid)
- Kontrakt-override valideres mot absolutte lov-grenser

---

## 9. Sikkerhet og PII

| Felt | Sensitivitet | Tilgang |
|---|---|---|
| `personal_number` | Høy | payroll_admin + ansatt selv |
| `tax_*` | Høy | payroll_admin + ansatt selv |
| `bank_account` | Høy | payroll_admin + ansatt selv |
| `monthly_salary` / `hourly_rate` | Medium | manager + payroll_admin + ansatt selv |
| `tip_share` | Medium | manager + ansatt selv |
| `obligations` | Lav | manager + ansatt selv |
| `job_title` / start_date | Lav | workspace |

Row-level security i Postgres. Tilleggs-audit på alle leser av "Høy"-felt.

---

## 10. Performance og skalering

- `contract_obligation` kan vokse stort (mange obligations × mange ansatte). Index på `(profile_id, status, due_at)` for blocker-sjekk
- Shift-evaluering må være rask: pay_rule lookup via `(contract_id, rule_type, effective_from)` index, cache aktive kontrakter per ansatt i memory
- Reconciliation-pull fra Tripletex: paginate, ikke last alle ansatte i én query
- PDF-generering: async job, ikke blokker UI

Forventet skala (estimat):
- 10 000 ansatte × 1.2 aktive kontrakter snitt = 12 000 kontrakter
- 12 000 × 8 obligations snitt = 96 000 obligation-rader
- 12 000 × 5 pay-rules snitt = 60 000 pay-rule-rader
- Lønnskjøring: ~50 000 shift-pay-calculation-rader/måned (ved 5 vakter/ansatt)

Innenfor enkel Postgres-skalering. Ingen sharding påkrevd nær fremtid.

---

## 11. Test-strategi

**Unit:**
- Felt-klassifisering (alle felt, alle endringer)
- Trigger-condition evaluering (pay_rule)
- Tip-share modifier-resolusjon

**Integrasjons:**
- Kontrakt-opprettelse end-to-end (mal → signering → aktivering)
- Amendment-flow (alle MATERIAL-felt)
- Obligation-blocker ved shift-tildeling
- Multi-contract-aggregering (D2)

**Compliance:**
- §14-6 fullstendighetstest (alle påkrevde felt validert)
- A-melding-kode-mapping (end_date_reason)
- Overtime-cap-validering (kontrakt-override innen lov-grenser)

**Property-based:**
- Pay-rule stacking-orden
- Snapshot-konsistens (signert kontrakt = uendret felt-verdier over tid)

---

## 12. Åpne spørsmål

1. **Skatteetaten-integrasjon**: leverandør-valg og sertifiseringsløype
2. **Riksavtalen-versjonering**: når tariff reforhandles, hvordan migreres aktive `contract_pay_rule`?
3. **Prøvetid-pause** ved sykefravær (Aml. §15-6 4. ledd) — automatisk eller manuell?
4. **Lærlinge-kontrakter** (Opplæringsloven kap. 4) — egen ADR senere
5. **`shift_pay_calculation`** — egen modul-arkitektur kreves før Botsson-løftet kan oppfylles
6. **Multi-arbeidsgiver-deling** av kontrakts-data — hvis konsern bytter ansatt mellom selskaper
7. **Engine-default for overtime-cap** — workspace-nivå eller tariff-nivå som primær?

---

## Referanser

- ADR-0001: Kontrakt og lønnsprofil — fundamentale valg
- Tripletex API: `/v2/employee`, `/v2/salary/type`
- Aml. (Arbeidsmiljøloven) §14-6, §10-6, §15-6
- Bokføringsloven §13
- A-meldingforskriften
- OTP-loven