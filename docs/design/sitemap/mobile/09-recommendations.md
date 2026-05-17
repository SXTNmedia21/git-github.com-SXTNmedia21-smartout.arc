---
title: Mobile Sitemap — Recommendations
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, recommendations, next-steps, sitemap]
---

# Recommendations

## Minimum Viable Nav Structure to Ship

The current 5-tab layout (Hjem · Vakter · FAB · Chat · Min Tid) is the right structure. No structural changes needed before shipping. Calendar remains accessible as a hidden tab for power users via programmatic navigation.

Core flows that work end-to-end today:
- Auth: welcome → verify → workspace-select → home (complete)
- Home phase views: NoShift / Before / During / After (complete)
- Shift detail: view + confirm (works); Tasks and Emma tabs are stubs
- Chat + Skranke merged tab (complete)
- Min Tid payroll sub-stack (complete, real data)

## Screens to Cut / Consolidate

1. **`(queue)/index.tsx` and `(queue)/[ticketId].tsx`** — superseded by `(komm)` per ADR-0165. These two files can be deleted once `(komm)` is validated as stable. Low risk; both are already hidden.

2. **`(me)/design-preview.tsx`** — dev-only QA screen. Should be gated behind `__DEV__` check or removed before production release. Currently accessible via direct router push but has no entry point.

3. **`DuringShiftView.v2.tsx`** — if feature flag `EXPO_PUBLIC_DURING_SHIFT_V2` has not been promoted to default after M4 review, decide: merge into V1 or delete V2. Two coexisting implementations create maintenance burden.

## Gaps Blocking Mobile Shipping

Priority order:

1. **Vakter loading issue** — resolve `selectedProfileId` in `useWorkspaceStore` on session restore. If profile store is empty after cold-start, `useTeamShifts` queries without workspace isolation → 0 results or RLS error. Confirm store hydration from MMKV before first render. File scope: `apps/mobile/src/hooks/stores/use-workspace-store.ts`, `apps/mobile/src/hooks/queries/use-team-shifts.ts`.

2. **`team/[id]` Stack.Screen registration** — add to `(home)/_layout.tsx` to apply animation and header options. File scope: `apps/mobile/app/(app)/(home)/_layout.tsx`.

3. **`payroll-supplements` name mismatch** — rename `<Stack.Screen name="payroll-supplements" />` to `<Stack.Screen name="supplements" />` in `payroll/_layout.tsx`. One-line fix. File scope: `apps/mobile/app/(app)/(me)/payroll/_layout.tsx:116`.

4. **Proposed-plan and journey entry points** — both routes have no in-app entry. Before shipping features that trigger these via push notifications, verify the deep-link handler is configured in `app.json` / `app.config.ts` under `expo.scheme`.

5. **Contract screens — TanStack Query migration** — `contract/index.tsx` and `contract/[id].tsx` use raw `supabase` in `useEffect`. Migrate to `useQuery` for cache consistency, offline support, and `emit()` compliance (ADR-0134). File scope: `apps/mobile/app/(app)/(me)/contract/index.tsx`, `apps/mobile/app/(app)/(me)/contract/[id].tsx`.

## ADR-0133 Drift Hotspots

- **`(shifts)/create.tsx`** — Create shift is an Author verb. ADR-0133 §"Author/Compose/Plan verbs stay web-only." Either remove this screen (web-only authoring), gate it to manager role only and amend ADR-0133, or create a new ADR clarifying that manager-role shift creation on mobile is a permitted Approve-class exception. The current screen calls the BFF (ADR-0270 compliant for execution) but the UI surface itself is an authoring form.

- **`(home)/clockout.tsx`** — Duty leader reconciliation. This is borderline — it's an Approve verb (C4 gate) applied by a manager to close a session. Existing code cites correct ADRs. No change needed.

## Concrete Next Sorties

**Sortie M-01 — Vakter loading fix + store hydration**
- Files: `use-workspace-store.ts`, `use-team-shifts.ts`, `(shifts)/index.tsx`
- Scope: ensure `selectedProfileId` is restored from MMKV before `useTeamShifts` fires; add explicit "Ingen vakter denne uken" empty state distinct from loading

**Sortie M-02 — Layout polish (one-line fixes)**
- Files: `(home)/_layout.tsx` (add `team/[id]` registration), `payroll/_layout.tsx` (rename `payroll-supplements` → `supplements`)
- Scope: no behavior change; fixes missing screen options and phantom registration

**Sortie M-03 — Contract screens TanStack Query migration**
- Files: `(me)/contract/index.tsx`, `(me)/contract/[id].tsx`
- Scope: replace `useEffect + supabase` with `useQuery`; add `emit()` on any future mutations; align with ADR-0134

**Sortie M-04 — ShiftClockView consolidation**
- Files: `(home)/punch-clock.tsx`, `ShiftClockView.tsx` and sub-components
- Scope: decide whether to route `punch-clock.tsx` to `ShiftClockView` (feature-complete) or port missing features (BreakToggle, SupplementSheet, GPS guard) into the inline implementation. Delete the orphan whichever path is chosen.

**Sortie M-05 — ADR-0268 amendment or tab-order ADR**
- Files: `docs/decisions/0268-tabbar-canonical-layout.md`, `(app)/_layout.tsx`
- Scope: amend ADR-0268 to reflect Hjem as landing anchor (not Calendar), or create ADR-0268-amendment. Calendar hidden status is acceptable; the ADR text is stale.

**Sortie M-06 — Training hook wiring**
- Files: `(home)/training.tsx`, `apps/mobile/src/hooks/queries/use-training-data.ts`
- Scope: wire `useTrainingData` to `protocol_assignment` and `knowledge_test` tables. This is a backend availability dependency — confirm tables are populated in Local dev first.
