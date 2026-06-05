---
title: Telemetry Implementation Plan — planlegging domain
status: draft
updated: 2026-05-31
created: 2026-05-31
module: planlegging
tags: [telemetry, planlegging, implementation-plan]
---

# Telemetry Implementation Plan — planlegging

Gate: **FAIL** — 5 blockers. This plan resolves them in dependency order.

---

## Blocker resolution order

### B1 — use-budget.ts:103 ungated direct upsert (F0.3)

**Status:** Blocked on F0.3. Do NOT wire MachineRoom "Propager til budsjett" (MR-11) until F0.3 is complete and workspace_budget writes have a C4-authority gate.

Action: Add `// TODO F0.3: gate this upsert before wiring MachineRoom propagate` comment to use-budget.ts:103. Flag in tech debt register.

**Not blocking other work** — all other Planlegging telemetry can proceed.

---

### B2 — BookingCreatePanel has no mutation hook

**Status:** The panel is a design stub. Toast fires on submit but no booking is persisted.

Actions:

1. Decide: does "Ny booking" in Planlegging write to `schedule_day_booking` (same table as Calendar domain) or to `planning_event`?
2. Create or reuse a `useCreateBooking` hook targeting the resolved table.
3. Replace `toast(...)` in BookingCreatePanel submit handler with `createBooking.mutateAsync(payload)`.
4. On mutation success, emit `booking created` (already in registry — entity_type: "booking").
5. Registry entry is sufficient; no new event needed.

---

### B3 — Leave approve/reject has no mutation hook

**Status:** Toast-stub only in DetailPanel leave block.

Actions:

1. Reuse or create `useAbsenceMutation` (approve/reject) targeting `absence` table.
2. Replace toast stubs with `approveAbsence.mutateAsync({absence_id})` / `rejectAbsence.mutateAsync({absence_id})`.
3. Emit `absence approved` / `absence rejected` on success (both in registry).

---

### B4 — 25 events missing from registry

Split by sub-domain:

#### Sub-group A: Season-financials (unblocked — implement now)

Add to `packages/telemetry/src/registry.ts`:

```typescript
// ── Planlegging calendar domain ──────────────────────────────────────

interface PlanleggingViewChanged extends BaseEvent {
  event: "planlegging view_changed";
  properties: {
    data: {
      from: string;
      to: string;
      trigger?: "toolbar" | "tools_menu" | "year_pick" | "month_pick";
    };
  };
}
interface PlanleggingLayerToggled extends BaseEvent {
  event: "planlegging layer_toggled";
  properties: { data: { layer: string; enabled: boolean; trigger?: "toolbar" | "empty_state" } };
}
interface PlanleggingSavedViewApplied extends BaseEvent {
  event: "planlegging saved_view_applied";
  properties: { data: { view_id: string; view_name?: string; calendar_view?: string } };
}
interface PlanleggingFilterApplied extends BaseEvent {
  event: "planlegging filter_applied";
  properties: { data: { group: string; value: string; active: boolean } };
}
interface PlanleggingFilterReset extends BaseEvent {
  event: "planlegging filter_reset";
  properties: { data: Record<string, never> };
}
interface PlanleggingDateNavigated extends BaseEvent {
  event: "planlegging date_navigated";
  properties: {
    data: {
      direction: "back" | "forward" | "day_selected" | "month_selected";
      view: string;
      iso?: string;
      month?: number;
    };
  };
}
interface PlanleggingTodayClicked extends BaseEvent {
  event: "planlegging today_clicked";
  properties: { data: { view: string } };
}
interface PlanleggingAttentionPanelOpened extends BaseEvent {
  event: "planlegging attention_panel_opened";
  properties: { data: { count: number } };
}
interface PlanleggingAttentionItemActioned extends BaseEvent {
  event: "planlegging attention_item_actioned";
  properties: { data: { attention_id: string; sev: "crit" | "warn" | "info"; type: string } };
}
interface PlanleggingMachineRoomOpened extends BaseEvent {
  event: "planlegging machine_room_opened";
  properties: { data: { season_id: string } };
}
interface PlanleggingMachineRoomDraftSaved extends BaseEvent {
  event: "planlegging machine_room_draft_saved";
  properties: { data: { season_id: string } };
}
interface SeasonGoalToggled extends BaseEvent {
  event: "season goal_toggled";
  properties: { data: { season_id: string; done: boolean } };
}
interface SeasonOperatingHoursOverrideAdded extends BaseEvent {
  event: "season operating_hours_override_added";
  properties: { data: { season_id: string } };
}
interface PlanleggingCrossDomainNavigate extends BaseEvent {
  event: "planlegging cross_domain_navigate";
  properties: { data: { to: string; entity?: string; entity_id?: string; trigger?: string } };
}
interface PlanleggingCreateButtonUsed extends BaseEvent {
  event: "planlegging create_button_used";
  properties: {
    data: { entity: "booking" | "event" | "vakt"; trigger?: "toolbar" | "calendar_click" };
  };
}
interface PlanleggingBotssonnCtaClicked extends BaseEvent {
  event: "planlegging botsson_cta_clicked";
  properties: { data: { cta_label: string } };
}
interface PlanleggingBotssonnDismissed extends BaseEvent {
  event: "planlegging botsson_dismissed";
  properties: { data: { cta_label: string } };
}
interface PlanleggingOpeningHoursSaved extends BaseEvent {
  event: "planlegging opening_hours_saved";
  properties: { data: { changes_count?: number } };
}
interface PlanleggingOpeningHoursExceptionAdded extends BaseEvent {
  event: "planlegging opening_hours_exception_added";
  properties: { data: Record<string, never> };
}
```

