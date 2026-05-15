---
title: Schedule Card Density — Architecture Plan
status: done
updated: 2026-05-15
created: 2026-05-15
module: schedule
tags: [schedule, density, ui, voice, telemetry]
---

# Schedule Card Density — Architecture Plan

Pontus' 3 fixed decisions honored (dedicated table, dual-render Pulse, SHIFT_INDICATOR_STYLES re-purposed). T3 hard constraints honored (design-tokens reuse, conflict-strip preserved in all tiers, single discriminated `schedule_view_change` event, gateAction + ADR-0094 pre-registration).

## 1. Density tier specification

Four tiers, name = enum `schedule_density`. Conflict-strip is a fixed 4px left rail in every tier (C2). Role-color uses `SHIFT_INDICATOR_STYLES[indicator]` on the rail when no conflict; switches to `bg-destructive` when `hasConflict` true.

**cozy** — 120px row, 16px padding, full card

```
┌──┬─────────────────────────────┐
│██│ Servitør          [conf-✓]  │   ██ = indicator strip (4px)
│██│ Sone A                      │
│██│  10–22  · 12t · 2 oppg.     │
└──┴─────────────────────────────┘
```

CSS: cell `h-[120px] p-3`, card `flex-col gap-2.5 p-3 rounded-lg`. Visible: role, zone, time, hours, task count, status icon. Conflict: rail switches to red + ring-destructive/60 on card.

**default** — 100px row, today's normal mode (`h-[100px] p-2`). Card per `draggable-card-views.tsx:152-183`. Visible: role, zone, time, status icon. No hours/task count.

**compact** — 52px row, today's compact (`h-[52px] p-1`). Card per `draggable-card-views.tsx:128-149`. Visible: role + time + status dot. Rail at `w-0.5` (existing pattern). Conflict: rail red + ring on card.

**pulse** — 28px row (heatmap baseline) OR 40px mini-card-with-strip (conflict escape). See section 8. Visible (heatmap): solid color cell only. Visible (mini-card): 4px rail + role initials (`SV`) + time hour (`10–22`). No status icon, no zone.

```
heatmap:         conflict-escape mini-card:
░░░░░ (28px)     ┌──┬──────────────┐
                 │██│ SV  10–22    │  (40px, red rail)
                 └──┴──────────────┘
```

## 2. Database schema

Re-check `database.types.ts` enums for `schedule_density` (none expected — new enum). Use `text` + CHECK constraint instead of new enum to avoid `database.types.ts` regen blocker on Local; future migration can promote to enum if reused.

```sql
-- supabase/migrations/20260515120050_user_view_preference.sql
-- (filename bumped from 120000 → 120050 due to collision with channel_event_projection_trigger)
create table public.user_view_preference (
  user_view_preference_id  uuid primary key default gen_random_uuid(),
  profile_id               uuid not null references public.profile(profile_id) on delete cascade,
  workspace_id             uuid not null references public.workspace(workspace_id) on delete cascade,
  surface                  text not null,              -- 'schedule' | future: 'oversikt', 'contracts'
  preference_key           text not null,              -- 'density'
  preference_value         text not null,              -- 'cozy'|'default'|'compact'|'pulse'
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint user_view_preference_unique unique (profile_id, workspace_id, surface, preference_key),
  constraint user_view_preference_density_value
    check (preference_key <> 'density' or preference_value in ('cozy','default','compact','pulse'))
);

create index user_view_preference_lookup
  on public.user_view_preference (profile_id, workspace_id, surface);

alter table public.user_view_preference enable row level security;

-- JWT path (browser): user reads/writes own rows only
create policy "user_view_preference_own_jwt_select"
  on public.user_view_preference for select to authenticated
  using (profile_id = (select profile_id from public.profile where user_id = auth.uid()
                       and workspace_id = user_view_preference.workspace_id));

create policy "user_view_preference_own_jwt_write"
  on public.user_view_preference for insert to authenticated
  with check (profile_id = (select profile_id from public.profile where user_id = auth.uid()
                            and workspace_id = user_view_preference.workspace_id));

create policy "user_view_preference_own_jwt_update"
  on public.user_view_preference for update to authenticated
  using (profile_id = (select profile_id from public.profile where user_id = auth.uid()
                       and workspace_id = user_view_preference.workspace_id));

-- API-key path: no policy — server actions use service-role + manual profile/workspace guard
```

