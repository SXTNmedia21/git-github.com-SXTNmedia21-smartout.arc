---
title: "Day Session — E2E Coverage"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-22
domain: day-session
tags: [domain, day-session, e2e, testing, playwright, coverage]
---

# Day Session — E2E Coverage

> Test matrix — proof of what is actually built and tested.

## 1. Coverage Matrix

| # | Flow | Web E2E | Mobile E2E | Capability Unit | Manual |
|---|---|---|---|---|---|
| F1 | Day opened (session → active) | MISSING | n/a | n/a | manual smoke only |
| F2 | Manager adds task at slot | `apps/e2e/dagslinjen-quickadd/slot-quickadd.spec.ts` | n/a | task.create_session unit pending | verified |
| F3 | Manager filters timeline by scope | `apps/e2e/dagslinjen-quickadd/filter-timeline.spec.ts` | n/a | n/a | verified |
| F4 | Manager sends targeted note | `apps/e2e/dagslinjen-quickadd/target-note-fanout.spec.ts` | n/a | communication unit pending | verified |
| F5 | Employee receives note | `employee-receives-note.spec.ts` (same folder) | n/a | n/a | verified |
| F6 | Manager wires session_task + avvik | `slot-quickadd.spec.ts:H3+H4` | n/a | n/a | verified |
| F7 | Employee reports deviation (mobile) | n/a | MISSING | hms capability pending | MISSING |
| F8 | Slot picker anchors at click | MISSING (anchor-at-click assert) | n/a | n/a | manual smoke 2026-05-17 |
| F9 | Timeline template save + apply | `apps/e2e/timeline-templates/timeline-templates.spec.ts` | n/a | n/a | verified |
| F10 | Manager creates day_line | MISSING | n/a | `day-line.create` unit MISSING | MISSING |
| F11 | Manager edits day_line hours | MISSING | n/a | `day-line.update_hours` unit MISSING | MISSING |
| F12 | Manager attaches template to day_line | MISSING | n/a | `day-line.instantiate_template` unit MISSING | MISSING |
| F13 | Employee views own day_line (mobile) | n/a | MISSING + RLS proof | n/a | MISSING |
| F14 | Push notification to clocked-in employees | n/a | MISSING | n/a | MISSING |
| F15 | Manager closes day (pending_signoff) | MISSING | n/a | n/a | manual smoke |
| F16 | Admin approves day (dagsgodkjenning) | MISSING | n/a | n/a | manual smoke |
| F17 | Admin locks week | MISSING | n/a | n/a | manual smoke |
| F18 | Mobile home Before/During/After | n/a | MISSING | n/a | manual smoke |
| F19 | Settlement image OCR | MISSING | n/a | n/a | manual smoke |
| F20 | Manager plans tomorrow (Tidslinje tab — chip-bar + list) | `apps/e2e/tidslinje-tab/tidslinje-tab.spec.ts` (happy path) | n/a | `__tests__/TidslinjeTab.test.tsx` | verified (P10) |
| F21 | Manager live-status during rush (Tidslinje tab) | `apps/e2e/tidslinje-tab/tidslinje-tab.spec.ts` (chip toggle) | n/a | `__tests__/TidslinjeChipBar.test.tsx` | verified (P10) |
| F22 | Employee mobile mirror | n/a | MISSING (V2 sortie) | n/a | n/a |
| F23 | Manager + Botsson reschedule | MISSING (G19b tools deferred) | n/a | n/a | n/a |
| F24 | Manager empty-day bootstrap | MISSING (V2 empty-state CTA) | n/a | n/a | n/a |

---

## 2. Web E2E — Existing Specs

### 2.1 `apps/e2e/dagslinjen-quickadd/slot-quickadd.spec.ts`
Covers F2 + F6. Validates:
- Hover guide-line appears on time-axis.
- Click opens slot picker popover.
- Each picker action opens the correct downstream dialog with prefilled time.
- Submit creates row + emits telemetry.
**Open gap:** anchor-at-click assertion (F8) — `clickAt({x, y})` + assert popover within ±20px.

