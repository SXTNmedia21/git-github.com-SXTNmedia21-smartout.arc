---
title: "Calendar Redesign — Phase 2 System-Steward Plan-Verify"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [audit, plan-verify, system-steward, calendar, mobile, adr-0133, adr-0134, adr-0151]
---

# Plan Verification — `feat/mobile-calendar-redesign`

> Phase 2 (system-steward) verification of `docs/plans/PLAN-calendar-redesign.md` against:
> Phase 0 discovery (`2026-05-04-calendar-redesign-discovery.md`),
> Phase 1 lovsen (`2026-05-04-lovsen-calendar-rapport.md`),
> ADR-0078, ADR-0132, ADR-0133, ADR-0134, ADR-0151,
> learning corpus (L-0044, L-0046, L-0094, L-0141, L-0177).
>
> **Verdict — PASS WITH CONDITIONS** (4 conditions; one BLOCKING for Phase 3e).

---

## Verdict at a glance

| Phase | Status | Blocker |
|---|---|---|
| Phase 3a (theme + tokens) | UNBLOCKED | none |
| Phase 3b (primitives) | UNBLOCKED | none |
| Phase 3c (calendar screens) | UNBLOCKED | F-09 (timezone) MEDIUM, must use `workspace.timezone` |
| Phase 3d (shift list redesign) | UNBLOCKED | F-05/F-07/F-08 are MEDIUM/backlog, not blocking — client-filter acceptable for `scope='all'` MVP |
| Phase 3e (sheets + DetailSheet) | **BLOCKED** | F-01/F-02/F-03 booking-PII; ADR-0267 must merge before Phase 3e ships |
| Phase 3f (5-tab redesign) | UNBLOCKED | wt-1 coordination required (ADR-0268 + branch ownership) |
| Phase 4 (review) | UNBLOCKED | depends on 3a-3f |

---

## ADR-0133 — Web composes, mobile executes

| R | Plan respects? | Evidence |
|---|---|---|
| R1 — Mobile owns D6 + C4 | YES | Plan §Hard constraints calls out ADR-0133 explicitly. Calendar reads `schedule_shift`, `session_task`, `schedule_day_booking`, `deviation` — all D6. Execute verbs declared: confirm shift detail, mark task done, swap acceptance. |
| R2 — Web-only verbs | YES | Plan §Out of scope: "AddSheet write-paths (calendar viser UI-flow; faktisk write går via wt-2 BFF eller fremtidig)." AddSheet is UI-only stub; create-shift authoring stays on web/wt-2 BFF. |
| R3 — Mobile reads D1-D5 | YES | Department, contract data read-only via `useCalendarItems`. No D1-D5 authoring. |
| Plan journey 3 ("Pontus-creates-via-add" + Avvik) | CONDITIONAL | Avvik creation IS a D6 verb (witness/log), so it sits inside ADR-0133. But §Out of scope says "UI-flow only" — the plan explicitly defers backend wiring. Acceptable, **but DetailSheet "Marker fullført" / "Bekreft mottak" / "Stempel inn" buttons (screens.jsx:557) ARE mutations** and must follow ADR-0134. |

**Finding:** No ADR-0133 violation. Plan correctly classifies Calendar as read-only D6 + execute-verbs.

---

## ADR-0134 — Mobile telemetry contract

Calendar mutations identified that MUST emit:

| Action | Surface | Telemetry path | Status in plan |
|---|---|---|---|
| Mark task done | DetailSheet (screens.jsx:557 "Marker fullført") | `emit("session_task confirmed")` via `useCalendarItems` mutation hook | NOT specified — gap |
| Confirm shift detail | DetailSheet (screens.jsx:557 "Bekreft mottak"/"Stempel inn") | `emit("schedule_shift confirmed")` via `useShiftLifecycle` | NOT specified — gap |
| Swap acceptance | DetailSheet (extension) | `emit("shift_swap accepted")` | OUT OF SCOPE in plan |
| Filter shift / scope shift / view shift | All calendar screens (taps) | `emit("calendar filter_changed")` style | NOT specified — plan §Hard constraints mentions it but doesn't list events |

**MEDIUM finding:** Plan mentions ADR-0134 but does not enumerate the telemetry events to register. Phase 3a or 3c MUST register every mutation event in `packages/telemetry/src/registry.ts` BEFORE the mutation hook is wired (per L-0094 phantom-emit pattern).

**Mandate:** `getProfileContext()` from `apps/mobile/src/lib/profile-context.ts` must wrap every mutation. Empty-string fallbacks are forbidden.

---

## ADR-0151 — Server-derived workspace_id

Plan introduces `useCalendarItems({ date, scope, filter })` hook. Two paths:

