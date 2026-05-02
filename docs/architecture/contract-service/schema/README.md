# Schema — Contracts Module

Per-table reference DDL for Contracts-modulen. **Disse filene er dokumentasjon, ikke deploy-artefakter.**

For faktisk migrasjon: se `migrations/0001_contracts_module_foundation.sql` (atomisk transaksjon).

## Hvorfor begge?

| Bruksområde | Riktig fil |
|---|---|
| Slå opp én tabell-definisjon | `schema/NN-tablename.sql` |
| Forstå én utvidelse isolert | `schema/NN-tablename.sql` |
| Diff i PR ved endring | `schema/NN-tablename.sql` |
| Deploy til DB | `migrations/0001_*.sql` |
| Rollback hele Fase 0a | `migrations/0001_*.sql` |

Per-table SQL er suboptimal for migrasjon pga FK-avhengigheter (f.eks. `contract_pay_rule` referer `salary_type` og `employment_contract`). Atomisk migrasjon eliminerer ordrings-feil.

## Lese-rekkefølge

1. `00-enums-and-lookups.sql` — typer og lookup-tabeller
2. `01-profile-extensions.sql` — Tripletex-mapping på eksisterende profile
3. `02-pension_scheme.sql` — ny tabell, må eksistere før employee_payroll_profile FK
4. `03-employment_contract.sql` — utvidelse
5. `04-employee_payroll_profile.sql` — utvidelse, FK til pension_scheme
6. `05-contract_template.sql` — utvidelse
7. `06-contract_pay_rule.sql` — ny, FK til employment_contract + salary_type
8. `07-contract_tip_rule.sql` — ny, FK til employment_contract
9. `08-contract_obligation.sql` — ny, FK til employment_contract + policy + protocol
10. `09-contract_amendment.sql` — ny, FK til employment_contract + user
11. `99-seed-classifications.sql` — ADR-0001 felt-klassifisering

## Forutsetninger

Eksisterende tabeller som ikke endres her, men FKes til:

- `profile` (utvides minimalt — kun Tripletex-mapping)
- `workspace`
- `policy`, `protocol` (governance)
- `tariff`, `framework_rule`
- `role_capability` (industry intelligence)
- `"user"` (auth)
- `employment_contract` (utvides her, opprettes ikke)
- `employee_payroll_profile` (utvides her)
- `contract_template` (utvides her)

PostgreSQL-extensions:

- `pgcrypto` for `gen_random_uuid()`

## Endring av schema

Når du endrer en tabell:

1. Oppdater `schema/NN-*.sql` (reference DDL — full final shape)
2. Lag ny migration-fil i `migrations/NNNN_short_description.sql` (kun den faktiske endringen)
3. Aldri rediger eksisterende `migrations/*.sql` — det er deploy-historikk

## Referanser

- `../ADR-0001-kontrakt-og-lonnsprofil-fundament.md`
- `../ARCHITECTURE-contracts-module.md`
- `../PRD-contracts-module.md`
