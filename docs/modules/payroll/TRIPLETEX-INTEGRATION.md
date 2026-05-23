---
title: Tripletex Integration Reference — Smartout Payroll Engine
status: archived
created: 2026-05-06
updated: 2026-05-23
module: payroll
tags: [tripletex, payroll, integration, A-melding, lønn, API]
superseded_by: docs/domains/payroll/
---
> Archived 2026-05-23 — see [payroll domain](../../domains/payroll/).


# Tripletex Integration Reference — Smartout Payroll Engine

> Ground truth for syncing Smartout payroll calculations to Tripletex. Cite facts with source; mark unverified sections explicitly. Never fabricate field names.

> **VERIFIED 2026-05-06 update — critical findings:**
> 1. Tripletex has **NO built-in Riksavtalen rate tables** (HIGH confidence). Workspace must seed supplement amounts manually + update on every Riksavtalen revision.
> 2. SalaryType `number` codes are **company-configurable strings**, not platform-wide standards (HIGH). Only the 2005–2008 OT codes are standard across accounts.
> 3. The kveld/natt/helg/helligdag codes (1020-1023) listed below ARE UNVERIFIED placeholders. They DO NOT appear in any public Tripletex documentation. Workspace integration setup MUST run `GET /salary/type` against the live Tripletex account to discover actual codes.
> 4. Tripletex does **NOT auto-bucket** shift hours into evening/night/weekend categories (HIGH). Smartout must push pre-computed `SalarySpecification` lines per SalaryType.
> 5. The three Riksavtalen natt-categories (nattvakt 42.41 / manuelt 24.01 / øvrige 56.02) require **THREE separate Tripletex SalaryTypes** — not one generic with rate-as-variable. A-melding `loennsbeskrivelse` is configured per-SalaryType in Tripletex GUI, not via API.
> 6. A-melding `inntektsbeskrivelse` for variable supplements is mostly `uregelmessigLoenn` (MEDIUM-HIGH) — no separate field per supplement-type from API perspective. Tripletex GUI configures the mapping.
> 7. Open question (UNVERIFIED until sandbox access): does Tripletex pre-populate three nattillegg SalaryTypes, or expect workspace to create them?

**API base URL (production):** `https://tripletex.no/v2`
**API base URL (test):** `https://api-test.tripletex.tech/v2`
**OpenAPI spec:** `https://tripletex.no/v2/openapi.json`
**Interactive docs (prod):** `https://tripletex.no/v2-docs/`
**Interactive docs (test):** `https://api-test.tripletex.tech/v2-docs/`

---

## 1. Authentication

### Model — Three-Token Chain

