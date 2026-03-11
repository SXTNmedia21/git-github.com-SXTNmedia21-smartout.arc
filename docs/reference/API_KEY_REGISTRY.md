---
title: API Key Registry — External Partners
status: in_progress
updated: 2026-03-11
created: 2026-03-11
module: platform-admin
tags: [api-keys, security, partners, external]
---

# API Key Registry — External Partners

> Single source of truth for all externally issued API keys. Update this document whenever a key is created, rotated, or revoked.

---

## Active Keys

| #   | Partner | Key Prefix           | Type      | Workspace | Scopes                                              | Rate Limit | Issued  | Expires  | Status         |
| --- | ------- | -------------------- | --------- | --------- | --------------------------------------------------- | ---------- | ------- | -------- | -------------- |
| 1   | EDDA    | `smo_sk_live_edda_*` | workspace | TBD       | `schedules:read`, `operations:read`, `reports:read` | 60/min     | Pending | +90 days | Not yet issued |

## Revoked Keys

| #   | Partner | Key Prefix | Issued | Revoked | Reason |
| --- | ------- | ---------- | ------ | ------- | ------ |
| —   | —       | —          | —      | —       | —      |

## Rotation History

| #   | Partner | Old Key | New Key | Rotated | Grace Period | Completed |
| --- | ------- | ------- | ------- | ------- | ------------ | --------- |
| —   | —       | —       | —       | —       | —            | —         |

---

## Scope Inventory

Which external partners have access to which scopes:

| Scope             | EDDA    | (future) | (future) |
| ----------------- | ------- | -------- | -------- |
| `profiles:read`   | **No**  | —        | —        |
| `contracts:read`  | **No**  | —        | —        |
| `training:read`   | **No**  | —        | —        |
| `schedules:read`  | **Yes** | —        | —        |
| `operations:read` | **Yes** | —        | —        |
| `reports:read`    | **Yes** | —        | —        |
| `guardian:read`   | **No**  | —        | —        |
| `events:read`     | **No**  | —        | —        |
| `suppliers:read`  | **No**  | —        | —        |
| `waste:read`      | **No**  | —        | —        |
| `equipment:read`  | **No**  | —        | —        |

---

## External API Surface Summary

Total public API endpoints: **24**
Endpoints available to EDDA: **10** (of 24)
Endpoints denied to EDDA: **14**
Internal-only endpoints (not in public API): **~131**

### EDDA's 10 Endpoints

| Endpoint                  | Scope             | Data Type                      |
| ------------------------- | ----------------- | ------------------------------ |
| `GET /v1/shifts`          | `schedules:read`  | Shift schedules                |
| `GET /v1/absences`        | `schedules:read`  | Absence records                |
| `GET /v1/sessions`        | `operations:read` | Daily operational sessions     |
| `GET /v1/deviations`      | `operations:read` | Operational exceptions         |
| `GET /v1/reconciliations` | `reports:read`    | Daily financial reconciliation |
| `GET /v1/shift-approvals` | `reports:read`    | Shift hour approvals           |
| `GET /v1/kpi-targets`     | `reports:read`    | KPI target definitions         |
| `GET /v1/budgets`         | `reports:read`    | Operational budgets            |

### Denied Endpoints (Exist But Not Granted)

| Endpoint                    | Scope            | Reason                              |
| --------------------------- | ---------------- | ----------------------------------- |
| `GET /v1/profiles`          | `profiles:read`  | PII — display_name, employee_number |
| `GET /v1/departments`       | `profiles:read`  | Bundled with profiles scope         |
| `GET /v1/teams`             | `profiles:read`  | Bundled with profiles scope         |
| `GET /v1/locations`         | `profiles:read`  | Bundled with profiles scope         |
| `GET /v1/contracts`         | `contracts:read` | PII — employment contracts          |
| `GET /v1/protocols`         | `training:read`  | Internal governance                 |
| `GET /v1/assignments`       | `training:read`  | Internal governance                 |
| `GET /v1/signals`           | `guardian:read`  | Internal alerting                   |
| `GET /v1/guardian-log`      | `guardian:read`  | Internal alerting                   |
| `GET /v1/events`            | `events:read`    | Internal event stream               |
| `GET /v1/suppliers`         | `suppliers:read` | Not in scope                        |
| `GET /v1/supplier-orders`   | `suppliers:read` | Not in scope                        |
| `GET /v1/waste-logs`        | `waste:read`     | Not in scope                        |
| `GET /v1/assets`            | `equipment:read` | Not in scope                        |
| `GET /v1/asset-maintenance` | `equipment:read` | Not in scope                        |
| `GET /v1/asset-downtime`    | `equipment:read` | Not in scope                        |

---

## Security Controls Per Key

Every external key has these controls active:

| Control                 | Detail                                         |
| ----------------------- | ---------------------------------------------- |
| Workspace isolation     | Key scoped to exactly one workspace via RLS    |
| Scope enforcement       | `requireScope()` checked before every query    |
| Rate limiting           | Per-key, configurable (default 60/min)         |
| Usage logging           | Every call logged: endpoint, status, timestamp |
| Environment enforcement | Test keys blocked in production                |
| Expiry                  | Configurable, enforced at gateway              |
| Rotation                | Dual-key with grace period                     |
| Revocation              | Immediate, all versions                        |
| Storage                 | SHA-256 hash only — raw key never stored       |

---

## Procedures

### Issuing a New Key

1. Confirm DPA signed
2. Add row to Active Keys table above
3. Create key in platform admin (`/dashboard/platform-admin/keys`)
4. Set scopes, rate limit, expiry
5. Deliver raw key via secure channel (1Password share, encrypted message)
6. Update this document with issue date and expiry

### Rotating a Key

1. Create new key with same scopes
2. Set grace period (recommend 48h)
3. Notify partner of new key
4. Old key auto-expires after grace period
5. Log in Rotation History table

### Revoking a Key

1. Revoke in platform admin (immediate)
2. Move from Active to Revoked table
3. Notify partner
4. Document reason

---

## Changelog

| Date       | Change                                           | Author |
| ---------- | ------------------------------------------------ | ------ |
| 2026-03-11 | Initial version — EDDA as first external partner | Claude |
