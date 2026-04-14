---
title: "Tripletex External Adapter — Cascade Phase F"
status: approved
updated: 2026-04-14
created: 2026-04-14
module: integrations
tags: [cascade, phase-f, tripletex, external-adapter, integrations]
---

# Tripletex External Adapter — Design Spec

> Council-reviewed 2026-04-14. APPROVE WITH CHANGES applied.
> Single spec, three implementation plans. Plans drafted separately.

## 1. Summary

First external adapter for Smartout. Admin-triggered, manual-only sync between Smartout and Tripletex (Norwegian accounting/payroll system). Establishes the foundation pattern for future adapters (Visma, PowerOffice, Planday, Fiken).

**What this is:** Integration layer beside cascade. Feeds data into D2 (profiles), D6 (timesheets as push target), and C3 (cost snapshots as push target). Never modifies D3 rules or K1a platform knowledge.

**What this is not:** A cascade dimension. A workflow runtime. An autonomous system.

## 2. Scope

| Plan | Feature | Direction | Cascade Touch | Gated By |
|------|---------|-----------|---------------|----------|
| F.1 | Foundation + employee pull | Inbound | D2 (profile, employment_contract) | ADR-0077 accepted |
| F.2 | Timesheet push | Outbound | D6 (schedule_shift → Tripletex) | F.1 merged |
| F.3 | Cost voucher push | Outbound | C3 (shift_cost_snapshot → Tripletex) | F.2 merged |

Each plan is independently shippable. Foundation (tables, package, Edge Function skeleton, UI shell) ships with F.1 because employee pull needs all of it.

## 3. Non-Goals

- **No cron, no event-driven sync.** Manual only in Phase F. Future auto-sync is a separate ADR.
- **No autonomous agent writes.** Money-movement operations are forever admin-confirmed.
- **No multi-tenant credential vault.** Each workspace manages its own Tripletex connection.
- **No D3 rule mutation.** Tripletex never overwrites tariff rates, frameworks, or regulatory data.
- **No Visma/Planday/Fiken.** Adapter pattern is generalized, but only Tripletex implements in Phase F.
- **No mobile UI.** Admin-only settings surface (CLAUDE.md admin-tools exception).

## 4. Architecture

### 4.1 Package Structure

```
packages/external-adapters/              ← NEW PACKAGE
├─ package.json                          "@smartout/external-adapters"
├─ tsconfig.json
└─ src/
   ├─ index.ts                           top-level exports
   ├─ types.ts                           ExternalAdapter interface + shared types
   ├─ registry.ts                        provider → adapter lookup
   ├─ errors.ts                          typed adapter errors
   └─ providers/
      └─ tripletex/
         ├─ adapter.ts                   Tripletex ExternalAdapter impl
         ├─ client.ts                    HTTP client (session token mgmt)
         ├─ types.ts                     Tripletex API response types (Zod)
         ├─ mappers/
         │  ├─ employee.ts               Tripletex.Employee ⇄ Smartout.profile
         │  ├─ timesheet.ts              schedule_shift → Tripletex.TimesheetEntry
         │  └─ cost.ts                   shift_cost_snapshot → Tripletex.Voucher
         └─ operations/
            ├─ pull-employees.ts         F.1
            ├─ push-timesheets.ts        F.2
            └─ push-costs.ts             F.3
```

**Mobile parity:** Package has zero dependencies on `apps/web/`. RN can consume same types in the future.

### 4.2 Database Schema

Schema placement decision: **`public` schema** (consistent with everything else; dedicated `integrations` schema rejected as premature optimization). Three new tables:

#### `integration_connection`

```sql
CREATE TABLE integration_connection (
  connection_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK (provider IN ('tripletex', 'visma', 'planday', 'poweroffice', 'fiken')),
  name                TEXT NOT NULL,                            -- Admin-chosen label
  credentials_ref     TEXT NOT NULL,                            -- Symbolic reference (see §5)
  sync_config         JSONB NOT NULL DEFAULT '{}',              -- Per-provider options
  status              TEXT NOT NULL CHECK (status IN ('active', 'paused', 'error', 'revoked')) DEFAULT 'active',
  last_verified_at    TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, provider, name)
);
```