### 2.2 `apps/e2e/dagslinjen-quickadd/filter-timeline.spec.ts`
Covers F3. Scope filter (dept/team/location/shift) URL persistence + strip event filtering.

### 2.3 `apps/e2e/dagslinjen-quickadd/target-note-fanout.spec.ts` + `employee-receives-note.spec.ts`
Covers F4 + F5. Two-actor flow: manager writes → employee receives via Komm channel.

### 2.4 `apps/e2e/timeline-templates/timeline-templates.spec.ts`
Covers F9. Save + apply round-trip per ADR-0335.

---

## 3. Web E2E — Required New Specs

### 3.0 `apps/e2e/tidslinje-tab/` — P10 Shipped (2026-05-23)

#### `apps/e2e/tidslinje-tab/tidslinje-tab.spec.ts` (F20/F21 — happy path)
```
- Login as manager, open DayControlPanel by clicking a date
- Click Tidslinje tab — assert tabpanel visible
- Assert chip-bar renders Alle + ≥0 location chips
- Click a location chip — assert aria-pressed toggles
- Assert list rows visible OR empty-state text visible
Coverage: F20 (plan-tomorrow steg 1-3), F21 (live-status chip-toggle)
```

#### `apps/e2e/tidslinje-tab/tidslinje-tab.axe.spec.ts` (a11y gate — all P10 tabs)
```
- Login as manager, open DayControlPanel
- Run axe-core on [role=tablist] + [role=tabpanel]
- Assert zero violations (WCAG 4.1.2 — G17 closure)
- Repeat with Tidslinje tab active
Coverage: G17 ARIA contract
```

#### `apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeTab.test.tsx` (unit)
```
- emit tidslinje_tab_opened with L-0177 fail-fast IDs on mount
- renders one row per DayEvent from useDayTimelineEvents
- sorts rows chronologically ascending
```

#### `apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeChipBar.test.tsx` (unit)
```
- renders Alle + one chip per location
- calls onToggleLocation with location id when chip clicked
- marks selected chips with aria-pressed='true'
```

#### `apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/tidslinje-no-mutation.test.ts` (regression guard)
```
- TidslinjeTab.tsx contains no useMutation / mutateAsync (council 2026-05-23)
- TidslinjeChipBar.tsx contains no useMutation / mutateAsync
- TidslinjeRow.tsx contains no useMutation / mutateAsync
```

### 3.1 `apps/e2e/day-session/create-day-line.spec.ts` (F10)
```
- Login as manager, navigate to Dagslinjen for today
- Click "Ny dagslinje"
- Pick location "Restaurant", set open 08:00 / close 23:00, submit
- Assert new DayLineStrip appears with testID "day-line-strip-{id}"
- Assert telemetry event "day_line.created" fires
- Error paths: gate deny, duplicate (same session+location), no locations available
```

### 3.2 `apps/e2e/day-session/edit-day-line-hours.spec.ts` (F11)
```
- Precondition: day_line exists
- Click DayLineStripHeader open-time chip
- OpenCloseEditPopover opens, change to 07:30, save
- Assert strip band shifts to 07:30
- Error paths: closing < opening, reconciled-day read-only
```

### 3.3 `apps/e2e/day-session/attach-template-to-day-line.spec.ts` (F12)
```
- Precondition: day_line + timeline_template exists
- SlotPicker → pick "Rutine" → AttachRoutineDialog opens
- Pick template "Åpningsrutine kjøkken", preview 5 child tasks, submit
- Assert hook marker + 5 child task markers on strip
- Assert telemetry "routine.attached" fires
```

### 3.4 `apps/e2e/day-session/close-day-flow.spec.ts` (F15)
```
- Login as manager
- Navigate to session in active state
- Click "Avslutt dagen" in SignoffTab
- Add signoff notes
- Assert status → pending_signoff
- Assert mobile AfterShiftView "venter på oppgjør" banner visible
```

