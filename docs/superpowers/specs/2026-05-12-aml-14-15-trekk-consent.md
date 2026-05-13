---
title: "Aml. §14-15 1.ledd — trekk-flow må kreve arbeidstaker-samtykke-link"
status: draft
created: 2026-05-12
updated: 2026-05-12
module: payroll
tags: [spec, payroll, compliance, lovsen, aml]
---

# Aml. §14-15 1.ledd — trekk-flow consent

## Problem

Aml. §14-15 første ledd krever at trekk i lønn skjer mot lovhjemmel ELLER skriftlig forhåndsavtale med arbeidstaker. Dagens `LineOverrideModal` har kun `reason`-felt — dette er intern dokumentasjon, ikke arbeidstaker-samtykke. Manager kan registrere trekk uten bevis for signert avtale. Compliance-blocker.

## Scope

1. Utvid `Category` enum i `LineOverrideModal` + Zod-schema i `propose-line-override` med `"deduction"`
2. Når `category === "deduction"` på override-submit: krev `signed_consent_signature_id` (FK → `confirmation_signature`)
3. BFF `propose-line-override` returnerer 422 hvis manglende
4. UI: dropdown viser ansatts signed `confirmation_signature` rows av type `deduction_consent`
5. Lovsen-MCP validerer paragraf-binding via `amendment-classifier`
6. Migration: ALTER `payroll_line_override` ADD COLUMN `consent_signature_id UUID REFERENCES confirmation_signature`; tilsvarende på `calculation_line.metadata` dersom override applieres
7. Telemetri: `payroll.deduction_consent_referenced`

## Out-of-scope

- Salary_code 910 mapping (separat SMA-332)
- DocuSeal direkte-integrasjon (B1 bygger på confirmation_signature governance-pipeline)
- Bulk-trekk via fagforening (ny ADR ved behov)

## ADRs

- ADR-0259 lovsen-capability paragraph-validation
- Potensiell ny ADR for `deduction_consent` confirmation_type extension
