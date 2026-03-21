---
title: "SmartOut API — EDDA Technical Specification"
status: done
updated: 2026-03-21
created: 2026-03-11
module: integrations
tags: [api, edda, partner, integration]
---

# SmartOut API — EDDA Technical Specification

**Version:** 1.0
**Date:** 2026-03-11
**Classification:** External — Partner Integration

---

## 1. Overview

EDDA receives read-only access to SmartOut operational data via workspace-scoped API keys. All data is **industry data only** — no personal identifiers (names, employee numbers, contact info). Employees are referenced by opaque UUIDs.

**Base URL:** `https://api.smartout.ai/v1/`
**Auth:** `Authorization: Bearer smo_sk_live_<key>`
**Format:** JSON, UTF-8
**Rate limit:** 60 requests/minute

---

## 2. Granted Scopes

| Scope             | What                               | PII                        |
| ----------------- | ---------------------------------- | -------------------------- |
| `schedules:read`  | Shift schedules, absences          | No — `employee_id` is UUID |
| `operations:read` | Daily sessions, deviations         | No                         |
| `reports:read`    | Revenue, labor cost, budgets, KPIs | No                         |

### Denied Scopes (not available to EDDA)

| Scope            | Why excluded                                    |
| ---------------- | ----------------------------------------------- |
| `profiles:read`  | Returns `display_name`, `employee_number` — PII |
| `contracts:read` | Employment contracts — PII                      |
| `training:read`  | Internal training governance                    |
| `guardian:read`  | Internal alerting system                        |
| `events:read`    | Internal event stream                           |
| `suppliers:read` | Supplier financials                             |
| `waste:read`     | Not in scope                                    |
| `equipment:read` | Not in scope                                    |

---

## 3. Endpoints & Response Fields

### 3.1 Schedules

#### GET /v1/shifts

Shift schedules. Employee referenced by UUID only.

| Parameter     | Type       | Required | Description            |
| ------------- | ---------- | -------- | ---------------------- |
| `date_from`   | YYYY-MM-DD | No       | Start date filter      |
| `date_to`     | YYYY-MM-DD | No       | End date filter        |
| `employee_id` | UUID       | No       | Filter by employee     |
| `status`      | string     | No       | Filter by shift status |
| `limit`       | int        | No       | Max 200, default 50    |
| `offset`      | int        | No       | Pagination offset      |

**Response:**

```json
{
  "data": {
    "shifts": [
      {
        "schedule_shift_id": "uuid",
        "employee_id": "uuid",
        "position_id": "uuid | null",
        "team_id": "uuid | null",
        "shift_date": "2026-03-11",
        "role": "string",
        "start_time": "08:00",
        "end_time": "16:00",
        "work_hours": 8.0,
        "breaks": 0.5,
        "day_category": "string",
        "status": "string",
        "is_published": true,
        "zone": "string | null",
        "notes": "string | null",
        "created_at": "ISO 8601",
        "updated_at": "ISO 8601"
      }
    ],
    "limit": 50,
    "offset": 0
  }
}
```

#### GET /v1/absences

Absence records. No personal details — type and dates only.

| Parameter     | Type   | Required | Description               |
| ------------- | ------ | -------- | ------------------------- |
| `employee_id` | UUID   | No       | Filter by employee        |
| `status`      | string | No       | Filter by approval status |
| `limit`       | int    | No       | Max 200, default 50       |
| `offset`      | int    | No       | Pagination offset         |

**Response fields:**

| Field                 | Type     | Description               |
| --------------------- | -------- | ------------------------- | -------------- |
| `schedule_absence_id` | UUID     | Absence record ID         |
| `employee_id`         | UUID     | Opaque employee reference |
| `shift_date`          | date     | Affected shift date       |
| `absence_type`        | string   | Category of absence       |
| `request_type`        | string   | How absence was requested |
| `reason`              | string   | null                      | Absence reason |
| `start_date`          | date     | Absence start             |
| `end_date`            | date     | Absence end               |
| `is_full_day`         | boolean  | Full day or partial       |
| `status`              | string   | Approval status           |
| `created_at`          | ISO 8601 | Record created            |
| `updated_at`          | ISO 8601 | Last modified             |

---

### 3.2 Operations

#### GET /v1/sessions

Daily operational containers per department.

