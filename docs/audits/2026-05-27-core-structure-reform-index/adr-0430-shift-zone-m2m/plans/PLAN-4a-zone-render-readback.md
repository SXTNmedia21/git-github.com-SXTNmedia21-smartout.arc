---
title: "PLAN-4a — Zone render readback (42-site shift.zone UI blocker)"
sortie: adr-0430-shift-zone-m2m
plan: "4a"
tier: T2
phase: render-readback
created: 2026-05-29
status: pending
depends_on: [PLAN-3]
blocks: [PLAN-4b]
estimated_effort_hours: 2-3
adr_rules_covered: [Rule 3 display-propagation, Rule 5 mobile-display]
adrs_referenced: [ADR-0133, ADR-0367, ADR-0430]
council_session: COUNCIL-PLAN-4-strategy-17-site.md
---

# PLAN-4a — Zone render readback

## Purpose

After PLAN-1–3, the DB and write-paths are correct: `shift_zone` rows exist and
`schedule_shift.zone` / `schedule_shift.location_id` are gone. But the UI still
tries to render `shift.zone` (scalar TEXT) — the field no longer exists, so every
ShiftCard, voice-tool serialization, daily-grid cell, and shift-view heading shows
nothing or throws a TS error at typecheck.

This plan re-wires all **42 read / display sites** to consume `shift.zones[]` (the
array the new mapper emits). The mapper funnel in `schedule-mappers.ts` is the
single fix point; all downstream display sites get the array through props.

> **Council verdict (2026-05-29):** 5/5 APPROVE Option A — funnel-first, single
> mapper rewrite, then propagate array downstream. See
> `docs/domains/scheduling/adr-0430-shift-zone-m2m/COUNCIL-PLAN-4-strategy-17-site.md`

---

## Scope

### Scope boundary

PLAN-4a is **read / display only**. No migrations. No write-path changes. No
typegen. All write-path + migration + M4 + typegen work lives in PLAN-4b.

---

## Pre-flight gate (L-0348 — 3rd occurrence promotion)

Before any code edits, verify baseline count:

```bash
grep -rn "\.zone\b" apps/ packages/ | grep -v "zone_id\|zone_ids\|shift_zone\|\.zones" | wc -l
```

Record the number. After all edits are complete, re-run and verify the count
reaches **0**. This gate is now a required step (L-0348 3rd occurrence; promoted
from "recommended" to mandatory pre-DROP check — see council log §MF-7).

---

## Join path (confirmed — Supervisor §2)

The schedule mapper must join through two hops to reach zone name:

```
schedule_shift
  → shift_session           (FK: shift_session.shift_id)
  → shift_session_day_line  (FK: ssdl.shift_session_id)
  → shift_zone              (FK: sz.shift_session_id + sz.day_line_id)
  → zone                    (FK: sz.zone_id)
```

`schedule_shift` has **NO direct FK to shift_zone**. Every SELECT that needs zone
names must traverse this path. The mapper is the only place that does this join;
all display components receive pre-resolved `zones: Array<{ name: string; location_id: string }>`.

Embed string (PostgREST / Supabase client):
```
*, shift_session!inner(shift_session_day_line(shift_zone(zone(name,location_id))))
```

---

## Tasks

### T1 — Funnel: schedule-mappers.ts (FIRST — all downstream auto-fix)

**File:** `apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts`

Five mapper sites all read `schedule_shift.zone` (scalar). Rewrite each to:
1. Access `shift.shift_session?.shift_session_day_line` (array of junction rows).
2. Flat-map to `shift_zone` rows, then to `zone` rows.
3. Deduplicate by `zone.name` (a shift spanning multiple day-lines may resolve the
   same zone more than once).
4. Emit: `zones: Array<{ name: string; location_id: string }>` — an empty array
   (never `null`) when no zones are resolved.

Relevant line references (verify before editing — line numbers may shift after
PLAN-1–3 commits):
- Line 113 — `toScheduleShift()`
- Line 148 — `toShiftListItem()`
- Line 175 — `toCalendarEvent()`
- Line 264 — `toVoiceShiftSummary()`
- Line 300 — `toDailyBriefingShift()`

All five sites collapse to a single shared helper:

```typescript
function resolveZones(
  shift: ScheduleShiftRaw
): Array<{ name: string; location_id: string }> {
  const seen = new Set<string>();
  const zones: Array<{ name: string; location_id: string }> = [];
  for (const ssdl of shift.shift_session?.shift_session_day_line ?? []) {
    for (const sz of ssdl.shift_zone ?? []) {
      const name = sz.zone?.name;
      const location_id = sz.location_id;
      if (name && !seen.has(name)) {
        seen.add(name);
        zones.push({ name, location_id });
      }
    }
  }
  return zones;
}
```

Add `resolveZones` near the top of the mapper file. Replace each of the 5 sites
with `zones: resolveZones(shift)`.

---

### T2 — Voice-tool serialization

**File:** `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`
**Line:** ~226 (verify)

Current: `zone: s.zone`
New: `zones: s.zones`

