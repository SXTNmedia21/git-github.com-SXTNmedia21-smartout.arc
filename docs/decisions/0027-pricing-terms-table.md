---
id: ADR-0027
title: Pricing Terms Table for Workspace Commercial Model
status: accepted
date: 2026-02-28
layer: decision
---

# ADR-0027: Pricing Terms Table for Workspace Commercial Model

## Context and Problem Statement

Platform admins need to create workspaces for clients with configurable pricing terms based on real contract patterns (e.g. the Spatind agreement). Pricing includes onboarding packages (one-time fee), monthly license costs, per-employee pricing, billing intervals, discounts, and trial periods. Contract templates should optionally carry default pricing that pre-fills the workspace creation form.

## Decision Drivers

- Real contracts (Spatind) define: onboarding tier, monthly cost, price per employee, billing interval, discount percentage
- Pricing terms must be stored separately from the workspace to support historical pricing and contract linkage
- Contract templates should optionally pre-fill pricing to speed up workspace creation
- Platform-admin tables follow the no-RLS, service-role-only pattern (like `platform_audit_log`)

## Considered Options

1. **Store pricing on workspace table** — add pricing columns directly to workspace
2. **Separate pricing_terms table** — dedicated table linked to company, workspace, and contract
3. **JSONB on company table** — store pricing as JSON alongside subscription data

## Decision Outcome

**Option 2: Separate pricing_terms table.** This gives us:

- Historical pricing (effective_from/effective_until) without workspace bloat
- Contract linkage (pricing_terms can reference the contract that defined them)
- Multiple pricing periods per workspace (e.g. trial pricing → production pricing)
- Clean separation of concerns

Additionally, `contract_template.default_pricing` (JSONB) allows templates to carry optional default pricing values that pre-fill the form when a template is selected during workspace creation.

## Rules & Consequences

- `pricing_terms` is a platform-admin table — no RLS, service role only
- All pricing amounts use `decimal(12,2)` for precision
- `currency` column reuses the existing `currency` enum (NOK, SEK, DKK, EUR)
- `billing_interval` is a text column with CHECK constraint (monthly, quarterly, yearly)
- `effective_until IS NULL` means the pricing terms are currently active
- `contract_template.default_pricing` shape: `{ monthly_cost, price_per_employee, billing_interval, onboarding_package, onboarding_cost, discount_percent, discount_label, trial_days }`
