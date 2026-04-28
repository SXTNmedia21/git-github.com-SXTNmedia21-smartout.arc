---
title: "Journey — User asks Botsson to open ticket → preview → confirm → click executes"
feature: m3-page-takeover
journey: confirm-and-execute
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: Core
tags: [journey, help, takeover, botsson, admin]
---

# Journey: User asks Botsson to perform action → preview → confirm → execute

**Role:** admin (with `page_takeover.help.panic_bar_human_button` authority opt-in)

**Precondition:** Admin on `/dashboard/help`. Workspace has authority config row with level='read_write' for the relevant target. Botsson chat hero loaded.

## Happy Path

1. Admin types: "Botsson, åpne en helpdesk-sak til menneske for meg".
2. agent-router classifies intent → selects `ui.simulate_click` tool with `{ target_id: "panic_bar_human_button" }`.
3. Tool calls Server Action `pageTakeoverGateAction({ target_id })` → gateAction returns allow=true.
4. Telemetry emit `page_takeover.action_proposed` with target_id + capability.
5. usePageTakeover state machine: idle → previewing.
6. TakeoverPreview overlay renders: outline around panic-bar "human" button + chip "Klikk for å bekrefte (3s)" + "ESC for å avbryte".
7. After 3000ms, confirm button enables.
8. Admin clicks "Klikk for å bekrefte".
9. usePageTakeover state: previewing → executing. Telemetry `page_takeover.action_confirmed`.
10. Tool fires `(element as HTMLElement).click()` on resolved selector.
11. Telemetry `page_takeover.action_executed`.
12. State: executing → done.
13. Botsson's existing PanicConfirmDrawer (Sheet) opens — admin sees second-level confirmation drawer (own UX, NOT chained by Botsson).
14. Admin completes second confirmation themselves (per Q2 default: each takeover step is one user-confirmation; no chaining).

**Postcondition:** PanicBar's drawer is open. activity_trail has 3 rows: action_proposed, action_confirmed, action_executed (G-AUDIT).

## Error Paths

- **Scenario:** Confirm clicked before 3000ms → button is disabled, no execution. (UI prevents.)
- **Scenario:** gateAction returns deny mid-flow → preview never renders, tool returns `{ ok: false, reason: 'authority_denied' }`.
- **Scenario:** Element not in DOM at execute time → tool returns `{ ok: false, reason: 'element_not_found' }`. Telemetry `action_executed` NOT emitted.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manually tested end-to-end (admin opens /help, asks Botsson, sees preview, confirms, panic drawer opens)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
