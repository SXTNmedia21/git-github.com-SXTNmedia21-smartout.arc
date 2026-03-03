---
title: "Module 11: Innstillinger & Administrasjon (Settings & Administration)"
id: MODULE_11
version: "1.0"
status: draft
layer: module
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
tags:
  - settings
  - administration
  - workspace-config
  - module-activation
  - gdpr
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Module 11: Innstillinger & Administrasjon (Settings & Administration)

> **Smartout.ai** — Functional documentation for migration
> Version 1.0 | February 2026
> **Dependencies:** Core Architecture v2, Module 13 (Multi-Tenant/Billing)
> **Status:** PLACEHOLDER — requires detailed specification

---

## 1. Module Overview

Workspace-level settings and configuration. Covers branding, module activation, payroll rules, notification defaults, integrations, and data management.

### What This Module Covers

- Workspace settings (name, logo, timezone, language, defaults)
- Module activation/deactivation per plan
- User management (roles, departments, statuses)
- Payroll configuration (supplements, overtime, pension) — via Policy
- Notification settings (channels, rate limits, quiet hours)
- Integration configuration
- Data export and GDPR tools

---

## 2. Workspace Settings

> **TODO:** Detailed specification needed

- Company name, logo, branding colors
- Timezone and locale
- Default values for shifts, breaks, etc. — via Policy (`policy_type: scheduling`)
- Module activation/deactivation (`active_modules[]` on Workspace)
- Subscription/billing link (→ Module 13)

---

## 3. User Management

> **TODO:** Detailed specification needed

- Create/edit/deactivate profiles
- Role assignment (employee, manager, admin, owner)
- Department/team assignment
- Employment profile details
- Status management (trainee → active → inactive → offboarding)

---

## 4. Payroll Settings

> **TODO:** Detailed specification needed

- All configured via Policy (`policy_type: payroll`) with `rules_json`
- Supplement rules and rates
- Day categories and time boundaries
- Overtime rules
- Vacation pay rate (12%)
- Pension (OTP 2% minimum)
- Employer social security (arbeidsgiveravgift 14.1%)

---

## 5. Notification Settings

> **TODO:** Detailed specification needed

- Global notification rules
- Channel priority (push, SMS, email, voice)
- Rate limits per user/per channel
- Default quiet hours
- Per-event notification configuration

---

## 6. Integrations

> **TODO:** Detailed specification needed

| Integration | Purpose    | Configuration              |
| ----------- | ---------- | -------------------------- |
| Supabase    | Backend    | Automatic (no user config) |
| Twilio      | SMS/Voice  | API keys, phone numbers    |
| SendGrid    | Email      | API key, sender domain     |
| Stripe      | Billing    | Managed via Module 13      |
| n8n         | Automation | Webhook URLs               |
| DocuSeal    | Contracts  | Template IDs, API key      |

---

## 7. Data & Export

> **TODO:** Detailed specification needed

- GDPR data export per user (JSON/CSV)
- Data deletion with cascading rules
- Backup information (Supabase managed)
- Audit log viewer

---

## 8. UI Routes

| Screen             | Route                     | Description                                 |
| ------------------ | ------------------------- | ------------------------------------------- |
| Workspace Settings | `/settings`               | Name, logo, timezone, language, defaults    |
| Modules            | `/settings/modules`       | Active modules toggle. Plan limits.         |
| Billing            | `/settings/billing`       | Stripe subscription. Plan, usage, invoices. |
| Payroll Config     | `/settings/payroll`       | Supplement rules, day categories, overtime. |
| Notifications      | `/settings/notifications` | Global rules, channels, rate limits.        |
| Integrations       | `/settings/integrations`  | Connected services. API keys.               |
| Data & Privacy     | `/settings/data`          | GDPR export, data deletion, audit log.      |

---

_This module requires detailed specification. Many settings are configured via the Policy system with `rules_json` — the Settings UI is essentially a friendly editor for those Policy objects._