### 3.5 `apps/e2e/day-session/admin-dagsgodkjenning.spec.ts` (F16)
```
- Login as admin, navigate to /dashboard/reconciliation
- DayList shows pending_signoff day with correct date/dept
- Click row → DayDetail opens
- Complete PreflightGate checks (no open deviations)
- Click "Godkjenn oppgjør"
- Assert status → closed
- Assert row in DayList shows "closed" badge
```

### 3.6 `apps/e2e/day-session/settlement-ocr.spec.ts` (F19)
```
- Login as manager, navigate to reconciliation detail
- Upload settlement image (mock POS receipt)
- Assert OCR results populate revenue fields
- Assert validate-settlement cross-check runs
- Assert "within_threshold" shown to user
```

---

## 4. Mobile E2E — Proposal

No mobile E2E framework wired today. Recommendation: **Maestro** (YAML-based, Expo-compatible).

### 4.1 Required flows for F13 + F18
`apps/mobile/.maestro/day-line-employee-views-own.yaml` (F13):
```yaml
- launchApp
- assertVisible: "Logg inn"
- ... (auth flow)
- tapOn: "Kalender"
- tapOn text: "I dag"
- assertVisible id: "day-line-strip"
- scrollUntilVisible element text: "Restaurant · Kjøkken"
```

`apps/mobile/.maestro/home-during-shift.yaml` (F18):
```yaml
- launchApp
- ... (auth + clock-in)
- assertVisible id: "during-shift-timer"
- assertVisible: "Klokket inn"
- tapOn: "Klokk ut"
- assertVisible: "Vakten er ferdig"
```

### 4.2 RLS leak detection
Synthetic foreign-workspace `day_line` injected server-side; client filter must drop it and emit `"shift_session.item_leak_detected"` telemetry.

---

## 5. Capability Unit Tests — Required

| Capability | Test path | Required cases |
|---|---|---|
| `day_line.create` | `packages/ai/src/capabilities/day-line/__tests__/create.test.ts` | allow+insert+emit; gate deny; UNIQUE violation; workspace_id from context |
| `day_line.update_hours` | `.../__tests__/update-hours.test.ts` | update+emit; reconciled-day rejected; closing < opening rejected |
| `day_line.instantiate_template` | `.../__tests__/instantiate-template.test.ts` | expand+emit; scope mismatch rejected |
| `task.create_session` (ADR-0367 ext) | existing `__tests__/` | `day_line_id` accepted; legacy dept path still works |
| `task.complete` | existing | employee completes own task; manager completes any |

All tests run against Supabase Local. Real DB, no RLS mocks.

---

## 6. Coverage Gates (for next sortie merging day-session work)

- [ ] F10/F11/F12 have passing Playwright specs
- [ ] F15/F16 have passing Playwright specs
- [ ] All new `day-line.*` capabilities have unit tests (allow + deny + edge paths)
- [ ] `task.create_session` extended unit test covers `day_line_id` path
- [ ] Manual test pass logged in `docs/journeys/MANUAL-TEST-day-session.md`
- [ ] `/audit smoke` green for ADR-0367 + ADR-0204 + ADR-0151

---

## 7. CI Wiring

| Suite | Command | Location |
|---|---|---|
| Web Playwright | `pnpm --filter @smartout/e2e test` | `.github/workflows/ci.yml` |
| Capability unit | `pnpm --filter @smartout/ai test` | same |
| Mobile Maestro (proposed) | `maestro test apps/mobile/.maestro/` | new `mobile-e2e.yml` |
| ADR contract audit | `/audit smoke` | heartbeat job |

---

## 8. Known Holes — Acknowledged

- No E2E for session auto-transitions (EF `session-lifecycle` cron) — covered by manual smoke only.
- No load-test for multi-line stack — deferred post-launch.
- No A11y automated audit on mobile — manual + axe-mobile follow-up.
- No visual regression (Chromatic not wired) — track in adjacent debt.