RLS: workspace-scoped. Both JWT and API-key policies required.

#### `sync_mapping`

Polymorphic by entity type. One row per (workspace, connection, entity_type, smartout_entity_id).

```sql
CREATE TABLE sync_mapping (
  mapping_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  connection_id       UUID NOT NULL REFERENCES integration_connection(connection_id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,                            -- Denormalized for query perf
  entity_type         TEXT NOT NULL CHECK (entity_type IN ('profile', 'employment_contract', 'department', 'schedule_shift')),
  smartout_entity_id  UUID NOT NULL,
  external_id         TEXT NOT NULL,
  mapping_metadata    JSONB NOT NULL DEFAULT '{}',              -- Per-entity extras (e.g. tripletex_employee_number)
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, entity_type, external_id),
  UNIQUE (connection_id, entity_type, smartout_entity_id)
);
```

RLS: workspace-scoped. Both JWT and API-key policies required.

#### `sync_event`

Audit + idempotency + debug payload. NOT a replacement for `activity_trail` (telemetry still emits).

```sql
CREATE TABLE sync_event (
  event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  connection_id       UUID NOT NULL REFERENCES integration_connection(connection_id) ON DELETE CASCADE,
  operation           TEXT NOT NULL,                            -- 'pull_employees' | 'push_timesheets' | 'push_costs'
  status              TEXT NOT NULL CHECK (status IN ('preview', 'pending', 'succeeded', 'failed', 'partial')),
  idempotency_key     TEXT NOT NULL,                            -- Composite: provider+operation+payload_hash
  request_body        JSONB,                                    -- Sanitized (no PII values)
  response_body       JSONB,                                    -- Sanitized (no PII values)
  http_status         INT,
  items_total         INT DEFAULT 0,
  items_succeeded     INT DEFAULT 0,
  items_failed        INT DEFAULT 0,
  error_summary       TEXT,
  actor_profile_id    UUID REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  UNIQUE (connection_id, idempotency_key)
);

-- Retention: 90 days (enforced by scheduled cleanup, not in Phase F)
```

RLS: workspace-scoped. PII NEVER stored in request_body/response_body payloads — only IDs and counts.

### 4.3 Edge Function

`supabase/functions/integrations-sync/` — standalone (not workspace-api gateway).

**Why standalone:** workspace-api is inbound-only (external systems → Smartout via API key + scope). integrations-sync is outbound+bidirectional with user JWT auth. Mixing pollutes the gateway's scope model. Precedent: engine-dispatch, contract-lifecycle, guardian-sweep.

Request shape (matches engine-dispatch pattern — routes by body, not URL):

```typescript
POST /functions/v1/integrations-sync
Authorization: Bearer <user-jwt>

{
  "connection_id": "uuid",
  "operation": "pull_employees" | "push_timesheets" | "push_costs",
  "mode": "preview" | "apply",
  "apply_token": "string"  // Required when mode=apply; returned from preview
}
```

Response:

```typescript
// Preview response
{
  "mode": "preview",
  "apply_token": "string",        // Valid for 30 minutes
  "summary": { "create": 12, "update": 3, "skip": 1, "conflict": 0 },
  "items": [...],                  // Per-item detail, no PII values
  "generated_at": "timestamp"
}

// Apply response (same shape as preview + status)
{
  "mode": "apply",
  "sync_event_id": "uuid",
  "status": "succeeded" | "failed" | "partial",
  "items": [...]
}
```

**Idempotency:** `apply_token` is the idempotency key. Generated per preview, valid 30 min, one-shot. On apply, Edge Function re-fetches from Tripletex and shows drift banner if state changed since preview (per council P5 recommendation).

### 4.4 UI

`/dashboard/settings/integrations` — new settings tab (not top-level route).

**Per Nordic Split frontend review, these patterns apply:**

