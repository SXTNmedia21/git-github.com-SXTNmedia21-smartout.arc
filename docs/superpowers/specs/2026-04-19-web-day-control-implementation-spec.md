---
title: "WebDayControl — Implementation Spec (Replace OversiktView)"
id: SPEC_WEB_DAY_CONTROL_IMPL_2026_04_19
version: "1.0"
status: draft
layer: spec
created: 2026-04-19
updated: 2026-04-19
author: pontus + claude
supersedes: []
depends_on:
  - DESIGN_DAY_INFORMATION_2026_04_19
  - ADR-0114
  - ADR-0115
  - ADR-0133
  - ADR-0156
  - ADR-0157
tags:
  - spec
  - implementation
  - web-day-control
  - dashboard
  - overview-v2
  - nordic-split
module: dashboard
---

# WebDayControl — Implementation Spec

> Narrow implementation spec that instantiates `DESIGN_DAY_INFORMATION_2026_04_19` (holistic design spec) into a single replaceable surface: the admin "Oversikt" route. Council-approved 2026-04-19 (APPROVE WITH CHANGES, unanimous). All 15 blocking conditions encoded below.

---

## 0. TL;DR

- Replace `apps/web/src/components/dashboard/OversiktView.tsx` (1070 LOC, mock-data executive roll-up) with `WebDayControl` — a 7-tab session-centric panel driven by `department_session`.
- 10 canonical widgets ported from design bundle `smartout/project/day/*.jsx`.
- 4-PR rollout (~5 days). PR 1 (tokens) → PR 2 (scaffold + Overview live) → PR 3 (6 tabs + Server Actions) → PR 4 (polish + delete OversiktView).
- All new mutations go through Server Actions (ADR-0114 applied to new paths per ADR-0157).
- Widgets live at `apps/web/src/components/day/` with strict portability discipline; extract to `packages/ui/day-control/` when mobile lands (ADR-0133).

---

## 1. Scope

### In scope
1. `WebDayControl` component (shell + 7 tabs)
2. 10 widgets: `SessionHeader`, `PhaseBadge`, `PhaseTimeline`, `ShiftCard`, `TaskRow`, `HookTile`, `KpiTile`, `DeviationCard`, `BroadcastComposer`, `SignoffPanel`, `ReconSummary`
3. `derivePhase(session, recon)` helper — resolves UI 6-state from DB 5-state + reconciliation lock
4. Design tokens: `--dept-kitchen/service/bar/event` (OKLCH light+dark)
5. Three Server Actions: `signoffSessionAction`, `toggleSessionTaskAction`, `sendBroadcastAction`
6. One new hook: `use-session-hooks-with-tasks.ts`
7. One selector: `useRoster(date, departmentId)` composing `useDepartmentShifts` + `useLiveShifts`
8. `engine_authority_config` seeds: `session.signoff`, `broadcast.send`
9. engine_memory pinning on panel mount (24h TTL)