Updated_at trigger via existing `set_updated_at()` helper (workspace pattern).

After migration: `pnpm supabase gen types --local typescript > packages/supabase/src/types/database.types.ts` (NOT under `op run` per L-op-run-supabase-gen-types).

## 3. Server Action contract

> **2026-05-15 implementation note:** Real `gateAction` is RPC-style (returns `GateResult { allow, reason }`), not callback-wrapper. Shipped action calls `gateAction(...)` → checks `gate.allow` → then runs upsert + emit. `entity_type = "profile"` (user_view_preference not in EntityType enum). See commit `938c0d867`.

File: `apps/web/src/app/dashboard/schedule/_actions/set-schedule-density.ts`.

```ts
"use server";
import { z } from "zod";
import { gateAction } from "@/app/dashboard/_actions/_shared";
import { resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";
import { emit } from "@smartout/telemetry";

const InputSchema = z.object({
  density: z.enum(["cozy","default","compact","pulse"]),
});

export type SetScheduleDensityResult =
  | { ok: true; density: "cozy"|"default"|"compact"|"pulse" }
  | { ok: false; error: string };

export async function setScheduleDensityAction(
  input: z.infer<typeof InputSchema>
): Promise<SetScheduleDensityResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid density" };

  // ADR-0151: server-derive profile_id + workspace_id from JWT, NEVER body
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };

  return gateAction({
    capability: "schedule.view_preference.write",
    workspace_id: profile.workspaceId,
    actor_profile_id: profile.profileId,
    roleFloor: "employee",                   // any logged-in user owns their view
    run: async (admin) => {
      const { error } = await admin
        .from("user_view_preference")
        .upsert({
          profile_id: profile.profileId,
          workspace_id: profile.workspaceId,
          surface: "schedule",
          preference_key: "density",
          preference_value: parsed.data.density,
        }, { onConflict: "profile_id,workspace_id,surface,preference_key" });
      if (error) return { ok: false, error: error.message };

      await emit({
        event: "schedule.density_changed",
        workspace_id: profile.workspaceId,
        actor_id: profile.profileId,
        properties: {
          entity: { type: "user_view_preference", id: profile.profileId },
          data: { density: parsed.data.density, source: "ui" },
        },
      });
      return { ok: true, density: parsed.data.density };
    },
  });
}
```

Idempotency: UPSERT on the unique tuple — repeated identical writes return ok without churning row.

Reader query: `getScheduleDensity(profileId, workspaceId)` server-component helper in same `_actions/` folder, returns `'default'` if no row.

## 4. Telemetry event registration

Event: `schedule.density_changed` (registry convention: `<surface>.<verb>_<noun>` per `personal.setting_updated` neighbour at registry.ts:8843).

Insert location:
- Interface: `packages/telemetry/src/registry.ts` near line 8849 (after `PersonalSettingUpdated`, in agent/personal block — schedule view-state is closer to "setting" than "shift").
- Routing entry: line 12489 area.

```ts
export interface ScheduleDensityChanged extends BaseEvent {
  event: "schedule.density_changed";
  properties: {
    entity: EntityRef;
    data: { density: "cozy"|"default"|"compact"|"pulse"; source: "ui"|"voice" };
  };
}

"schedule.density_changed": {
  destinations: ["posthog", "activity_trail"],
  category: "schedule",
},
```

Destinations rationale: posthog (adoption funnel — Pulse uptake, conflict-escape rate), activity_trail (audit — who switched what when). NOT engine_event (no downstream workflow), NOT logger-only (need PostHog signal).

