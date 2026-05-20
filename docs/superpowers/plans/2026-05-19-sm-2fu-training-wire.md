---
title: SM-2-followup-training — Wire Trening page to protocol_assignment + knowledge_test
status: in_progress
created: 2026-05-19
updated: 2026-05-19
module: people
tags: [people, training, protocol_assignment, knowledge_test, readiness, workforce]
---

# Plan: SM-2-followup-training

Wire `/dashboard/people/training/page.tsx` to real data.
Replaces the "Kommer snart" placeholder with a workforce readiness view —
profiles × protocols, color-coded by completion status.

**Branch:** `campaign/ui-shell`  
**Working dir:** `~/dev/smartout.ai-ui-shell`  
**Spec ref:** Canonical spec §12 — "SM-2-followup-training | Wire Trening page to protocol_assignment + knowledge_test. Workforce readiness matrix."

---

## Recon findings

### `protocol_assignment` table (`packages/supabase/src/database.types.ts:15736`)

Key columns for this sortie:

| Column | Type | Notes |
|--------|------|-------|
| `assignment_id` | uuid PK | |
| `workspace_id` | uuid | **present — workspace-scoping confirmed, no RLS workaround needed** |
| `profile_id` | uuid | FK → profile |
| `protocol_id` | uuid | FK → protocol |
| `status` | enum | `pending \| completed \| expired \| not_started \| in_progress \| waived` |
| `procedures_completed / procedures_total` | int | step counters |
| `tests_passed / tests_total` | int | |
| `confirmations_signed / confirmations_total` | int | |
| `next_review_at` | timestamptz | null = no recurrence |
| `completed_at` | timestamptz | null = not done |
| `assigned_at` | timestamptz | |
| `assigned_via` | enum (`assignment_source`) | workspace / department / team / manual … |

**workspace_id semantics: CONFIRMED CLEAR.** Direct `.eq("workspace_id", workspaceId)` on `protocol_assignment` is correct — no profile-join hack needed (contrast: `use-protocol-assignees.ts` uses `profile!inner` + `profile.workspace_id` because it was written before `workspace_id` was confirmed on the assignment table — that hook is a known legacy workaround, do NOT copy it).

### `knowledge_test` table (`packages/supabase/src/database.types.ts:11448`)

| Column | Notes |
|--------|-------|
| `knowledge_test_id` | PK |
| `protocol_id` | FK → protocol (no `workspace_id` on this table) |
| `is_active` | boolean filter |
| `pass_threshold` | number (e.g. 0.8 = 80%) |

Related: `knowledge_test_attempt` (`packages/supabase/src/database.types.ts:11501`) has `workspace_id`, `profile_id`, `knowledge_test_id`, `protocol_assignment_id`, `passed`, `score`.

**V1 scope decision:** `knowledge_test_attempt` data is NOT required for the readiness matrix — `protocol_assignment.tests_passed / tests_total` already rolls up test completion. The `knowledge_test` table is only needed if we want to show which tests are attached to a protocol (column-header decoration). Defer to post-V1.

### Existing HMS CompetenceMatrix (`apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx`)

`useCompetenceData()` (line 66) executes three parallel Supabase queries:
1. `profile` — active + trainee profiles, with department join
2. `protocol` — active workspace protocols
3. `protocol_assignment` — all assignments for workspace via `.eq("workspace_id", …)`

Returns `{ rows: MatrixRow[], columns: ProtocolColumn[] }` where each `MatrixRow` has `readinessPercent` pre-computed from step counters.

**Decision A — DRY reuse:** Extract `useCompetenceData` and its types to a shared hook under `apps/web/src/app/dashboard/_hooks/use-workforce-readiness.ts`. Both HMS training and People training import from there. Do NOT copy-paste. The HMS `CompetenceMatrix.tsx` currently collocates the hook with the component — that coupling must be broken.

### Hook `use-protocol-assignees.ts` (line 14)

Per-protocol filtered view (one protocol → list of people). Not relevant for the page-level matrix, which is per-person grouped. Do NOT reuse this for the matrix query.

### Existing i18n