Tripletex uses Basic Authentication with a three-token chain. Source: [developer.tripletex.no/docs/documentation/authentication-and-tokens/](https://developer.tripletex.no/docs/documentation/authentication-and-tokens/)

| Token | Created by | Scope |
|---|---|---|
| `consumerToken` | Tripletex grants after API registration | Identifies the integration application, shared across all customers |
| `employeeToken` | Customer admin creates in GUI (Brukerinnstillinger → API-tilgang) | Per-customer access with configurable entitlements |
| `sessionToken` | Developer calls `PUT /token/session/:create` | Short-lived, used as password in Basic Auth |

### Creating a Session Token

```
PUT /token/session/:create
  ?consumerToken=<consumerToken>
  &employeeToken=<employeeToken>
  &expirationDate=<YYYY-MM-DD>
```

The response contains the `sessionToken`. No Authorization header is needed for this call.

**Token lifetime:** Expires at midnight CET on the specified `expirationDate`. Maximum expiry is implementation-dependent — set it to the end of the current integration session, not indefinitely far in the future. No refresh endpoint exists; create a new session token when the old one expires.

### Basic Auth Format

```
Authorization: Basic base64(<companyId>:<sessionToken>)
```

- `companyId = 0` — access the employee's own company
- `companyId = <clientId>` — accountant token accessing a client's company
- To list accessible clients: `GET /company/>withLoginAccess`

### Environment Separation

Tokens are environment-scoped. Test credentials **never** work in production, and vice versa.

| Environment | Base URL | Account creation |
|---|---|---|
| Test | `api-test.tripletex.tech` | Self-service, free |
| Production | `tripletex.no` | Form submission, 2–3 weeks approval |

### Production Access

Submit the production access application form. Approval includes a consumer token and application name. Commercial integrations needing a production test account should contact Tripletex after receiving the consumer token.

To appear in the customer's "Create token" dropdown (recommended for partners): submit API methods list to developer support after production approval.

---

## 2. Core Entities Relevant for Payroll Sync

### Employee — `/employee`

Maps to Smartout `profile` + `user_identity`.

| Tripletex field | Type | Notes |
|---|---|---|
| `id` | Integer | Tripletex internal ID — store this in Smartout |
| `employee_number` | String | Employer-assigned number |
| `first_name` | String | Required |
| `last_name` | String | Required |
| `national_identity_number` | String | Fødselsnummer — required for A-melding |
| `dnumber` | String | D-nummer for foreign nationals without fnr |
| `date_of_birth` | String | ISO date |
| `email` | String | For system access |
| `phone_number_mobile` | String | |
| `bank_account_number` | String | For salary disbursement |
| `user_type` | String | `STANDARD`, `EXTENDED`, `NO_ACCESS` |
| `allow_information_registration` | Boolean | Must be `true` for hours/expense registration |
| `department` | Department ref | Department assignment |
| `employments` | Array\<Employment\> | One or more employment relationships |

Source: [github.com/sveredyuk/tripletex_ruby/blob/master/docs/Employee.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/Employee.md)

### Employment — `/employee/employment`

Maps to Smartout `employment_contract`.

| Tripletex field | Type | Notes |
|---|---|---|
| `id` | Integer | |
| `employee` | Employee ref | Parent employee |
| `employment_id` | String | External employment ID from previous system |
| `start_date` | String | **Required**. ISO date |
| `end_date` | String | ISO date, null if ongoing |
| `division` | Integer | |
| `last_salary_change_date` | String | ISO date |
| `employment_details` | Array\<EmploymentDetails\> | Employment type + rate, see below |

Source: [github.com/sveredyuk/tripletex_ruby/blob/master/docs/Employment.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/Employment.md)

### EmploymentDetails — `/employee/employment/details`

One employment can have multiple detail records representing changes over time (e.g. position % change, rate change).

| Tripletex field | Type | Notes |
|---|---|---|
| `id` | Integer | |
| `employment` | Employment ref | |
| `date` | String | Effective date of this detail record |
| `employment_type` | Integer | Lookup: `GET /employee/employment/employmentType` |
| `remuneration_type` | Integer | Lookup: `GET /employee/employment/remunerationType` — fastlønn, timelønn, etc. |
| `working_hours_scheme` | Integer | Lookup: `GET /employee/employment/workingHoursScheme` |
| `occupation_code` | Integer | STYRK-08 code. Lookup: `GET /employee/employment/occupationCode` |
| `percentage_of_full_time_equivalent` | Float | **Required**. E.g. `100.0` for full-time, `50.0` for half-time |
| `annual_salary` | Float | NOK, for monthly-salaried employees |
| `hourly_wage` | Float | NOK per hour, for hourly employees |

Source: [github.com/sveredyuk/tripletex_ruby/blob/master/docs/EmploymentDetails.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/EmploymentDetails.md)

### SalaryType (Lønnsart) — `/salary/type`

The central concept. Each line on a payslip references one SalaryType.

| Tripletex field | Type | Notes |
|---|---|---|
| `id` | Integer | Tripletex internal ID |
| `number` | String | The lønnsartnummer (e.g. "2001") |
| `name` | String | Human-readable name in Norwegian |
| `description` | String | Longer description |

**Note:** The public API model exposes only `number`, `name`, `description`. The A-melding mapping (loennsbeskrivelse, inntektstype) and tax treatment settings are configured within Tripletex GUI and are NOT directly settable via API. Custom salary types are configured per-company; standard types are pre-populated. Source: [github.com/sveredyuk/tripletex_ruby/blob/master/docs/SalaryType.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/SalaryType.md)

### SalaryTransaction — `/salary/transaction`

A payroll run. One SalaryTransaction per pay period covers all employees. Contains one Payslip per employee.

| Tripletex field | Type | Notes |
|---|---|---|
| `id` | Integer | |
| `date` | String | Voucher date (lønnsbilagsdato) |
| `year` | Integer | **Required** |
| `month` | Integer | **Required** (1–12) |
| `payslips` | Array\<Payslip\> | One per employee |

Source: [github.com/sveredyuk/tripletex_ruby/blob/master/docs/SalaryTransaction.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/SalaryTransaction.md)

### Payslip — `/salary/payslip`

One Payslip per employee within a SalaryTransaction.

| Tripletex field | Type | Notes |
|---|---|---|
| `id` | Integer | |
| `employee` | Employee ref | **Required** |
| `transaction` | SalaryTransaction ref | |
| `date` | String | Voucher date |
| `year` | Integer | |
| `month` | Integer | |
| `gross_amount` | Float | Before deductions |
| `amount` | Float | Net payment amount |
| `vacation_allowance_amount` | Float | Accrued feriepenger |
| `specifications` | Array\<SalarySpecification\> | The line items |

Source: [github.com/sveredyuk/tripletex_ruby/blob/master/docs/Payslip.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/Payslip.md)

### SalarySpecification — line items within a Payslip

| Tripletex field | Type | Notes |
|---|---|---|
| `id` | Integer | |
| `salary_type` | SalaryType ref | **Required** — the lønnsart |
| `rate` | Float | **Required** — hourly rate or unit rate in NOK |
| `count` | Float | **Required** — number of hours or units |
| `amount` | Float | Total = rate × count (computed or override) |
| `description` | String | Line item text |
| `project` | Project ref | Optional project allocation |
| `department` | Department ref | Optional department |
| `payslip` | Payslip ref | Parent payslip |
| `employee` | Employee ref | |
| `year` | Integer | |
| `month` | Integer | |

Source: [github.com/sveredyuk/tripletex_ruby/blob/master/docs/SalarySpecification.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/SalarySpecification.md)

### TaxCard (Skattekort) — `/employee/taxCard` (UNVERIFIED — endpoint path not confirmed via public docs)

Tax cards are retrieved automatically from Skatteetaten via Tripletex's Altinn integration. Manual entry is also possible via GUI (Lønn → Skattekort).

| Tripletex field | Likely type | Notes |
|---|---|---|
| `employee` | Employee ref | |
| `year` | Integer | Tax year |
| `deduction_type` | Enum | `TABLE` (tabelltrekk) or `PERCENT` (prosenttrekk) |
| `table_number` | String | E.g. "7100" — tax table |
| `percentage` | Float | Used when deduction_type = PERCENT |
| `non_taxable_amount` | Float | Fribeløp |

**UNVERIFIED:** Specific field names need confirmation via the OpenAPI spec at `https://tripletex.no/v2/openapi.json`. The GUI flow is documented at [hjelp.tripletex.no](https://hjelp.tripletex.no/hc/no/articles/19223314124689).

### WorkingHoursScheme — `/employee/employment/workingHoursScheme`

Lookup endpoint returning enumerated working hour schemes. UNVERIFIED — specific enum values require authenticated API call.

### Department — `/department`

| Field | Notes |
|---|---|
| `id` | Tripletex ID — store for cost-centre routing |
| `name` | Department name |
| `department_number` | String identifier |

### TimesheetEntry — `/timesheet/entry`

The hours source. Used if Smartout pushes actual hours to Tripletex before the salary run.

| Field | Type | Notes |
|---|---|---|
| `activity` | Activity ref | **Required** |
| `date` | String | **Required** ISO date |
| `hours` | Float | **Required** |
| `chargeable_hours` | Float | **Required** |
| `employee` | Employee ref | **Required** |
| `project` | Project ref | Optional |
| `comment` | String | |
| `locked` | Boolean | Locked entries cannot be edited |

Source: [github.com/sveredyuk/tripletex_ruby/blob/master/docs/TimesheetEntry.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/TimesheetEntry.md)

---

## 3. Lønnsart-koder (Salary Type Codes)

**Important context:** Tripletex lønnsart codes are company-configurable, not a fixed national standard. The `number` field is a string that the Tripletex account admin controls. However, Tripletex pre-populates new accounts with a standard set. The codes below reflect the Tripletex standard template and Norwegian payroll conventions for hospitality (overenskomsten for hotell og restaurant, NAF/NHO).

**UNVERIFIED — canonical complete list:** The full pre-populated list requires an authenticated `GET /salary/type` call on a standard Tripletex account. The codes below are compiled from search results, community documentation, and Norwegian payroll conventions. Verify against your customer's actual account before hardcoding.

### Standard Lønnsart Koder — Hospitality-Relevant

| Kode | Navn (NO) | Kategori | Typical Use | A-melding loennsbeskrivelse |
|---|---|---|---|---|
| 1001 | Fastlønn | Grunnlønn | Monthly fixed salary — full or part-time | `fastloenn` |
| 1002 | Timelønn | Grunnlønn | Hourly wage — rate × hours worked | `timeloenn` |
| 1003 | Akkordlønn | Grunnlønn | Piece-rate / contract work | `akkordloenn` |
| 1010 | Provisjon | Grunnlønn | Commission/provision (e.g. banquet sales) | `loennProvisjon` |
| 1020 | Ulempetillegg kveld | Tillegg | Evening supplement (typically 17:00–21:00 or 21:00–06:00 per tariff) | `ulempetilelggKveld` |
| 1021 | Ulempetillegg natt | Tillegg | Night supplement | `ulempetilelggNatt` |
| 1022 | Helgetillegg | Tillegg | Weekend supplement (lørdag/søndag) | `loennTilleggHelg` |
| 1023 | Helligdagstillegg | Tillegg | Public holiday supplement | `loennTilleggHelligdag` |
| 1030 | Turnustillegg | Tillegg | Rotating shift supplement | — |
| 1040 | Ansiennitetstillegg | Tillegg | Seniority increment | `fastloenn` |
| 2001 | Feriepenger | Ferie | Holiday pay — typically 10.2% or 12% of basis | `feriepenger` |
| 2002 | Trekk for ferie | Ferie | Deduction for vacation days taken (monthly salaried) | `trekkILoennForFerie` |
| 2005 | Overtidstillegg | Overtid | Overtime supplement (general) | `overtidsloenn` |
| 2006 | Overtid 40% tillegg | Overtid | 40% overtime premium (first 10 OT hours/week, NHO Reiseliv) | `overtidsloenn` |
| 2007 | Overtid 50% tillegg | Overtid | 50% overtime premium (standard arbeidsmiljøloven) | `overtidsloenn` |
| 2008 | Overtid 100% tillegg | Overtid | 100% overtime premium (sundays/helligdager, or tariff special) | `overtidsloenn` |
| 3001 | Skattetrekk | Trekk | Tax withholding (generated automatically by Tripletex) | — |
| 3002 | Forskuddstrekk prosentvis | Trekk | Percentage tax deduction | — |
| 3010 | Trekk for fagforeningskontingent | Trekk | Union dues deduction | `fagforeningskontingent` |
| 3020 | Trekk for kost og losji | Trekk | Board and lodging deduction | — |
| 3030 | Trekk for andre utlegg | Trekk | Other deductions | — |
| 3050 | Trekk for forskudd | Trekk | Deduction for advances paid | — |
| 4001 | Sykepenger refusjon NAV | Refusjon | NAV sickness benefit refund | `sykepenger` |
| 4002 | Foreldrepenger refusjon NAV | Refusjon | NAV parental leave refund | `foreldrepenger` |
| 5001 | Naturalytelse kost | Naturalytelse | Subsidized meals (taxable benefit) | `kostBesoek` |
| 5002 | Fri telefon/internett | Naturalytelse | Company phone/internet benefit | `elektroniskKommunikasjon` |
| 5003 | Fri bil | Naturalytelse | Company car benefit | `bilOgBaat` |
| 5010 | Drikkepenger (tips) | Naturalytelse/Tillegg | Tips — taxable, must be reported on A-melding | `loennTilleggTips` |
| 6001 | Arbeidsgiveravgift-basis | Intern | Employer NI contribution basis (auto-calculated) | — |
| 6002 | Syke-/feriepengegrunnlag | Intern | Basis for sick pay and holiday pay accrual | — |

**Sources on actual code numbers:**
- Codes 2005–2008 (overtid) confirmed via Tripletex help search results referencing "2005 Overtime Allowance, 2006 Overtime 40%, 2007 Overtime 50%, 2008 Overtime 100%". Source: help.recman.io + search results.
- All other codes in the 1xxx/3xxx/4xxx/5xxx ranges are **UNVERIFIED** — reconstructed from Norwegian payroll conventions and Tripletex UI descriptions. Verify with `GET /salary/type` on a live account before mapping.

### Tips (Drikkepenger) — Special Handling

Tips reported via electronic payment (Vipps, card) must be reported on A-melding as income for the employee. Cash tips are technically the employee's own responsibility but common practice is to include via a lønnsart. In Tripletex, tips are typically entered as a custom lønnsart with `loennsbeskrivelse = "loennTilleggTips"` or similar. UNVERIFIED — confirm with Tripletex support for authoritative handling.

---

## 4. A-melding Integration via Tripletex

### How Tripletex Generates and Sends A-melding

Tripletex has a direct Altinn integration. After a lønnskjøring (salary run) is completed:

1. Employee income, tax withholdings, and employer contributions are auto-populated into the A-melding.
2. The A-melding is submitted to Skatteetaten/NAV/SSB monthly — deadline 5th of the following month.
3. One click sends the A-melding for all employees simultaneously.
4. Tripletex also retrieves electronic tax cards from Skatteetaten via this same Altinn connection.

Source: [tripletex.no/fagblogg/lonn/alt-du-trenger-aa-vite-om-a-meldingen/](https://www.tripletex.no/fagblogg/lonn/alt-du-trenger-aa-vite-om-a-meldingen/)

**2026 rule change:** From January 2026, `Forskuddstrekk` and `Utleggstrekk` must be paid to Skatteetaten no later than the first working day after salary disbursement (previously within the accounting period).

### What Fields on SalarySpecification Map to A-melding Income Lines

Each `SalarySpecification` line item becomes one income line in the A-melding:

| A-melding field | Tripletex source |
|---|---|
| `loennsbeskrivelse` | Configured on the lønnsart (SalaryType) in GUI — NOT exposed via API as a field on SalarySpecification |
| `beloep` | `SalarySpecification.amount` |
| `antall` | `SalarySpecification.count` (hours) |
| `sats` | `SalarySpecification.rate` (hourly rate) |
| `skatteOgAvgiftsregel` | Derived from lønnsart configuration |
| Employee fnr/dnr | From `Employee.national_identity_number` / `Employee.dnumber` |
| Employment relationship | From `Employment` record |

### Required Fields for A-melding Generation

For Tripletex to generate a valid A-melding, these must be populated on the employee:

- `national_identity_number` (fnr) or `dnumber`
- `start_date` on Employment
- Valid `employment_type` on EmploymentDetails
- Valid `working_hours_scheme` on EmploymentDetails
- `percentage_of_full_time_equivalent` on EmploymentDetails
- Each lønnsart must have `loennsbeskrivelse` configured (done in GUI, not API)
- Tax card must be active (retrieved from Skatteetaten or entered manually)

### Corrections (Korrigeringer)

To correct a previous A-melding period:
1. In Tripletex: reverse the existing salary run (`Korrigert lønn` flow).
2. Create a new corrected salary transaction for the same `year`/`month`.
3. Tripletex re-submits a corrected A-melding to Altinn.

Via API: DELETE the original SalaryTransaction and POST a new one. The A-melding correction is triggered by Tripletex automatically when the period is re-submitted.

**UNVERIFIED:** Whether DELETE on a submitted transaction triggers automatic A-melding correction or whether a manual re-send is required. Confirm with Tripletex partner support before implementing.

---

## 5. API Endpoints — POST/PUT/GET Pattern for Payroll Sync

### Employee CRUD

```
GET  /employee/{id}                    → Fetch employee by Tripletex ID
GET  /employee?fields=id,employee_number,national_identity_number  → List all
POST /employee                         → Create employee
PUT  /employee/{id}                    → Update employee
```

**POST /employee body (key fields):**
```json
{
  "firstName": "Kari",
  "lastName": "Nordmann",
  "nationalIdentityNumber": "12345678901",
  "employeeNumber": "EMP-042",
  "bankAccountNumber": "1234.56.78901",
  "email": "kari@restaurant.no",
  "allowInformationRegistration": true,
  "department": { "id": 123 }
}
```

### Employment

```
GET  /employee/employment/{id}
GET  /employee/employment?employee_id={id}  → All employments for employee
POST /employee/employment                   → Create [BETA]
PUT  /employee/employment/{id}              → Update [BETA]

POST /employee/employment/details           → Create detail record [BETA]
PUT  /employee/employment/details/{id}      → Update detail
```

**POST /employee/employment body:**
```json
{
  "employee": { "id": 456 },
  "startDate": "2026-01-01",
  "employmentDetails": [
    {
      "date": "2026-01-01",
      "employmentType": 1,
      "remunerationType": 2,
      "workingHoursScheme": 1,
      "percentageOfFullTimeEquivalent": 100.0,
      "hourlyWage": 185.00
    }
  ]
}
```

### SalaryTransaction (Lønnskjøring)

```
POST /salary/transaction                   → Create payroll run
GET  /salary/transaction/{id}              → Retrieve run
DELETE /salary/transaction/{id}            → Reverse/delete run
```

**POST /salary/transaction body:**
```json
{
  "year": 2026,
  "month": 5,
  "date": "2026-05-31",
  "payslips": [
    {
      "employee": { "id": 456 },
      "specifications": [
        {
          "salaryType": { "id": 101 },
          "rate": 185.00,
          "count": 160.5,
          "amount": 29692.50,
          "description": "Timelønn mai 2026"
        },
        {
          "salaryType": { "id": 203 },
          "rate": 92.50,
          "count": 8.0,
          "amount": 740.00,
          "description": "Kveldstillegg mai 2026"
        }
      ]
    }
  ],
  "generateTaxDeduction": true
}
```

**`generateTaxDeduction`**: Set to `true` to have Tripletex auto-compute `Skattetrekk` based on the employee's tax card. Set to `false` if you pass a manual tax deduction specification.

### Payslip

```
GET /salary/payslip/{id}                  → Single payslip
GET /salary/payslip/{id}/pdf              → PDF download
GET /salary/payslip?employee_id={id}&year={y}&month={m}  → Search
```

### SalaryType (Lønnsart)

```
GET /salary/type/{id}                     → Single type [BETA]
GET /salary/type?number={n}&name={name}   → Search [BETA]
```

Use these to look up Tripletex IDs for salary types before creating SalarySpecification lines.

### Timesheet

```
GET  /timesheet/entry?date_from={d}&date_to={d}&employee_id={id}
POST /timesheet/entry                     → Single entry
POST /timesheet/entry/list                → Batch create
PUT  /timesheet/entry/{id}
DELETE /timesheet/entry/{id}
GET  /timesheet/entry/>totalHours?employee_id={id}&start_date={d}&end_date={d}
```

Timesheet entries are the input for hour-based payroll. If Smartout manages the shift/timesheet data, push to Tripletex before running the salary transaction.

### Webhooks / Callbacks

Tripletex supports webhooks via `POST /event/subscription`. **No dedicated payroll events exist.** Employee lifecycle events (`employee.create/update/delete`) are available.

```
POST /event/subscription
{
  "event": "employee.update",
  "targetUrl": "https://api.smartout.ai/webhooks/tripletex",
  "authHeaderName": "X-Smartout-Token",
  "authHeaderValue": "secret"
}
```

Retry: exponential backoff over 30 hours. Subscriptions auto-disable after one week of failures (`DISABLED_TOO_MANY_ERRORS`).

Source: [developer.tripletex.no/docs/documentation/webhooks/](https://developer.tripletex.no/docs/documentation/webhooks/)

---

## 6. Rate Limits + Error Handling

### Rate Limits

**UNVERIFIED — no explicit rate limit numbers found in public documentation.** The FAQ confirms a maximum result set of 10,000 objects per `GET` request. Recommended practice from Tripletex: use webhooks instead of polling, and filter GET requests with date/entity parameters to avoid hitting result limits.

Safe operational assumption: implement exponential backoff starting at 1s on any `429` or `503` response. Check `Retry-After` header if present.

### Error Response Format

All errors follow this envelope. Source: [github.com/Tripletex/tripletex-api2/issues/13](https://github.com/Tripletex/tripletex-api2/issues/13)

```json
{
  "status": 422,
  "code": 18000,
  "message": "Validation failed.",
  "link": "https://www.tripletex.no/tripletex-api-2-0/",
  "developerMessage": null,
  "validationMessages": [
    {
      "field": "organizationNumber",
      "message": "The organization number must consist of 9 numbers..."
    }
  ],
  "requestId": "uuid-here"
}
```

| HTTP Status | Meaning |
|---|---|
| `200` / `201` | Success |
| `400` | Bad request / malformed |
| `401` | Authentication failure |
| `403` | Token lacks entitlement |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate) |
| `422` | Validation failure (`validationMessages` populated) |
| `429` | Rate limit exceeded |

**Log `requestId` always** — required when contacting Tripletex developer support.

### Idempotency

Tripletex does **not** expose an idempotency key header for POST requests. To avoid duplicate transactions:
- Store the Tripletex `id` returned on POST in Smartout immediately.
- Before creating a new SalaryTransaction, `GET /salary/transaction` filtered by `year` + `month` and check for existing records.
- Use `requestId` from error responses for debugging, not deduplication.

### Common Validation Errors

- "An ID cannot be set when creating a new object" — do not include `id` or `version` in POST bodies.
- "Object not found" — the referenced ID does not exist in this company's dataset.
- Sub-object required fields: when referencing an existing object, use only `{ "id": N }` — do NOT re-populate all fields.

Source: [developer.tripletex.no/docs/documentation/faq/general/](https://developer.tripletex.no/docs/documentation/faq/general/)

---

## 7. Data Model Diagram (Tripletex Payroll Subgraph)

```
Employee (1)
  ├── bank_account_number
  ├── national_identity_number
  └── Employment (1..N)
        ├── start_date / end_date
        └── EmploymentDetails (1..N)  ← changes over time
              ├── employment_type
              ├── remuneration_type
              ├── working_hours_scheme
              ├── percentage_of_full_time_equivalent
              ├── annual_salary
              └── hourly_wage

TaxCard (1 per Employee per year)
  ├── deduction_type (TABLE | PERCENT)
  ├── table_number
  └── percentage

SalaryType (global lookup, per company)
  ├── number  (lønnsartkode)
  ├── name
  └── [A-melding loennsbeskrivelse — GUI only]

SalaryTransaction (one per payroll run)
  ├── year
  ├── month
  ├── date (voucher date)
  └── Payslip (1 per Employee)
        ├── gross_amount
        ├── amount (net)
        ├── vacation_allowance_amount
        └── SalarySpecification (1..N lines)
              ├── salary_type → SalaryType
              ├── rate (NOK/unit)
              ├── count (hours/units)
              ├── amount (rate × count)
              ├── department → Department
              └── project → Project

TimesheetEntry (input, pre-salary-run)
  ├── employee
  ├── date
  ├── hours
  └── activity

A-melding (generated by Tripletex, submitted to Altinn)
  ← SalarySpecification lines + Employee fnr + Employment data
```

---

## 8. Smartout → Tripletex Field Mapping

| Smartout Field | Tripletex Target | Notes |
|---|---|---|
| `payroll_calculation_line.salary_code` | `SalarySpecification.salary_type.id` | Lookup Tripletex `SalaryType.id` by `number` matching Smartout's `salary_code`. Store mapping in Smartout. |
| `payroll_calculation_line.amount` | `SalarySpecification.amount` | NOK total for this line |
| `payroll_calculation_line.hours` | `SalarySpecification.count` | Float — hours worked |
| `payroll_calculation_line.rate` | `SalarySpecification.rate` | NOK per hour |
| `payroll_calculation_line.description` | `SalarySpecification.description` | Free text |
| `employee_payroll_profile.tax_table_number` | `TaxCard.table_number` | Read from Skatteetaten via Tripletex; write only if manual override |
| `employee_payroll_profile.tax_deduction_pct` | `TaxCard.percentage` | Only when deduction_type = PERCENT |
| `employee_payroll_profile.holiday_allowance_pct` | Configured on lønnsart for feriepenger | Not a direct API field on EmploymentDetails — set via SalarySpecification with feriepenger lønnsart |
| `employment_contract.hourly_rate` | `EmploymentDetails.hourly_wage` | NOK per hour |
| `employment_contract.monthly_salary` | `EmploymentDetails.annual_salary` ÷ 12 implied | Tripletex stores `annual_salary`, not monthly. Multiply by 12. |
| `employment_contract.start_date` | `Employment.start_date` | ISO date |
| `employment_contract.end_date` | `Employment.end_date` | ISO date or null |
| `employment_contract.position_pct` | `EmploymentDetails.percentage_of_full_time_equivalent` | Float 0–100 |
| `profile.national_id` | `Employee.national_identity_number` | Required for A-melding |
| `profile.display_name` (first/last) | `Employee.first_name` + `Employee.last_name` | |
| `profile.bank_account` | `Employee.bank_account_number` | Norwegian format: NNNN.NN.NNNNN |
| `schedule_shift` planned hours | `TimesheetEntry.hours` | Push shift hours to Tripletex timesheet before salary run; `activity` must be mapped to a Tripletex Activity ID |
| `schedule_shift` actual hours | `TimesheetEntry.hours` | Prefer actual over planned |
| `department.name` | `Department.name` | Match by name or store Tripletex `Department.id` on Smartout `department` |
| Tips / drikkepenger | `SalarySpecification` with tips lønnsart | Create a dedicated lønnsart for tips; map Smartout tip amount to `SalarySpecification.amount` |
| Manual supplement (e.g. kveldstillegg) | `SalarySpecification` with supplement lønnsart | Rate = supplement NOK/hour, count = hours in that category |
| `payroll_period.year` + `payroll_period.month` | `SalaryTransaction.year` + `SalaryTransaction.month` | One-to-one |

---

## 9. Sync Strategy Recommendations

### Push vs Pull per Data Class

| Data Class | Direction | Rationale |
|---|---|---|
| Employee master data (name, fnr, bank) | Push: Smartout → Tripletex | Smartout is the system of record for HR data |
| Employment terms (rate, %, type) | Push: Smartout → Tripletex | Smartout `employment_contract` is authoritative |
| Salary transactions | Push: Smartout → Tripletex | Smartout calculates; Tripletex books and reports |
| Timesheet entries (hours) | Push: Smartout → Tripletex | Smartout `schedule_shift` data is source of truth |
| Tax card | Pull: Tripletex → Smartout (or no sync needed) | Tripletex fetches from Skatteetaten automatically; Smartout reads back if needed |
| SalaryType lookup table | Pull: Tripletex → Smartout (on setup) | Bootstrap mapping once; cache Tripletex IDs in Smartout |
| Department lookup | Pull: Tripletex → Smartout (on setup) | Bootstrap mapping once |
| Payslips / Gross/Net amounts | Pull: Tripletex → Smartout | Tripletex computes final payroll figures after tax |

### Idempotency Keys

No native idempotency header. Use this pattern:

1. Store `tripletex_id` on every synced Smartout entity (`profile.tripletex_employee_id`, `employment_contract.tripletex_employment_id`, `payroll_period.tripletex_transaction_id`).
2. Before any POST, check if `tripletex_id` is already populated → skip or update.
3. On network timeout (no response), immediately GET by external reference to check if creation succeeded before retrying.

### Conflict Resolution

| Situation | Authority |
|---|---|
| Employee personal data (name, fnr) | Smartout wins — push on mismatch |
| Employment rate / position % | Smartout wins — push updates |
| Tax card / deduction type | Tripletex wins — pulled from Skatteetaten |
| Salary type configuration (lønnsart settings) | Tripletex wins — configured in GUI, Smartout must not overwrite |
| Booked payroll (submitted salary transaction) | Tripletex wins — only DELETE+rePOST allowed, never edit-in-place |
| Closed accounting period | Tripletex wins — cannot post to a locked period; Smartout must align `payroll_period` close dates |

### Initial Bootstrap vs Ongoing Delta

**Bootstrap (one-time):**
1. Pull `GET /salary/type` → build `tripletex_salary_type_id` lookup table in Smartout.
2. Pull `GET /department` → build `tripletex_department_id` lookup.
3. POST employees batch → store `tripletex_employee_id` on each profile.
4. POST employment records → store `tripletex_employment_id`.
5. Verify tax cards have been retrieved by Tripletex from Skatteetaten.

**Ongoing delta:**
1. On `employment_contract` change → PUT `/employee/employment/details/{id}`.
2. On new employee → POST `/employee` then POST `/employee/employment`.
3. Monthly payroll: POST `/salary/transaction` with all employee payslips for the period.
4. Subscribe to `employee.update` webhook → pull changes made in Tripletex GUI (e.g. manual tax card entry).

### Period-Lock Alignment

Tripletex locks accounting periods after the period close (`regnskapsperiode`). A POST or DELETE to a SalaryTransaction in a locked period returns an error.

**Smartout rule:** When Tripletex signals a period is locked (API error), mark the corresponding `payroll_period` as `locked = true` in Smartout. Block further sync attempts for that period and require manual operator unlock in Tripletex before correction.

**UNVERIFIED:** The exact API error code/message for a locked period — confirm via testing on sandbox.

---

## 10. Risks + Gotchas

### API Quirks

1. **`token/session/:create` — Postman trap.** Postman interprets `:create` as a variable placeholder. Manually define `create` as a path segment parameter with value `:create`. Source: [Tripletex FAQ](https://github.com/Tripletex/tripletex-api2/blob/master/FAQ.md)

2. **Sub-object ID only.** When referencing an existing Tripletex object in a POST/PUT body (e.g., `salaryType: { id: 5 }`), include ONLY the `id`. Do not re-populate other fields — this causes validation errors.

3. **No `id` on POST body.** Never include `id` or `version` when creating a new object. IDs are system-generated.

4. **Max 10,000 rows per GET.** Result set limit — use date filters and pagination (`from` + `count`) for large datasets. The `count` parameter affects response size but not query scope.

5. **Annual salary, not monthly.** `EmploymentDetails.annual_salary` is the annual figure. Multiply Smartout monthly salary by 12 before sending.

6. **BETA endpoints.** Employment and salary type endpoints are marked BETA — field names or behavior may change without major version bump. Pin to a specific OpenAPI spec version in integration code.

7. **OpenAPI migration (June 2025).** Tripletex migrated from Swagger v2 (`swagger.json`) to OpenAPI v3 (`openapi.json`). Use `https://tripletex.no/v2/openapi.json` as spec source. Old clients using swagger.json may miss new fields.

8. **No dedicated payroll webhooks.** There is no `salary.transaction.create` or `payslip.ready` event. Poll `GET /salary/payslip` if you need to confirm payslip generation after transaction creation.

9. **Salary type `number` is a String, not Integer.** Do not cast to int — leading zeros or non-numeric codes are possible on custom lønnsarter.

10. **`generate_tax_deduction` defaults to `false`.** If you omit it, no tax deduction line is created. Set `true` for normal payroll or pass a manual `Skattetrekk` specification line.

### Field Naming Traps

- `annual_salary` on EmploymentDetails — stores ANNUAL NOK, not monthly. Frequently confused.
- `count` on SalarySpecification — represents hours/units, not a record count.
- `rate` on SalarySpecification — NOK per unit (e.g. NOK/hour), not a percentage.
- `amount` on Payslip — net payment amount (after tax), not gross. Use `gross_amount` for pre-tax total.
- `vacation_allowance_amount` on Payslip — accrued feriepenger balance shown on the payslip, separate from the `Feriepenger` SalarySpecification line (which is the actual payout in the vacation month).
- `employee_number` on Employee — employer-assigned string, not Tripletex's internal `id`. Use internal `id` for API references.

### Period and Timing Risks

- **A-melding submission lock:** After the 5th of each month, the previous period's A-melding has been submitted. Corrections are possible but require explicit re-submission in Tripletex — do not assume a corrected SalaryTransaction auto-sends a corrected A-melding without manual approval.
- **Tax withholding payment deadline (2026):** From January 2026, `Forskuddstrekk` must be paid to Skatteetaten on the first working day after salary disbursement. Smartout `payroll_period` close flow should account for this timeline.
- **Closed accounting period:** Tripletex prevents posting to locked periods. Smartout must detect and surface this error rather than silently failing.

### Known Integration Pitfalls from Community Sources

- **Employees missing fnr/dnumber:** A-melding cannot be generated for employees without a valid Norwegian identity number. Always validate before posting employee record.
- **Employment type lookup values change:** `employmentType`, `remunerationType`, and `workingHoursScheme` are integer enum lookups, not stable strings — their values must be fetched from Tripletex at runtime, not hardcoded.
- **Test environment differences:** Some lønnsarter or employer settings present in production may not exist in the test environment. Test with a realistic account setup.
- **Session token expiry during long jobs:** For batch payroll sync jobs running past midnight CET, session tokens expire. Implement pre-flight token refresh or create a new session token at the start of each job.
- **Fields expanding with `fields=*`:** The default response excludes nested objects. Use `fields=*,payslips(*)` or similar to pull related data in one request instead of N+1 GET calls.

---

## Sources

- [developer.tripletex.no — Authentication and Tokens](https://developer.tripletex.no/docs/documentation/authentication-and-tokens/)
- [developer.tripletex.no — Getting Started](https://developer.tripletex.no/getting-started/)
- [developer.tripletex.no — Webhooks](https://developer.tripletex.no/docs/documentation/webhooks/)
- [developer.tripletex.no — Integration Best Practices](https://developer.tripletex.no/docs/documentation/integration-best-practices/)
- [developer.tripletex.no — FAQ General](https://developer.tripletex.no/docs/documentation/faq/general/)
- [github.com/Tripletex/tripletex-api2](https://github.com/Tripletex/tripletex-api2)
- [github.com/Tripletex/tripletex-api2/blob/master/FAQ.md](https://github.com/Tripletex/tripletex-api2/blob/master/FAQ.md)
- [github.com/sveredyuk/tripletex_ruby — SalaryTransaction.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/SalaryTransaction.md)
- [github.com/sveredyuk/tripletex_ruby — SalarySpecification.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/SalarySpecification.md)
- [github.com/sveredyuk/tripletex_ruby — SalaryType.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/SalaryType.md)
- [github.com/sveredyuk/tripletex_ruby — Payslip.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/Payslip.md)
- [github.com/sveredyuk/tripletex_ruby — Employee.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/Employee.md)
- [github.com/sveredyuk/tripletex_ruby — Employment.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/Employment.md)
- [github.com/sveredyuk/tripletex_ruby — EmploymentDetails.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/EmploymentDetails.md)
- [github.com/sveredyuk/tripletex_ruby — TimesheetEntry.md](https://github.com/sveredyuk/tripletex_ruby/blob/master/docs/TimesheetEntry.md)
- [tripletex.no/fagblogg/lonn/alt-du-trenger-aa-vite-om-a-meldingen/](https://www.tripletex.no/fagblogg/lonn/alt-du-trenger-aa-vite-om-a-meldingen/)
- [skatteetaten.no — The A-melding Guide](https://www.skatteetaten.no/en/business-and-organisation/employer/the-a-melding/the-a-melding-guide/)
- [github.com/Tripletex/tripletex-api2/issues/13](https://github.com/Tripletex/tripletex-api2/issues/13)
- [api-test.tripletex.tech/v2-docs/](https://api-test.tripletex.tech/v2-docs/)