ADR-0094 sequence: registry merge FIRST → typecheck green → THEN Server Action lands. Otherwise emit() fails type-check.

## 5. Voice-tool extension

New tool: `set_schedule_density` in `services/voice-agent/src/tools-schedule.ts`. Insert after `set_schedule_focus_day` (line ~549 area).

Pattern follows L-0234 — single `schedule_view_change` event, NEW `action` discriminant `set_density`. NO new event type.

```ts
set_schedule_density: llm.tool({
  description: [
    "Bytt tetthet på vaktplan-kort.",
    'Bruk når brukeren sier "vis mer info", "kompakt visning", "gi meg pulsen",',
    '"større kort", "krymp", "vis dagen som hetekart".',
    "Allowed values: cozy | default | compact | pulse.",
    "Pulse = heatmap-modus for å se hele uka på én skjerm.",
    "Bare når brukeren er på vaktplan-siden.",
  ].join(" "),
  parameters: {
    type: "object" as const,
    properties: {
      density: {
        type: "string",
        enum: ["cozy","default","compact","pulse"],
      },
    },
    required: ["density"],
    additionalProperties: false,
  },
  execute: async ({ density }: { density: string }) => {
    const redirect = checkSchedulePath();
    if (redirect) return redirect;
    if (!["cozy","default","compact","pulse"].includes(density)) {
      return `Ugyldig tetthet "${density}".`;
    }
    _publishActivity({
      type: "schedule_view_change",
      payload: { action: "set_density", density },
    });
    return `Bytter til ${density === "pulse" ? "puls-modus" : density + "-visning"}.`;
  },
}),
```

`ScheduleViewChangePayload` discriminated union extension in `apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx:91-97`:

```ts
| { action: "set_density"; density: "cozy"|"default"|"compact"|"pulse" };
```

Bridge handler in `schedule-voice-tools-bridge.tsx` `case "set_density":` calls `setScheduleDensity(payload.density)` (the same setter the UI button uses, source-of-truth single path).

Voice path: persistence is intentionally fire-and-forget — bridge calls UI setter, setter calls Server Action. Voice tool itself does NOT call gateAction (L-0234: view-tools never write to domain tables). Persistence ride-along happens via the shared client setter. This means voice tool returns success even if persistence later fails; acceptable — view-state is best-effort, conflict-strip + density both fall back to `'default'`.

## 6. State management

`ScheduleCoordinationContext.tsx:85` migration:

```ts
// Before
const [scheduleCompactMode, setScheduleCompactMode] = useState(false);

// After
type ScheduleDensity = "cozy"|"default"|"compact"|"pulse";
const [scheduleDensity, setScheduleDensityState] =
  useState<ScheduleDensity>(initialDensity ?? "default");

// Setter wraps Server Action + local state (optimistic update)
const setScheduleDensity = useCallback((next: ScheduleDensity) => {
  setScheduleDensityState(next);                          // optimistic
  void setScheduleDensityAction({ density: next });       // fire-and-forget
}, []);

// Back-compat shim — deprecated, removed in cleanup commit
const scheduleCompactMode = scheduleDensity === "compact";
const setScheduleCompactMode = (val: boolean) =>
  setScheduleDensity(val ? "compact" : "default");
```

Callers reading `scheduleCompactMode`:
- `apps/web/src/components/dashboard/contexts/useDashboard.ts` — bag selector
- `apps/web/src/components/dashboard/DashboardShell.tsx` — passes through
- `apps/web/src/app/dashboard/schedule/page.tsx` — page-level
- `apps/web/src/app/dashboard/schedule/_components/planner-command-bar.tsx:106` — toggle button
- `apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx:254,1068` — sizing
- `apps/web/src/app/dashboard/schedule/_components/draggable-card-views.tsx:121,128` — card layout

Migration strategy: keep back-compat shim for ONE commit (T4 sandbox green) → second commit removes all 6 readers in find/replace → ScheduleCoordinationContext drops shim. Both commits must keep typecheck green per pre-push hook.