- `people.tab_training` → "Training" / "Trening" — already exists in both locales.
- `hms.competence_matrix.*` — 9 keys already exist covering the matrix labels.
- New keys needed for the people-specific KPI strip and page header subtitle (see Phase D).

### Telemetry registry

- `hms.training.viewed` (line 2691) — exists, has `protocol_count` payload.
- `people.training.viewed` — **does NOT exist**. Must be registered (Phase D).

---

## Open decisions — resolved

| # | Decision | Resolution |
|---|----------|------------|
| A | DRY: shared hook or per-page copy? | **Shared hook** — extract `useCompetenceData` → `use-workforce-readiness.ts` |
| B | Matrix layout: Gantt-style grid vs list-by-profile | **List-by-profile for V1** — matrix UI is a big lift; list scales to mobile; Gantt can be Phase 2 |
| C | Show ALL protocols or assigned-only? | **Assigned-only** — unassigned protocols clutter manager view; empty state explicit |
| D | Drill-in: EntityDrawer vs dedicated detail page? | **EntityDrawer (profile tab) — defer.** V1 shows inline expanded row with protocol list. No new route. |
| E | `knowledge_test_attempt` in V1? | **No** — `tests_passed/tests_total` on `protocol_assignment` is sufficient |
| F | workspace_id on `protocol_assignment`? | **Confirmed present** — direct filter, no join hack |

---

## COUNCIL ESCALATION FLAG

**NOT required.** `protocol_assignment.workspace_id` semantics are unambiguous — confirmed via `database.types.ts` schema and cross-checked against `CompetenceMatrix.tsx` query pattern (which uses direct `.eq("workspace_id", …)` on the table). No novel RLS pattern, no cross-schema join, no new table.

---

## Architecture

```
page.tsx (Server Component — resolveDashboardContext)
  └─ <WorkforceReadinessClient workspaceId profileId />   "use client"
       └─ useWorkforceReadiness(workspaceId)   ← new shared hook
            ├─ profile (active + trainee, with department)
            ├─ protocol_assignment (workspace-scoped, direct eq)
            └─ protocol (active, name only — for label lookup)
```

**Why Server Component shell + Client body?**  
Same pattern as `hms/training/page.tsx` — page shell resolves workspace context server-side (zero client auth roundtrip), hands `workspaceId` + `profileId` as props to a client island for the interactive matrix. The HMS page uses `DashboardContext` client-side because it was written before `resolveDashboardContext` was standardized. People pages use the newer RSC pattern (`roles/page.tsx` reference).

---

## Files to create / modify

| File | Action | Notes |
|------|--------|-------|
| `apps/web/src/app/dashboard/_hooks/use-workforce-readiness.ts` | **CREATE** | Shared hook — extracted + typed from HMS CompetenceMatrix |
| `apps/web/src/app/dashboard/people/training/page.tsx` | **REPLACE** | Remove placeholder; add server shell + client import |
| `apps/web/src/app/dashboard/people/training/_components/WorkforceReadinessClient.tsx` | **CREATE** | "use client" component — KPI strip + profile list |
| `apps/web/src/app/dashboard/people/training/_components/ReadinessProfileRow.tsx` | **CREATE** | Expandable row — one profile, inline protocol list |
| `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts` | **MODIFY** | Add `workforceReadiness` key |
| `packages/i18n/locales/en/dashboard.json` | **MODIFY** | Add `people.training.*` keys |
| `packages/i18n/locales/nb/dashboard.json` | **MODIFY** | Add `people.training.*` keys |
| `packages/telemetry/src/registry.ts` | **MODIFY** | Register `people.training.viewed` event |
| `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx` | **MODIFY** | Import `useCompetenceData` from shared hook, delete local definition |

---

## Phase A — Shared hook extraction

**Goal:** Move `useCompetenceData` and its types out of `CompetenceMatrix.tsx` into a shared location so both HMS and People training pages can import it without duplication.

### A.1 — Create `use-workforce-readiness.ts`

**File:** `apps/web/src/app/dashboard/_hooks/use-workforce-readiness.ts`

Copy types and query logic from `CompetenceMatrix.tsx:24-190` verbatim, with these changes:

1. Rename exported function: `useCompetenceData` → `useWorkforceReadiness` (keep `useCompetenceData` as a re-export alias for backward compat with `OversiktDashboard.tsx`)
2. Move query key to `dashboardKeys.workforceReadiness(workspaceId)` (see A.2)
3. Export all types (`AssignmentStatus`, `CellData`, `AssignmentProgress`, `MatrixRow`, `ProtocolColumn`) so both consumer files can import from one place
4. Query unchanged — three `Promise.all` fetches, same field selection

```typescript
// apps/web/src/app/dashboard/_hooks/use-workforce-readiness.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

// ── Types (exported for consumer use) ──
export type AssignmentStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "expired"
  | "waived"
  | "pending"
  | "not_assigned";

export type AssignmentProgress = { /* ... exact copy from CompetenceMatrix.tsx:36-42 */ };
export type CellData = { /* ... exact copy from CompetenceMatrix.tsx:44-49 */ };
export type MatrixRow = { /* ... exact copy from CompetenceMatrix.tsx:51-56 */ };
export type ProtocolColumn = { /* ... exact copy from CompetenceMatrix.tsx:59-62 */ };

// ── Hook ──
export function useWorkforceReadiness() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: dashboardKeys.workforceReadiness(workspace.workspace_id),
    staleTime: 3 * 60 * 1000,
    queryFn: async (): Promise<{ rows: MatrixRow[]; columns: ProtocolColumn[] }> => {
      // ... exact query logic from CompetenceMatrix.tsx:72-189
    },
  });
}

// Backward-compat alias — HMS CompetenceMatrix imports this
export { useWorkforceReadiness as useCompetenceData };
```

### A.2 — Add `workforceReadiness` key to `dashboard-keys.ts`

**File:** `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`

Add after line 81 (after `protocolAssignees`):

```typescript
workforceReadiness: (workspaceId: string) =>
  ["dashboard", "workforce-readiness", workspaceId] as const,
```

### A.3 — Update HMS `CompetenceMatrix.tsx`

**File:** `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx`

- Delete lines 24-190 (types + `useCompetenceData` definition)
- Add import: `import { useWorkforceReadiness as useCompetenceData, type MatrixRow, type ProtocolColumn, type CellData, type AssignmentStatus, type AssignmentProgress } from "@/app/dashboard/_hooks/use-workforce-readiness";`
- All other code unchanged

**Verification after A.3:** Run `pnpm --filter @smartout/web typecheck` — must pass. HMS matrix must still render.

---

## Phase B — Server shell + data query

**Goal:** Replace placeholder `page.tsx` with a proper server component shell. The page will:
1. Resolve workspace context via `resolveDashboardContext()`
2. Render `<WorkforceReadinessClient workspaceId profileId />` — client island handles the TanStack Query fetch

### B.1 — Rewrite `people/training/page.tsx`

```typescript
// apps/web/src/app/dashboard/people/training/page.tsx
import { resolveDashboardContext } from "../../_data/resolve-page-context";
import { WorkforceReadinessClient } from "./_components/WorkforceReadinessClient";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const { workspace, profileId } = await resolveDashboardContext();

  return (
    <WorkforceReadinessClient
      workspaceId={workspace.workspace_id}
      profileId={profileId}
    />
  );
}
```

**~15 LOC.** All layout, loading, and data logic lives in the client island.

---

## Phase C — Client component + UI

**Goal:** Build the two new client components.

### C.1 — `WorkforceReadinessClient.tsx`

**File:** `apps/web/src/app/dashboard/people/training/_components/WorkforceReadinessClient.tsx`

```
"use client"

Props: { workspaceId: string; profileId: string }
```

**Structure:**

```
<div page-shell>
  <PageHeader />               ← h1 "Trening" + subtitle t("people.training.subtitle")
  <KpiStrip />                 ← 4 cards (see below)
  <DepartmentFilter />         ← pills if >1 department (same pattern as CompetenceMatrix)
  <ProfileList />              ← scrollable list of <ReadinessProfileRow />
</div>
```

**KPI strip — 4 cards:**