The voice tool now passes the full `zones[]` array. Downstream voice template may
need to render `zones?.[0]?.name ?? ''` if it expects a scalar — update the
template string to use first-zone. Mark with `// V1: first-zone only — multi-zone
voice pending future ADR`.

---

### T3 — Stage-engine workforce slice enrichment

**File:** `services/stage-engine/src/core/agent-router.ts`
**Lines:** ~212–238 (`renderWorkforceSlice` or equivalent function)

The workforce slice serializes shifts for agent context. Currently uses a stale
`shift.zone` scalar. Add +3-line enrichment:

```typescript
zones: (shift.zones ?? []).map((z) => z.name),
zone_display: shift.zones?.[0]?.name ?? null,  // V1 scalar for templates
```

This closes the pre-existing slice-vs-tool asymmetry: the capability tool already
emits `zones[]` after PLAN-3; the agent-router slice was lagging.

---

### T4 — 15 inline display sites: first-zone render

Pattern: `shift.zone` → `shift.zones?.[0]?.name ?? null`

Where an i18n fallback is needed (label shown to end user): use
`shift.zones?.[0]?.name ?? t("schedule.no_zone")` and add the key to both
`nb.json` and `en.json`.

| File | Approx line(s) | Surface |
|---|---|---|
| `apps/mobile/app/(app)/(calendar)/index.tsx` | 125, 129 | Calendar day list |
| `apps/mobile/src/components/ShiftCard.tsx` | 174, 200 | Shift card body |
| `apps/mobile/src/components/views/DuringShiftView.v2.tsx` | 181 | During-shift header |
| `apps/mobile/src/components/views/BeforeShiftView.tsx` | 193 | Greeting subtitle |
| `apps/mobile/src/components/views/AfterShiftView.tsx` | 166, 219 | After-shift summary (2 sites) |
| `apps/mobile/src/hooks/use-operations-feed.ts` | 139, 140 | Hook: propagates `zones` to feed items |
| `apps/web/src/components/ShiftClockView.tsx` | 296, 365 | Clock-in header + PunchButton prop |
| `apps/web/src/app/dashboard/schedule/page.tsx` | 886 | Copy-shift: mapper must preserve `zones` |
| `apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx` | 968 | ShiftCard prop pass-through |
| `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx` | 517 | Modal read-only zone display |

**Total: 13 site rows** (some files have 2 lines each = ~15 edits).

> Before editing each file, run `grep -n "\.zone\b" <file>` to confirm line
> numbers (PLAN-1–3 may have shifted them).

---

### T5 — 2 pill-stack sites: max-2 + "+N" counter

These surfaces display the full zones array, not just the first zone.

**Site 1 — `apps/mobile/src/components/views/BeforeShiftView.tsx:269`**
deptInset card zone area — render up to 2 zone badges then "+N more":

```tsx
{(shift.zones ?? []).slice(0, 2).map((z) => (
  <ZoneBadge key={z.name} name={z.name} />
))}
{(shift.zones ?? []).length > 2 && (
  <Text style={styles.zoneOverflow}>
    +{(shift.zones ?? []).length - 2}
  </Text>
)}
```

**Site 2 — `apps/web/src/app/dashboard/oppgaver/_components/daily-briefing.tsx`**
(verify exact path — may differ from `_chart/daily-briefing.tsx`) MapPin zone
render around line 982. Same pattern: `slice(0, 2)` + `+N` badge.

> If path resolves to `_chart/daily-briefing.tsx` instead, use that path and note
> the correction in the PLAN-4b HANDOFF.

---

### T6 — Payroll routes: audit-and-prune (6 sites)

The payroll API routes may embed a zone join purely for pass-through. Audit each:

1. **Does this route actually display or return zone data to a client?**
   - Yes → keep embed, update to `zones[]` shape
   - No → remove the join entirely (reduces query complexity)

2. **Does the route use `shift.zone` (scalar) anywhere downstream?**
   - Yes → update to `shift.zones?.[0]?.name ?? null`

Run before editing:
```bash
grep -rn "\.zone\b\|location:location_id" apps/web/src/app/api/payroll/ apps/web/src/app/dashboard/payroll/ 2>/dev/null | head -30
```

If 0 hits: no payroll route changes needed; record "0 payroll sites — skip" in
PLAN-4b HANDOFF deferred-items section.

---

### T7 — Dev sandbox: delete zone refs

**File:** `apps/web/src/app/dashboard/oppgaver/_chart/__density-sandbox/_demo-cell.tsx`
(verify path exists)

This is a dev fixture. Remove all `zone` / `shift.zone` references. Replace with
`zones: []` stub or delete the zone-rendering block entirely (it's a sandbox — no
user-facing impact).

If path does not exist, skip and note in HANDOFF.

---

## Acceptance criteria