| Hook caller | Auth path | Compliance |
|---|---|---|
| Direct Supabase client (current `useMyShifts` pattern) | JWT-resolved via RLS | OK — `auth.uid()` in `jwt_read_schedule_shift` policy ensures only own-workspace rows |
| BFF route (recommended for `scope='all'` server-side gate) | JWT → server-derived `workspace_id` from `getProfileContext()` | **MUST** — see F-05 backlog item |

**HIGH finding:** Phase 3c plan does NOT specify whether `useCalendarItems` calls Supabase directly or routes via BFF. Direct Supabase is acceptable (RLS protects); BFF is required if and only if scope-mode introduces non-RLS-enforceable rules (e.g., per-shift PII redaction). **Recommendation:** Phase 3c starts with direct Supabase + client-filter. ADR-0266 documents the deferral of server-side `scope='all'` gating.

**ADR-0151 absolute rule:** Any new BFF route MUST derive `workspace_id` from JWT, never from request body. L-0177 (silent body-supplied row fallback) applies. Plan's hook signature `{ date, scope, filter }` is JWT-derivable — no body-supplied workspace_id risk if Phase 3c sticks to client-side filter on RLS-scoped reads.

---

## Lovsen findings — severity-tagged

| Lovsen Finding | Severity | Phase blocked | Steward verdict |
|---|---|---|---|
| F-01 booking-PII no rolesjekk | **BLOCKING** | Phase 3e | ADR-0267 must merge before DetailSheet ships |
| F-02 "Ring"-knapp ucontrolled | **BLOCKING** | Phase 3e | ADR-0267 mandates mask + "Kontakt resepsjonen" CTA for `employee` |
| F-03 GDPR art. 5(1)(f) need-to-know | **BLOCKING** | Phase 3e | ADR-0267 implements field-level access in `useCalendarItems` |
| F-04 avvik-push w/ andres PII | OUT OF SCOPE | push-sortie | not a Phase 3e blocker; documented for future push-sortie |
| F-05 no server-side scope-gate | MEDIUM | NONE | Backlog. Client-filter acceptable per ADR-0266. |
| F-06 `jwt_read_schedule_shift` udokumentert | MEDIUM | NONE | Backlog. Driftsformål documentation is product/legal task, not blocker. |
| F-07 `isShiftLead` ikke rolle-gate | MEDIUM | NONE | ADR-0266 codifies `profile.role` as canonical differentiator. |
| F-08 ingen `schedule.view_team` capability | MEDIUM | NONE | ADR-0266 includes capability table draft for future seed. |
| F-09 tz-naive rendering | MEDIUM | Phase 3c | Phase 3c MUST use `workspace.timezone` + `date-fns-tz`. NOT BLOCKING; flagged as condition. |
| F-10 pause-avvik-push throttle | LOW | push-sortie | out of calendar-redesign scope |
| F-11 tz-naive DB columns | MEDIUM | Phase 3c | covered by F-09 mitigation |
| F-12 hardcoded "Europe/Oslo" | LOW | Phase 3c | covered by F-09 mitigation |
| F-13 HMS-avvik push-prioritet | MEDIUM | push-sortie | out of scope |
| F-14 no cascade scope-gating utility | MEDIUM | NONE | future cascade-scope work; not calendar blocker |

---

## Boundary with wt-2 — disjoint (verified)

Phase 0 §9 + plan §Boundary verified. Wt-3 owns:
- `apps/mobile/app/(app)/_layout.tsx` (TabBar redesign)
- `apps/mobile/app/(app)/(shifts)/index.tsx` (vaktliste full-redesign)
- `apps/mobile/app/(app)/(calendar)/**` (new route group)

Wt-2 owns:
- `apps/mobile/app/(app)/(shifts)/create.tsx`
- `apps/mobile/app/(app)/(home)/punch-clock.tsx`
- mutation hooks `use-create-shift.ts`, `use-punch.ts`
- `apps/mobile/src/lib/sync/action-map.ts`

**No file conflict.** Merge order non-strict. Confidence HIGH.

---

## Boundary with wt-1 — coordination required

`git worktree list` shows TWO 4-tab restore branches:
- `/home/sxtnl/dev/smartout.ai-mobile-wt-1` → `feat/mobile-mobile-restore-4tab-plan` (active, HEAD `234c795ae`)
- `/home/sxtnl/dev/smartout.ai-wt-7` → `feat/mobile-restore-4tab-plan` (locked)

Both target a 4-tab layout per memory entry "Mobile 4-tab plan drift (2026-05-03)". Wt-3 plan §Phase 3f redesigns to **5 tabs** per design handoff (Pontus delivered 2026-05-04, supersedes 2026-03-24 4-tab plan).

**HIGH finding:** Direct conflict on `apps/mobile/app/(app)/_layout.tsx` if both wt-1 and wt-3 land. ADR-0268 resolves by picking 5-tab winner and documenting the rebase/cancel decision for wt-1.

