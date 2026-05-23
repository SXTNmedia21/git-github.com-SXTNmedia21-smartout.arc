---
title: "Contracts — Overview"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: contracts
mirror: verified
last_verified: 2026-05-23
tags: [contracts, employment, cascade, docuseal, aml-14-6]
---

# Contracts — Overview

## What and Why

The contracts domain owns the **employment contract lifecycle**: everything that describes the legal and operational relationship between an employer-workspace and an employee-profile. It covers:

- **Employment contract** (`employment_contract`): the §14-6-compliant structured record, from draft through signing to active, amendment, and archive.
- **Client contracts** (`contract` + `contract_template`): workspace-onboarding-side agreements (signed by clients before gaining workspace access). Co-located because they share the DocuSeal delivery infrastructure.
- **Contract composition**: cascade derivation pulling workspace defaults + role-class + tariff baseline into a draft (ADR-0076). The composition engine runs inside `services/contract-service/`.
- **Contract intake**: the assisted form flow (employer side via composition, employee side via DocuSeal embedded signing) that converts a draft into an active contract.
- **Templates**: `contract_template` + `contract_template_attachment` + `contract_template_binding` — the factory from which per-employee contracts are derived.
- **Amendments**: `contract_amendment` + `employment_contract_detail` versioning (ADR-0111). Drafts are NOT versions (ADR-0082). Materially-changed contracts require re-sign.
- **Phantom contracts** (ADR-0197): promotion of pre-Smartout legacy contracts into the system.
- **Apprentice/lærling contracts** (ADR-0253): block enforced per Opplæringsloven kap. 4.
- **PII handling** in contracts: Høy-PII tier for personnummer + bank account, RPC-controlled (ADR-0077).

## Why it Exists

In the pre-Smartout world a contract is a signed PDF forgotten after day 1. The contracts domain converts the contract into a **living cascade component**: structured data that is the truth, with the PDF as a projection of it. This enables Botsson to say "according to your contract..." and enables automated enforcement of training obligations, seniority calc for payroll, and billing gate on signed status.

## Cascade Placement

The contracts domain lives at **D2 Resource Availability** — the binding paper that makes a profile a real D2 resource.

```
I1 Industry (role_capability baseline)
    ↓ inherit
D2 Resource — employment_contract (binding, THIS DOMAIN)
    ↓ cascade_contract_payroll_sync
    → employee_payroll_profile (payroll domain owns this)
    ↓ signed_at
    → billing gate (ADR-0384, billing domain reads)
    ↓ obligation rows
    → day-session readiness gate (contract active = prerequisite)
```

The contracts domain **authors** `employment_contract`. All other domains **read** it.

## Employment vs Platform Contract Split (ADR-0079)

Two contract types co-exist in the tables:

| Type | Table | Signed by | Purpose |
|---|---|---|---|
| Employment | `employment_contract` | Employee (DocuSeal) | §14-6 juridical relationship |
| Platform | `contract` | Client company | Workspace onboarding agreement |

ADR-0079 governs the split. Employment contracts have a richer lifecycle (draft → proposed → active → amending → archived) and full cascade coupling. Platform contracts are lighter (draft → sent → signed → active).

## Template vs Contract Lifecycle (ADR-0182)

Templates are **factories**, not contracts. A template change does NOT retroactively change signed contracts. Signed contracts are snapshots. The `contract_template_binding` table (ADR migration `20260422120000`) wires workspace-level template assignment to role + department without touching live contracts.

## Contract as Cascade Derivation (ADR-0076)

The composition engine (7-phase: collect → derive → validate → change_proposal → approve → apply → engine dispatch) pulls:
1. Workspace defaults (working-hours, overtime policy, holiday policy)
2. Role-class baseline (from I1 `role_capability`)
3. Tariff baseline (K1a `tariff_rate_table` — payroll domain sources this)
4. Employee-specific overrides (employment percentage, start date, title)

Output: a pre-filled `employment_contract` draft ready for review + sending.

## Key ADRs

| ADR | Topic |
|---|---|
| ADR-0024 | Contract system architecture (DocuSeal Cloud, Fastify, Tiptap, table rename) |
| ADR-0076 | Composition as cascade derivation |
| ADR-0077 | PII handling in contracts (RPC-controlled access) |
| ADR-0079 | Employment vs platform contract split |
| ADR-0082 | Drafts are not versions |
| ADR-0093 | Unified cascade for draft proposals |
| ADR-0109 | Migrated shell — block + supersede (`migration_incomplete`) |
| ADR-0111 | `employment_contract_detail` versioning |
| ADR-0182 | Template vs contract lifecycle |
| ADR-0197 | Phantom contracts promotion |
| ADR-0242 | Contract / payroll capability split |
| ADR-0253 | Lærling-kontrakter per Opplæringsloven kap. 4 |
| ADR-0256 | Lovsen citation contract (ADR-0256; `packages/lovsen-contract` type schema) |
| ADR-0384 | Billing gate on signed contract |
