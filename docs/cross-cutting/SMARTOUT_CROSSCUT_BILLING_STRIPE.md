---
title: "Payments, Billing & Stripe Integration"
id: XCUT_BILLING
version: "1.0"
status: canonical
layer: cross-cutting
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - billing
  - stripe
  - payments
  - subscriptions
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Cross-Cutting: Payments, Billing & Stripe Integration

> **Smartout.ai** — Cross-cutting documentation
> Version 1.0 | February 2026
> **Source:** SMARTOUT_COMPLETE_DOCUMENTATION.md, Section 24
> **See also:** SMARTOUT_MODULE_13_MULTITENANT.md (subscription tables, plan tiers, enforcement)

---

> Stripe billing is primarily documented in Module 13 (Multi-Tenant). This document provides the detailed Stripe data model and integration patterns from Complete Documentation.

## 1. Pricing Model

Per employee / per month. Plan tiers define: max_profiles, active_modules, AI access, support tier, storage limits. Trainee profiles count toward plan limit.

## 2. Stripe Data Model

```
stripe_subscription
  subscription_id, company_id, stripe_customer_id, stripe_subscription_id,
  plan_id, status (trial|active|paused|past_due|cancelled|unpaid),
  current_period_start/end, trial_end, cancel_at, cancelled_at

stripe_invoice
  invoice_id, company_id, stripe_invoice_id, amount, currency,
  status (draft|open|paid|void|uncollectible), invoice_url, invoice_pdf,
  period_start/end

stripe_payment_method
  payment_method_id, company_id, stripe_pm_id, type (card|bank_transfer|invoice),
  last_four, brand, is_default
```

## 3. Subscription Lifecycle

```
Trial (14 days) → Active → Paused / Past Due / Cancelled
```

## 4. Webhook Integration

Events: subscription.created/updated/deleted, invoice.paid/payment_failed, trial_will_end.
Edge Function: `stripe-webhook/index.ts` with Stripe signature validation.

## 5. Payment Failure Recovery

1→3d→7d→14d (read-only) →30d (suspended) →90d (deletion warning) →120d (deleted).

---

_For plan tiers, profile enforcement, and billing events see SMARTOUT_MODULE_13_MULTITENANT.md §6._
_For platform-level billing management (super admin) see SMARTOUT_MODULE_17_PLATFORM_ADMIN.md §4.4._
