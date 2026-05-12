---
title: "ADR-0012: Subscription Data on Company Table (No Separate Table)"
id: ADR_0012
status: accepted
layer: decision
created: 2026-02-27
updated: 2026-02-27
---

# ADR-0012: Subscription Data on Company Table (No Separate Table)

**Date:** 2026-02-27
**Status:** Accepted

## Context

Smartout uses Stripe for billing. The question was whether to create a separate `stripe_subscription` table or embed subscription data on the existing `company` table.

## Decision

Subscription data lives directly on the `company` table:

```sql
company.subscription_plan     -- text (e.g., 'starter', 'pro', 'enterprise')
company.subscription_status   -- text (e.g., 'trial', 'active', 'past_due', 'cancelled')
company.trial_ends_at         -- timestamptz
```

There is **no** `stripe_subscription` table.

## Rationale

- One company = one subscription (1:1 relationship doesn't need a separate table)
- Simplifies queries — no joins needed to check subscription status
- RLS policies can directly reference `company.subscription_status`
- Stripe webhook handler updates `company` row directly
- Matches the existing operational system being rebuilt from Bubble.io

## Consequences

- Module 13 (Multi-tenant) docs reference `stripe_subscription` — needs correction
- Stripe customer ID, payment method details, and invoice history should be stored in Stripe (not duplicated in our DB)
- If multi-subscription per company is ever needed, this decision must be revisited
