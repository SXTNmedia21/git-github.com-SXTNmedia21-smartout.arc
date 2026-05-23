---
title: "Contracts — Architecture"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: contracts
mirror: verified
last_verified: 2026-05-23
tags: [contracts, architecture, docuseal, fastify, capability]
---

# Contracts — Architecture

> CODE WINS. Every claim below has a grep-able file anchor.

## L1 — Web UI

Route root: `apps/web/src/app/dashboard/people/contracts/` (migrated from `/dashboard/contracts/` per plan 2026-05-19 — migration PENDING as of 2026-05-23; old path still active).

Current active UI location: `apps/web/src/app/dashboard/people/contracts/`

| Path | File | Purpose |
|---|---|---|
| List (hub) | `apps/web/src/app/dashboard/people/contracts/page.tsx` | Contract hub — tabs: Kontrakter / Maler / Bindinger |
| Detail | `apps/web/src/app/dashboard/people/contracts/[id]/` | Single-contract view + revise |
| New | `apps/web/src/app/dashboard/people/contracts/new/` | Redirect → drawer-flow |
| Awaiting | `apps/web/src/app/dashboard/people/contracts/awaiting-my-signature/` | Employee-side sign queue |
| Filters | `apps/web/src/app/dashboard/people/contracts/filters.ts` | Query-filter state |
| Hooks | `apps/web/src/app/dashboard/people/contracts/_hooks/` | Client hooks |
| Tools | `apps/web/src/app/dashboard/people/contracts/_tools/` | Server action bridges |
| Components | `apps/web/src/app/dashboard/people/contracts/_components/` | Drawers, tables, timeline |
| Tests | `apps/web/src/app/dashboard/people/contracts/__tests__/` | Unit tests |

## L2 — BFF: Contract Service

Service: `services/contract-service/` (Fastify, port 5012)

| File | Purpose |
|---|---|
| `src/server.ts` | Fastify bootstrap + plugin registration |
| `src/config.ts` | Env var schema |
| `src/secrets.ts` | DocuSeal API key + webhook secret via Vault / env |
| `src/routes/contracts.ts` | Core CRUD — create, send, sync submission, cancel |
| `src/routes/templates.ts` | Template CRUD + clone + DocuSeal template sync |
| `src/routes/sync.ts` | DocuSeal ↔ Supabase reconciliation jobs |
| `src/routes/webhooks.ts` | DocuSeal webhook handler (signed, viewed, declined events) |
| `src/lib/docuseal.ts` | DocuSeal API client wrapper |
| `src/lib/placeholders.ts` | Placeholder resolution engine (`resolvePlaceholders`) |
| `src/lib/reminders.ts` | Reminder cron jobs for unsigned contracts |
| `src/lib/supabase.ts` | Supabase admin client factory |

**Placeholder resolution note:** `apps/web/src/app/api/platform-admin/contracts/route.ts` bypasses the contract-service and stores raw HTML without resolving placeholders (known gap per ADR-0024 spec 2026-03-20, flagged in GAPS).

## L3 — Capability Layer

### `packages/ai/src/capabilities/contract/`

Files: `index.ts`, `gate.ts`, `tools.ts`, `__tests__/`

| Tool | Type | gatedMutation |
|---|---|---|
| `list_employee_templates` | read | — |
| `list_employee_contracts` | read | — |
| `check_contract_status` | read | — |
| `explain_contract_clause` | read | — |
| `get_compliance_drift_for_contract` | read | — |
| `create_employee_contract` | write | yes (ADR-0204, ADR-0191 admin write at line 488) |
| `send_employee_contract` | write | yes |
| `fork_template` | write | yes |
| `publish_workspace_template` | write | yes |
| `deprecate_workspace_template` | write | yes |

**Total: 10 named tools** (8 distinct tools + 2 `resolvedName` dynamic registrations at lines 523 + 564 of tools.ts).

### `packages/ai/src/capabilities/contract-intake/`

Files: `index.ts`, `gate.ts`, `tools.ts`, `__tests__/`