Initial value: page-level server-component fetches `getScheduleDensity(profileId, workspaceId)` and passes `initialDensity` prop into `ScheduleCoordinationProvider`. Avoids client-side flash from default → persisted.

## 7. UI component contract

**`DensitySelector`** — 4-button segmented group (NOT dropdown, NOT cycle). Cycle hides options; dropdown adds click cost; segmented matches existing `weekSpan` toggle at `planner-command-bar.tsx:120-137`.

Mount: replace the lines 104-116 compact button block in `planner-command-bar.tsx`. Same `(!scheduleLayout || scheduleLayout === "daily")` visibility gate (other layouts unaffected V1).

```
[ Cozy │ Default │ Compact │ Pulse ]
   ░       ▓         ▒          ⚡
```

Icons (Lucide only, no emojis): `Maximize2` cozy, `Rows3` default (keep existing icon), `Rows4` compact, `Activity` pulse. Active state matches existing `weekSpan` pattern (`bg-background text-foreground shadow-sm`).

**`<DensityStrip />`** — ONE component, not two. Renders the 4px left rail in all tiers + handles conflict-merge:

```tsx
function DensityStrip({ indicator, hasConflict, tier }: Props) {
  const color = hasConflict ? "bg-destructive" : SHIFT_INDICATOR_STYLES[indicator];
  const width = tier === "compact" ? "w-0.5" : "w-1";  // existing widths
  return <div className={`absolute top-2 bottom-2 left-0 ${width} rounded-r-full ${color}`} />;
}
```

Used by `ShiftCardView` (replaces lines 134 and 157 inline divs) AND by `MiniCardWithStrip` (Pulse conflict-escape). Single source of role-color + conflict-color truth.

Conflict ring (`ring-destructive/60` at `grid-cards.tsx:160`) STAYS on the card. The strip is in addition, not instead — defence in depth (C2: even if ring is hidden by overlap, strip flags conflict).

## 8. Pulse dual-render-path

Cell render decision tree (inside `daily-grid.tsx` cell renderer, replaces lines 1068 region):

```
if (density === "pulse") {
  shifts = cell.shifts
  if (shifts.length === 0) → empty heatmap cell, gray (bg-muted/20)
  if (shifts.some(s => s.hasConflict)) → MiniCardWithStrip path (40px row)
  else → heatmap cell, color = heatmapColor(shifts)
}
```

Heatmap color source V1: `SHIFT_INDICATOR_STYLES` of the cell's **majority indicator** at 60% opacity (`bg-blue-400/60` etc.). NOT D4 demand intensity, NOT booking-load — those are future iterations. Rationale: tokens we already have, no new color math, ships V1 without coupling to D4.

Multiple shifts same cell, no conflict: dominant indicator color. Mixed: blend via stripe pattern `bg-gradient-to-r from-{c1} to-{c2}` (existing Tailwind gradient utility).

Row height: 28px when ANY cell heatmap-mode, 40px when ANY cell conflict-mode in that row. `estimateRowSize` returns max() across visible cells. Re-render gating: `React.memo(PulseCell, (a, b) => a.indicatorKey === b.indicatorKey && a.hasConflict === b.hasConflict)` — heatmap cells are pure functions of indicator+conflict, cheap to memoize.

Conflict escape mini-card has the SAME `<DensityStrip hasConflict tier="compact" />` + role initials + 4-char time. Click-target is full cell; same drag handler wired (Pulse is NOT read-only, just visually compressed).

## 9. Time format helper

File: `apps/web/src/app/dashboard/schedule/_utils/format-time.ts`.

```ts
// "10:00"–"22:00" → "10–22"
// "10:30"–"22:15" → "10:30–22:15"
// "22:00"–"02:00" → "22–02" (cross-midnight; no special marker V1)
export function formatTimeShort(start: string, end: string): string {
  const fmt = (t: string) => t.endsWith(":00") ? t.slice(0, -3) : t;
  return `${fmt(start)}–${fmt(end)}`;   // EN-DASH U+2013, not hyphen
}
```