| AC | Check | Pass condition |
|----|-------|----------------|
| AC-4a.1 | schedule-mappers.ts funnel | `resolveZones()` helper introduced; all 5 mapper sites emit `zones: Array<{name,location_id}>`. No mapper site reads `.zone` (scalar). |
| AC-4a.2 | Voice-tool serialization | `use-schedule-voice-tools.ts` uses `zones: s.zones`. No `zone: s.zone`. |
| AC-4a.3 | Workforce slice | `agent-router.ts renderWorkforceSlice` includes `zones: shift.zones.map(z=>z.name)` and `zone_display`. |
| AC-4a.4 | 15 inline display sites | All sites use `shift.zones?.[0]?.name ?? null` (or i18n key). `grep -rn "\.zone\b"` across those files returns 0. |
| AC-4a.5 | 2 pill-stack sites | BeforeShiftView deptInset + daily-briefing MapPin render max-2 zone badges + "+N" counter. |
| AC-4a.6 | Payroll routes audited | Each of 6 payroll routes either updated to `zones[]` shape or zone embed removed as unused. Decision recorded in HANDOFF. |
| AC-4a.7 | Dev sandbox cleaned | `__density-sandbox/_demo-cell.tsx` has no `.zone` scalar ref (or file absent — note in HANDOFF). |
| AC-4a.8 | Pre-grep gate = 0 | `grep -rn "\.zone\b" apps/ packages/ | grep -v "zone_id\|zone_ids\|shift_zone\|\.zones" | wc -l` → **0**. |
| AC-4a.9 | Typecheck GREEN | `TURBO_CONCURRENCY=1 pnpm turbo typecheck --filter=web --filter="@smartout/ai"` — 0 errors. |
| AC-4a.10 | Live-invoke spot-check | `packages/ai/src/capabilities/schedule/__live__/invoke-read.ts` (or equivalent) invoked against local Supabase shows `zones[]` populated on at least one seeded shift. |

---

## Files to touch

| File | Op | Reason |
|---|---|---|
| `apps/web/src/app/dashboard/schedule/_hooks/schedule-mappers.ts` | Edit | Funnel: introduce `resolveZones()`, replace 5 sites |
| `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts` | Edit | `zones: s.zones` serialization |
| `services/stage-engine/src/core/agent-router.ts` | Edit | Workforce slice +3-line zones enrichment |
| `apps/mobile/app/(app)/(calendar)/index.tsx` | Edit | First-zone inline (2 sites) |
| `apps/mobile/src/components/ShiftCard.tsx` | Edit | First-zone inline (2 sites) |
| `apps/mobile/src/components/views/DuringShiftView.v2.tsx` | Edit | First-zone inline |
| `apps/mobile/src/components/views/BeforeShiftView.tsx` | Edit (2 sites) | Line 193: first-zone inline; line 269: pill-stack |
| `apps/mobile/src/components/views/AfterShiftView.tsx` | Edit | First-zone inline (2 sites) |
| `apps/mobile/src/hooks/use-operations-feed.ts` | Edit | Propagate `zones` array |
| `apps/web/src/components/ShiftClockView.tsx` | Edit | First-zone inline + PunchButton prop |
| `apps/web/src/app/dashboard/schedule/page.tsx` | Edit | Copy-shift: preserve `zones` |
| `apps/web/src/app/dashboard/schedule/_components/daily-grid.tsx` | Edit | ShiftCard prop pass-through |
| `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx` | Edit | Read-only zone display |
| `apps/web/src/app/dashboard/oppgaver/_components/daily-briefing.tsx` | Edit | MapPin pill-stack (verify path) |
| Payroll routes (6) | Audit-and-prune | Remove unused zone embed or update to `zones[]` |
| `apps/web/src/app/dashboard/oppgaver/_chart/__density-sandbox/_demo-cell.tsx` | Edit/skip | Dev fixture zone ref removal (verify existence) |

---

## Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| Mapper output shape mismatch with existing prop types | HIGH | Introduce `ShiftZone` type in `@smartout/types` first; fix TypeScript type errors before runtime testing. |
| Line numbers drifted post PLAN-1–3 | MEDIUM | Always `grep -n "\.zone\b" <file>` before editing. Never rely on line numbers in this plan literally. |
| Payroll route returns `zones[]` to a mobile client expecting scalar `zone` | MEDIUM | Check mobile BFF consumer before changing payroll route response shape. |
| dev sandbox file absent | LOW | Skip + note in HANDOFF — no user impact. |
| Pre-grep gate reaches 0 but voice template still uses scalar `zone` as string interpolation | LOW | Include voice template files in grep scope; use `grep -rn "\.zone\b" apps/ packages/ services/`. |

---

## Notes

- V1 is explicitly **single-zone-display** for most surfaces: show `zones[0].name`.
  Multi-zone pill-stack only on BeforeShiftView deptInset and daily-briefing MapPin.
  This is a product decision (single-zone V1 reality per council Option A rationale).
- Do NOT add a zone-picker or zone-assignment UI in this plan — that is PLAN-3 scope
  and is already shipped.
- The "phantom-display" class of bug (L-NEW per council §MF-8): after PLAN-4a lands,
  a shift that genuinely has no zones assigned will show an empty first-zone (`null` →
  i18n key). This is correct behavior — not a display glitch. Document in HANDOFF.
- AC-4a.10 live-invoke is the Track-F rule (L-0348 3rd occurrence; every new DB-read
  MUST end with a Node-script live invoke on seeded local DB). Do not skip.