| Card | Value | Source |
|------|-------|--------|
| Arbeidsstyrke klar | `{readyCount}/{totalCount}` | `rows` where `readinessPercent === 100` |
| Gjennomsnitt beredskap | `{avgReadiness}%` | mean of all `row.readinessPercent` |
| Forfalt | count | assignments where `status === "expired"` (any profile) |
| Forfall < 14 dager | count | `next_review_at` within 14 days (from `protocol_assignment` — pre-computed in hook) |

The "Forfall < 14 dager" KPI requires the hook to pass through raw `next_review_at` per assignment. The existing `useWorkforceReadiness` data shape does NOT include `next_review_at` — the hook query must be extended:

**Hook extension (in A.1):** Add `next_review_at` to the `protocol_assignment` select field list and include it in `CellData`:
```
// Add to CellData type:
nextReviewAt: string | null;
// Add to assignmentsRes select:
"..., next_review_at"
// Add to assignmentMap.set:
nextReviewAt: a.next_review_at,
// Add to protocols[col.protocolId] cell:
nextReviewAt: assignment.nextReviewAt,
```

KPI computation (client-side from hook data):
```typescript
const forfaltCount = useMemo(() =>
  data?.rows.flatMap(r => Object.values(r.protocols))
    .filter(c => c.status === "expired").length ?? 0,
[data]);

const soonCount = useMemo(() => {
  const cutoff = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return data?.rows.flatMap(r => Object.values(r.protocols))
    .filter(c => c.nextReviewAt !== null && c.nextReviewAt <= cutoff).length ?? 0;
}, [data]);
```

**Loading state:** Full-page `<Loader2>` spinner (same as CompetenceMatrix).  
**Empty state:** Dashed border card — "Ingen protokoller tildelt ennå" with t key.

**Department filter pills:** Extracted from CompetenceMatrix filter logic. Same pattern — "Alle" pill + one per unique `departmentName`. Only shown if ≥2 departments.

**Profile list:**

```tsx
<ul className="space-y-3">
  {filteredRows.map(row => (
    <ReadinessProfileRow key={row.profileId} row={row} columns={data.columns} />
  ))}
</ul>
```

**~120 LOC** for this component.

### C.2 — `ReadinessProfileRow.tsx`

**File:** `apps/web/src/app/dashboard/people/training/_components/ReadinessProfileRow.tsx`

Expandable row. Collapsed = summary bar. Expanded = inline protocol list.

```
Props: { row: MatrixRow; columns: ProtocolColumn[] }
```

**Collapsed view:**

```
[Avatar] [Name]                [Dept badge]   [NN% readiness bar]   [N/N done]
```

- Avatar: initials fallback (no avatar_url in current MatrixRow — do not add network call; use `display_name[0]` as initials in a colored circle)
- Readiness bar: thin `h-1.5` progress bar, color-coded: green ≥80%, amber 40-79%, red <40%
- Click anywhere on row → toggle expanded state (`useState`)

**Expanded view (below the row, inline — not a modal):**

```
  Protocol name        Status badge       [Progress bar if in_progress]
  Protocol name        Status badge
  ...
  [No protocols assigned if row has no assigned protocols]
```

- Only show protocols where `cell.status !== "not_assigned"` — assigned-only rule
- Status badge: reuse exact same color logic as HMS `ProgressCell` (copy the badge/color mapping — do not import `ProgressCell` directly since it lives in `hms/_components/CompetenceMatrix.tsx` and would create cross-hub dependency; duplicate the 30-line color map locally or extract to a tiny `protocol-status-badge.tsx` shared util under `apps/web/src/components/`)
- Sorted: expired first, then in_progress, then pending/not_started, then completed, then waived

**Status color map:**

```typescript
const STATUS_COLORS: Record<AssignmentStatus, string> = {
  completed:   "bg-success/15 text-success",
  expired:     "bg-destructive/15 text-destructive",
  in_progress: "bg-primary/15 text-primary",
  pending:     "bg-primary/15 text-primary",
  not_started: "bg-muted text-muted-foreground",
  waived:      "bg-warning/15 text-warning",
  not_assigned: "",  // never rendered
};
```

**~90 LOC** for this component.

---

## Phase D — i18n + telemetry

### D.1 — New i18n keys

