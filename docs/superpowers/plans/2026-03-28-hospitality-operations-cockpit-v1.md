# Hospitality Operations Cockpit V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an action-first, live first-screen cockpit that shows staffing + operational risk, on-duty progression, guarded quick actions, and a normalized unified activity feed.

**Architecture:** Keep cockpit as a read/orchestration layer over existing runtime data. Add a shared cockpit contract, pure normalization/prioritization utilities, and dedicated hooks/components for the five locked slices. Reuse existing mutations and APIs, but enforce explicit governance checks for quick actions and normalize multi-source activity data into one envelope with dedup.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, TanStack Query, Supabase client/server, Vitest, shadcn/ui, lucide-react

---

## Scope Check

This plan is scoped to one subsystem: **Dashboard first-screen cockpit V1**.  
No new workflow engine state, no new DB tables, no deep analytics, no phase-2 automation.

---

## File Structure (locked before implementation)

- Create: `packages/types/src/cockpit.ts`  
  Shared read/action/event contract for web + mobile parity.
- Modify: `packages/types/src/index.ts`  
  Export cockpit contract.
- Create: `apps/web/src/app/dashboard/_lib/cockpit/event-envelope.ts`  
  Normalize mixed event sources and deduplicate.
- Create: `apps/web/src/app/dashboard/_lib/cockpit/risk-priority.ts`  
  Priority scoring + ordering for risk queues.
- Create: `apps/web/src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`  
  Unit tests for normalization + dedup.
- Create: `apps/web/src/app/dashboard/_lib/cockpit/__tests__/risk-priority.test.ts`  
  Unit tests for queue priority ordering.
- Create: `apps/web/src/app/dashboard/_hooks/use-cockpit-first-screen.ts`  
  Main read hook composing operations + live shifts + feed + filter options.
- Create: `apps/web/src/app/dashboard/_hooks/use-cockpit-actions.ts`  
  Guarded quick actions (broadcast, task, note).
- Create: `apps/web/src/components/dashboard/cockpit/HospitalityOperationsCockpit.tsx`  
  Container rendering the 5 locked slices.
- Create: `apps/web/src/components/dashboard/cockpit/CockpitTopStrip.tsx`
- Create: `apps/web/src/components/dashboard/cockpit/CockpitRiskQueues.tsx`
- Create: `apps/web/src/components/dashboard/cockpit/CockpitOnDutyProgress.tsx`
- Create: `apps/web/src/components/dashboard/cockpit/CockpitActionRail.tsx`
- Create: `apps/web/src/components/dashboard/cockpit/CockpitActivityFeed.tsx`
- Modify: `apps/web/src/components/dashboard/AdminDashboard.tsx`  
  Use cockpit component for tactical admin view.
- Create: `apps/web/src/app/api/schedule/send-message/guards.ts`  
  Role-based authority guard for broadcast path.
- Create: `apps/web/src/app/api/schedule/send-message/__tests__/guards.test.ts`  
  Guard unit tests.
- Modify: `apps/web/src/app/api/schedule/send-message/route.ts`  
  Apply guard and return explicit authorization failure.

---

### Task 1: Add Shared Cockpit Contract

**Files:**

- Create: `packages/types/src/cockpit.ts`
- Modify: `packages/types/src/index.ts`
- Test: `apps/web/src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`

- [ ] **Step 1: Write the failing test (import contract-dependent type)**

```ts
import { describe, expect, it } from "vitest";
import type { CockpitEventEnvelope } from "@smartout/types";
import { dedupeCockpitEvents } from "../event-envelope";

describe("dedupeCockpitEvents", () => {
  it("keeps only one event per correlation key + type", () => {
    const input: CockpitEventEnvelope[] = [
      {
        id: "a1",
        source: "human",
        sessionMode: "none",
        severity: "warning",
        eventType: "task.overdue",
        summary: "Task overdue",
        occurredAt: "2026-03-28T10:00:00.000Z",
        correlationId: "task-1",
      },
      {
        id: "a2",
        source: "human",
        sessionMode: "none",
        severity: "warning",
        eventType: "task.overdue",
        summary: "Task overdue (duplicate)",
        occurredAt: "2026-03-28T10:00:01.000Z",
        correlationId: "task-1",
      },
    ];

    const result = dedupeCockpitEvents(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("a2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`  
Expected: FAIL with module/type import errors (`@smartout/types` cockpit exports missing).

- [ ] **Step 3: Add the shared contract**