| Tool | Type | gatedMutation |
|---|---|---|
| `submit_field_group` | write | yes |
| `decline_intake` | write | yes |
| `get_intake_progress` | read | — |

**Total: 3 tools**

### Combined capability count: 13 tools across 2 capabilities.

## L4 — Data Layer

See [DATA-MODEL.md](./DATA-MODEL.md) for full table reference with migration cites.

**Key RPCs / triggers:**

| Object | Migration | Purpose |
|---|---|---|
| `anonymize_contract_rpc` | `20260501120000_anonymize_contract_rpc.sql` | GDPR erasure |
| `employment_contract activity_trail trigger` | `20260430182443_employment_contract_activity_trail_trigger.sql` | Audit trail emit |
| `contract_event_notify_trigger` | `20260414072300_contract_event_notify_trigger.sql` | Notification fanout on lifecycle events |
| `engine_trigger_contract_events` | `20260520120100_engine_trigger_contract_events.sql` | Event Engine consumption of contract events |
| `cascade_contract_payroll_sync` | `20260422400200_cascade_contract_payroll_sync.sql` | Propagate contract fields → `employee_payroll_profile` |
| `contract_status_timestamp_trigger` | `20260615100100_contract_status_timestamp_trigger.sql` | Auto-stamp `sent_at`, `signed_at`, etc. on status transitions |

**Authority seeds (C4 governance):**

| Migration | Content |
|---|---|
| `20260515170500_contract_capability_authority_seed.sql` | Authority config for contract capability tools |
| `20260518000000_contract_authority_seed_upsert_and_bootstrap.sql` | Upsert + bootstrap for engine_authority_config |
| `20260616100300_engine_authority_config_contract_seed.sql` | Additional C4 authority config insert |

## L5 — Lifecycle Pipeline

```
Draft ──── compose (ADR-0076) ──── Proposed
    │                                  │
    │              ◄── Decline ────────┤
    │                                  │
    │                         Send (DocuSeal submit)
    │                                  │
    │                              Sent
    │                                  │
    │                         Sign (DocuSeal webhook)
    │                                  │
    │                             Signed ──── cascade_contract_payroll_sync ──► employee_payroll_profile
    │                                  │                                         (payroll domain)
    │                                  │──── billing gate (ADR-0384) ──────────► billing domain reads
    │                                  │
    │                             Active
    │                                  │
    │              Amendment request ──┤
    │                                  │
    │                          Amending (ADR-0111 detail row)
    │                                  │
    │                Re-sign ──────────┘
    │
    └── Phantom promotion (ADR-0197) ──────► Active (skips signing)
```

**Pipeline handlers:**

| Phase | File | Method |
|---|---|---|
| Draft create | `services/contract-service/src/routes/contracts.ts` | POST `/contracts` |
| Composition | `services/contract-service/src/lib/placeholders.ts` | `resolvePlaceholders()` |
| Send (DocuSeal) | `services/contract-service/src/routes/contracts.ts` | POST `/contracts/:id/send` |
| Signed webhook | `services/contract-service/src/routes/webhooks.ts` | POST `/webhooks/docuseal` |
| Sync reconcile | `services/contract-service/src/routes/sync.ts` | POST `/sync` |
| Template sync | `services/contract-service/src/routes/templates.ts` | CRUD |

## DocuSeal Integration

DocuSeal Cloud is the e-signing provider (ADR-0024). Secrets loaded at `services/contract-service/src/secrets.ts:13-41` via Vault (`docuseal` + `docuseal_webhook_secret`). Contract-service is the sole caller of DocuSeal API — no direct calls from web or mobile.

## Relationship to lovsen-mcp

The `packages/lovsen-contract/` package contains **Zod schemas and TypeScript types** for the lovsen citation interface (ADR-0256, ADR-0257). It does NOT contain legal rules or validation logic. The actual Aml §14-6 validation lives in `packages/ai/src/capabilities/legal/` (the `legal` capability) and is consumed by contract-intake. See GAPS for ownership classification of `lovsen-contract`.