Add to **both** `packages/i18n/locales/en/dashboard.json` and `packages/i18n/locales/nb/dashboard.json` under the existing `"people"` object:

```json
"people": {
  "tab_list": "...",       // existing
  "tab_roles": "...",      // existing
  "tab_contracts": "...",  // existing
  "tab_training": "...",   // existing
  "filter_invited": "...", // existing

  // NEW — training sub-section
  "training": {
    "subtitle": "Workforce readiness per employee",        // nb: "Beredskap per ansatt"
    "kpi_ready": "Ready workforce",                        // nb: "Klar arbeidsstyrke"
    "kpi_avg": "Avg. readiness",                           // nb: "Snitt beredskap"
    "kpi_expired": "Overdue",                              // nb: "Forfalt"
    "kpi_soon": "Expiring <14d",                           // nb: "Forfall <14d"
    "no_assignments": "No protocols assigned yet.",        // nb: "Ingen protokoller tildelt ennå."
    "expand_row": "Show protocols",                        // nb: "Vis protokoller"
    "collapse_row": "Hide protocols",                      // nb: "Skjul protokoller"
    "no_assigned_protocols": "No assigned protocols.",     // nb: "Ingen tildelte protokoller."
    "status_expired": "Overdue",                           // nb: "Forfalt"
    "status_completed": "Done",                            // nb: "Fullført"
    "status_in_progress": "In progress",                   // nb: "Pågår"
    "status_not_started": "Not started",                   // nb: "Ikke startet"
    "status_waived": "Waived",                             // nb: "Frafalt"
    "status_pending": "Pending",                           // nb: "Venter"
    "filter_all": "All"                                    // nb: "Alle"
  }
}
```

**14 new keys × 2 locales = 28 entries.**

### D.2 — Telemetry event

**File:** `packages/telemetry/src/registry.ts`

Add after the `HmsTrainingViewed` interface (line ~2700):

```typescript
// people.training.viewed — emitted when /dashboard/people/training loads (manager view).
// Mirrors hms.training.viewed but scoped to the people hub surface.
// No engine_event: read-side view; no downstream workflow triggered.

export interface PeopleTrainingViewed extends BaseEvent {
  event: "people.training.viewed";
  properties: {
    entity: EntityRef;
    data: {
      // Total active+trainee profiles visible at view time.
      profile_count: number;
      // Workspace-level readiness snapshot (0-100) at view time.
      workspace_readiness_percent: number;
      // Count of expired assignments at view time.
      expired_count: number;
    };
  };
}
```

Register in the registry union type (wherever `HmsTrainingViewed` is referenced in the union — same file, search for `"hms.training.viewed"` in the routing map at line ~14347 and add parallel entry).

**emit() call-site** inside `WorkforceReadinessClient.tsx`:

```typescript
// L-0177: fail-fast if workspaceId or profileId empty
const trainingViewedRef = useRef(false);
useEffect(() => {
  if (!data || trainingViewedRef.current) return;
  trainingViewedRef.current = true;
  void emit({
    event: "people.training.viewed",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profileId, "actor_id"),
    properties: {
      entity: { entity_type: "workspace", entity_id: workspaceId, entity_label: "People Training" },
      data: {
        profile_count: data.rows.length,
        workspace_readiness_percent: avgReadiness,
        expired_count: forfaltCount,
      },
    },
  });
}, [data, workspaceId, profileId, avgReadiness, forfaltCount]);
```

---

## Phase E — Verification gate

Run all of these in order. All must pass before marking sortie done.