#### Sub-group B: Booking mutations (depends on B2 resolution)

```typescript
interface BookingConfirmed extends BaseEvent {
  event: "booking confirmed";
  properties: { entity_type: "booking"; entity_id: string; data: { status_from: string } };
}
interface BookingCancelled extends BaseEvent {
  event: "booking cancelled";
  properties: { entity_type: "booking"; entity_id: string; data: { reason?: string } };
}
```

#### Sub-group C: Machine room propagate (blocked on F0.3)

```typescript
// Add after F0.3 is complete:
interface BookingMachineRoomPropagated extends BaseEvent {
  event: "booking machine_room_propagated";
  properties: { data: { season_id: string; period_type: string } };
}
```

---

### B5 — OpeningHoursPanel has no mutation hook

**Status:** Save and exception-add both fire toasts only.

Actions:

1. Determine target table: `department_operating_hours` (seeded by activate_season) or a dedicated `opening_hours_exception` table.
2. Create `useOpeningHoursMutation` hook.
3. Wire panel save button to mutation, emit `planlegging opening_hours_saved` on success.
4. Wire "Legg til unntak" to mutation, emit `planlegging opening_hours_exception_added`.

---

## Implementation checklist (post-blocker resolution)

### Phase 1 — Registry additions (unblocked, ~2h)

- [ ] Add sub-group A events (19 events) to `packages/telemetry/src/registry.ts`
- [ ] Add `booking confirmed` and `booking cancelled` to registry
- [ ] Add registry entries to the event map object (destinations + category)

### Phase 2 — Season-financials emit wiring (unblocked, ~3h)

These require emit() calls added to existing click handlers in planlegging.jsx / planlegging-season.jsx:

- [ ] PL-01–05: View segment → `planlegging view_changed`
- [ ] PL-06–08: Nav buttons → `planlegging date_navigated` / `planlegging today_clicked`
- [ ] PL-09–10: Saved view → `planlegging saved_view_applied`
- [ ] PL-11–13: Layer toggle → `planlegging layer_toggled`
- [ ] PL-14–15: Filter → `planlegging filter_applied` / `planlegging filter_reset`
- [ ] PL-17–20: Tools menu → `planlegging opening_hours_panel_opened`, `planlegging view_changed`, stubs for export/settings
- [ ] PL-21: Attention badge → `planlegging attention_panel_opened`
- [ ] PL-22–24: CreateButton → `planlegging create_button_used`
- [ ] PL-42–43: AttentionPanel items → `planlegging attention_item_actioned`
- [ ] BC-01–02: BotCard → `planlegging botsson_cta_clicked` / `planlegging botsson_dismissed`
- [ ] SP-01–02: Season activate/archive → already wired via use-season-tools.ts (verify emit fires)
- [ ] SP-03–04: Machine room open + tab change → `planlegging machine_room_opened`, `season tab_changed`
- [ ] SP-05: Season hours override → `season operating_hours_override_added`
- [ ] SP-06–07: Goal toggle + create → `season goal_toggled`, `season_goal created`
- [ ] SP-08–09: Season footer navigation → `planlegging cross_domain_navigate`
- [ ] MR-05: Hour bar click → `hour_factors updated` (already in registry)
- [ ] MR-10: Lagre utkast → `planlegging machine_room_draft_saved`
- [ ] V-01–16: View interaction emit calls → `calendar item_viewed`, `season block_clicked`, `season pin_clicked`, navigation events
- [ ] ES-01: Empty state show all → `planlegging layer_toggled`

### Phase 3 — Mutation hooks (depends on B2/B3/B5 resolution, ~1d each)

- [ ] B2: Wire BookingCreatePanel to booking creation hook, emit `booking created`
- [ ] B3: Wire leave approve/reject to absence mutation, emit `absence approved` / `absence rejected`
- [ ] B5: Wire OpeningHoursPanel save/exception to mutation hooks

### Phase 4 — Machine room propagate (blocked on F0.3)

- [ ] After F0.3: add C4 gate to use-budget.ts:103 upsert
- [ ] Wire MR-11 to gated mutation, emit `booking machine_room_propagated`

---

## Notes

- **Season-financials vs budget-tiles split:** SeasonPanel (activate/archive/goals/operating_hours/tab_changed) is unblocked and maps to the `season` table + `activateSeasonAction` / `archiveSeasonAction`. MachineRoom "Propager til budsjett" maps to `workspace_budget` (budget-tiles) and is blocked on F0.3.
- **use-budget.ts:103:** The ungated `.upsert()` on `workspace_budget` is the single most dangerous control in this domain. Do not wire any Planlegging UI to it until F0.3 adds the C4 gate. The current toast stub is safer than an ungated write.
- **calendar item_viewed:** This event exists in registry for the production Calendar domain. The same event shape is reusable for Planlegging item clicks — no new event needed, just emit() calls in the view renderers.
- **`workspace_budget updated`:** Already in registry and already emitted (on success) in use-budget.ts:110 via `emit(...)`. The problem is the upsert itself is ungated — the telemetry call is correct, the write is not.