| Surface | Pattern |
|---------|---------|
| Connections list | Card grid, 2-col, warm-surface cards, radial glow on hover |
| Add connection | **Inline expand** on the list (NOT modal). Token inputs + "Test connection" button |
| Per-connection detail | Route `/dashboard/settings/integrations/[connection_id]`. Three sync cards (employees, timesheets, costs) with "last synced X ago" |
| Sync preview | **Side Sheet** right-anchored, 720px wide. NOT a Dialog. |
| First-run mapping | **Dedicated wizard route** `/dashboard/settings/integrations/[id]/first-sync`. Uses `AnimatedWizardShell` |
| Sync in progress | Event stream replaces preview content in same sheet (staggered fade-in lines) |
| Sync result | Instrument Serif success hero + collapsed event log + "View in activity trail →" |
| History | Collapsed section on per-connection page, NOT a tab. Links to `activity_trail` |

**Destructive change surfacing:** Typography hierarchy + diff-style side-by-side for updates. NOT red badges. Conflicts get ambient radial glow, not red borders.

**Motion:** Framer Motion springs — `{ stiffness: 35, damping: 22, mass: 2.2 }` for structural (sheet open), `{ stiffness: 45, damping: 24, mass: 2.0 }` for interactions. Honor `prefers-reduced-motion`.

**i18n:** New namespace `packages/i18n/locales/{nb,en}/integrations.json`.

## 5. Credentials Model

**Problem:** op:// references cannot be resolved in Supabase Edge Function runtime. 1Password CLI is not available there.

**Solution (decided by council):** Two-layer model.

1. **Bootstrap secret in Supabase env var:** `TRIPLETEX_CONSUMER_TOKEN` — global, platform-level. One per Tripletex partner agreement.
2. **Per-connection employee token:** Stored encrypted in `integration_connection.credentials_ref` as pgsodium-encrypted value (ADR-0086 to establish pattern).

Session tokens (30-min expiry) fetched fresh per sync. Never stored.

**On token refresh mid-sync:** Client auto-retries with new session token. Adapter tracks this in `sync_event.response_body.session_refreshes` counter. Not a failure.

**Rotation contract:**
- Consumer token: rotated by platform admin (Pontus), 1Password → Supabase env var sync
- Employee token: rotated by workspace admin via UI ("Update credentials" action) → pgsodium re-encryption

## 6. Field Ownership Matrix

Per council B1 (blocking). Declares who owns truth on conflict, per field.

### Employee pull (F.1) — D2 profile/employment_contract

| Smartout field | Tripletex source | Ownership | Conflict behavior |
|---|---|---|---|
| `profile.email` | `employee.email` | **proposal-required** | Surface in preview; admin picks |
| `profile.first_name` | `employee.firstName` | **tripletex-authoritative** | Silent overwrite on sync |
| `profile.last_name` | `employee.lastName` | **tripletex-authoritative** | Silent overwrite on sync |
| `profile.phone` | `employee.phoneNumberMobile` | **proposal-required** | Surface in preview |
| `profile.personnummer` | `employee.nationalIdentityNumber` | **smartout-authoritative** | Never overwrite; pull only if Smartout is empty |
| `profile.status` | `employee.employments[*].active` | **smartout-authoritative** | Tripletex termination creates a `change_proposal`, not direct write |
| `employment_contract.start_date` | `employment.startDate` | **tripletex-authoritative** | Silent overwrite |
| `employment_contract.end_date` | `employment.endDate` | **proposal-required** | Surface in preview |
| `employment_contract.hourly_rate` | `employment.wageType+amount` | **smartout-authoritative** | Tripletex value shown as informational; D3 tariff remains truth for scheduling |
| `employment_contract.workspace_id` | — | **N/A** | Always Smartout-set at mapping time |
| `profile.bank_account` | `employee.bankAccountNumber` | **NOT SYNCED** | Explicit exclusion, Phase F |
| `profile.home_address` | `employee.address` | **NOT SYNCED** | Explicit exclusion, Phase F |

### Timesheet push (F.2) — D6 schedule_shift