```ts
// packages/types/src/cockpit.ts
export type CockpitEventSource = "human" | "agent" | "system";
export type CockpitSessionMode = "mission" | "agent" | "none";
export type CockpitSeverity = "critical" | "warning" | "info";

export type CockpitEventEnvelope = {
  id: string;
  source: CockpitEventSource;
  sessionMode: CockpitSessionMode;
  severity: CockpitSeverity;
  eventType: string;
  summary: string;
  occurredAt: string;
  correlationId?: string | null;
  entityRef?: { type: string; id: string } | null;
  actorLabel?: string | null;
};

export type CockpitFilterState = {
  locationIds: string[];
  teamIds: string[];
  roles: string[];
  timeWindow: "now" | "today";
};

export type CockpitQuickAction =
  | { type: "broadcast"; workspaceId: string; message: string }
  | { type: "create_task"; workspaceId: string; dateId: string; label: string }
  | { type: "log_note"; workspaceId: string; dateId: string; message: string };
```

```ts
// packages/types/src/index.ts
export * from "./cockpit.js";
```

- [ ] **Step 4: Run test to verify type import now resolves**

Run: `pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`  
Expected: FAIL now only because `event-envelope.ts` is not implemented yet (next task), not because types are missing.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/cockpit.ts packages/types/src/index.ts
git commit -m "feat(types): add shared cockpit v1 contracts"
```

---

### Task 2: Implement Event Normalization + Dedup (Feed Hygiene)

**Files:**

- Create: `apps/web/src/app/dashboard/_lib/cockpit/event-envelope.ts`
- Test: `apps/web/src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`

- [ ] **Step 1: Extend failing tests for normalization behavior**

```ts
it("maps activity_trail rows to cockpit envelope", () => {
  const result = normalizeActivityTrailEvent({
    id: 12,
    event: "day_info created",
    category: "operations",
    actionVerb: "created",
    actorName: "Anna",
    entityType: "task",
    entityLabel: "Temperaturkontroll",
    createdAt: "2026-03-28T12:00:00.000Z",
  });

  expect(result.source).toBe("human");
  expect(result.sessionMode).toBe("none");
  expect(result.summary).toContain("Temperaturkontroll");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`  
Expected: FAIL with `normalizeActivityTrailEvent is not defined`.

- [ ] **Step 3: Implement normalization + dedup utilities**

```ts
// apps/web/src/app/dashboard/_lib/cockpit/event-envelope.ts
import type { CockpitEventEnvelope } from "@smartout/types";

type ActivityTrailInput = {
  id: number;
  event: string;
  category: string;
  actionVerb: string;
  actorName: string;
  entityType: string;
  entityLabel: string | null;
  createdAt: string;
};

export function normalizeActivityTrailEvent(row: ActivityTrailInput): CockpitEventEnvelope {
  const severity =
    row.event.includes("overdue") || row.event.includes("deviation")
      ? "critical"
      : row.event.includes("late")
        ? "warning"
        : "info";

  return {
    id: `activity-${row.id}`,
    source: "human",
    sessionMode: "none",
    severity,
    eventType: row.event,
    summary: `${row.actorName} ${row.actionVerb} ${row.entityType}${row.entityLabel ? ` — ${row.entityLabel}` : ""}`,
    occurredAt: row.createdAt,
    correlationId: null,
    entityRef: row.entityLabel ? { type: row.entityType, id: row.entityLabel } : null,
    actorLabel: row.actorName,
  };
}

export function dedupeCockpitEvents(events: CockpitEventEnvelope[]): CockpitEventEnvelope[] {
  const byKey = new Map<string, CockpitEventEnvelope>();
  for (const event of events) {
    const key = `${event.eventType}::${event.correlationId ?? event.id}`;
    const current = byKey.get(key);
    if (
      !current ||
      new Date(event.occurredAt).getTime() >= new Date(current.occurredAt).getTime()
    ) {
      byKey.set(key, event);
    }
  }
  return [...byKey.values()].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/_lib/cockpit/event-envelope.ts apps/web/src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts
git commit -m "feat(web): add cockpit event normalization and dedup"
```

---

### Task 3: Implement Risk Priority Utilities (Staffing + HACCP Queues)

**Files:**

- Create: `apps/web/src/app/dashboard/_lib/cockpit/risk-priority.ts`
- Test: `apps/web/src/app/dashboard/_lib/cockpit/__tests__/risk-priority.test.ts`

- [ ] **Step 1: Write failing tests for queue ordering**

```ts
import { describe, expect, it } from "vitest";
import { prioritizeStaffingRisks, prioritizeOperationalRisks } from "../risk-priority";

describe("prioritizeStaffingRisks", () => {
  it("sorts late and unfilled shifts above waiting shifts", () => {
    const result = prioritizeStaffingRisks([
      { id: "s1", status: "waiting", minutesLate: 0 },
      { id: "s2", status: "late", minutesLate: 18 },
      { id: "s3", status: "unfilled", minutesLate: 0 },
    ]);

    expect(result.map((r) => r.id)).toEqual(["s3", "s2", "s1"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/risk-priority.test.ts`  
Expected: FAIL with missing exports.

- [ ] **Step 3: Implement deterministic prioritization**

```ts
// apps/web/src/app/dashboard/_lib/cockpit/risk-priority.ts
type StaffingRisk = { id: string; status: "late" | "unfilled" | "waiting"; minutesLate: number };
type OperationalRisk = {
  id: string;
  severity: "critical" | "warning" | "info";
  overdueMinutes: number;
};

const staffingWeight: Record<StaffingRisk["status"], number> = {
  unfilled: 300,
  late: 200,
  waiting: 100,
};

const severityWeight: Record<OperationalRisk["severity"], number> = {
  critical: 300,
  warning: 200,
  info: 100,
};

export function prioritizeStaffingRisks(risks: StaffingRisk[]): StaffingRisk[] {
  return [...risks].sort(
    (a, b) => staffingWeight[b.status] + b.minutesLate - (staffingWeight[a.status] + a.minutesLate),
  );
}

export function prioritizeOperationalRisks(risks: OperationalRisk[]): OperationalRisk[] {
  return [...risks].sort(
    (a, b) =>
      severityWeight[b.severity] +
      b.overdueMinutes -
      (severityWeight[a.severity] + a.overdueMinutes),
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/risk-priority.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/_lib/cockpit/risk-priority.ts apps/web/src/app/dashboard/_lib/cockpit/__tests__/risk-priority.test.ts
git commit -m "feat(web): add cockpit risk prioritization utilities"
```

---

### Task 4: Build Cockpit Read Hook (five-slice data contract)

**Files:**

- Create: `apps/web/src/app/dashboard/_hooks/use-cockpit-first-screen.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/use-live-shifts.ts`
- Modify: `apps/web/src/app/dashboard/_hooks/use-activity-feed.ts`
- Test: `apps/web/src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`

- [ ] **Step 1: Add failing test for filter + dedup composition**

```ts
it("applies role filter before returning on-duty entries", () => {
  const input = [
    { id: "1", role: "Kokk", status: "clocked_in" },
    { id: "2", role: "Servitor", status: "waiting" },
  ];

  const result = filterOnDutyByRole(input, ["Kokk"]);
  expect(result).toHaveLength(1);
  expect(result[0]?.role).toBe("Kokk");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`  
Expected: FAIL with missing `filterOnDutyByRole`.

- [ ] **Step 3: Implement cockpit read hook and source extensions**

```ts
// apps/web/src/app/dashboard/_hooks/use-cockpit-first-screen.ts
import { useMemo } from "react";
import { useOperationsData } from "@/app/dashboard/operations/_hooks/use-operations-data";
import { useLiveShifts } from "@/app/dashboard/_hooks/use-live-shifts";
import { useActivityFeed } from "@/app/dashboard/_hooks/use-activity-feed";
import {
  dedupeCockpitEvents,
  normalizeActivityTrailEvent,
} from "@/app/dashboard/_lib/cockpit/event-envelope";
import {
  prioritizeOperationalRisks,
  prioritizeStaffingRisks,
} from "@/app/dashboard/_lib/cockpit/risk-priority";

export function filterOnDutyByRole<T extends { role: string }>(entries: T[], roles: string[]) {
  if (roles.length === 0) return entries;
  const allowed = new Set(roles);
  return entries.filter((entry) => allowed.has(entry.role));
}

export function useCockpitFirstScreen(selectedRoles: string[]) {
  const operations = useOperationsData();
  const liveShifts = useLiveShifts();
  const feed = useActivityFeed({ limit: 50, filters: { timeRange: "today", category: "all" } });

  return useMemo(() => {
    const staffingQueue = prioritizeStaffingRisks(
      (liveShifts.data?.entries ?? []).map((entry) => ({
        id: entry.shiftId,
        status:
          entry.status === "waiting" ? "waiting" : entry.status === "late" ? "late" : "unfilled",
        minutesLate: entry.minutesLate ?? 0,
      })),
    );

    const operationalQueue = prioritizeOperationalRisks([
      {
        id: "overdue-tasks",
        severity: operations.data?.overdueTasks ? "critical" : "info",
        overdueMinutes: (operations.data?.overdueTasks ?? 0) * 10,
      },
    ]);

    const normalizedFeed = dedupeCockpitEvents(
      (feed.data ?? []).map((row) => normalizeActivityTrailEvent(row)),
    );

    return {
      staffingQueue,
      operationalQueue,
      onDuty: filterOnDutyByRole(liveShifts.data?.entries ?? [], selectedRoles),
      kpis: operations.data,
      feed: normalizedFeed,
      isLoading: operations.isLoading || liveShifts.isLoading || feed.isLoading,
    };
  }, [
    operations.data,
    operations.isLoading,
    liveShifts.data,
    liveShifts.isLoading,
    feed.data,
    feed.isLoading,
    selectedRoles,
  ]);
}
```

- [ ] **Step 4: Run focused tests**

Run:  
`pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts`  
`pnpm --filter web typecheck`  
Expected: PASS for tests and no type errors from new hook imports.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-cockpit-first-screen.ts apps/web/src/app/dashboard/_hooks/use-live-shifts.ts apps/web/src/app/dashboard/_hooks/use-activity-feed.ts apps/web/src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts
git commit -m "feat(web): compose cockpit first-screen read model hook"
```

---

### Task 5: Enforce Guarded Broadcast Authority (C4 gate)

**Files:**

- Create: `apps/web/src/app/api/schedule/send-message/guards.ts`
- Create: `apps/web/src/app/api/schedule/send-message/__tests__/guards.test.ts`
- Modify: `apps/web/src/app/api/schedule/send-message/route.ts`

- [ ] **Step 1: Write failing guard tests**

```ts
import { describe, expect, it } from "vitest";
import { canSendOperationalBroadcast } from "../guards";

describe("canSendOperationalBroadcast", () => {
  it("allows manager/admin/owner", () => {
    expect(canSendOperationalBroadcast("manager")).toBe(true);
    expect(canSendOperationalBroadcast("admin")).toBe(true);
    expect(canSendOperationalBroadcast("owner")).toBe(true);
  });

  it("blocks employee role", () => {
    expect(canSendOperationalBroadcast("employee")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `pnpm --filter web test src/app/api/schedule/send-message/__tests__/guards.test.ts`  
Expected: FAIL with missing module/export.

- [ ] **Step 3: Implement guard and apply in route**

```ts
// apps/web/src/app/api/schedule/send-message/guards.ts
export function canSendOperationalBroadcast(role: string | null | undefined): boolean {
  return role === "manager" || role === "admin" || role === "owner";
}
```

```ts
// route.ts membership select
.select("profile_id, role")
```

```ts
// route.ts authorization gate after membership fetch
if (!canSendOperationalBroadcast(membership.role)) {
  return NextResponse.json(
    { error: "Forbidden: insufficient authority for broadcast action" },
    { status: 403 },
  );
}
```

- [ ] **Step 4: Run tests**

Run:  
`pnpm --filter web test src/app/api/schedule/send-message/__tests__/guards.test.ts`  
`pnpm --filter web typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/schedule/send-message/guards.ts apps/web/src/app/api/schedule/send-message/__tests__/guards.test.ts apps/web/src/app/api/schedule/send-message/route.ts
git commit -m "fix(web): gate schedule broadcast by operational authority"
```

---

### Task 6: Build Cockpit UI and Replace Tactical First Screen

**Files:**

- Create: `apps/web/src/components/dashboard/cockpit/HospitalityOperationsCockpit.tsx`
- Create: `apps/web/src/components/dashboard/cockpit/CockpitTopStrip.tsx`
- Create: `apps/web/src/components/dashboard/cockpit/CockpitRiskQueues.tsx`
- Create: `apps/web/src/components/dashboard/cockpit/CockpitOnDutyProgress.tsx`
- Create: `apps/web/src/components/dashboard/cockpit/CockpitActionRail.tsx`
- Create: `apps/web/src/components/dashboard/cockpit/CockpitActivityFeed.tsx`
- Modify: `apps/web/src/components/dashboard/AdminDashboard.tsx`

- [ ] **Step 1: Write failing component test for locked five slices**

```ts
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HospitalityOperationsCockpit } from "../HospitalityOperationsCockpit";

describe("HospitalityOperationsCockpit", () => {
  it("renders the five locked slices", () => {
    render(<HospitalityOperationsCockpit isDark={false} />);
    expect(screen.getByText("Staffing Risk Now")).toBeTruthy();
    expect(screen.getByText("Operational/HACCP Risk")).toBeTruthy();
    expect(screen.getByText("On-Duty Progression")).toBeTruthy();
    expect(screen.getByText("Quick Actions")).toBeTruthy();
    expect(screen.getByText("Activity Feed")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/components/dashboard/cockpit/__tests__/HospitalityOperationsCockpit.test.tsx`  
Expected: FAIL with missing component file.

- [ ] **Step 3: Implement cockpit container + wire into admin tactical view**

```tsx
// apps/web/src/components/dashboard/cockpit/HospitalityOperationsCockpit.tsx
"use client";

import { useState } from "react";
import { useCockpitFirstScreen } from "@/app/dashboard/_hooks/use-cockpit-first-screen";
import { CockpitTopStrip } from "./CockpitTopStrip";
import { CockpitRiskQueues } from "./CockpitRiskQueues";
import { CockpitOnDutyProgress } from "./CockpitOnDutyProgress";
import { CockpitActionRail } from "./CockpitActionRail";
import { CockpitActivityFeed } from "./CockpitActivityFeed";

export function HospitalityOperationsCockpit({ isDark }: { isDark: boolean }) {
  const [roles, setRoles] = useState<string[]>([]);
  const data = useCockpitFirstScreen(roles);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CockpitTopStrip isDark={isDark} isLoading={data.isLoading} />
      <CockpitRiskQueues staffing={data.staffingQueue} operational={data.operationalQueue} />
      <CockpitOnDutyProgress entries={data.onDuty} kpis={data.kpis} />
      <CockpitActionRail isDark={isDark} />
      <CockpitActivityFeed events={data.feed} />
    </div>
  );
}
```

```tsx
// apps/web/src/components/dashboard/AdminDashboard.tsx
const HospitalityOperationsCockpit = dynamic(() =>
  import("./cockpit/HospitalityOperationsCockpit").then((m) => ({
    default: m.HospitalityOperationsCockpit,
  })),
);

// tactical branch
adminView === "tactical" ? (
  <HospitalityOperationsCockpit isDark={isDark} />
) : ...
```

- [ ] **Step 4: Run tests and sanity checks**

Run:  
`pnpm --filter web test src/components/dashboard/cockpit/__tests__/HospitalityOperationsCockpit.test.tsx`  
`pnpm --filter web test`  
`pnpm --filter web typecheck`  
Expected: PASS; tactical view renders new cockpit without regressing other admin tabs.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/cockpit apps/web/src/components/dashboard/AdminDashboard.tsx
git commit -m "feat(web): replace tactical first screen with hospitality cockpit v1"
```

---

### Task 7: Final Verification + Docs Consistency Check

**Files:**

- Modify: `docs/superpowers/specs/2026-03-28-hospitality-operations-cockpit-v1-design.md` (only if implementation drift exists)

- [ ] **Step 1: Run focused verification matrix**

Run:

```bash
pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/event-envelope.test.ts
pnpm --filter web test src/app/dashboard/_lib/cockpit/__tests__/risk-priority.test.ts
pnpm --filter web test src/app/api/schedule/send-message/__tests__/guards.test.ts
pnpm --filter web typecheck
pnpm --filter web lint
```

Expected: PASS.

- [ ] **Step 2: Manual acceptance smoke in dashboard**

Run: `pnpm --filter web dev`  
Verify in `/dashboard` tactical view:

- staffing risk queue visible and sorted,
- operational/HACCP risk queue visible,
- on-duty progression card visible with late/waiting statuses,
- quick action rail blocks unauthorized broadcast users,
- activity feed shows normalized + deduped rows.

- [ ] **Step 3: Confirm no scope creep**

Check that first screen does **not** include:

- custom layout builder,
- predictive recommendation engine,
- multi-location command center,
- deep historical analytics panels.

- [ ] **Step 4: Update spec only if needed**

If runtime implementation differs from accepted spec wording, patch exact acceptance criteria section in:
`docs/superpowers/specs/2026-03-28-hospitality-operations-cockpit-v1-design.md`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src docs/superpowers/specs/2026-03-28-hospitality-operations-cockpit-v1-design.md
git commit -m "test(web): verify cockpit v1 acceptance and governance gates"
```

---

## Self-Review (plan vs spec)

- **Spec coverage:**
  - 5 locked slices -> Tasks 4 + 6
  - no new workflow state -> Task 4 reuses existing hooks/tables only
  - C4 governance on quick actions -> Task 5
  - normalized event envelope + dedup -> Task 2
  - shared web/mobile contract -> Task 1
- **Placeholder scan:** No `TODO`, `TBD`, or unresolved markers in tasks.
- **Type consistency:** `CockpitEventEnvelope` and filter/action models are defined once in `@smartout/types` and reused in hook/UI utilities.
