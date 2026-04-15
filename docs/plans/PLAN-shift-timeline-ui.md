---
title: Shift Timeline UI — Phase 6 Implementation Plan
status: approved
updated: 2026-04-15
created: 2026-04-15
module: shift-lifecycle
tags: [ui, timeline, nordic-split, mobile-first, botsson]
---

# Shift Timeline UI — Phase 6 Implementation Plan

> **Phase 6 of Shift Lifecycle Consolidation.** Backend (Phases 1+3+4+5) landed on `development`. This plan specifies the UI layer.
> **Reference:** ADR-0095, `docs/architecture/SHIFT_LIFECYCLE_MAP.md`, Council 2026-04-15 (R1–R8 locked).

**Worktree:** `/home/sxtnl/dev/smartout.ai-wt-1` · **Branch:** `feat/shift-timeline-ui` · **Data source:** `v_shift_lifecycle`

---

## 0. Vocabulary Lock

| Phase key (DB) | Employee copy (nb) | Admin copy (nb) | EN |
|---|---|---|---|
| `planlegges` | "Planlegges" | "Planlegges" | "Planned" |
| `pagar` | "Pågår" | "Pågår" | "In progress" |
| `oppgjor` | "Oppgjør" | "Oppgjør" | "Settlement" |
| `avsluttet` | "Avsluttet" | "Avsluttet" | "Closed" |

**Forbidden in UI strings:** "Livssyklus", "Lifecycle", "State machine", "Status flow", "Shift stages" (as heading). Object noun: "Din vakt" / "Vakten".

i18n: `shift.timeline.*` in `packages/i18n/locales/{nb,en}/shift.json` (new file).

---

## 1. Primitives — `packages/ui/src/shift-timeline/`

### 1.1 `<LifecycleStage>`

Props: `phase, state, label, timestamp?, metric?, detail?, hasDeviation?, hasBlockingDeviation?, onClick?, orientation?, reducedMotion?`

**Tokens:**
- Active: `bg-primary/10` inner, `ring-1 ring-primary/40` outer
- Completed: `text-muted-foreground`, icon `text-primary/60`
- Upcoming: `text-muted-foreground/70`, dashed `border-border/60`
- Skipped: upcoming + strikethrough
- Deviation: amber `oklch(0.75 0.15 55)` → add `--color-warning` if missing
- Blocking: `text-destructive` + `animate-pulse` on dot only
- Label: Geist Sans `text-sm font-medium` (NOT `font-heading`)
- Metric value: `font-mono tabular-nums text-lg`

**Motion:** Spring `{stiffness: 35, damping: 22, mass: 2.2}`. Animates on phase change only (4 events/shift max). Completion crossfade 450ms.

**Mobile:** vertical, 48px touch target. **Desktop:** vertical default (Council R3). Horizontal = escape hatch, NOT built in Phase 6.

### 1.2 `<StageConnector>`

Props: `fromState, toState, orientation?, reducedMotion?`

- Completed→completed: solid `border-primary/40` 1px
- Completed→active: gradient `from-primary/40 to-primary/10` with 700ms fill
- Others: dashed `border-border/50`
- Vertical 32px, horizontal 48px

### 1.3 `<ActiveOrb>`

Props: `anchorPhase, size?, intensity?, reducedMotion?`

**Construction (radial-gradient, NOT blur):**
- Base: `radial-gradient(ellipse at center, oklch(0.70 0.14 50 / 0.45), transparent 60%)`
- Highlight: `radial-gradient(circle at 30% 30%, oklch(0.85 0.08 55 / 0.35), transparent 45%)`
- Sizes: sm=160px (mobile), md=240px (sheet), lg=360px (full-page)
- Attention: hue→35, scale pulse 1.0↔1.03 over 3s

**Drift:** `layoutId="shift-lifecycle-orb"` + Framer `layout` prop + lava-lamp spring. Reduced-motion → jump, no idle drift.

### 1.4 `<StageBadge>`

Variants: `deviation | blocking | pending-approval | punched-in | punched-out | locked`

`bg-muted/60 text-xs rounded-full px-2 py-0.5`, Lucide 12px, hover `ring-1 ring-primary/30`.

### 1.5 Barrel: `packages/ui/src/shift-timeline/index.ts` + `package.json` exports map entry `"./shift-timeline"`.