| Parameter       | Type       | Required | Description              |
| --------------- | ---------- | -------- | ------------------------ |
| `department_id` | UUID       | No       | Filter by department     |
| `status`        | string     | No       | Filter by session status |
| `date_from`     | YYYY-MM-DD | No       | Start date               |
| `date_to`       | YYYY-MM-DD | No       | End date                 |
| `limit`         | int        | No       | Max 200, default 50      |
| `offset`        | int        | No       | Pagination offset        |

**Response fields:**

| Field                   | Type     | Description                                       |
| ----------------------- | -------- | ------------------------------------------------- | ---------------------- |
| `department_session_id` | UUID     | Session ID                                        |
| `department_id`         | UUID     | Department reference                              |
| `season_id`             | UUID     | null                                              | Season reference       |
| `session_date`          | date     | Operational date                                  |
| `status`                | string   | upcoming, active, pending_signoff, closed, missed |
| `opened_at`             | ISO 8601 | null                                              | When session opened    |
| `closed_at`             | ISO 8601 | null                                              | When session closed    |
| `planned_shifts`        | int      | Planned shift count                               |
| `actual_shifts`         | int      | Actual shift count                                |
| `tasks_total`           | int      | Total tasks                                       |
| `tasks_completed`       | int      | Completed tasks                                   |
| `signoff_notes`         | string   | null                                              | Manager sign-off notes |
| `handoff_notes`         | string   | null                                              | Handoff notes          |
| `created_at`            | ISO 8601 | Record created                                    |
| `updated_at`            | ISO 8601 | Last modified                                     |

#### GET /v1/deviations

Operational exceptions and incidents.

| Parameter  | Type   | Required | Description                  |
| ---------- | ------ | -------- | ---------------------------- |
| `domain`   | string | No       | e.g. operations, food_safety |
| `severity` | string | No       | low, medium, high, critical  |
| `status`   | string | No       | open, resolved, dismissed    |
| `limit`    | int    | No       | Max 200, default 50          |
| `offset`   | int    | No       | Pagination offset            |

**Response fields:**

| Field                 | Type     | Description                 |
| --------------------- | -------- | --------------------------- | -------------------- |
| `deviation_id`        | UUID     | Deviation ID                |
| `department_id`       | UUID     | Department reference        |
| `session_id`          | UUID     | null                        | Linked session       |
| `domain`              | string   | Category domain             |
| `subcategory`         | string   | null                        | Sub-domain           |
| `severity`            | string   | low, medium, high, critical |
| `title`               | string   | Short description           |
| `description`         | string   | null                        | Detailed description |
| `cost_impact`         | number   | null                        | Estimated cost (NOK) |
| `linked_shift_id`     | UUID     | null                        | Related shift        |
| `status`              | string   | open, resolved, dismissed   |
| `resolution_notes`    | string   | null                        | How it was resolved  |
| `resolved_at`         | ISO 8601 | null                        | Resolution timestamp |
| `blocks_day_approval` | boolean  | Blocks daily close          |
| `requires_action`     | boolean  | Needs followup              |
| `payroll_impact`      | boolean  | Affects payroll             |
| `created_at`          | ISO 8601 | Record created              |
| `updated_at`          | ISO 8601 | Last modified               |

---

### 3.3 Reports

#### GET /v1/reconciliations

Daily financial reconciliation per department.

| Parameter       | Type       | Required | Description          |
| --------------- | ---------- | -------- | -------------------- |
| `department_id` | UUID       | No       | Filter by department |
| `status`        | string     | No       | Filter by status     |
| `date_from`     | YYYY-MM-DD | No       | Start date           |
| `date_to`       | YYYY-MM-DD | No       | End date             |
| `limit`         | int        | No       | Max 200, default 50  |
| `offset`        | int        | No       | Pagination offset    |

**Response fields:**

| Field                     | Type     | Description            |
| ------------------------- | -------- | ---------------------- | -------------------- |
| `reconciliation_id`       | UUID     | Record ID              |
| `department_id`           | UUID     | Department reference   |
| `session_id`              | UUID     | null                   | Linked session       |
| `reconciliation_date`     | date     | Business date          |
| `status`                  | string   | Reconciliation status  |
| `settled_at`              | ISO 8601 | null                   | Settlement timestamp |
| `approved_at`             | ISO 8601 | null                   | Approval timestamp   |
| `revenue_total`           | number   | Total revenue (NOK)    |
| `revenue_card`            | number   | Card payments          |
| `revenue_cash`            | number   | Cash payments          |
| `revenue_vat`             | number   | VAT amount             |
| `revenue_transactions`    | int      | Transaction count      |
| `revenue_source`          | string   | Data source            |
| `total_planned_hours`     | number   | Planned labor hours    |
| `total_actual_hours`      | number   | Actual labor hours     |
| `total_labor_cost`        | number   | Total labor cost (NOK) |
| `revenue_per_worked_hour` | number   | Revenue/hour KPI       |
| `labor_percentage`        | number   | Labor % of revenue     |
| `created_at`              | ISO 8601 | Record created         |
| `updated_at`              | ISO 8601 | Last modified          |