No i18n key for separator V1 (en-dash is locale-neutral in nb/en/sv). Cross-midnight: caller passes the actual times; helper doesn't know — UI tooltip shows full `HH:mm–HH:mm` for accessibility. Used by compact + Pulse mini-card tiers.

Default + cozy keep current full `HH:mm–HH:mm` rendering.

## 10. Test plan

**Unit** — `apps/web/src/__tests__/`:
- `format-time.test.ts` — 6 cases: round hours, half-hours, mixed, cross-midnight, leading-zero, identical-start-end.
- `density-context.test.tsx` — initial value precedence (server prop > default), back-compat shim, optimistic update.
- `density-selector.test.tsx` — 4-button render, active state, click invokes setter, keyboard nav.

**E2E** — `apps/e2e/schedule/density.spec.ts`:
- J1: Manager logs in → sees default → clicks Compact → reload page → still Compact (persistence).
- J2: Manager clicks Pulse → cells render heatmap height (28px) → injects conflict via fixture → that row escapes to 40px mini-card with red strip.
- J3: Manager voice command "gi meg pulsen" → Pulse renders → DB row written (`user_view_preference` assertion).
- J4: New user (no row) → defaults to `'default'` density → never crashes on missing row.

**Visual regression** — Playwright snapshot per tier at `/dashboard/schedule` with seeded fixture (10 employees, 1 conflict). 4 snapshots: `density-cozy.png`, `density-default.png`, `density-compact.png`, `density-pulse.png`. Use existing `apps/e2e/visual/` infra.

## 11. Risk + mitigation

**R1 — `scheduleCompactMode` is read in 6 files including useDashboard bag** — silent miss leaves a tier-mismatch where command-bar shows Pulse but daily-grid still renders normal. Mitigation: keep back-compat shim ONE commit, remove in dedicated find/replace commit, grep-guard in pre-push: `grep -r scheduleCompactMode apps/web/src && exit 1`.

**R2 — Pulse heatmap re-renders on every shift update** — naive implementation re-mounts 1000+ cells on a single drag. Path: `daily-grid.tsx:271 virtualRows` + heatmap cell that depends on `shifts` array. Mitigation: `React.memo(PulseCell)` with indicator-key equality (per §8), measure with React DevTools Profiler before T5 merge.

**R3 — Voice tool writes view-state but Server Action persistence fails silently** — bridge calls setter, setter fires Server Action fire-and-forget, no error surfaced. User reloads, density resets, looks like voice "lied". Mitigation: bridge handler calls `setScheduleDensity` which already wraps `void setScheduleDensityAction(...)` — but add `.catch(err => console.warn(...))` + Sentry breadcrumb. Acceptable trade-off: V1 doesn't toast voice errors, but breadcrumb means we can diagnose post-hoc.

## 12. Build sequence

Phase A — migration (BLOCKS everything):
- [x] A1. Write migration `20260515120050_user_view_preference.sql` (§2). DONE @ ea880f2ee.
- [x] A2. Apply locally: `npx supabase migration up --include-all`. DONE.
- [x] A3. Regen types: `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts` (stderr → /dev/null, no `op run`). DONE.
- [x] A4. Verify `user_view_preference` in `database.types.ts` (7 occurrences). DONE.

Phase B — telemetry registry (BLOCKS Server Action):
- [ ] B1. Add `ScheduleDensityChanged` interface in `packages/telemetry/src/registry.ts` near line 8849.
- [ ] B2. Add `"schedule.density_changed"` routing entry near line 12489.
- [ ] B3. `pnpm --filter @smartout/telemetry build` (per L-stale-telemetry-dist).
- [ ] B4. Typecheck root: `pnpm turbo typecheck`.