---

## 2. Composed exports

### 2.1 `<EmployeeShiftTimeline>`

Paths: `apps/web/src/components/shift-timeline/EmployeeShiftTimeline.tsx` + mobile mirror.

Props: `shiftId, onOpenBotsson?, className?`

- All 4 stages always visible. Derive state from `data.phase`.
- Metrics per stage (employee):
  - Planlegges: "Planlagt: 7,5 t"
  - Pågår: live counter from `last_punch_in` or "Ikke startet"
  - Oppgjør: `interpreted_hours` as "Tolket: 7,25 t"
  - Avsluttet: `approved_hours` as "Godkjent: 7,25 t"
- Deviation → `onOpenBotsson({ phase, reason: 'deviation' })`
- **No cost fields** (RLS + UI defensive filter).

### 2.2 `<AdminShiftTimeline>`

Path: `apps/web/src/components/shift-timeline/AdminShiftTimeline.tsx`

Props: `shiftId, onOpenBotsson?, onOpenDeviation?, className?`

Richer `detail` per stage (publisher, punch status, cost diff, approver, reconciliation). `<StageBadge>` aggressively (pending-approval, locked, punched-in). Deviation → Botsson with `capability: 'shift_lifecycle'`.

Vertical only.

---

## 3. Data layer — `packages/schedule/src/hooks/useShiftLifecycle.ts`

```ts
export type ShiftLifecycleRow = {
  shift_id, workspace_id, department_id, employee_id, shift_date,
  phase: 'planlegges' | 'pagar' | 'oppgjor' | 'avsluttet',
  scheduled_hours, interpreted_hours, approved_hours, gross_cost,
  shift_status, session_status, approval_status, reconciliation_status,
  last_punch_in, last_punch_out, has_deviation, has_blocking_deviation
};

export function useShiftLifecycle(shiftId: string, opts?: { suspense?: boolean }):
  { data, isLoading, isError, error, refetch };
```

- TanStack Query, key `['shift-lifecycle', shiftId]`, `staleTime: 30s`
- Query: `supabase.from('v_shift_lifecycle').select('*').eq('shift_id', shiftId).single()`
- RLS enforces workspace scope
- Realtime = Phase 6.5 (flag-gated, out of scope)
- Platform-agnostic (works in RN). Export from `packages/schedule/src/index.ts`.

---

## 4. Entry points

### 4.1 Web admin cockpit
**Modify:** `apps/web/src/app/dashboard/shifts/_components/CockpitGrid.tsx`
**New:** `apps/web/src/app/dashboard/shifts/_components/ShiftSheet.tsx`
- Click cell → shadcn `Sheet` right `w-[480px] lg:w-[560px]`
- Header: employee + date `font-heading text-2xl` + department
- Content: `<AdminShiftTimeline />`
- Footer: Approve / Request interpretation / Open in Botsson

### 4.2 Mobile employee home
**Modify:** `apps/mobile/app/(app)/(home)/index.tsx` + `apps/mobile/src/components/home/ShiftCard.tsx`
- "Din vakt fredag" card; collapsed=phase label+action, expanded=inline timeline

### 4.3 Botsson
- **Web:** `onOpenBotsson` → `useBotsson()` hook, panel alongside sheet (`modal={false}`)
- **Mobile:** push `/chat/botsson?context=shift:{shiftId}:phase:{phase}` via expo-router

---

## 5. Notification consolidation (R6)

**One component:** `packages/ui/src/notifications/ShiftNotification.tsx`

```ts
type ShiftNotificationKind =
  | 'published' | 'reminder' | 'punched_in' | 'punched_out'
  | 'interpretation_ready' | 'approval_needed' | 'approved'
  | 'deviation_raised' | 'deviation_blocking' | 'closed';
```

**One copy source:** `packages/i18n/locales/{nb,en}/shift-notifications.json` with `shift.notification.{kind}.{title,body}`.

Backend emits `{ kind, shiftId, params }` — **never user-facing strings**. Helper `toast.shift(kind, shiftId, params)`. Legacy strings → fallback plain render.

Inventory at build via `rg -n "toast\(|Toaster|useToast|Notification\b" apps/web/src packages/ui/src packages/notifications/src`. Migrate 3 highest-volume call sites in Phase 6. Full backend payload migration = follow-up.