```bash
# 1. Typecheck (no errors tolerated)
pnpm --filter @smartout/web typecheck

# 2. HMS CompetenceMatrix still compiles after hook extraction
grep -n "useCompetenceData\|useWorkforceReadiness" apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx
# Expected: import line only, no local definition

# 3. i18n key count sanity
node -e "
const en = require('./packages/i18n/locales/en/dashboard.json');
const nb = require('./packages/i18n/locales/nb/dashboard.json');
const keys = Object.keys(en.people.training);
const nbKeys = Object.keys(nb.people.training);
console.log('en:', keys.length, 'nb:', nbKeys.length);
console.assert(keys.length === nbKeys.length, 'Key count mismatch!');
"

# 4. Telemetry event registered
grep -c '"people.training.viewed"' packages/telemetry/src/registry.ts
# Expected: 2 (interface + routing map entry)

# 5. emit() call-site wired
grep -n 'people.training.viewed' apps/web/src/app/dashboard/people/training/_components/WorkforceReadinessClient.tsx
# Expected: at least 1 match

# 6. No hardcoded Norwegian strings in new .tsx files
grep -n "['\"]Klar\|Forfalt\|Beredskap\|Fullført\|Pågår" \
  apps/web/src/app/dashboard/people/training/_components/WorkforceReadinessClient.tsx \
  apps/web/src/app/dashboard/people/training/_components/ReadinessProfileRow.tsx
# Expected: 0 matches

# 7. No OKLCH literals
grep -n "oklch(" \
  apps/web/src/app/dashboard/people/training/_components/WorkforceReadinessClient.tsx \
  apps/web/src/app/dashboard/people/training/_components/ReadinessProfileRow.tsx
# Expected: 0 matches

# 8. Placeholder gone
grep -c "Construction\|Kommer snart" apps/web/src/app/dashboard/people/training/page.tsx
# Expected: 0
```

---

## Estimated LOC

| File | Action | Est. LOC |
|------|--------|---------|
| `use-workforce-readiness.ts` | CREATE | ~120 |
| `dashboard-keys.ts` | MODIFY +1 line | ~1 |
| `people/training/page.tsx` | REPLACE | ~15 |
| `WorkforceReadinessClient.tsx` | CREATE | ~130 |
| `ReadinessProfileRow.tsx` | CREATE | ~100 |
| `CompetenceMatrix.tsx` | MODIFY (delete + add import) | net -160 |
| `en/dashboard.json` | MODIFY | ~18 |
| `nb/dashboard.json` | MODIFY | ~18 |
| `registry.ts` | MODIFY | ~25 |
| **Total net new** | | **~430** |

In-range for the ~500-700 LOC estimate.

---

## Dependency order

```
A.1 (hook) → A.2 (key) → A.3 (HMS update)   [sequential — A.3 depends on A.1]
                ↓
B.1 (page shell)                               [depends on A.1]
                ↓
C.1 (client component)  ←──── C.2 (row)       [C.1 depends on C.2 — build C.2 first]
                ↓
D.1 (i18n) + D.2 (telemetry)                  [parallel with C — independent]
                ↓
E (verification)                               [all must pass]
```

Recommended build order for a single agent: A.2 → A.1 → A.3 → C.2 → C.1 → B.1 → D.1 → D.2 → E.

---

## Traps to avoid

1. **Do NOT copy `use-protocol-assignees.ts` pattern** — it uses `profile!inner` + `profile.workspace_id` as a workaround because it predates the workspace_id confirmation. The new hook uses direct `.eq("workspace_id", …)` on `protocol_assignment`.

2. **Build-agent uncommitted-changes pattern (L-build-agent-1)** — after build agent reports "done", verify with `git log --oneline <base>..<branch>` before merge. If empty → agent wrote files but never committed.

3. **Stale telemetry dist (L-stale-telemetry-dist)** — if typecheck fails on `EntityType` or event types, run `pnpm --filter @smartout/telemetry build` first.

4. **HMS CompetenceMatrix uses query key `["hms", "competence-matrix", workspaceId]`** (hardcoded, not from `dashboardKeys`). After A.3, the hook will use `dashboardKeys.workforceReadiness`. Update `OversiktDashboard.tsx` if it passes the key manually for invalidation — check line 63 of `OversiktDashboard.tsx`.

5. **`knowledge_test` has no `workspace_id`** — any future query on that table must join through `protocol` to get workspace scoping. V1 avoids this entirely (per Decision E).

6. **`next_review_at` not in current MatrixRow** — Phase C.1 KPI computation requires hook extension in Phase A.1. Do not skip this field addition.

7. **i18n keys use dot notation in t() calls** — `t("people.training.subtitle")` requires the `"people"` object to exist in the JSON (it does). Verify nested path matches JSON structure.