Phase C — parallel (Server Action || voice tool):
- [x] C1a. Server Action `set-schedule-density.ts` + reader helper `get-schedule-density.ts`. DONE @ 938c0d867. Two adaptations: (1) `gateAction` is RPC-style returning `GateResult`, not callback-wrapper — action calls gateAction then runs mutation conditionally. (2) `user_view_preference` not in EntityType enum — entity_type set to `"profile"` (the calling profile is the semantic actor/entity).
- [ ] C1b. Density utility tests. (DEFERRED to T7 batch.)
- [ ] C2a. Voice tool `set_schedule_density` in `tools-schedule.ts`. (Absorbed into T5 E5 — voice bridge requires new context setter from T5 E1.)
- [ ] C2b. Extend `ScheduleViewChangePayload` union in `BotssonOrbVoiceMount.tsx:91-97`. (Absorbed into T5 E5.)

Phase D — sandbox UI (T4):
- [x] D1. `format-time.ts` (+formatTimeFull tooltip helper). DONE @ fc1c7b6fc.
- [x] D2. `<DensityStrip />` component (SHIFT_INDICATOR_STYLES mirror, T5 must consolidate). DONE @ fc1c7b6fc.
- [x] D3. `<DensitySelector />` component (Maximize2/Rows3/Rows4/Activity, exports ScheduleDensity type). DONE @ fc1c7b6fc.
- [x] D4. Sandbox at `/dashboard/schedule/__density-sandbox` renders 4 tiers with fixture (single-shift, double-shift, conflict, night). DONE @ fc1c7b6fc.

Phase E — live integration (T5):
- [ ] E1. Migrate `ScheduleCoordinationContext` to density enum + back-compat shim.
- [ ] E2. Replace command-bar compact button with `<DensitySelector />`.
- [ ] E3. `daily-grid.tsx` cell sizing switches on density; Pulse render decision tree.
- [ ] E4. `draggable-card-views.tsx` uses `<DensityStrip />` (replace inline rails).
- [ ] E5. Bridge handler `case "set_density":` in `schedule-voice-tools-bridge.tsx`.
- [ ] E6. Page-level server fetch `getScheduleDensity` → `initialDensity` prop.

Phase F — cleanup:
- [ ] F1. Find/replace `scheduleCompactMode` → use `scheduleDensity === "compact"` directly. 6 files.
- [ ] F2. Remove back-compat shim from context.
- [ ] F3. Add pre-push grep-guard in `package.json` lint-staged.

Phase G — tests + closure:
- [ ] G1. E2E specs J1–J4.
- [ ] G2. Visual regression snapshots.
- [ ] G3. ADR draft: `0331-schedule-density-persistence.md` (records dedicated table + dual-render Pulse + view-state-on-voice-without-gateAction trio).
- [ ] G4. HANDOFF + journey doc.

---

**Files touched (final list):**

- `supabase/migrations/20260515120050_user_view_preference.sql` (new, applied ea880f2ee)
- `packages/supabase/src/types/database.types.ts` (regen)
- `packages/telemetry/src/registry.ts` (edit ~8849, ~12489)
- `apps/web/src/app/dashboard/schedule/_actions/set-schedule-density.ts` (new, shipped 938c0d867)
- `apps/web/src/app/dashboard/schedule/_actions/get-schedule-density.ts` (new, shipped 938c0d867)
- `apps/web/src/app/dashboard/schedule/_utils/format-time.ts` (new)
- `apps/web/src/app/dashboard/schedule/_components/density-selector.tsx` (new)
- `apps/web/src/app/dashboard/schedule/_components/density-strip.tsx` (new)
- `services/voice-agent/src/tools-schedule.ts` (edit, append tool)
- `apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx` (edit union L91-97)
- `apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx` (edit handler)
- `apps/web/src/components/dashboard/contexts/ScheduleCoordinationContext.tsx` (edit L85)
- `apps/web/src/app/dashboard/schedule/_components/planner-command-bar.tsx` (edit L104-116)
- `apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx` (edit L254 + L1068)
- `apps/web/src/app/dashboard/schedule/_components/draggable-card-views.tsx` (edit L121, L128, L134, L157)