Outbound only. Smartout is authoritative. Tripletex receives the shift as a timesheet entry and should not modify. If admin edits a shift after push, a new push overwrites the Tripletex entry (idempotent by `schedule_shift.shift_id` → Tripletex timesheet entry ID via `sync_mapping`).

### Cost push (F.3) — C3 shift_cost_snapshot

Outbound only. Only settled shifts (`schedule_shift.status = 'settled'`). Pushed as Tripletex vouchers for accounting.

### Explicit non-owned domains

Tripletex adapter **MUST NEVER write**:
- `tariff_rate_table` (K1a platform + D3 rules)
- `framework_rule` (D3)
- `regulatory_framework` (K1a)
- `public_holiday` (K1a)
- Any `workspace_id = NULL` row

Runtime enforcement: code audit in F.1 + unit test proving no adapter code path references these tables.

## 7. Telemetry Events

Per council (Supervisor CRITICAL). All events registered in `packages/telemetry/src/registry.ts` as part of F.1, **before** any sync code ships.

| Event name | Destinations | When |
|---|---|---|
| `integration.connection_created` | activity_trail, posthog | New `integration_connection` row |
| `integration.connection_verified` | activity_trail, posthog | Test connection succeeded |
| `integration.connection_revoked` | activity_trail, posthog | Admin disconnects |
| `integration.sync_preview_generated` | activity_trail, posthog | Preview mode complete |
| `integration.sync_applied` | activity_trail, posthog, engine_event | Apply mode complete |
| `integration.sync_failed` | activity_trail, posthog, engine_event | Apply mode failed |
| `integration.mapping_created` | activity_trail, posthog | New `sync_mapping` row |
| `integration.mapping_updated` | activity_trail, posthog | `sync_mapping` changed |
| `integration.employee_imported` | activity_trail, posthog | Profile created from pull |
| `integration.employee_updated` | activity_trail, posthog | Profile updated from pull |
| `integration.timesheet_pushed` | activity_trail, posthog | One timesheet entry pushed |
| `integration.voucher_pushed` | activity_trail, posthog | One cost voucher pushed |

`engine_event` destination on sync_failed/sync_applied lets future workflows (retry, notify) hook in without requiring adapter changes.

## 8. Implementation Plans

Each plan gets its own implementation plan document. Dependencies are linear.

### Plan 1: F.1 — Foundation + Employee Pull

**Deliverables:**
- ADR-0086: External adapter architecture
- `packages/external-adapters/` package skeleton
- Migration: `integration_connection`, `sync_mapping`, `sync_event` tables + RLS
- Tripletex client (auth, session token mgmt, error mapping)
- Employee pull operation (preview + apply)
- Edge Function `integrations-sync` — routes pull_employees
- Settings tab UI: connection list, add connection inline expand, per-connection page
- First-run mapping wizard (AnimatedWizardShell)
- Preview Side Sheet with diff surfacing
- Telemetry registry entries (all 12 events)
- E2E test: admin connects → preview → confirm → 10 profiles imported + 10 mappings + sync_event row + telemetry emitted

**Blocked by:** ADR-0077 (PII handling) must be accepted first. Without it, employee pull writes raw personnummer/PII which has no governance.

**Size estimate:** Large. This is the foundation for everything else.

### Plan 2: F.2 — Timesheet Push

**Deliverables:**
- Tripletex timesheet mapper (schedule_shift → Tripletex.TimesheetEntry)
- Push timesheets operation (preview + apply)
- Edge Function: push_timesheets route
- UI: timesheet sync card on per-connection page
- Idempotency via `sync_mapping` for shift↔timesheet_id linkage
- E2E test: push 5 shifts → verify Tripletex mocks received them + sync_mapping rows

**Blocked by:** F.1 merged (needs profile mappings to push timesheets under correct Tripletex employee).

### Plan 3: F.3 — Cost Voucher Push

**Deliverables:**
- Tripletex voucher mapper (shift_cost_snapshot → Tripletex.Voucher)
- Push costs operation (preview + apply)
- Edge Function: push_costs route
- UI: costs sync card on per-connection page
- Filter: only settled shifts
- E2E test: push costs for settled week → verify vouchers created

