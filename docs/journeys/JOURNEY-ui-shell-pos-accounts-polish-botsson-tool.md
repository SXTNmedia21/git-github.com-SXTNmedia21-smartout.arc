---
title: "Journey — Botsson reads POS state via page-scope tool, never mutates"
status: verified
feature: pos-accounts-polish
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, admin, pos, harness, botsson, ui-shell, campaign-ui-shell]
---

# Journey — Botsson queries POS state (read-only, ADR-0244)

> Sub-sortie: `ui-shell-pos-accounts-polish`. Verifies Phase 7+8 boundaries — page-scope tools READ-ONLY, mutations stay voice-only per ADR-0288.

## Journey: Admin asks Botsson "kan jeg koble til POS?"

**Precondition:** Admin signed-in, route `/dashboard/admin/pos-accounts`. `pos_account_management` capability exists with `connect_lightspeed` (chat-only mutation per ADR-0288). Page-scope kit `admin-pos-accounts` registered with 2 read-only tools.

1. Admin types "kan jeg koble til POS?" in Botsson chat → BFF forwards `client_tools` for current route → HarnessAdapter resolves page-scope kit
2. LLM picks `getPosActionState` (read tool) → returns `{ canConnect: true, hasActiveAccount: false, hint: "Trykk 'Koble til ny' øverst på siden." }` → composes "Ja, ingen POS koblet til ennå. Trykk 'Koble til ny' øverst på siden for å starte Lightspeed-tilkoblingen."
3. If admin says "koble til Lightspeed nå" → LLM does NOT find a connect tool on page-scope kit (read-only by design) → falls back to capability `connect_lightspeed` (voice-only chat per ADR-0288) → if on chat channel, capability fires with `mutateWithGate()` + emit; if on voice channel, capability blocks per ADR-0288

**Postcondition:** Page-scope kit answers read questions without `query_smartout` fallback. Mutations route through capability layer with proper gate + telemetry. Latency <2s end-to-end.

**Error paths:**
- Page-scope tool returns PII (oauth token) → review-time block (this journey forbids it)
- Capability fires from voice channel → blocked per ADR-0288, fallback message "Koble til via dashboard"
- Page-scope tool name collides with capability → site-map validator catches

## Verification

- `apps/web/.botsson/site-map.json` has `/dashboard/admin/pos-accounts` entry with tools `getPosAccountsState` + `getPosActionState` (verbatim)
- `pnpm --filter web site-map:validate` exits 0
- `chat-harness-pipeline.test.ts` still green (no regression)
- Manual: open Botsson chat on /dashboard/admin/pos-accounts, ask state question → answer specific, no `query_smartout` fallback in stage-engine logs
- Manual: tool response NEVER contains `oauth_token` field (PII safety per ADR-0077)

## E2E (recommended)

Chat-path manual verification sufficient. Voice-path covered by ADR-0288 enforcement test in capability layer.