### Out of scope
- Mobile port (Phase 2 of ADR-0133; not this PR)
- Retroactive rewrite of existing TanStack mutations (ADR-0157 boundary)
- New `department_session` row creation from UI (engine's job via `session-lifecycle`)
- POS/revenue integration (revenue stays post-reconciliation only)
- ReconciliationView replacement (lives independently; Oppgjør tab deep-links)
- **Compose drawers** from current OversiktView (Nyhet / Dagsnotat / Vakt / Invitasjon). These are executive-admin composition verbs, not day-control. They are **deleted** with OversiktView. Follow-up: surface "Invitér ansatt" in `DashboardShell` global action menu; "Ny vakt" moves to schedule module; "Dagsnotat" and "Nyhet" → day-control's Melding tab (broadcast type covers "note" already; dagsnotat = broadcast scoped to session).
- **Admin without department** fallback UX: falls back to first workspace department (by `created_at ASC`). Workspace picker in top bar is out of scope — admins who manage multiple depts use existing `DashboardShell` workspace switcher.

---

## 2. Source-of-truth mapping

| UI tab | Primary table(s) | Hook(s) — existing | Hook(s) — new | Writes |
|--------|------------------|--------------------|----------------|--------|
| Oversikt | `department_session`, `deviation`, `schedule_shift`, `timesheet.time_entry`, `channel_message` | `useDepartmentSessions`, `useLeaderPulse`, `useLiveShifts`, `useDeviations`, `useChannels`, `useChannelMessages` | dept-filter wrapper on `useDepartmentSessions` | — |
| Dagslinjen | `department_session`, `session_hook`, `session_task` | — | `useSessionHooksWithTasks` | — |
| Bemanning | `schedule_shift`, `timesheet.time_entry`, `profile` | `useDepartmentShifts`, `useLiveShifts` | `useRoster(date, deptId)` selector | — |
| Oppgaver | `session_hook`, `session_task` | — | `useSessionHooksWithTasks` | `toggleSessionTaskAction` |
| Avvik | `deviation` | `useDeviations`, `useCreateDeviation`, `useUpdateDeviation` | — | existing mutations OK |
| Melding | `channel`, `channel_message` (komm news) | `useSendBroadcast`, `useBroadcastRecipients`, `useChannels`, `useChannelMessages` | — | `sendBroadcastAction` (replaces `useSendBroadcast` mutation call) |
| Oppgjør | `department_session`, `daily_reconciliation`, `shift_cost_snapshot` | `useSignoffSession`, `useReconciliation` | — | `signoffSessionAction` (replaces `useSignoffSession` mutation call) |

---

## 3. Phase derivation (ADR-0156 rule)

UI exposes 6 phase states; DB enum has 5. `locked` is derived, not stored.

```ts
// packages/utils/src/cascade/derive-phase.ts (new file)
export type UiPhase =
  | "upcoming"
  | "active"
  | "pending_signoff"
  | "closed"
  | "missed"
  | "locked";

export function derivePhase(
  session: { status: DepartmentSessionStatus },
  recon?: { status: DailyReconciliationStatus; locked_at: string | null } | null,
): UiPhase {
  if (session.status === "closed" && recon?.status === "locked") return "locked";
  return session.status; // passthrough for upcoming/active/pending_signoff/closed/missed
}
```

All widgets consume `phase: UiPhase`, never raw `session.status`. **No new DB migration.**

---

## 4. Server Actions (ADR-0157 applies)

Three new mutations. Each: Server Action file in `apps/web/src/app/dashboard/_actions/`, Zod-validated input, `emit()` for telemetry, authority check via `engine_authority_config`.

### 4.1 `signoffSessionAction`
- Input: `{ sessionId: uuid, notes?: string, confirm: "pending" | "close" }`
- Authority: `session.signoff` (min_role=manager, level=confirm, dept-RLS scoped)
- Writes: `department_session.status` transition only. `active → pending_signoff` (leder) or `pending_signoff → closed` (admin). Does NOT write `daily_reconciliation` — that row is created by the existing day-close workflow / ReconciliationView; Server Action only transitions session status.
- Emits: `session pending_signoff` (step 1) + `session closed` (step 2) — both via registry fan-out
- Gap fix: existing `useSignoffSession` skips step-1 emit (registry has it; hook never calls it). Server Action fixes this.

### 4.2 `toggleSessionTaskAction`
- Input: `{ taskId: uuid, done: boolean, evidence?: { photos: string[] }, note?: string }`
- Authority: inherited from `operations` capability grant (existing)
- Writes: `session_task.completed_at`, `completed_by`
- Emits: `session task_completed` via registry — must NOT bypass like `complete_task` agent tool does (flagged audit item)
- Derived write: `department_session.tasks_completed` auto-increment — see §5

### 4.3 `sendBroadcastAction`
- Input: `{ type: "alert" | "reminder" | "note", title: string, body: string, recipientIds: uuid[], departmentId?: uuid }`
- Authority: `broadcast.send` (min_role=manager, allowedChannels=['chat'])
- Writes: resolves/creates `channel` (type=news), inserts `channel_message` (type=announcement) with `metadata.broadcast_type = type` JSONB
- Emits: `communication.broadcast_sent` (existing registry entry — may need `engine_event` destination added)
- PII guardrail: server-side regex check on title+body for personnummer/bank/adresse per ADR-0077 (reject with 422)

---

## 5. `tasks_total` / `tasks_completed` policy

`department_session.tasks_total` and `tasks_completed` are NOT auto-maintained by trigger today (Supervisor finding).

**Decision:** **Derive client-side** from `useSessionHooksWithTasks` count. Do NOT read the columns. Do NOT add a trigger migration in this PR (reduces migration scope, matches Steward's "no orphan state" rule — columns become advisory, not authoritative).

Follow-up issue: add trigger OR deprecate columns. Out of scope here.

---

## 6. Authority seeds

New SQL seed migration: `supabase/migrations/YYYYMMDDHHMMSS_seed_day_control_authority.sql`

Verify the actual unique constraint on `engine_authority_config` before emitting `ON CONFLICT` clause (existing migrations use `(capability_key, workspace_id)` but must be confirmed via `grep "UNIQUE\|CREATE UNIQUE\|unique" supabase/migrations/*engine_authority*` in PR 3). Seeds:

- `session.signoff`   — `min_role=manager`, `level=confirm`, `allowed_channels=['chat']`, `workspace_id=NULL`
- `broadcast.send`    — `min_role=manager`, `level=confirm`, `allowed_channels=['chat']`, `workspace_id=NULL`

`workspace_id = NULL` → platform default. Per-workspace overrides via existing `engine_authority_config` UI.

---

## 7. engine_memory pinning

On panel mount, Web route handler writes to `engine_memory` so Botsson has context:

```ts
// apps/web/src/app/dashboard/_lib/pin-day-control-context.ts (new)
export async function pinDayControlContext({
  sessionId, departmentName, date, profileId, workspaceId,
}: PinArgs) {
  await supabase.from("engine_memory").insert({
    workspace_id: workspaceId,
    profile_id: profileId,
    memory_type: "fact",
    content: `Viewing department_session=${sessionId} for department=${departmentName} on date=${date}`,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    source: "web.day-control",
  });
}
```

Called from Server Component wrapper on panel route. Botsson's `loadRecentMemories` picks it up automatically (verified in `services/stage-engine/src/core/memory-manager.ts:22`).

---

## 8. Widget placement (ADR-0156 staging)

- **Phase 1 (this series):** `apps/web/src/components/day/`
  - `widgets/` — 10 widget files
  - `WebDayControl.tsx` — shell
  - `tabs/{OverviewTab,TimelineTab,RosterTab,TasksTab,DeviationsTab,BroadcastTab,SignoffTab}.tsx`
- **Portability discipline (MANDATORY — enforced via ESLint):**
  - No `next/image`, no `next/link`, no Next-specific hooks in widget files
  - No direct Supabase client access in widgets — data via props only
  - Lucide icons allowed (react-native-compatible via expo-symbols later)
  - CSS via CSS variables (no CSS modules, no styled-components)
  - **Enforcement:** ESLint rule added in PR 2 — `no-restricted-imports` override for pattern `apps/web/src/components/day/widgets/**` forbidding imports of `next/*` and `@/lib/supabase/**`. CI must fail if violated.
- **Phase 2 (future PR, out of scope now):** Extract to `packages/ui/day-control/` when mobile consumer is ready.

---

## 9. Design tokens (PR 1 prerequisite)

New tokens in `packages/design-tokens/src/tokens.ts` + `.css` + `native.ts`:

```ts
// Light
"--dept-kitchen":  "oklch(0.68 0.15 40)",   // warm orange, hue-shifted from brand
"--dept-service":  "oklch(0.68 0.12 170)",  // teal
"--dept-bar":      "oklch(0.58 0.20 300)",  // purple
"--dept-event":    "oklch(0.70 0.15 60)",   // amber-gold

// Dark — same hue, lightness adjusted
"--dept-kitchen":  "oklch(0.72 0.16 40)",
"--dept-service":  "oklch(0.72 0.13 170)",
"--dept-bar":      "oklch(0.68 0.22 300)",
"--dept-event":    "oklch(0.75 0.16 60)",
```

Verify existing `--success`, `--warning`, `--info` tokens exist in both modes; add if missing.

---

## 10. PR breakdown

### PR 1 — Design tokens prereq
- Add 4 dept tokens (light+dark) to tokens.ts/.css/native.ts
- Verify success/warning/info dark variants
- Typecheck + commit
- **~2 hours**

### PR 2 — Scaffold + Overview tab live (Phase 1)
- Create `apps/web/src/components/day/` structure with 10 widget skeletons + `WebDayControl` shell + 7 tab stubs
- Port all widgets with Nordic Split CSS variables (no hex)
- Write `derivePhase` helper + `pinDayControlContext`
- Wire Overview tab fully to live data using existing hooks (plus dept-filter wrapper)
- **Feature flag branch point:** `apps/web/src/app/dashboard/page.tsx:68` — the existing `adminView === "oversikt"` branch. Gated with `process.env.NEXT_PUBLIC_DAY_CONTROL_V2 === "true"` → `<WebDayControl />`; else `<OversiktView />`. Both imported via `dynamic()`.
- Dept filter: `profile.department_id` → fallback `first workspace department by created_at ASC`
- Empty state: "Ingen sesjon registrert for i dag — venter på åpningsrutine"
- ESLint rule for portability discipline (§8) added
- **~1 day**

### PR 3 — Remaining 6 tabs live + Server Actions + authority (Phase 2)
- Build `useSessionHooksWithTasks`
- Build `useRoster` selector (join time_entry onto schedule_shift)
- Three Server Actions with Zod + emit + authority checks
- Seed migration for `engine_authority_config` (session.signoff, broadcast.send)
- Registry emit fixes (signoff pending_signoff, broadcast engine_event routing decision, task toggle)
- Broadcast type encoding in `channel_message.metadata.broadcast_type` JSONB
- Wire Dagslinjen, Bemanning, Oppgaver, Avvik, Melding, Oppgjør tabs
- engine_memory pin on panel mount
- **~2.5 days**

### PR 4 — Polish + delete OversiktView (Phase 3)
- Motion spec (10 items per Designer review — springs + CSS pulses, `useReducedMotion` fallback)
- Dark mode pass: SignoffPanel gradient `color-mix()`, PhaseBadge tints, orb hue-shift
- A11y fix list (11 items per Designer review)
- One orb (down from OversiktView's two), phase-reactive hue
- Remove feature flag, delete `OversiktView.tsx`, simplify `page.tsx` variant routing
- Write ADR-0156, ADR-0157, L-0064 (already drafted in this PR series; mark accepted)
- Close out `PLAN-overview-v2.md`
- **~1 day**

---

## 11. Acceptance criteria

### Functional
- [ ] All 7 tabs render for a seeded `department_session` (Café Skuta · Kjøkken · today)
- [ ] Oversikt KPIs: revenue labeled "post-reconciliation" when not yet reconciled
- [ ] Dagslinjen: `PhaseTimeline` "NÅ" marker updates every minute (not per-second, per Designer §3)
- [ ] Bemanning: actual vs planned hours computed from `time_entry` join
- [ ] Oppgaver: task toggle writes `session_task.completed_at` AND emits via registry
- [ ] Avvik: 4-way status filter works (`open/acknowledged/resolved/escalated`)
- [ ] Melding: compose writes to `channel_message` with `metadata.broadcast_type`
- [ ] Oppgjør: signoff writes `department_session.status` + `daily_reconciliation` row

### Trust Gate (ADR-0156)
- [ ] `session.signoff` + `broadcast.send` rows seeded in `engine_authority_config`
- [ ] All 3 Server Actions authority-gated against current user's role + dept
- [ ] `session pending_signoff` telemetry event fires on step 1 of signoff
- [ ] Task toggle UI uses `emit()` registry-path, not direct `engine_event` insert
- [ ] PII guardrail blocks broadcast containing personnummer regex

### Quality
- [ ] `pnpm turbo typecheck` passes
- [ ] Widget portability discipline holds (no next/* imports in `components/day/widgets/`)
- [ ] Dark mode verified visually on all 10 widgets
- [ ] `useReducedMotion()` respected in all Framer Motion uses
- [ ] ARIA roles on tabs, accordions, table (11 Designer items)

### Docs
- [ ] ADR-0156 accepted
- [ ] ADR-0157 accepted
- [ ] L-0064 registered in learning log
- [ ] Council log entry committed (2026-04-19)
- [ ] HANDOFF-overview-v2.md written at closure

---

## 12. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `tasks_total` trigger gap → stale KPI | Derive client-side from `useSessionHooksWithTasks` |
| Dept filter missing → leder sees all depts | Mandatory selector wrapper; reject merge without dept filter |
| `session_hook`+tasks join missing | Build `useSessionHooksWithTasks` in PR 3, blocks Dagslinjen + Oppgaver |
| `broadcast_type` silent schema drift | Encode in `channel_message.metadata.broadcast_type` JSONB, documented in ADR-0156 |
| SignoffPanel burnt-caramel dark mode | Use `color-mix(in oklch, var(--warning) 8%, var(--card))` not raw rgba |
| Server Action adoption feels inconsistent | Scope boundary per ADR-0157: new only, not retro |
| Widget extraction cost | Phase-1 portability discipline enforced via ESLint rule (future): `no-restricted-imports` for `next/*` under `components/day/widgets/` |

---

## 13. References

- `DESIGN_DAY_INFORMATION_2026_04_19` — holistic design spec (parent)
- Council verdict 2026-04-19 — `docs/council/COUNCIL-LOG.md`
- ADR-0114 — Server Actions Canonical Mutation Primitive
- ADR-0115 — RSC Migration Pattern
- ADR-0133 — Web Composes, Mobile Executes
- ADR-0156 — Day-Control Panel (this PR series)
- ADR-0157 — Server Actions Scope Amendment (this PR series)
- L-0064 — Phase Enum UI-vs-DB Drift (this PR series)
