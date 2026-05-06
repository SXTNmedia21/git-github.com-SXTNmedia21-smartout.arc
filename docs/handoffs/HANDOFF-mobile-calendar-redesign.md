---
title: "HANDOFF — Mobile Calendar Redesign (feat/mobile-calendar-redesign)"
feature: mobile-calendar-redesign
status: complete
verified_at: 2026-05-04
created: 2026-05-04
updated: 2026-05-04
module: mobile
tags: [handoff, mobile, calendar, kalender, vaktliste, pii, rbac, adr-0266, adr-0267, adr-0268]
---

# HANDOFF — Mobile Calendar Redesign

## Summary

This sortie delivers the Phase 3a–3d foundation for the unified mobile calendar experience: a `CalendarScreen` composing `WeekStrip`, `FilterChips`, `CalendarList`, `DetailSheet`, and `AddSheet`. Key infrastructure: `useCalendarItems` hook (workspace-tz-aware data layer), `useOperationsFeed` (unified feed adapter), ADR-0267 PII gate (booking contact field-level redaction by role), ADR-0266 scope RBAC (client-filter for scope modes), ADR-0268 TabBar canonical layout decision (5-tab layout resolving three-way conflict with wt-1 4-tab plan and wt-7 locked branch).

Phase 3e (AddSheet BFF-wrap, booking creation pipeline) and Phase 3f (TabBar 5-tab implementation) remain as follow-up sorties. Six telemetry events registered pre-implementation (L-0094 phantom-emit prevention); emit() calls deferred to Phase 3c screen wiring.

---

## Decisions Made

### ADR-0266 — Vaktliste Scope RBAC
`docs/decisions/0266-vaktliste-scope-rbac.md`

Client-filter on RLS-scoped reads is canonical for read-only scope modes (`me` / `all` / `dept` / `person`). `profile.role` is the differentiator (NOT `isShiftLead`, NOT `team.leader_profile_id`). Server-side gate for `scope='all'` deferred to backlog with capability-table draft. GDPR art. 6(1)(f) is sufficient legal basis for all four scope modes in workspace context.

### ADR-0267 — Booking PII Access Control
`docs/decisions/0267-booking-pii-access-control.md`

Field-level mask in `useCalendarItems` hook. `CalendarItem.contact` returned as `undefined` for `profile.role === 'employee'`; `contactRedacted = true` flag set. "Ring"-button replaced by passive "Kontakt resepsjonen" stub in DetailSheet. Default deny when role is unknown. Telemetry payloads MUST NEVER carry contact value (ADR-0134 + ADR-0078). Closes lovsen F-01/F-02/F-03 (HIGH, GDPR art. 5(1)(f) need-to-know). Status: **proposed** — BLOCKING for Phase 3e booking branch until accepted.

### ADR-0268 — TabBar Canonical Layout (5-Tab)
`docs/decisions/0268-tabbar-canonical-layout.md`

Resolves three-way conflict between current 6-tab state, wt-1 4-tab restore plan, and wt-3 5-tab design handoff. Canonical layout: Kalender | Vakter | ⊕ FAB | Chat | Min Tid. wt-1 (`feat/mobile-mobile-restore-4tab-plan`) must be cancelled or rebased before Phase 3f TabBar merge. wt-7 locked branch slated for deletion. "Min Tid" V1 = relabel of `(me)`. Status: **proposed**.

---

## Learnings Discovered

**L-wt3-01: WeekStrip device-tz date math is a silent correctness bug.**
`WeekStrip.tsx` uses raw `new Date()` for day boundaries. In workspace timezone (e.g. Europe/Helsinki, UTC+3), a shift at 23:00 Norwegian time crosses day boundaries differently. Fix applied in `useCalendarItems` via `toZonedTime` from `date-fns-tz`; WeekStrip's cosmetic display is separately safe because it renders the selected Date object labels — the data layer is the critical boundary.

**L-wt3-02: `pnpm-lock.yaml` diverges when worktree adds new deps (`date-fns`, `date-fns-tz`) without updating lockfile.**
`pnpm install --frozen-lockfile` fails at typecheck gate; `pnpm install --no-frozen-lockfile` required to sync. Lockfile must be committed before close-feature merge to avoid campaign conflict.

**L-wt3-03: ADR frontmatter id convention drift — underscore vs dash.**
All three ADRs use `id: ADR_0266` (underscore). Repo convention is `id: ADR-0266` (dash). Fixed by G1 closeout pass (see commit on this branch).

**L-wt3-04: BookingCreated event intentionally absent from Phase 3a telemetry registration.**
Booking creation requires AddSheet BFF-wrap (Phase 3e) which is deferred and blocked on ADR-0267 acceptance. Pre-registering a mutation event without an emit() callsite would violate L-0094. Correct: register at Phase 3e implementation time.

**L-wt3-05: No active emit() calls in calendar Phase 3a/3b/3c/3d code — all deferred.**
Only the telemetry interface + routing table definitions are committed. Implementations emit in Phase 3c screen wiring. Gate 10 (NonEmptyString / getProfileContext) is N/A until Phase 3c.

---

## Known Issues / Debt

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| D-01 | BLOCKING | Phase 3e DetailSheet booking branch blocked on ADR-0267 `accepted` status | ADR-0267 must be promoted before Phase 3e sortie |
| D-02 | BLOCKING | Phase 3f TabBar 5-tab implementation blocked on wt-1 cancellation or rebase | Cancel `feat/mobile-mobile-restore-4tab-plan` or rebase onto ADR-0268 |
| D-03 | MEDIUM | `WeekStrip.tsx` cosmetic date labels use `new Date()` — no workspace tz override | Acceptable for Phase 3a (display only); data layer is correct. Fix in Phase 3c |
| D-04 | MEDIUM | `scope='all'` has no server-side gate — client-filter only (ADR-0266 backlog) | Deferred; capability-table draft documented in ADR-0266 |
| D-05 | MEDIUM | AddSheet save is mocked — no BFF route for task/deviation/note creation | Phase 3e sortie |
| D-06 | LOW | `pnpm-lock.yaml` diverged — needs commit before campaign merge | Lockfile updated by `pnpm install --no-frozen-lockfile` during closeout gate check |
| D-07 | LOW | ADR frontmatter `id:` uses underscore (`ADR_026X`) — repo convention is dash (`ADR-026X`) | Fixed in G1 closeout commit |

---

## Next Steps

1. **Phase 3e sortie** — AddSheet BFF-wrap: create task/booking/deviation/note via API routes, emit `calendar item_viewed` and CreateEvent telemetry, wire `getProfileContext()` to satisfy ADR-0134 gate 10.
2. **Promote ADR-0267 to `accepted`** — unblocks Phase 3e booking branch (Ring-button + contact_reveal_request audit).
3. **Cancel or rebase wt-1** (`feat/mobile-mobile-restore-4tab-plan`) — prerequisite for Phase 3f.
4. **Phase 3f sortie** — TabBar 5-tab implementation per ADR-0268: Kalender | Vakter | ⊕ | Chat | Min Tid. Delete wt-7 locked branch.
5. **Phase 3c screen wiring** — add actual `emit()` calls to CalendarScreen, FilterChips, WeekStrip day-tap, DetailSheet item-tap. Resolve `workspace_id` + `actor_id` via `getProfileContext()` (ADR-0134).
6. **Server-side scope gate (Phase 3d)** — implement `engine_authority_config`-based `schedule.view_team` / `schedule.view_person_detail` capability seeds for manager+ scope modes.