#### GET /v1/shift-approvals

Individual shift hour approvals tied to reconciliation.

| Parameter           | Type   | Required | Description               |
| ------------------- | ------ | -------- | ------------------------- |
| `reconciliation_id` | UUID   | No       | Filter by reconciliation  |
| `status`            | string | No       | Filter by approval status |
| `limit`             | int    | No       | Max 200, default 50       |
| `offset`            | int    | No       | Pagination offset         |

**Response fields:**

| Field                | Type     | Description             |
| -------------------- | -------- | ----------------------- | ---------------------- |
| `approval_id`        | UUID     | Record ID               |
| `reconciliation_id`  | UUID     | Parent reconciliation   |
| `shift_id`           | UUID     | Linked shift            |
| `punch_in`           | ISO 8601 | null                    | Clock-in time          |
| `punch_out`          | ISO 8601 | null                    | Clock-out time         |
| `planned_hours`      | number   | Planned hours           |
| `calculated_hours`   | number   | System-calculated hours |
| `approved_hours`     | number   | Manager-approved hours  |
| `status`             | string   | Approval status         |
| `edit_justification` | string   | null                    | Reason for adjustment  |
| `approved_by`        | UUID     | null                    | Approver (opaque UUID) |
| `approved_at`        | ISO 8601 | null                    | Approval timestamp     |
| `created_at`         | ISO 8601 | Record created          |
| `updated_at`         | ISO 8601 | Last modified           |

#### GET /v1/kpi-targets

Workspace KPI target definitions.

**No query parameters.** Returns all targets.

**Response fields:**

| Field             | Type     | Description    |
| ----------------- | -------- | -------------- | ------------------- |
| `id`              | UUID     | Target ID      |
| `metric`          | string   | Metric name    |
| `target_value`    | number   | Target value   |
| `benchmark_value` | number   | null           | Benchmark reference |
| `created_at`      | ISO 8601 | Record created |
| `updated_at`      | ISO 8601 | Last modified  |

#### GET /v1/budgets

Operational budget targets per date/location/department.

| Parameter   | Type       | Required | Description         |
| ----------- | ---------- | -------- | ------------------- |
| `date_from` | YYYY-MM-DD | No       | Start date          |
| `date_to`   | YYYY-MM-DD | No       | End date            |
| `limit`     | int        | No       | Max 200, default 50 |
| `offset`    | int        | No       | Pagination offset   |

**Response fields:**

| Field                | Type     | Description                 |
| -------------------- | -------- | --------------------------- | -------------------- |
| `id`                 | UUID     | Budget record ID            |
| `location_id`        | UUID     | null                        | Location reference   |
| `department_id`      | UUID     | null                        | Department reference |
| `period_type`        | string   | Granularity (daily, hourly) |
| `period_date`        | date     | Budget date                 |
| `hour_slot`          | int      | null                        | Hour slot (0-23)     |
| `revenue_target`     | number   | Revenue target (NOK)        |
| `labor_cost_target`  | number   | Labor cost target (NOK)     |
| `labor_hours_target` | number   | Planned hours target        |
| `currency`           | string   | Currency code               |
| `notes`              | string   | null                        | Budget notes         |
| `created_at`         | ISO 8601 | Record created              |
| `updated_at`         | ISO 8601 | Last modified               |

---

## 4. Common Patterns

### Authentication

```bash
curl -H "Authorization: Bearer smo_sk_live_<key>" \
     https://api.smartout.ai/v1/shifts?date_from=2026-03-01&date_to=2026-03-31
```

### Pagination

All list endpoints support `limit` (1-200, default 50) and `offset`.

```
GET /v1/shifts?limit=100&offset=200
```

### Error Responses