---

## L-0044 — mobile-parity-framing-creates-feature-graveyards

Plan must NOT mirror web shift-modal verbatim. Verification:

| Pattern | Mirrored from web? | Verdict |
|---|---|---|
| WeekStrip (handoff `primitives.jsx`) | NO — mobile-native | OK |
| FilterChips (chip pills, scrollable) | NO — mobile-native | OK |
| ItemCard (compact, mobile-thumb-friendly) | NO — mobile-native | OK |
| ScopeChips dropdown | NO — mobile pattern | OK |
| AddSheet bottom-sheet | NO — uses `@gorhom/bottom-sheet` (mobile-native) | OK |
| DetailSheet | NO — type-specific branching, mobile pattern | OK |

**Finding:** Plan respects L-0044. Calendar is a **mobile-native execution surface**, not a port of web's `/dashboard/schedule`. Pixel-paritet is with the design handoff (mobile-native), not with web.

---

## Telemetry registry coverage check

Calendar plan introduces these mutation surfaces. ALL must be registered in `packages/telemetry/src/registry.ts` before code lands:

| Event | Where emitted | Notes |
|---|---|---|
| `calendar view_changed` | View toggle (Uke/Måned/Dag) | Read-only navigation; OPTIONAL but nice-to-have |
| `calendar scope_changed` | ScopeChips tap | OPTIONAL; recommended for product analytics |
| `calendar item_opened` | DetailSheet open | OPTIONAL |
| `session_task confirmed` | DetailSheet "Marker fullført" | **REQUIRED** — D6 mutation |
| `schedule_shift confirmed` | DetailSheet "Bekreft mottak" / "Stempel inn" | **REQUIRED** — D6 mutation, may already exist |
| `deviation created` | AddSheet → Avvik branch (when wired) | Out of Phase 3 scope |

**MEDIUM finding:** Plan does not enumerate these events. Add to Phase 3a checklist: "register all calendar/shift-detail mutation events in `packages/telemetry/src/registry.ts` BEFORE Phase 3c hook implementation."

---

## Schema verification

| Plan claim | Code reality | Status |
|---|---|---|
| `schedule_shift.department_id` | NULLABLE-by-design (memory: schedule_shift fetch pattern 2026-04-24) | OK — plan must use `position_id → position.department_id` for canonical dept link |
| `workspace.timezone` autoritativ | Verified Phase 1 (migration `00001_identity_tables.sql:80`, default `Europe/Oslo`) | OK |
| Department colors in `native.ts` | Verified Phase 0 §4 — present, English keys vs Norwegian aliases needed | OK |
| `@gorhom/bottom-sheet` v5 | Verified Phase 0 §7 | OK |

---

## Cross-cutting concern compliance

| Concern | Status |
|---|---|
| RLS + workspace isolation | OK — RLS on all touched tables |
| Telemetry emit() coverage | **GAP** — events not enumerated in plan |
| Event Engine pattern | N/A — calendar reads, no engine_process work |
| Security three laws | OK |
| i18n (no hardcoded Norwegian) | **WARNING** — handoff source uses Norwegian strings; Phase 3 must use i18n keys (sjekk `packages/i18n/`) |
| TypeScript strict | OK by plan |
| Workspace timezone | **CONDITION** — Phase 3c must implement |

---

## Conditions for PASS

1. **BLOCKING for Phase 3e** — ADR-0267 (booking-PII access control) must be `accepted` and `useCalendarItems` field-level access implemented BEFORE DetailSheet booking branch ships.
2. **CONDITION for Phase 3a** — Add subtask: "register all calendar mutation events in `packages/telemetry/src/registry.ts`" + cross-link to ADR-0134 enforcement helper.
3. **CONDITION for Phase 3c** — `useCalendarItems` MUST resolve `workspace.timezone` from workspace context and use `date-fns-tz` for rendering. No hardcoded `Europe/Oslo`. (F-09/F-11/F-12)
4. **CONDITION for Phase 3f** — Coordinator must resolve wt-1 (4-tab) vs wt-3 (5-tab) conflict via ADR-0268 BEFORE Phase 3f code lands. Recommendation: ADR-0268 picks 5-tab; wt-1 rebases or is cancelled.

---

## Verdict — PASS WITH CONDITIONS

Plan is structurally sound, respects ADR-0133, and correctly defers compose verbs to web/wt-2. Phase 3a-3d + 3f UNBLOCKED with conditions documented. Phase 3e BLOCKED on ADR-0267 merge.

**Phase 3 unblocked:** 3a, 3b, 3c (with tz condition), 3d, 3f (with wt-1 coordination).
**Phase 3 blocked:** 3e (until ADR-0267 accepted).

---

*Phase 2 system-steward verification, 2026-05-04. Ready for ADR drafting + Phase 3 dispatch.*
