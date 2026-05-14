---
title: "POS Integration — Adapter Pattern, Sale-Event Append-Only"
id: ADR_0305
status: proposed
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

# ADR-0305: POS Integration — Adapter Pattern, Sale-Event Append-Only

## Context and Problem Statement

Smartout cascade D4 (Demand) parameterizes day_factor / hour_factor coefficients
manually today. Without sales data from POS (point-of-sale), demand forecasting
is mageføl. Hospitality industry's core KPI is sales-per-labor-hour (SPLH);
without it Smartout cannot ship real-time labor% or auto-staffing. POS-vendor
landscape is fragmented (Lightspeed, Toast, Square, Onslip, Tripletex POS,
Cashbon, Mews POS) — direct integration per vendor scales linearly with
maintenance cost.

## Decision Drivers

- D4 demand inputs need real sales history (not coefficients picked by manager).
- Real-time labor% dashboard needs sales stream within minutes of transaction.
- Vendor count high; integration code must isolate vendor specifics from cascade.
- Norway-first launch; Lightspeed has Nordic presence + open REST API.
- Append-only event store matches existing `engine_event` pattern + simplifies replay.

## Considered Options

1. **Per-vendor direct integration in cascade code** — fastest first vendor, fails at vendor #2.
2. **Adapter pattern + canonical `pos_sale_event` table** — vendor adapters write to one schema; cascade reads only canonical shape.
3. **Third-party aggregator (e.g. Plaid-for-POS)** — outsources problem; vendor coverage gaps + ongoing per-event cost.

## Decision Outcome

Chosen option: **Option 2 — adapter pattern + canonical sale-event table**.

**MVP scope (sjapp / lightweight first iteration):**

- One vendor: **Lightspeed Restaurant K-Series** (Nordic presence, OAuth2, REST).
- Schema (one migration):
  - `public.pos_account` — workspace_id, vendor enum, external_account_id, credentials_ref (op:// URI, never plaintext), sync_state, last_synced_at, status, created_at, updated_at.
  - `public.pos_sale_event` — workspace_id, location_id (FK department or null), occurred_at, vendor enum, external_event_id (unique with vendor), gross_amount_minor, net_amount_minor, currency, item_count, raw_payload jsonb, created_at. Append-only.
  - Indexes: `(workspace_id, occurred_at desc)`, unique `(vendor, external_event_id)`.
  - RLS: workspace-scoped read; service-role write only (adapter writes via Edge Function).
- Adapter contract: `packages/ai/src/adapters/pos/<vendor>.ts` exports `pull(account, since): SaleEvent[]`.
- Sync: Edge Function `pos-sync` runs every 5 min via Supabase cron, iterates active accounts, calls adapter, INSERTs new events ON CONFLICT DO NOTHING.
- Cascade D4 read: new view `cascade.v_pos_sales_hour` aggregates `(workspace_id, location_id, hour_bucket, gross_minor, txn_count)` for `hour_factor` consumer.
- No real-time push V1; 5-min cron delay acceptable for forecasting.
- No POS write-back V1 (Smartout never modifies POS data).

**Out of scope V1:** webhook ingestion, multi-vendor per workspace, POS labor-cost write-back, payment-method splits, tip data (separate ADR — see open-shift marketplace ADR-0306 follow-on for tip-pool ADR).

## Rules & Consequences

- **Good, because** vendor adapters isolated; cascade D4 reads one canonical shape; append-only enables replay + audit.
- **Good, because** unblocks demand-forecasting ML + real-time labor% (both downstream features).
- **Bad, because** 5-min cron lag; not real-time. Acceptable for forecasting, not for live floor-management dashboard (separate ADR for webhook upgrade if needed).
- **Bad, because** raw_payload jsonb growth — partition or archive policy needed when first workspace exceeds 1M rows (defer to ADR when triggered).
- **Bad, because** credentials in 1Password; rotation requires manual op:// update + Edge Function restart V1 (acceptable; rotation is rare).
- **Agent Impact:**
  - When building demand-related capabilities, READ from `cascade.v_pos_sales_hour`, never query Lightspeed directly.
  - When adding second POS vendor, follow adapter contract; do NOT extend cascade reader.
  - Never write `pos_sale_event` from anywhere except `supabase/functions/pos-sync/`.
  - Treat `pos_sale_event` as immutable; corrections via new event with negative amount.

---

> Register in `docs/decisions/0000-decision-log.md`. First sortie: `feat/pos-integration-lightspeed-mvp` — schema + adapter scaffolding + cron + view. Estimated 3-5 days.
