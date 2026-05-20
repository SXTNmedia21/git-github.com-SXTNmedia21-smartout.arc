---
title: Day Timeline — E2E Coverage
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: daytimeline
tags: [module, daytimeline, e2e, testing, web, mobile, playwright, maestro]
---

# Day Timeline — E2E Coverage

> Test matrix for Day Timeline across web (Playwright), mobile (Detox/Maestro candidate), capability units, and manual checks.

## 1. Coverage Matrix

| # | Journey | Web E2E | Mobile E2E | Capability Unit | Manual |
|---|---|---|---|---|---|
| J1 | Slot popover anchors at click | **MISSING** | n/a (web-only) | n/a | shipped 2026-05-17, manual smoke OK |
| J2 | Manager click-slot quick-add | `apps/e2e/dagslinjen-quickadd/slot-quickadd.spec.ts` | n/a (mobile read-only) | n/a | verified |
| J3 | Task + Avvik wire | `slot-quickadd.spec.ts:H3+H4` | n/a | task.create_session unit pending | verified |
| J4 | Filter strip by scope | `apps/e2e/dagslinjen-quickadd/filter-timeline.spec.ts` | n/a | n/a | verified |
| J5 | Targeted note fanout | `apps/e2e/dagslinjen-quickadd/target-note-fanout.spec.ts` + `employee-receives-note.spec.ts` | n/a | communication.create_targeted_note unit pending | verified |
| J6 | Timeline templates save+apply | `apps/e2e/timeline-templates/timeline-templates.spec.ts` | n/a | n/a | verified |
| J7 | Create day-line | **MISSING** (Phase B+C+D) | n/a (no mobile authoring) | **MISSING** | **MISSING** |
| J8 | Edit opening/closing | **MISSING** | n/a | **MISSING** | **MISSING** |
| J9 | Add single task to slot | **MISSING** for day_line path | n/a | task.create_session has unit tests; day_line variant **MISSING** | **MISSING** |
| J10 | Attach routine to line | **MISSING** | n/a | **MISSING** (routine cap doesn't exist yet) | **MISSING** |
| J11 | Employee views own-location lines | n/a (mobile-first) | **MISSING** + RLS proof | **MISSING** RLS test | **MISSING** |
| J12 | Admin multi-location overview | **MISSING** | n/a | n/a | **MISSING** |

Existing infra:
- Web: Playwright. Tests live under `apps/e2e/`. Pattern: one folder per feature/sortie.
- Mobile: no E2E framework wired today. Maestro proposed below.
- Capability units: Vitest. `packages/ai/src/capabilities/<cap>/__tests__/`.
- Manual: documented in `docs/journeys/MANUAL-TEST-*.md` (one per feature, recommended).

---

## 2. Web E2E — Existing Specs

### 2.1 `apps/e2e/dagslinjen-quickadd/slot-quickadd.spec.ts`

Covers J2 + J3. Validates:
- Hover guide-line appears on time-axis.
- Click opens slot popover (today — to be updated to verify anchor at click coordinate per J1).
- Each picker action opens the correct downstream dialog with prefilled time.
- Submit creates the row + emits telemetry.

**Gap to close:** anchor-at-click assertion (J1). Test should `clickAt({x: 600, y: 100})` and assert popover renders within ±20px of `(x, y)`.

### 2.2 `filter-timeline.spec.ts`

Covers J4. Validates scope filter (Dept/Team/Location/Shift) URL persistence + strip event filtering.

### 2.3 `target-note-fanout.spec.ts` + `employee-receives-note.spec.ts`

Covers J5. Two-actor flow: manager writes note → employee receives via channel.

### 2.4 `timeline-templates.spec.ts`

Covers J6. Save + apply round-trip per ADR-0335.

---

## 3. Web E2E — Required New Specs

For each location-awareness journey:

### 3.1 `apps/e2e/timeline-location-awareness/create-day-line.spec.ts` (J7)

```
- Login as manager
- Navigate to Dagslinjen for today
- Click "Ny dagslinje"
- Pick location "Restaurant"
- Toggle to "Avdeling" → pick "Kjøkken"
- Set planned_open "08:00", planned_close "23:00"
- Click "Opprett"
- Assert new strip appears in stack
- Assert telemetry event "day_line created" fires
- Error paths: no location available, XOR violation, equal open/close, gate denies
```

### 3.2 `apps/e2e/timeline-location-awareness/edit-opening-closing.spec.ts` (J8)

```
- Precondition: day_line exists
- Click strip header time chip "08:00"
- OpenCloseEditPopover opens
- Change to "07:30"
- Save
- Assert strip band shifts left to 07:30
- Assert existing markers stay at absolute time
- Error paths: closing < opening, reconciled-day read-only, concurrent 409
```

### 3.3 `apps/e2e/timeline-location-awareness/add-single-task.spec.ts` (J9)

```
- Click slot at 14:15 on day_line strip
- SlotPicker anchored at click
- Pick "Oppgave"
- AddTaskDialog opens with "Enkeltoppgave" tab default
- Fill title, owner, reason
- Submit
- Assert session_task marker appears at 14:15
- Assert telemetry `"task.added_manual"` fires with `day_line_id` field in metadata (canonical creation event per ADR-0298 — `task.*` namespace, 30-day alias window for legacy consumers)
- Error paths: reason < 8 chars, gate denies, out-of-window confirmation
```

### 3.4 `apps/e2e/timeline-location-awareness/attach-routine.spec.ts` (J10)

```
- Click slot at 09:00
- SlotPicker pick "Rutine"
- AttachRoutineDialog opens
- Template list filtered by line's scope
- Pick "Åpningsrutine kjøkken"
- Preview panel shows 5 child tasks
- Click "Fest til linjen"
- Assert hook marker + 5 child markers on strip
- Assert telemetry "routine attached" with task_count: 5
- Error paths: no templates, placeholder unresolved, out-of-window, gate denies, partial-insert rollback
```

### 3.5 `apps/e2e/timeline-location-awareness/admin-multi-location.spec.ts` (J12)

```
- Login as admin
- Stack header shows count badges "3 lokasjoner · 5 avd · 2 team · 12 dagslinjer"
- Filter to "Restaurant" location
- Stack collapses to subset
- Click slot on filtered line → SlotPicker opens
- Clear filter → stack expands
- Edit different line's opening → success (admin no dept-restriction)
- Date navigation persists filter scope
```

---

## 4. Mobile E2E — Proposal

Today no mobile E2E framework is wired. Recommendation: **Maestro** (YAML-based, low-friction, Expo-compatible).

### 4.1 Setup
- Add `apps/mobile/.maestro/` folder.
- CI workflow: `apps/mobile/.maestro/ci.yaml` runs flows in EAS Build preview.
- Smoke flow covers app boot + login + day view.

### 4.2 Required flows for J11

`apps/mobile/.maestro/day-line-employee-views-own.yaml`:

```yaml
appId: ai.smartout.app
---
- launchApp
- assertVisible: "Logg inn"
- tapOn: "Logg inn"
- inputText: "test-employee@smartout.no"
- ... (auth flow)
- tapOn: "Kalender"
- tapOn:
    text: "I dag"
- assertVisible:
    id: "day-line-strip"
- assertVisibleCount:
    id: "day-line-strip"
    count: 2  # employee at 2 locations
- scrollUntilVisible:
    element:
      text: "Restaurant · Kjøkken"
- tapOn:
    text: "Restaurant · Kjøkken"
- assertVisible:
    id: "task-marker"
- # Defensive RLS leak test
- runScript: assert-no-foreign-lines.js
```

### 4.3 RLS proof

`apps/mobile/.maestro/day-line-rls-leak-detection.yaml` — injects a foreign-workspace day_line server-side (test fixture), verifies the client filter drops it AND telemetry emits `"day_line rls_leak_detected"`.

---

## 5. Capability Unit Tests — Required

For Phase C delivery:

| Capability | Test path | Required cases |
|---|---|---|
| `day_line.create` | `packages/ai/src/capabilities/day-line/__tests__/create.test.ts` | (1) allow + insert + emit; (2) `department_location` membership enforced (manager outside pairing rejected); (3) gate_action denies → 403; (4) duplicate UNIQUE `(department_session_id, location_id)` rejected; (5) workspace_id derived from context, not body |
| `day_line.edit_opening_closing` | `packages/ai/src/capabilities/day-line/__tests__/edit-opening-closing.test.ts` | (1) update + emit; (2) reconciled-day rejected; (3) closing-equals-opening rejected; (4) concurrent edit detection (optimistic version) |
| `routine.attach_to_line` | `packages/ai/src/capabilities/routine/__tests__/attach-to-line.test.ts` | (1) hook + N children inserted in transaction; (2) partial failure rolls back; (3) template scope mismatch rejected; (4) anchor + offsets compute correctly |
| `task.create_session` (extended) | existing test file | (1) day_line_id accepted; (2) legacy department_session_id still works during bridge period; (3) inherits location_id from day_line |

All tests run against Supabase Local. No mocks for RLS — use real DB. Per CLAUDE.md feedback-memory: "integration tests must hit a real database, not mocks" (reason: prior incident where mock/prod divergence masked a broken migration).

---

## 6. Manual Test Cases

Recommended `docs/journeys/MANUAL-TEST-timeline-location-awareness.md` covering:

### 6.1 Visual / Nordic Split
- Token audit: no hardcoded zinc/blue/red. Use `smartout-nordic-split` skill grep.
- Motion budget: every spring uses `motionTokens.*`; no inline `stiffness:` literals.
- Multi-line stack spacing feels intentional, not crowded.
- Strip headers visually distinct per location color.

### 6.2 Accessibility
- SlotPicker keyboard nav (arrow within lane, tab between lanes).
- OpenCloseEditPopover keyboard accessible.
- TimelineTopBar buttons have `aria-label`.
- Color-contrast ≥ WCAG AA on strip backgrounds + markers.
- Screen-reader announces "Dagslinje for Restaurant Kjøkken, åpning 08:00 til 23:00".

### 6.3 Cross-Browser
- Chrome / Firefox / Safari desktop.
- Safari iOS Mobile Web (PWA fallback).
- Edge cases: zoom 200%, narrow viewport (768px).

### 6.4 Edge / Empty
- Workspace with 0 locations.
- Workspace with 1 location, 1 dept (single line — verify no stack noise).
- Day with 0 events (empty strip + empty list).
- Day post-reconciliation (read-only enforcement).

---

## 7. Coverage Gates

For Phase F to merge:

- [ ] Every J7-J12 has a passing Playwright spec (web) or Maestro flow (mobile).
- [ ] Every new capability has unit tests for allow + deny + edge paths.
- [ ] Manual test pass logged in `docs/journeys/MANUAL-TEST-timeline-location-awareness.md`.
- [ ] RLS leak test fires telemetry on synthetic injection.
- [ ] Performance budget met (TimelineTab ≤200ms TTI, mobile day route ≤800ms TTI on iPhone SE 2gen).
- [ ] `/audit smoke` green for the touched ADRs.

---

## 8. CI Wiring

| Suite | Command | Where |
|---|---|---|
| Web Playwright | `pnpm --filter @smartout/e2e test` | `.github/workflows/ci.yml` |
| Capability unit | `pnpm --filter @smartout/ai test` | same |
| Mobile Maestro (proposed) | `maestro test apps/mobile/.maestro/` | new workflow `mobile-e2e.yml` |
| ADR contract audit | `/audit smoke` post-merge | heartbeat job |
| Drift check | `./infra/scripts/drift-check.sh` | daily heartbeat |

Mobile Maestro flow can be a follow-up sortie if Phase E ships without it — but RLS leak detection must be covered some other way (capability unit + manual) before merge.

---

## 9. Known Holes — Document Acknowledged

- No native iOS Detox (Maestro covers most cases; Detox needed only for native bridges).
- No load-testing for multi-line stack (deferred to post-launch).
- No A11y automated audit on mobile (manual + axe-mobile follow-up).
- No visual regression (Chromatic / Percy not wired today — track in adjacent debt).

These are LOW severity — manual coverage compensates V1.
