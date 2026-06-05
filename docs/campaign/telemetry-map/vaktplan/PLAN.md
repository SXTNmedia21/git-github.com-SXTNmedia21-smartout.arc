---
title: Vaktplan — Sortie Plan (Telemetry Wiring)
status: draft
created: 2026-05-31
updated: 2026-05-31
domain: vaktplan
---

# Vaktplan — Sortie Plan: Telemetry Wiring

## Objective

Wire every interactive element in the vaktplan design to its backend hook and telemetry event. Gate all shift-mutation paths through the C4 cascade-gate before any write reaches `schedule_shift`. Establish a noop baseline of 153 elements and verify the baseline count is stable before any implementation begins.

---

## Control-Point DoD Checklist

- [ ] **Noop baseline locked** — 153 elements counted, count committed in control.json before any implementation
- [ ] **Every element mapped** — all 153 elements have a row in TELEMETRY-MAP.md, including noops
- [ ] **Every mutation has a telemetry event** — 91 mutating elements each have an assigned event name
- [ ] **Every event registry status known** — all 91 events are either found in registry.ts or explicitly listed as MISSING in control.json
- [ ] **Every mutation has a hook or is flagged as stub** — all 91 mutations reference a reuse hook or are marked "stub — new hook required"
- [ ] **Cascade-gate applied to all 18 shift writes** — each `schedule_shift` insert/update/delete goes through `enforce-gates` before reaching Supabase
- [ ] **Gate battery passed** (see below)

---

## Gate Battery (DoD for each button group)

All of the following must pass before closing the sortie:

1. **No-mock** — zero `jest.mock` / `vi.mock` bypassing Supabase in telemetry tests
2. **Noop baseline** — 153 interactive elements; zero new elements added without updating control.json
3. **Telemetry DB-assert** — for each mutating element, an integration test asserts the correct event row exists in the telemetry table after the action fires
4. **E2E against seed** — Playwright journey runs against a seeded Supabase schema (schedule_shift, shift_zone, schedule_absence, swap_request) and all critical paths complete without error
5. **Dual-perspective** — both admin (Driftsleder / Maria A.) and employee (Selma / Petter) journeys exercise the same flows; employee must not see cascade-gated admin actions

---

## Implementation Order (Critical Path First)

### Phase 1 — Missing events: add to registry.ts (prerequisite for all wiring)

Priority: must land before any hook wiring.

| #   | New event name                  | Rationale                                                 |
| --- | ------------------------------- | --------------------------------------------------------- |
| 1   | `schedule.week_navigated`       | Week ← / → buttons; essential navigation telemetry        |
| 2   | `schedule.grouping_changed`     | Group-by + turnus column toggle                           |
| 3   | `schedule.filter_changed`       | Dept chips + availability dept filter                     |
| 4   | `schedule.gap_fill_initiated`   | Gap chip + inspector "Finn vikar" — key workflow entry    |
| 5   | `scheduler.planner_opened`      | AI planner open — tracks adoption                         |
| 6   | `schedule.publish_modal_opened` | All "Publiser" toolbar/turnus buttons that open the modal |
| 7   | `schedule.export_opened`        | Print/export modal open                                   |
| 8   | `schedule.pdf_exported`         | Actual window.print() call                                |
| 9   | `schedule.week_added`           | Turnus: copy/scratch/template week additions              |
| 10  | `schedule.week_removed`         | Turnus: trash week                                        |
| 11  | `profile.schedule_viewed`       | Any profile drawer opened from scheduling context         |

> NOTE: Events #12–#33 (settings toggles, stub follow-ups, communication, task wiring) are deferred stubs — they map to existing registry events (`shift updated`, `communication sent`, `task created`, etc.) and are wired when those features are implemented. Document as stub in TELEMETRY-MAP.

---

### Phase 2 — Cascade-gate: apply to all shift write paths

All 18 shift writes listed below MUST route through `.sxtn/enforce-gates` before reaching Supabase:

1. `copyShift` — creates draft on chip "Kopier"
2. `saveShift` (new) — creates draft from shift controller
3. `saveShift` (update) — updates existing from shift controller
4. `deleteShift` — deletes shift from controller
5. `acceptPlan` — bulk creates/updates from AI planner
6. `confirmPublish` — bulk publish from publish modal
7. `ctlAction("publish")` — single publish from controller footer
8. `ctlAction("republish")` — republish from controller footer
9. `ctlAction("unpublish")` — unpublish
10. `ctlAction("duplicate")` — duplicate shift
11. `ctlAction("marketplace")` — post to vaktbørs
12. `ctlAction("approve")` — approve for payroll
13. `assignToShift` (from profile) — assign employee to shift
14. `assignToShift` (from availability) — tildel from availability list
15. `assignToShift` (from side panel) — tildel from panel assign button
16. Day inspector `onPublishDay` — day-scoped publish
17. Turnus `addWeek("ai")` — AI-proposed batch shifts
18. Shift controller Livsløp action button (publish/republish/approve)