| Code | Meaning                                                 |
| ---- | ------------------------------------------------------- |
| 200  | Success                                                 |
| 400  | Bad request (missing workspace context, invalid params) |
| 401  | Invalid or missing API key                              |
| 403  | Missing required scope                                  |
| 404  | Unknown endpoint                                        |
| 429  | Rate limit exceeded — check `Retry-After` header        |
| 500  | Internal error                                          |

```json
{ "error": "Missing scope: profiles:read" }
```

### Rate Limiting

60 requests per minute per key. Response headers on 429:

| Header                  | Value               |
| ----------------------- | ------------------- |
| `X-RateLimit-Remaining` | Remaining requests  |
| `Retry-After`           | Seconds until reset |

Implement exponential backoff.

---

## 5. API Key Policy

### Key Specification

| Property    | Value                                               |
| ----------- | --------------------------------------------------- |
| Prefix      | `smo_sk_live_`                                      |
| Type        | Workspace key                                       |
| Scopes      | `schedules:read`, `operations:read`, `reports:read` |
| Rate limit  | 60 req/min                                          |
| Expiry      | 90 days from issuance                               |
| Environment | Production only (`smo_sk_test_*` blocked in prod)   |

### Key Lifecycle

| Event        | What Happens                                                     |
| ------------ | ---------------------------------------------------------------- |
| **Creation** | Raw key shown once. Only SHA-256 hash stored.                    |
| **Rotation** | New key issued with grace period (old key works during overlap). |
| **Expiry**   | Key stops working after `expires_at`. No grace.                  |
| **Revoke**   | Immediate. All versions of the key are invalidated.              |

### Usage Tracking

Every API call is logged:

- Key ID
- Endpoint called
- HTTP status
- Timestamp
- Hourly aggregation in `platform_api_key_usage`

SmartOut monitors usage patterns. Anomalous spikes will trigger review.

### Key Delivery

- Key is generated in SmartOut platform admin
- Delivered to EDDA via secure channel (not email)
- EDDA stores key in their secret management system
- Key is never logged, committed to code, or transmitted in plaintext

---

## 6. Data Security

### What EDDA Cannot Do

- Resolve `employee_id` UUIDs to names (no `profiles:read` scope)
- Access employment contracts
- Access training content or completion data
- Write or mutate any data (all endpoints are GET-only)
- Access other workspaces (key scoped to one workspace)
- Use test keys in production

### Free-Text Fields

Some fields (`signoff_notes`, `handoff_notes`, `resolution_notes`, `edit_justification`) are free-text written by managers. These may occasionally contain first names in context (e.g. "Talked to Lars about the deviation"). This is incidental, not structured PII.

### Data Handling Requirements

1. **Purpose limitation** — Data used only for agreed data collection scope
2. **No re-identification** — EDDA must not attempt to resolve UUIDs to individuals
3. **Retention** — Max 12 months rolling, then delete
4. **Storage** — Encrypted at rest
5. **Access** — Principle of least privilege within EDDA's organization
6. **Breach notification** — 72 hours (GDPR Art. 33)
7. **Deletion on termination** — All SmartOut data deleted when agreement ends

---

## 7. Integration Checklist

- [ ] DPA (Data Processing Agreement) signed
- [ ] Confirm target workspace
- [ ] API key created with scopes: `schedules:read, operations:read, reports:read`
- [ ] Key delivered via secure channel
- [ ] EDDA stores key in secret management
- [ ] Test integration against sandbox (`smo_sk_test_*` key)
- [ ] Validate rate limit handling (429 + backoff)
- [ ] Go live with production key
- [ ] Schedule 90-day key rotation

---

## 8. Quick Start

```bash
# List today's shifts
curl -s -H "Authorization: Bearer $SMARTOUT_KEY" \
  "https://api.smartout.ai/v1/shifts?date_from=2026-03-11&date_to=2026-03-11"

# List active sessions
curl -s -H "Authorization: Bearer $SMARTOUT_KEY" \
  "https://api.smartout.ai/v1/sessions?status=active"

# Get this month's reconciliations
curl -s -H "Authorization: Bearer $SMARTOUT_KEY" \
  "https://api.smartout.ai/v1/reconciliations?date_from=2026-03-01"

# Get budget targets
curl -s -H "Authorization: Bearer $SMARTOUT_KEY" \
  "https://api.smartout.ai/v1/budgets?date_from=2026-03-01&date_to=2026-03-31"
```

---

_This document covers the EDDA integration surface only. Additional scopes and endpoints are available but not included in this agreement._
