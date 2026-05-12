---
title: "Journey — harness-coverage-top3-batch4"
feature: harness-coverage-top3-batch4
branch: feat/harness-coverage-top3-batch4
created: 2026-05-12
updated: 2026-05-12
module: ai
status: verified
tags: [e2e, harness, coverage, legal, helpdesk, billing-query]
---

# Journey — harness-coverage-top3-batch4

## Why

Fourth wave of Botsson harness E2E coverage. Closes 3 capability gaps: legal (3 tools), helpdesk_query (4 tools), billing-query (6 tools). Total +13 tools toward 100% capability coverage.

## Journey 1 — Legal capability E2E

**Precondition:** Stage-engine fresh, Supabase healthy, seed admin in seed workspace.

1. BFF call with legal query (`"hva sier §14-6"`, `"kveldstillegg for bartender"`)
2. Stage-engine routes to legal capability
3. `cite_law` fires → response contains paragraph reference (`§`, `Aml.`, `Riksavtalen`)
4. `activity_trail.legal.law_cited` row written
5. validate_aml_14_6 covered (16-letter compliance check)

**Postcondition:** 2 chat-channel tools verified. `classify_amendment` system-channel-only — tracked as gap `legal-classify-amendment-system-e2e`.

## Journey 2 — Helpdesk_query capability E2E

**Precondition:** Same. Seed admin has authority `read_only` or `suggest`.

1. BFF call with helpdesk query (`"er saken min løst"`)
2. `list_my_queue` fires → DB query contract verified
3. `get_ticket` field shape verified
4. `open_ticket` mutation contract verified (suggest+ authority)
5. `resolve_ticket` mutation + emit shape (completed_at stamp per L-0079)

**Postcondition:** 4 tools covered. Router-level gate verified. ADR-0151 actor_profile_id confirmed.

**Error paths:** open_ticket self-skips when authority is read_only. Voice path skipped.

## Journey 3 — Billing-query capability E2E

**Precondition:** Seed admin profile in workspace with billing data (Erik portal scope).

1. BFF call with billing query for each of 6 tools
2. Each tool fires with classifier intent='billing_query'
3. `botsson.tool_invoked` trail row written per tool
4. Email masking verified for invoice_dispatch surface (PII non-leak)

**Postcondition:** All 6 read-side billing tools verified. Empty-state handled gracefully (paid invoice → empty overdue list).

**Error paths:** get_invoice_basis RPC dependency — A9 graceful if RPC not deployed. M1 masking conditional on seeded dispatch row.
