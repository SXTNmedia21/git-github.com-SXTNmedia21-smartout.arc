# Checklist — Amendment-klassifisering

## 5 klasser

| Klasse | Eksempler | Krever |
|--------|-----------|--------|
| **MATERIAL** | `monthly_salary`, `hourly_rate`, `position_title`, `employment_form`, `employment_percentage`, `start_date`, `agreed_weekly_hours`, `notice_period_months` | Ny ansatt-signering |
| **ADMIN** | `internal_notes`, `tag[]`, `manager_comment`, metadata-felt | Admin commit direkte |
| **DERIVED** | `total_compensation`, `framework_snapshot`, computed sums | Auto-oppdateres, ingen sign |
| **SYSTEM** | `updated_at`, `version`, audit-felt | Audit-only |
| **BLOCKED** | `hourly_rate < tariff_min` uten override, `trial_period_months > 6`, ulovlig diskriminering | STOPP + eskaler |

## Conditional rules (utover felt-classification)

- **Tariff-revisjon trigger** (`context.tariff_revision_triggered=true`): MATERIAL kan downgrade til DERIVED hvis felt aligner med ny workspace-default
- **Innenfor prøvetid** (`context.is_within_trial_period=true`): MATERIAL-endringer kan committes uten sign hvis ADR-0236 amendment-flow brukes med 14-dagers varsel
- **Workspace-default-aligned** (`context.field_is_workspace_default_aligned=true`): MATERIAL kan downgrade til ADMIN hvis verdien er en kjent default fra workspace_framework_binding

## Constructive-dismissal-risk (ADR-0236)

`requires_resigning=true` PLUS følgende = `constructive_dismissal_risk=true`:

- Lønn-reduksjon (`monthly_salary` eller `hourly_rate` ned)
- Stilling-degradering (`position_title` til lavere rang)
- Arbeidstid-reduksjon (`employment_percentage` eller `agreed_weekly_hours` ned)
- Departement-bytte uten samtykke
- Vesentlig endring i arbeidsoppgaver

Når flag = true → ekstra varsling: "Endringen kan tolkes som vesentlig forringelse, ansatt kan kreve det likestilt med oppsigelse"

## Phase 0c stub

Returnerer alltid `MATERIAL` for visse felt-navn (hardkodet liste), `ADMIN` for resten. Ingen `BLOCKED`-detection. Ingen constructive-dismissal-risk-eval. Real implementation Phase 0c+ via `field_classification_metadata`-tabell.
