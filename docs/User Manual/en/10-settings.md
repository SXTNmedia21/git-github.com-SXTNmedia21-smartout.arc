---
title: "Settings"
id: MANUAL_10_EN
version: "1.0"
status: canonical
layer: manual
created: 2026-03-24
updated: 2026-03-24
author: claude
slug_en: settings
tags:
  - manual
  - settings
  - configuration
  - gdpr
  - english
---

# Settings

> Configuration, subscription, GDPR, language and integrations — customise SmartOut for your business.

---

## Workspace settings

These settings apply per workspace:

### General

- **Name and logo** — Workspace name and profile picture
- **Address** — Physical address used in reports and contracts
- **Timezone** — Default: Europe/Oslo
- **Language** — Norwegian (default), Swedish, Danish, Finnish or English
- **Currency** — NOK (default), SEK, DKK or EUR

### Operations

- **Opening hours** — Weekly schedule for workspace and departments
- **Break rules** — Automatic break calculation based on shift length
- **Overtime rules** — When overtime starts and which supplements apply
- **Time clock** — Enable/disable, allow late clock-in, geofencing

### Modules

Each module can be enabled or disabled per workspace:

| Module             | Default                    |
| ------------------ | -------------------------- |
| Shift schedule     | Always active              |
| Onboarding         | Active                     |
| Tasks and routines | Active                     |
| HACCP              | Active for restaurant/cafe |
| Communication      | Active                     |
| Reports            | Active                     |
| AI assistant       | Active                     |

---

## Company settings

These settings apply to the entire company (all workspaces):

### Subscription

- **Plan** — View current plan and usage
- **Billing** — Manage payment method (Stripe)
- **Invoice history** — Download previous invoices
- **Upgrade/downgrade** — Change plan

### User management

- **Owners** — Manage who has owner access
- **Administrators** — Manage admin access
- **Invitations** — View pending invitations

---

## GDPR and privacy

SmartOut is built for GDPR compliance from the ground up:

### Data processing

- **Deletion** — Employees can request deletion of personal data (right to be forgotten)
- **Export** — Employees can download all their personal data (data portability)
- **Consent** — Consent management for data processing
- **Access control** — Row-Level Security (RLS) on all tables

### Retention

- **Active data** — Stored as long as the employment relationship lasts
- **Archived data** — Stored in accordance with Norwegian legislation (typically 5 years for payroll data)
- **Deleted data** — Permanently removed after confirmation

> SmartOut stores all data within EU/EEA in compliance with the Schrems II ruling.

---

## Language and localisation

SmartOut supports five languages:

| Language  | Code |
| --------- | ---- |
| Norwegian | `no` |
| Swedish   | `sv` |
| English   | `en` |
| Danish    | `da` |
| Finnish   | `fi` |

- **Workspace language** — Determines the default language for all employees
- **Personal language** — Each employee can override with their preferred language
- **Content language** — Policies and protocols can have translations

---

## Integrations

SmartOut integrates with the following services:

| Service      | Purpose                                | Status |
| ------------ | -------------------------------------- | ------ |
| **Stripe**   | Billing and subscription               | Active |
| **DocuSign** | Employment contracts and confirmations | Active |
| **SendGrid** | Transactional email                    | Active |
| **Twilio**   | SMS notifications                      | Active |
| **PostHog**  | Product analytics                      | Active |

> More integrations are planned — including payroll systems, POS systems and time tracking tools.

---

## Notification preferences

Manage which notifications you receive and how:

- **Push notifications** — Enable/disable per notification type
- **SMS** — Choose which events send SMS
- **Email** — Daily summary or real-time alerts
- **Quiet hours** — Configure when notifications are muted