---

## 6. Deviation-Botsson bridge (R5)

**Path:** `apps/web/src/components/shift-timeline/DeviationBridge.tsx` + mobile mirror

```ts
type DeviationBridgeProps = {
  shiftId, phase, deviationId?, reason, capability?,
  children: (open: () => void) => React.ReactNode;
};
```

Render-prop. Preinject `{ type: 'shift_context', shift_id, phase, deviation_id?, capability? }` via `botsson.preinject()` → open panel.

**Mobile:** route params + one-shot `AsyncStorage` key `botsson.pending_context`.

**Fallback (Botsson unavailable):** shadcn Dialog with deviation detail + "Jeg forstår" / "Kontakt leder" (mailto + activity_trail emit).

---

## 7. Accessibility

- Stage = `<button>`, tab-reachable, Enter/Space triggers
- Focus ring `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- Timeline `role="list"`, stage `role="listitem"`, active `aria-current="step"`
- Phase change: `aria-live="polite"` "Vakten din har gått fra X til Y"
- `useReducedMotion()` — orb static, transitions opacity-only 150ms, connectors solid
- Sheet focus trap + Escape via shadcn defaults

---

## 8. Build sequence (10 commits)

Each = one commit. `feat(shift-timeline): ...` + Co-Authored-By trailer.

1. **Primitives scaffolding** — 4 primitives + index + exports + design page `apps/web/src/app/design/shift-timeline/page.tsx` rendering all 16 state combos
2. **Data hook** — `useShiftLifecycle` + unit test with mocked Supabase
3. **EmployeeShiftTimeline web** + i18n bundles + Playwright `employee.spec.ts`
4. **Mobile integration** — RN component + home card expanded + Expo smoke test
5. **AdminShiftTimeline** + Playwright `admin.spec.ts`
6. **Web cockpit sheet** — ShiftSheet + grid click wire + Playwright `cockpit-sheet.spec.ts`
7. **Notification consolidation** — ShiftNotification + helper + i18n + migrate 3 top call sites
8. **Deviation-Botsson bridge** + preinject + fallback Dialog + Playwright spec
9. **A11y polish** — aria-live, role=list, useReducedMotion + axe-core audit
10. **E2E journeys** — employee punch→approved walk + admin approve-in-cockpit

---

## 9. Non-goals

1. New capability wiring (backend shipped)
2. Schema changes (`v_shift_lifecycle` suffices)
3. Mobile rebuild (card integration only)
4. Horizontal admin dense table
5. Realtime subscriptions (Phase 6.5)
6. Backend notification payload migration
7. Admin bulk approve UX
8. Third locale
9. Botsson voice-mode for deviations
10. Legacy cockpit grid theming cleanup

---

## 10. Closure checklist

- [ ] Phase labels all from i18n
- [ ] `rg -i "lifecycle|livssyklus"` in `apps/web/src/components/shift-timeline/` → 0 user-facing matches
- [ ] Design page renders 16 state combos
- [ ] `pnpm turbo typecheck lint` 0 errors
- [ ] Playwright specs (3,5,6,8,9,10) pass
- [ ] Axe-core 0 violations on design page + cockpit sheet
- [ ] Reduced-motion: no transform animations
- [ ] Mobile "Din vakt" expanded on iOS sim + Android emulator
- [ ] ADR-0095 updated with Phase 6 status
- [ ] HANDOFF written

---

## Source files

**Read before implementing:**
- `docs/decisions/0095-shift-lifecycle-five-layer-architecture.md`
- `docs/architecture/SHIFT_LIFECYCLE_MAP.md`
- `docs/design/ren-og-varm-styleguide.html`
- `docs/design/motion.md`, `components.md`, `mobile.md`
- `packages/design-tokens/src/tokens.ts`
- `packages/ui/src/wizard/WizardShell.tsx` (primitive pattern reference)

**Existing files to modify:**
- `packages/ui/package.json` (exports map)
- `packages/schedule/src/index.ts` (re-export)
- `apps/web/src/app/dashboard/shifts/_components/CockpitGrid.tsx`
- `apps/mobile/app/(app)/(home)/index.tsx`
- `packages/design-tokens/src/tokens.ts` (warning token)
- `docs/decisions/0000-decision-log.md` (at closure)