**Blocked by:** F.2 merged (cost push relies on timesheet mapping integrity).

## 9. Dependencies

| Dependency | Impact | Status |
|---|---|---|
| ADR-0077 (PII handling) | Gates F.1 employee pull | Proposed — must accept before F.1 |
| ADR-0086 (External adapter architecture) | Written as part of F.1 | New |
| pgsodium extension | Credentials encryption | Already available in Supabase |
| `packages/telemetry/src/registry.ts` | Event registration | Extend in F.1 |
| `AnimatedWizardShell` | First-run mapping | Exists — reuse |
| Supabase env var: `TRIPLETEX_CONSUMER_TOKEN` | Platform credential | Set by Pontus before F.1 deploy |

## 10. Future Agent Integration (Reserved)

Per council (Agent Coordinator). Phase F ships zero agent capabilities. But reserve:

- **Capability name:** `integrations` (future)
- **Channel restriction:** chat only. Voice forbidden for mapping tools per ADR-0078 (personnummer-adjacent identity resolution).
- **Authority defaults:**
  - `read_only`: explain sync status, list mappings
  - `suggest`: propose employee matches (never apply)
  - `confirm`: apply mapping (admin must confirm)
  - `autonomous`: **FORBIDDEN** for any write operation. Money movement stays admin-gated forever.
- **First tool (future, not Phase F):** `suggest_employee_matches(tripletex_employees[]) → MatchSuggestion[]`

These commitments live in ADR-0086 to prevent future scope drift.

## 11. Open Questions (to resolve in plan docs)

1. **Tripletex test tenant provisioning:** Pontus supplies credentials. Stored in Supabase staging env vars.
2. **Deactivation semantics:** Tripletex employee terminated → Smartout profile goes to `offboarding` (not `inactive`) pending admin confirm? Decide in F.1 plan.
3. **Employment contract pull:** F.1 scope is profile-only OR profile+employment_contract? Recommendation: profile+contract since they're linked 1:1. Decide in F.1 plan.
4. **Timesheet granularity:** One shift = one timesheet entry OR aggregated per day? Tripletex API constraint research in F.2 plan.
5. **Multi-company Tripletex:** One workspace = one Tripletex company, confirmed? Decide in F.1 plan.
6. **Retention enforcement:** `sync_event` 90-day retention — cleanup job is F+1 phase? Decide in F.1 plan.

## 12. Success Criteria

### F.1 ship criteria
- Admin connects Tripletex test tenant in < 2 minutes
- Preview of 50 employees loads in < 5s
- Apply of 50 employees completes in < 30s
- Zero mis-mapped profiles on first pass (measured against manual verification)
- All telemetry events fire and appear in `activity_trail`
- Zero writes to forbidden tables (tariff_rate_table, framework_rule, etc.) — verified by unit test
- E2E test green

### F.2 ship criteria
- Push 100 timesheets in < 60s
- Idempotent: pushing same shift twice results in one Tripletex entry
- Admin can see sync history per connection

### F.3 ship criteria
- Push week-of-costs for 5 departments in < 30s
- Only settled shifts included
- Voucher totals match Smartout cost snapshots within 0.01 NOK rounding tolerance

## 13. References

- `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` (ExternalAdapter interface, K1a/K1b)
- `docs/decisions/0077-pii-handling.md` (gates F.1)
- `docs/decisions/0078-channel-restriction.md` (future agent tools)
- `docs/decisions/0086-external-adapter-architecture.md` (written with F.1)
- `supabase/migrations/20260421200000_cascade_a2_enums.sql` (external_provider, sync_direction, sync_status enums)
- `packages/telemetry/src/registry.ts` (event registration)
- `supabase/functions/engine-dispatch/index.ts` (routing pattern reference)
- `apps/web/src/components/wizard/AnimatedWizardShell.tsx` (first-run mapping shell)
- Tripletex API: https://tripletex.no/v2-docs/
