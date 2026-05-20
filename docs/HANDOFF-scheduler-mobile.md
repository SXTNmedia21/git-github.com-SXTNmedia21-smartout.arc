---
title: HANDOFF — scheduler-mobile sortie
status: done
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [scheduler, mobile, bundle, handoff, e2e]
---

# HANDOFF: scheduler-mobile

Closes Tasks 5 + 6 of the `world-best-wfm` campaign C3 follow-on.
Parent campaign HANDOFF: `docs/HANDOFF-world-best-wfm-phase4.md`.

---

## What was built

### Task 5 — Mobile 3-component bundle V1

**File:** `apps/mobile/app/(app)/(shifts)/proposed-plan.tsx`

Three components ONLY per ADR-0309 V1:

| Component | Purpose | Key invariants |
|-----------|---------|----------------|
| `BundleCard` | Summary card — date range, shift count, gap count, objective score | `FadeInDown.springify()` using `nativeTheme.motion.springAmbient.stiffness * 10` ms. No per-row stutter. |
| `BundleActionBar` | Bottom bar — "Avslå alle" + "Godta alle" | `getProfileContext()` before emit. ONE emit per logical event. Haptics on tap. Alert confirmation for Reject only. |
| `ReadOnlyShiftList` | Flat list — employee name + role + time | NO toggle, NO checkbox, NO per-row interaction. `scrollEnabled={false}`. |

Supporting changes:
- `apps/mobile/app/(app)/(shifts)/_layout.tsx` — `<Stack.Screen name="proposed-plan" />` registered.
- `apps/mobile/src/lib/web-api.ts` — `getSchedulerProposalsUrl()`, `getSchedulerAcceptBundleUrl()`, `getSchedulerRejectBundleUrl()` added.

### Task 6 — E2E protocols

**S10:** `apps/e2e/protocols/p-scheduler-propose-accept.ts`
- JourneyIR v2.0.0, slug `S10`, module `JP-R000-SCHEDULER-PROPOSE-ACCEPT`.
- 8 steps: dashboard → chat propose → DB assert proposal created → ONE proposed event → web Godta → success UI → DB assert N shifts + status='applied' → ONE accepted event.
- Registered as `S10` in `PROTOCOL_REGISTRY`.

**S11:** `apps/e2e/protocols/p-scheduler-mobile-bundle.ts`
- JourneyIR v2.0.0, slug `S11`, module `JP-R000-SCHEDULER-MOBILE-BUNDLE`.
- 6 steps: mobile navigate → BundleCard visible → ReadOnlyShiftList visible (V1 no-toggle gate) → tap Godta alle → DB assert applied → ONE accepted event.
- Registered as `S11` in `PROTOCOL_REGISTRY`.

---

## Decisions made

### D1 — `createStyles` at module level, not inside component
`createStyles(factory)` returns a React hook. Must be called at module level (not inside a component body or nested function). All style keys consume the returned hook `useStyles()` inside the component.

### D2 — `emit()` shape: single object argument
`emit(event: SmartoutEvent)` takes ONE argument. The `BaseEvent` fields (`workspace_id`, `actor_id`) are top-level alongside `event` and `properties`. No two-argument form.

### D3 — Client-side emit is fire-and-forget; BFF writes are the authoritative gate
The BFF `acceptProposal.execute()` writes `gate_evaluation` + telemetry server-side. The `emit()` call in the mobile mutation hook is a client-side supplement for PostHog analytics. Both emit the same event name — the `since` field in `TelemetryEventGateSchema` should be set to the test start time to avoid counting a pre-existing event.

### D4 — `solver_run_id` in accepted emit is empty string on mobile path
The mobile client does not have access to `solver_run_id` (only in the `changes` JSONB of the proposal). Set to `""` in the client-side emit. The BFF-side emit (from `acceptProposal.execute()`) will have the real value. This is acceptable for mobile client telemetry (posthog analytics); the audit trail authoritative record comes from the BFF.

### D5 — No confirmation Alert for Accept; confirmation for Reject
Accept is irreversible but expected. Reject could be accidental. Pattern: tap Accept → immediate mutation; tap Reject → `Alert.alert` confirmation required.

### D6 — `data-testid` attributes required in web UI for S10 gates
S10 relies on `testid="scheduler-bundle-card"`, `testid="scheduler-accept-all-btn"`, `testid="scheduler-accept-success"`, `testid="botsson-chat-toggle"`, `testid="botsson-chat-input"`, `testid="botsson-chat-send"`, `testid="botsson-chat-thinking"`. These must be added to the web `/dashboard/schedule/proposed-plan` page and the Botsson chat widget when implementing the web E2E runner.

---

## Known issues / debt

| # | Issue | Impact | Owner |
|---|-------|--------|-------|
| I1 | `solver_run_id` empty on mobile client emit | PostHog event incomplete; BFF emit has correct value | Campaign phase — not blocking |
| I2 | `ReadOnlyShiftList` uses `scrollEnabled={false}` — outer scroll required | Works when inside a `ScrollView`. Current screen layout has `scrollArea` as `flex:1` without a wrapping ScrollView — if shift list grows past screen height it will be clipped. | Next V1 polish |
| I3 | `proposed_shifts` not enriched on list endpoint | `BFF /api/scheduler/proposals` returns `proposed_shift_count` but not `proposed_shifts[]` with employee names. `ReadOnlyShiftList` will show truncated UUIDs unless a detail endpoint is added or `changes.proposed_shifts` is joined with profile table. | C3 follow-on |
| I4 | Web `/dashboard/schedule/proposed-plan` page not built | S10 step 5 navigates to this URL. The web proposed-plan page (with `data-testid` attributes) must be built before S10 can run. | Campaign phase C3.5 |
| I5 | S10 step 3 `precondition expect: {}` | The runner's `db_record` gate for "no pending proposals" uses an empty expect. Some runners may not interpret this correctly. Consider adding a custom `count_zero` gate type for S10 cleanup. | E2E runner improvement |

---

## Next steps

1. Build web `/dashboard/schedule/proposed-plan` with `data-testid` attributes to unblock S10 E2E execution.
2. Enrich `proposed_shifts` in BFF proposals list endpoint (join with profile for `employee_name` + `role`).
3. Address `ReadOnlyShiftList` scroll clipping when shift count > screen height (wrap in `ScrollView`).
4. Run S10 + S11 against local Supabase once golden-case seed fixture is built for the scheduler domain.
5. Add `solver_run_id` passthrough to mobile client emit if posthog analytics require it.
