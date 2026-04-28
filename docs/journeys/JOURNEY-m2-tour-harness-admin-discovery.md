---
title: "Journey — Admin asks 'hvor finner jeg X' → Botsson navigates + highlights tier"
feature: m2-tour-harness
journey: admin-discovery
status: verified
verified_at: 2026-04-28
e2e_test: apps/e2e/tests/journey-help-tour-onboarding.spec.ts
e2e_coverage_note: "Shares structural E2E with employee-onboarding — both journeys execute the same code path (bridge mount → kit invocation → DOM scroll/highlight → telemetry emit). The semantic difference (admin asks 'hvor finner jeg X' vs employee asks 'hvis meg hvordan jeg ber om hjelp') is purely conversational; the harness is role-agnostic. Full agent-invoked E2E (chat → stage-engine → tool runtime) deferred — see HANDOFF debt."
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [journey, help, tour, admin, discovery]
---

# Journey: Admin discovery via tour

**Role:** admin

**Precondition:** Admin on `/dashboard/help`. Page composed with all tiers + active-ticket-badge. Anchors registered for `quick_paths`, `curated_articles`, `kontakt_footer`.

## Happy Path

1. Admin types: "hvor finner jeg [feature/policy/article]?".
2. Agent selects best matching tier → invokes `ui.navigate_to({ target_id: "curated_articles" })` (or `quick_paths`, `kontakt_footer`).
3. Page smooth-scrolls to that tier.
4. Agent invokes `ui.highlight_element({ target_id: "curated_articles", label: "Her finner du <topic>", duration_ms: 4000 })`.
5. Outline overlay drawn around the tier section.
6. Agent in chat hero adds: "Jeg har markert [section]. Klikk på [item] for å lese mer."
7. Telemetry: 2 `help.tour_step_invoked` rows.

**Postcondition:** Admin sees the relevant tier highlighted, can act. If 3+ steps invoked in same chat session within 60s, `help.tour_completed` emits with step_count.

## Error Paths

- **Scenario:** Topic doesn't match any tier → agent does NOT invoke tour tool, instead chats answer. No phantom navigate.
- **Scenario:** Multiple matching tiers → agent picks best one, uses single highlight (Q1 default: one active highlight).

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (covered by `journey-help-tour-onboarding.spec.ts` + `journey-help-tour-anchors.spec.ts` since shape is identical to employee onboarding journey for any anchor)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
