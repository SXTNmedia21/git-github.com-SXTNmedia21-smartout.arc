---
title: "Journey — User asks for action → preview → ESC → cancelled, no execution"
feature: m3-page-takeover
journey: cancel
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: Core
tags: [journey, help, takeover, cancellation, accessibility]
---

# Journey: Takeover cancellation via ESC or off-target click

**Role:** admin (with authority opt-in)

**Precondition:** Admin on /help. Authority allow. Botsson invoked `ui.simulate_click` and TakeoverPreview is rendered (state: previewing).

## Happy Path A — ESC

1. Admin presses ESC during preview.
2. usePageTakeover document keydown handler catches ESC.
3. State: previewing → cancelled.
4. TakeoverPreview unmounts (overlay removed).
5. Telemetry emit `page_takeover.action_cancelled` with `{ trigger: 'esc', target_id }`.
6. Tool resolves with `{ ok: true, executed: false, cancelled: true }`.
7. Botsson can chat-respond: "Ok, jeg avbrøt."

## Happy Path B — Off-target click

1. Admin clicks anywhere outside the preview overlay (not on confirm chip, not on target).
2. Document click handler detects target ≠ overlay AND ≠ resolved target element.
3. Same as A: cancel + emit + tool resolves cancelled.

**Postcondition:** No DOM mutation. activity_trail has 2 rows: action_proposed + action_cancelled. NO action_executed (G-AUDIT).

## Error Paths

- **Scenario:** ESC pressed when state==='idle' → no-op. No emit.
- **Scenario:** Click on confirm chip → that's confirm, not cancel — see confirm-and-execute journey.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
