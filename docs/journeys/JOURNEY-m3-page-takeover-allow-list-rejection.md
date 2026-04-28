---
title: "Journey — Botsson invokes unknown target_id → tool rejects, no preview"
feature: m3-page-takeover
journey: allow-list-rejection
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: Core
tags: [journey, help, takeover, security, allow-list]
---

# Journey: Allow-list rejection (I-4 invariant)

**Role:** any (this is a tool-shape contract test, not a user flow)

**Precondition:** Help page loaded. Tool kit registered.

## Happy Path

1. Botsson agent (or test fixture) invokes `ui.simulate_click({ target_id: "kontakt_footer_emergency" })`.
2. Tool implementation looks up target_id in TAKEOVER_TARGETS const.
3. `isValidTakeoverTarget("kontakt_footer_emergency")` returns false (not in v1 allow-list).
4. Tool returns `{ ok: false, reason: 'unknown_target' }`.
5. NO preview overlay rendered. NO telemetry emit. NO DOM mutation.

**Postcondition:** Page state unchanged. Botsson sees the rejection in the tool result and can chat-respond: "Det kan jeg ikke gjøre — den knappen er ikke i mitt godkjente sett."

## Error Paths

- **Scenario:** Botsson keeps trying with synthesized selectors (`'.btn-danger'`) → all rejected. No preview ever shown unless target_id matches allow-list keyword.
- **Scenario:** target_id is empty string or undefined → Zod validation rejects at tool entry, before lookup.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — assert tool result shape for unknown target_id
- [ ] Manually tested

**Mark `status: verified` in frontmatter when all three boxes are checked.**
