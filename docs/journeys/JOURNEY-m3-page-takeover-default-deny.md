---
title: "Journey — Workspace without authority opt-in → gateAction denies → no preview"
feature: m3-page-takeover
journey: default-deny
status: verified
verified_at: 2026-04-29
e2e_test: apps/e2e/tests/journey-page-takeover-default-deny.spec.ts
created: 2026-04-29
updated: 2026-04-29
module: Core
tags: [journey, help, takeover, security, gate-action, default-deny]
---

# Journey: Default-deny — gateAction denies before preview

**Role:** admin (workspace WITHOUT authority opt-in for page_takeover)

**Precondition:** Workspace `engine_authority_config` row for capability='page_takeover.help.panic_bar_human_button' has level='disabled' (default seed). Admin loads /help. Botsson chat hero ready.

## Happy Path

1. Admin asks Botsson to open helpdesk ticket.
2. agent-router selects `ui.simulate_click({ target_id: "panic_bar_human_button" })`.
3. Tool calls Server Action `pageTakeoverGateAction({ target_id })`.
4. gateAction RPC returns `{ allow: false, reason: 'authority_disabled' }`.
5. Tool returns `{ ok: false, reason: 'authority_denied', user_message: 'Denne handlingen er ikke aktivert i workspace.' }`.
6. NO preview overlay rendered. NO `page_takeover.action_proposed` emit (gate denial precedes proposed event).
7. Botsson chat-responds with the user_message OR the agent rephrases: "Jeg har ikke tillatelse til å gjøre det her — be admin aktivere page-takeover først."

**Postcondition:** Page state unchanged. activity_trail has zero takeover events for this attempt (gate denied at server, no proposed/confirmed/executed).

## Error Paths

- **Scenario:** Admin manually edits `engine_authority_config` to level='read_write' → next invocation flows through to confirm-and-execute journey.
- **Scenario:** gateAction RPC errors (DB unreachable) → tool returns `{ ok: false, reason: 'gate_rpc_error' }`. Default-deny stance.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — fresh workspace + tool invocation + assert no preview + telemetry shows no proposed event
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