**Schema trap note:** `schedule_shift` writes currently bypass the cascade gate. All 18 paths above must be gated. Absence writes (`schedule_absence`) are not in scope for this sortie.

---

### Phase 3 — Hook wiring: connect design actions to existing hooks

| Design action                    | Hook to wire                        | Event emitted                                           |
| -------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| copyShift / duplicate            | `useCreateShift`                    | `shift created`                                         |
| saveShift (new)                  | `useCreateShift`                    | `shift created`                                         |
| saveShift (update)               | `useUpdateShift`                    | `shift updated`                                         |
| deleteShift                      | `useDeleteShift`                    | `shift deleted`                                         |
| confirmPublish / publish(scope)  | `usePublishShifts`                  | `shift published`                                       |
| acceptPlan (Botsson)             | `useCreateShift` + `useUpdateShift` | `scheduler.proposal.accepted` + `shift created/updated` |
| assignToShift                    | `useUpdateShift` (assign employee)  | `shift assigned`                                        |
| approveOffer                     | `useAssignOpenShift`                | `shift_offer.approved`                                  |
| resolveSwap(true)                | `useApproveSwap`                    | `shift_swap.approved`                                   |
| resolveSwap(false)               | `useRespondToSwap`                  | `shift_swap.rejected`                                   |
| act("marketplace")               | `useCreateOpenShift`                | `shift_offer.posted`                                    |
| act("swap")                      | `useInitiateSwap`                   | `shift_swap.requested`                                  |
| act("approve") payroll           | existing (no hook yet)              | `shift_lifecycle approved`                              |
| Lifecycle overlay: Godkjenn      | existing (no hook yet)              | `shift_lifecycle approved`                              |
| upsertRoster (profile agreement) | `useUpsertRoster`                   | `roster updated` / `roster created`                     |
| setDensity changes               | existing emit in use-shifts area    | `schedule.density_changed`                              |
| Week nav ±                       | new emit at call site               | `schedule.week_navigated`                               |
| GroupBy change                   | new emit at call site               | `schedule.grouping_changed`                             |
| Dept filter toggle               | new emit at call site               | `schedule.filter_changed`                               |
| Gap fill initiated               | new emit at call site               | `schedule.gap_fill_initiated`                           |
| Planner opened                   | new emit at call site               | `scheduler.planner_opened`                              |
| Export/print opened              | new emit at call site               | `schedule.export_opened`                                |
| PDF print                        | new emit at call site               | `schedule.pdf_exported`                                 |
| Turnus week added                | new emit at call site               | `schedule.week_added`                                   |
| Turnus week removed              | new emit at call site               | `schedule.week_removed`                                 |
| Profile opened from schedule     | new emit at call site               | `profile.schedule_viewed`                               |

---

### Phase 4 — Test suite

Per control-point gate battery:

1. Unit: one test per new registry event — verifies TypeScript discriminated union compiles
2. Integration: for each Phase 3 hook emit, assert telemetry row appears in test DB
3. E2E (Playwright, seed data):
   - Journey 1: Manager creates, edits, publishes, and unpublishes a shift
   - Journey 2: Manager uses AI planner, accepts proposal, verifies shifts created
   - Journey 3: Employee swap request → manager approves in "Bytteforespørsler" tab
   - Journey 4: Gap chip → Tilgjengelighet → Tildel employee → shift assigned
   - Journey 5: Manager opens Print modal, confirms PDF event fires

---

## Known Gaps / Debt

1. **Settings toggles** (notify, marketplace, swap, template, audit on Innstillinger tab) — currently local state only, not persisted. Must decide: persist to `schedule_shift` metadata column or separate settings table. Emit `shift updated` when wired.
2. **Task toggle** in Oppgaver tab — maps to `session_task completed` but requires session-task join with shift. Deferred to session-task sortie.
3. **Manuell justering** in Lønnsgrunnlag — maps to `shift supplement_claimed` + approval. Deferred to payroll sortie.
4. **Foreslå fiks** Botsson button on issues bar — stub; wires to `botsson.tool_invoked` when tool dispatch is live.
5. **Shift lifecycle approved** — no backend hook exists yet for manager payroll approval. New hook required; follow WFM pattern from `shift_lifecycle settled`.
6. **Profile request Godkjenn/Avslå** — currently local state; requires mapping to actual swap/absence approve endpoints.
7. **Re-share offer** ("Del på nytt") — stub; wires to `shift_offer.posted` when notification fan-out is implemented.
8. **Communication "Send oppdatering"** — stub; wires to `communication sent` when comms sortie lands.
