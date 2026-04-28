---
title: "Journey — Employee asks 'vis meg hvordan jeg ber om hjelp' → Botsson highlights panic bar"
feature: m2-tour-harness
journey: employee-onboarding
status: draft
verified_at: null
e2e_test: null
created: 2026-04-28
updated: 2026-04-28
module: Core
tags: [journey, help, tour, employee, onboarding]
---

# Journey: Employee asks how to get help → Botsson points at panic bar

**Role:** employee

**Precondition:** Employee on `/dashboard/help`. Botsson chat hero has loaded. Page has `id="panic-bar"` on PanicBar wrapper.

## Happy Path

1. Employee types in Botsson chat hero: "vis meg hvordan jeg ber om hjelp" (or similar intent).
2. agent-router classifies intent as page-action (or knowledge with action follow-up).
3. Agent selects `ui.navigate_to` tool with `{ target_id: "panic_bar" }` and invokes it.
4. Client tool resolves anchor → calls `element.scrollIntoView({ behavior: "smooth", block: "start" })`.
5. Client emits `help.tour_step_invoked` with `{ tool: "navigate_to", target_id: "panic_bar", reduced_motion: false }`.
6. Agent then invokes `ui.highlight_element` with `{ target_id: "panic_bar", label: "Klikk her i nødssituasjon", duration_ms: 5000 }`.
7. `TourHighlight` overlay renders absolute-positioned outline + label badge above panic bar (z-40).
8. Client emits `help.tour_step_invoked` with `{ tool: "highlight_element", target_id: "panic_bar", reduced_motion: false }`.
9. After 5000ms (or new highlight invocation, or ESC, or off-target click), overlay auto-dismisses.

**Postcondition:** Employee saw panic bar visually identified. Both events present in activity_trail. No DOM mutation, no DB write.

## Error Paths

- **Scenario:** Anchor allow-list rejects unknown id → tool returns `{ ok: false, reason: "unknown_target" }`. Botsson explains in chat instead.
- **Scenario:** Element not yet in DOM (stale page state) → graceful no-op. Tool returns `{ ok: false, reason: "element_not_found" }`. No crash.
- **Scenario:** prefers-reduced-motion → see `reduced-motion` journey (I-2).

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
