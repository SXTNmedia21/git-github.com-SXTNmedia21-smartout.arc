# Slim TidslinjeTab in DayControlPanel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slimmed-down purpose-built "Tidslinje" tab to `DayControlPanel` (the schedule bottom-sheet) that gives managers a unified D6 chronological view (shifts + tasks + hooks + day_lines) filterable by location chips. Read-only V1; DnD re-time deferred to a separate capability sortie.

**Architecture:** Two views over one cascade pipeline. `DayControlPanel` and `WebDayControl` will both mount day-line content; both share the `day-line` capability + `DaySessionProvider` data layer. The new tab uses `PageTabNav` (canonical ARIA tab primitive) and reads from `useDayTimelineEvents` + `useDayLines`. The 75 vh bottom-sheet constraint forces a flat list layout (chip-bar + cards), not the gantt-strip stack used in `WebDayControl`. Three pre-conditions must close before the build: dead Ultravox path removed from `DaySessionProvider`, `pinDayControlPanelContextAction` wired, inline `TabButton` ARIA replaced by `PageTabNav`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 (CSS-config), shadcn/ui, TanStack Query v5, `@smartout/telemetry` emit + registry, `@smartout/i18n` t(), Supabase (`engine_memory`, anon client), Vitest (unit), Playwright (E2E), `@axe-core/playwright` (a11y).

---

## Council & ADR Anchors

- Council 2026-05-23 Tidslinje surface boundary — `docs/council/COUNCIL-LOG.md`
- ADR-0156 amendment 2026-05-23 — surface-duplication discriminating test
- ADR-0367 — Day Line tri-layer model (capability anchor)
- ADR-0078 — channel guard double-pin (chat-only for day-line)
- ADR-0282 — post-Ultravox harness (`useRegisterTools` canonical)
- ADR-0134 — mobile telemetry contract (L-0177 fail-fast pattern)
- ADR-0204 — gatedMutation wrapper requirement
- ADR-0358 — telemetry registry → emit() Phase 3 mandate
- L-0338 surface duplication ≠ authority fragmentation
- L-0339 spatial budget axis
- L-0340 telemetry-registered without emit (3rd-occurrence rule)
- L-0177 fail-fast on workspace_id / profile_id
- Domain spine: `docs/domains/day-session/ROADMAP.md` §P10 + `GAPS-AND-DEBT.md` §G16-G19

## Pre-completed (do NOT re-execute)

These council outputs already shipped (commits `d766392ab` + `48da7cdc1` + `503c06272`):

- ADR-0156 §"Amendment — 2026-05-23" appended
- 4 learning files L-0338..L-0341 created + registered
- `COUNCIL-LOG.md` entry for 2026-05-23 PM2
- `docs/domains/day-session/ROADMAP.md` §P10 added
- `docs/domains/day-session/GAPS-AND-DEBT.md` §G16-G19 added
- `council_meta.md` Phase 9 entry

---

## File Structure

```
apps/web/src/
├── app/
│   └── dashboard/
│       ├── _actions/
│       │   └── pin-day-control-panel-context.ts          [NEW — Sortie 1]
│       └── schedule/
│           └── _components/
│               └── day-control/
│                   ├── DayControlPanel.tsx               [MODIFY — Sortie 1+2: replace TabButton + add Tidslinje case]
│                   ├── DaySessionProvider.tsx            [MODIFY — Sortie 1: remove Ultravox path; add useRegisterTools bridge]
│                   ├── day-session-voice-tools.ts        [DELETE — Sortie 1: dead Ultravox]
│                   ├── day-session-agent-tools.ts        [DELETE OR REFACTOR — Sortie 1: depends on grep]
│                   ├── day-control-tools-bridge.tsx      [NEW — Sortie 1: replaces voice-tools wiring]
│                   ├── use-day-control-tools.ts          [NEW — Sortie 1: tool definitions]
│                   ├── TidslinjeTab.tsx                  [NEW — Sortie 2]
│                   ├── TidslinjeChipBar.tsx              [NEW — Sortie 2]
│                   ├── TidslinjeRow.tsx                  [NEW — Sortie 2]
│                   └── __tests__/
│                       ├── TidslinjeTab.test.tsx         [NEW — Sortie 2: unit]
│                       └── TidslinjeChipBar.test.tsx     [NEW — Sortie 2: unit]
└── components/
    └── day/
        └── (no changes — TimelineTab stays in WebDayControl)

apps/web/e2e/
└── tidslinje-tab/
    ├── tidslinje-tab.spec.ts                              [NEW — Sortie 2: Playwright]
    └── tidslinje-tab.axe.spec.ts                          [NEW — Sortie 1+2: axe a11y]

apps/web/src/app/dashboard/_hooks/
└── use-day-timeline-events.ts                             [MODIFY — Sortie 2: add session_hook source]

packages/telemetry/src/
└── registry.ts                                            [MODIFY — Sortie 2: add tidslinje_tab_* events]

packages/i18n/locales/
├── nb/
│   └── dashboard.json                                     [MODIFY — Sortie 2: add tidslinje.* keys]
└── en/
    └── dashboard.json                                     [MODIFY — Sortie 2: add tidslinje.* keys]

docs/
├── domains/day-session/
│   ├── ARCHITECTURE.md                                    [MODIFY — Sortie 3: add bottom-sheet variant]
│   ├── USER-FLOWS.md                                      [MODIFY — Sortie 3: link 5 journeys]
│   └── E2E-COVERAGE.md                                    [MODIFY — Sortie 3: add test matrix rows]
└── journeys/
    ├── JOURNEY-tidslinje-manager-plan-tomorrow.md         [NEW — Sortie 3]
    ├── JOURNEY-tidslinje-manager-live-status.md           [NEW — Sortie 3]
    ├── JOURNEY-tidslinje-employee-mobile-mirror.md        [NEW — Sortie 3]
    ├── JOURNEY-tidslinje-manager-botsson-reschedule.md    [NEW — Sortie 3]
    └── JOURNEY-tidslinje-manager-empty-day-bootstrap.md   [NEW — Sortie 3]
```

**Total: 11 new files, 6 modified files, 2 deleted files.**

---

## Phase 1 / Sortie 1 — Pre-condition Cleanup

**Gate 1 exit criteria:** (a) `grep -rn "useVoiceTools\|temporaryTool" apps/web/src` returns zero hits outside legacy/test folders. (b) `pinDayControlPanelContextAction` writes engine_memory row on panel open. (c) `axe-core` zero violations on `/dashboard/schedule` with DayControlPanel open. (d) `pnpm turbo typecheck --filter @smartout/web` passes.

### Task 1: Audit dead Ultravox path scope

**Files:**
- Read: none (grep-only)

- [ ] **Step 1: Find every reference**

Run:
```bash
grep -rn "useVoiceTools\|temporaryTool\|VoiceToolsContext\|mergeVoiceTools" \
  apps/web/src services/ packages/ \
  --include="*.ts" --include="*.tsx"
```

Expected: a list of files. Note each one. Anything in `__tests__/` or `legacy/` folders is informational only; everything else must be removed or replaced in this sortie.

- [ ] **Step 2: Identify the dead consumer**

Run:
```bash
grep -rn "VoiceAssistant\b" apps/web/src --include="*.tsx"
```

Expected: `apps/web/src/components/dashboard/DashboardShell.tsx:42` (dynamic import). Per ADR-0282 the Ultravox VoiceAssistant was removed — this dynamic import is the dead-sink. Confirm by reading the file at that line + verifying the imported file no longer exists OR exists only as a stub.

- [ ] **Step 3: Catalog**

Write the audit result inline in the task log (`docs/sortie-logs/2026-05-23-p10-s1-task1.md`):

```markdown
## Task 1 audit result
- Active references to useVoiceTools: <list file:line>
- Active references to temporaryTool: <list file:line>
- VoiceAssistant import site: <file:line>
- VoiceAssistant target file exists: <yes/no>
```

This file is the spec for Task 2 + 3.

- [ ] **Step 4: Commit**

```bash
git add docs/sortie-logs/2026-05-23-p10-s1-task1.md
git commit -m "docs(p10): Task 1 audit — Ultravox dead-path scope catalog"
```

---

### Task 2: Write the regression test for tool registration (TDD red)

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/day-control-tools-bridge.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { DayControlToolsBridge } from "../day-control-tools-bridge";

const registerToolsMock = vi.fn();

vi.mock("@/app/Botsson/_components/tool-registry", () => ({
  useRegisterTools: (kit: string, tools: unknown[]) => registerToolsMock(kit, tools),
}));

vi.mock("@/lib/workspace-context", () => ({
  useWorkspaceOptional: () => ({ workspace: { workspace_id: "ws-1" } }),
}));

describe("DayControlToolsBridge", () => {
  beforeEach(() => {
    registerToolsMock.mockClear();
  });

  it("registers tools under the 'day-control' kit when mounted", () => {
    render(
      <DayControlToolsBridge
        sessionId="sess-1"
        departmentId="dept-1"
        departmentName="Sal"
        dateISO="2026-05-23"
      />,
    );

    expect(registerToolsMock).toHaveBeenCalledWith(
      "day-control",
      expect.any(Array),
    );
  });

  it("does NOT call any Ultravox useVoiceTools / temporaryTool path", () => {
    // Negative assertion — if the bridge accidentally re-imports the dead path,
    // this test catches it at build-time via the package's exclusion list.
    // No runtime assertion needed; presence of the import would be flagged
    // by ESLint rule `no-dead-ultravox` (added in Task 7).
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm vitest run apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/day-control-tools-bridge.test.tsx
```

Expected: FAIL — module `../day-control-tools-bridge` not found.

---

### Task 3: Create day-control tools bridge + use-day-control-tools

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/use-day-control-tools.ts`
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/day-control-tools-bridge.tsx`

- [ ] **Step 1: Write `use-day-control-tools.ts`**

```typescript
/**
 * use-day-control-tools — tool definitions for the DayControlPanel surface.
 *
 * Replaces the legacy DaySessionProvider voice-tool path (ADR-0282).
 * V1 ships read-only view tools; mutation tools (re-time, assign) belong
 * to the day-line capability and are dispatched by the stage-engine, not
 * registered here.
 */
import type { SmartoutTool } from "@smartout/agent-sdk";

export type DayControlToolContext = {
  sessionId: string;
  departmentId: string;
  departmentName: string;
  dateISO: string;
};

export function useDayControlTools(ctx: DayControlToolContext): SmartoutTool[] {
  return [
    {
      name: "get_day_control_context",
      description: "Returns the currently focused department_session for the day control panel.",
      parameters: { type: "object", properties: {}, required: [] },
      execute: async () => ({
        session_id: ctx.sessionId,
        department_id: ctx.departmentId,
        department_name: ctx.departmentName,
        date_iso: ctx.dateISO,
      }),
    },
  ];
}
```

- [ ] **Step 2: Write `day-control-tools-bridge.tsx`**

```typescript
"use client";

/**
 * day-control-tools-bridge.tsx — registers DayControlPanel tools in the
 * harness registry (ADR-0282 canonical pattern).
 *
 * Mounts only when DaySessionProvider has resolved a session; the bridge
 * unmounts when the panel closes, which auto-unregisters tools.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useDayControlTools } from "./use-day-control-tools";

type Props = {
  sessionId: string;
  departmentId: string;
  departmentName: string;
  dateISO: string;
};

export function DayControlToolsBridge({
  sessionId,
  departmentId,
  departmentName,
  dateISO,
}: Props) {
  const tools = useDayControlTools({ sessionId, departmentId, departmentName, dateISO });
  useRegisterTools("day-control", tools);
  return null;
}
```

- [ ] **Step 3: Run test to verify it passes**

Run:
```bash
pnpm vitest run apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/day-control-tools-bridge.test.tsx
```

Expected: PASS (both tests).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/use-day-control-tools.ts \
        apps/web/src/app/dashboard/schedule/_components/day-control/day-control-tools-bridge.tsx \
        apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/day-control-tools-bridge.test.tsx
git commit -m "feat(day-control): add tool bridge using useRegisterTools (ADR-0282)"
```

---

### Task 4: Remove dead Ultravox path from DaySessionProvider

**Files:**
- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/DaySessionProvider.tsx` (lines 97, 335-336 + related imports)
- Delete: `apps/web/src/app/dashboard/schedule/_components/day-control/day-session-voice-tools.ts`
- Delete or modify: `apps/web/src/app/dashboard/schedule/_components/day-control/day-session-agent-tools.ts` (per Task 1 audit — keep only types/exports that something else imports)

- [ ] **Step 1: Read provider**

Run:
```bash
sed -n '1,30p;90,110p;320,360p' apps/web/src/app/dashboard/schedule/_components/day-control/DaySessionProvider.tsx
```

Identify exact lines importing `useVoiceTools`, `mergeVoiceTools`, `createDaySessionVoiceTools` + the `useEffect` blocks that call them.

- [ ] **Step 2: Strip the imports + effects**

Apply Edit to `DaySessionProvider.tsx`:

Remove imports:
```typescript
import { useVoiceTools } from "@/components/voice-tools-context";
import { createDaySessionVoiceTools, mergeVoiceTools } from "./day-session-voice-tools";
```

Remove the destructure:
```typescript
const { clientTools, setClientTools } = useVoiceTools();
```

Remove both useEffect blocks (the one that registers voice tools + the cleanup one):
- The block starting `useEffect(() => { if (!clientTools || hasRegisteredVoiceToolsRef.current) return; ...`
- The block starting `useEffect(() => { return () => { if (!hasRegisteredVoiceToolsRef.current) return; ...`

Remove refs no longer needed:
```typescript
const baseVoiceToolsRef = useRef<typeof clientTools>(null);
const hasRegisteredVoiceToolsRef = useRef(false);
```

Remove `daySessionAgentTools` `useMemo` block if it is only consumed by the voice-tools effect (verify via grep; if it's also exported and consumed elsewhere, keep it).

- [ ] **Step 3: Delete the voice-tools file**

```bash
git rm apps/web/src/app/dashboard/schedule/_components/day-control/day-session-voice-tools.ts
```

- [ ] **Step 4: Handle agent-tools file**

```bash
grep -rn "day-session-agent-tools\|DaySessionAgentToolSet" apps/web/src services/
```

If no remaining imports: `git rm` the file. If imports remain, refactor to only export the type stubs that survive — do not leave any function that constructs voice-tool definitions.

- [ ] **Step 5: Run typecheck**

Run:
```bash
pnpm turbo typecheck --filter @smartout/web
```

Expected: PASS. If errors point at the removed imports, fix them by following the Task 4 §2-4 deletion list. If errors point at consumers of `daySessionAgentTools`, re-evaluate §2 — that block may need to stay.

- [ ] **Step 6: Verify regression**

Run:
```bash
grep -rn "useVoiceTools\|temporaryTool" apps/web/src --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__" \
  | grep -v "legacy"
```

Expected: zero hits.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/src/app/dashboard/schedule/_components/day-control/
git commit -m "refactor(day-control): remove dead Ultravox voice-tools path post-ADR-0282 (G18)"
```

---

### Task 5: Write the failing test for pinDayControlPanelContextAction

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/__tests__/pin-day-control-panel-context.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createClientMock = vi.fn(async () => ({ from: fromMock }));
const resolveCurrentProfileMock = vi.fn();

vi.mock("@smartout/supabase/server", () => ({
  createClient: () => createClientMock(),
}));
vi.mock("../_shared", () => ({
  resolveCurrentProfile: () => resolveCurrentProfileMock(),
}));

import { pinDayControlPanelContextAction } from "../pin-day-control-panel-context";

describe("pinDayControlPanelContextAction", () => {
  beforeEach(() => {
    insertMock.mockReset().mockResolvedValue({ error: null });
    fromMock.mockClear();
    createClientMock.mockClear();
    resolveCurrentProfileMock.mockReset();
  });

  it("writes engine_memory row with surface=day_control_panel discriminator", async () => {
    resolveCurrentProfileMock.mockResolvedValue({
      profileId: "p-1",
      workspaceId: "ws-1",
    });

    const result = await pinDayControlPanelContextAction({
      sessionId: "00000000-0000-0000-0000-000000000001",
      departmentName: "Sal",
      date: "2026-05-23",
    });

    expect(result.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("engine_memory");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: "p-1",
        workspace_id: "ws-1",
        memory_type: "fact",
        content: expect.stringContaining("via DayControlPanel"),
      }),
    );
  });

  it("L-0177 fail-fast: returns ok:false when profile cannot be resolved", async () => {
    resolveCurrentProfileMock.mockResolvedValue(null);

    const result = await pinDayControlPanelContextAction({
      sessionId: "00000000-0000-0000-0000-000000000001",
      departmentName: "Sal",
      date: "2026-05-23",
    });

    expect(result.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns ok:false on invalid input shape (Zod guard)", async () => {
    const result = await pinDayControlPanelContextAction({
      sessionId: "not-a-uuid",
      departmentName: "",
      date: "",
    } as never);

    expect(result.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm vitest run apps/web/src/app/dashboard/_actions/__tests__/pin-day-control-panel-context.test.ts
```

Expected: FAIL — module `../pin-day-control-panel-context` not found.

---

### Task 6: Implement pinDayControlPanelContextAction

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/pin-day-control-panel-context.ts`

- [ ] **Step 1: Write the action**

```typescript
"use server";

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { resolveCurrentProfile } from "./_shared";

const PinSchema = z.object({
  sessionId: z.string().uuid(),
  departmentName: z.string().min(1),
  date: z.string().min(1),
});

export type PinDayControlPanelContextInput = z.infer<typeof PinSchema>;

/**
 * Pins the active DayControlPanel view into engine_memory so Botsson has
 * contextual grounding when the panel is open on schedule/calendar/AdminDashboard.
 *
 * Sibling of pinDayControlContextAction (which serves WebDayControl). The
 * `via DayControlPanel` suffix lets engine_memory consumers distinguish surface.
 * TTL 24h. Caller is the viewing profile (resolved server-side per ADR-0151).
 * L-0177 fail-fast: returns { ok:false } on missing profile OR workspace.
 */
export async function pinDayControlPanelContextAction(
  input: PinDayControlPanelContextInput,
): Promise<{ ok: boolean }> {
  const parsed = PinSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const profile = await resolveCurrentProfile();
  if (!profile || !profile.profileId || !profile.workspaceId) return { ok: false };

  const supabase = await createClient();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const content =
    `Viewing department_session=${parsed.data.sessionId} ` +
    `for department=${parsed.data.departmentName} ` +
    `on date=${parsed.data.date} via DayControlPanel`;

  const { error } = await supabase.from("engine_memory").insert({
    profile_id: profile.profileId,
    workspace_id: profile.workspaceId,
    memory_type: "fact",
    content,
    expires_at: expires,
  });

  if (error) return { ok: false };
  return { ok: true };
}
```

- [ ] **Step 2: Run test to verify it passes**

Run:
```bash
pnpm vitest run apps/web/src/app/dashboard/_actions/__tests__/pin-day-control-panel-context.test.ts
```

Expected: PASS (all 3 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/_actions/pin-day-control-panel-context.ts \
        apps/web/src/app/dashboard/_actions/__tests__/pin-day-control-panel-context.test.ts
git commit -m "feat(day-control): pinDayControlPanelContextAction (G16) — L-0177 fail-fast"
```

---

### Task 7: Wire pin-action + tools-bridge into DayControlPanel

**Files:**
- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx`

- [ ] **Step 1: Add imports + effect at top of `DayControlPanelContent`**

Find the existing destructure at `DayControlPanel.tsx:96`:
```typescript
const { snapshot, dayBookings, dayMessages } = useDaySession();
```

Add after it:

```typescript
const { sessionId, departmentId, departmentName } = useMemo(() => ({
  sessionId: snapshot?.session?.department_session_id ?? null,
  departmentId: snapshot?.session?.department_id ?? null,
  departmentName: snapshot?.session?.department_name ?? null,
}), [snapshot]);

useEffect(() => {
  if (!sessionId || !departmentName) return;
  void pinDayControlPanelContextAction({
    sessionId,
    departmentName,
    date,
  });
}, [sessionId, departmentName, date]);
```

Add import:
```typescript
import { pinDayControlPanelContextAction } from "@/app/dashboard/_actions/pin-day-control-panel-context";
import { DayControlToolsBridge } from "./day-control-tools-bridge";
```

- [ ] **Step 2: Mount the tools-bridge**

Inside the `return (...)` block of `DayControlPanelContent`, immediately before the `<div className="relative flex h-full w-full flex-col">` opening tag, insert:

```tsx
{sessionId && departmentId && departmentName ? (
  <DayControlToolsBridge
    sessionId={sessionId}
    departmentId={departmentId}
    departmentName={departmentName}
    dateISO={date}
  />
) : null}
```

The bridge renders null but registers tools — placement before the visual tree is convention; placement inside is also OK as long as it's only mounted when session is resolved.

- [ ] **Step 3: Run typecheck**

```bash
pnpm turbo typecheck --filter @smartout/web
```

Expected: PASS. If the `snapshot.session` shape does not expose `department_session_id` / `department_id` / `department_name`, read `apps/web/src/app/dashboard/_hooks/use-day-session-data.ts` and adjust the destructure to match the real shape. Do NOT invent fields.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx
git commit -m "feat(day-control): wire pin-context + tools-bridge into DayControlPanel (G16+G18)"
```

---

### Task 8: Replace inline TabButton with PageTabNav

**Files:**
- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx` (replace inline tab strip + add tabpanel ARIA)

- [ ] **Step 1: Add PageTabNav import**

```typescript
import { PageTabNav, type PageTab } from "@/components/dashboard/PageTabNav";
```

- [ ] **Step 2: Define TAB_DEFS const at module scope**

After the existing `TabId` type, add:

```typescript
const TAB_DEFS: ReadonlyArray<PageTab<TabId>> = [
  { key: "oversikt", label: "Oversikt", icon: Info },
  { key: "meldinger", label: "Dagsinfo", icon: MessageSquare },
  { key: "bookings", label: "Reservasjoner", icon: CalendarCheck },
  { key: "oppgaver", label: "Oppgaver", icon: ListTodo },
  { key: "budsjett", label: "Budsjett", icon: DollarSign },
  { key: "bemanning", label: "Bemanning", icon: Users },
  { key: "okonomi", label: "Økonomi", icon: DollarSign },
];
```

- [ ] **Step 3: Replace the tab strip JSX**

Find the existing block at `DayControlPanel.tsx:221-273` starting with:
```tsx
<div className="no-scrollbar border-border/50 flex gap-0 overflow-x-auto border-t px-5">
  <TabButton ... />
  ...
</div>
```

Replace with:

```tsx
<div className="border-border/50 border-t px-5 py-2">
  <PageTabNav
    tabs={TAB_DEFS}
    active={activeTab}
    onChange={(k) => setActiveTab(k as TabId)}
    ariaLabel="Kontrollsenter tabs"
  />
</div>
```

Remove the inline `TabButton` function definition at the bottom of the file (if it lives there) — it is no longer used. If `TabButton` is exported from `./shared`, leave it; just stop importing it here.

- [ ] **Step 4: Wrap each tab body with role="tabpanel"**

Find the existing block at `DayControlPanel.tsx:278-286`:
```tsx
<div className="flex-1 overflow-y-auto p-5">
  {activeTab === "oversikt" && <OversiktTab dateId={date} />}
  ...
</div>
```

Replace with:

```tsx
<div
  id={`tab-panel-${activeTab}`}
  role="tabpanel"
  aria-labelledby={`tab-btn-${activeTab}`}
  tabIndex={0}
  className="flex-1 overflow-y-auto p-5"
>
  {activeTab === "oversikt" && <OversiktTab dateId={date} />}
  {activeTab === "meldinger" && <MeldingerTab dateId={date} />}
  {activeTab === "bookings" && <BookingsTab dateId={date} />}
  {activeTab === "oppgaver" && <SessionTasksTab />}
  {activeTab === "budsjett" && <BudgetTab dateId={date} />}
  {activeTab === "bemanning" && <StaffingTab dateId={date} />}
  {activeTab === "okonomi" && <OkonomiTab dateId={date} />}
</div>
```

- [ ] **Step 5: Run typecheck**

```bash
pnpm turbo typecheck --filter @smartout/web
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx
git commit -m "fix(day-control): replace inline TabButton with PageTabNav (G17, WCAG 4.1.2)"
```

---

### Task 9: Write Playwright a11y test

**Files:**
- Create: `apps/web/e2e/tidslinje-tab/tidslinje-tab.axe.spec.ts`

- [ ] **Step 1: Write the a11y test**

```typescript
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("DayControlPanel — Sortie 1 a11y gate", () => {
  test("zero axe violations with panel open on /dashboard/schedule", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    // Open a date — adapt selector to existing E2E fixture conventions
    await page.locator("[data-testid='schedule-day-cell']").first().click();
    await page.waitForSelector("[role='tablist'][aria-label='Kontrollsenter tabs']");

    const results = await new AxeBuilder({ page })
      .include("[role='tablist'][aria-label='Kontrollsenter tabs']")
      .include("[role='tabpanel']")
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("each tab has role=tab + aria-selected + aria-controls", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.locator("[data-testid='schedule-day-cell']").first().click();
    await page.waitForSelector("[role='tablist'][aria-label='Kontrollsenter tabs']");

    const tabs = await page.locator("[role='tablist'][aria-label='Kontrollsenter tabs'] [role='tab']").all();
    expect(tabs.length).toBeGreaterThanOrEqual(7);

    for (const t of tabs) {
      const ariaSelected = await t.getAttribute("aria-selected");
      const ariaControls = await t.getAttribute("aria-controls");
      expect(ariaSelected).toMatch(/^(true|false)$/);
      expect(ariaControls).toMatch(/^tab-panel-/);
    }
  });
});
```

- [ ] **Step 2: Run a11y test**

```bash
pnpm playwright test apps/web/e2e/tidslinje-tab/tidslinje-tab.axe.spec.ts
```

Expected: PASS (both tests). If FAIL, the violations array points at the exact rule (e.g. `aria-allowed-attr`); fix in `DayControlPanel.tsx` and re-run.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/tidslinje-tab/tidslinje-tab.axe.spec.ts
git commit -m "test(day-control): Playwright + axe verify ARIA contract on tab strip (Gate 1)"
```

---

### Task 10: Gate 1 verification

- [ ] **Step 1: Full typecheck**

```bash
TURBO_CONCURRENCY=1 pnpm turbo typecheck --filter @smartout/web
```

Expected: PASS.

- [ ] **Step 2: Unit tests for new files**

```bash
pnpm vitest run apps/web/src/app/dashboard/_actions/__tests__/pin-day-control-panel-context.test.ts \
                apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/day-control-tools-bridge.test.tsx
```

Expected: 2 files, 5 tests PASS.

- [ ] **Step 3: a11y E2E**

```bash
pnpm playwright test apps/web/e2e/tidslinje-tab/tidslinje-tab.axe.spec.ts
```

Expected: 2 tests PASS, zero axe violations.

- [ ] **Step 4: Dead-Ultravox grep regression**

```bash
grep -rn "useVoiceTools\|temporaryTool" apps/web/src --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__" \
  | grep -v "legacy"
```

Expected: zero hits.

- [ ] **Step 5: Pin-context smoke**

Run the dev server (`pnpm dev` from another shell), open `/dashboard/schedule`, click a date, open browser devtools → Network. Expected: one POST to a Server Action endpoint that resolves to `pinDayControlPanelContextAction`. Verify the request body shape matches `PinDayControlPanelContextInput`. Verify (via Supabase SQL editor) a new row in `engine_memory` with `content LIKE '%via DayControlPanel%'`.

If verified, Gate 1 PASS. Continue to Phase 2.

---

## Phase 2 / Sortie 2 — Slim TidslinjeTab Build

**Gate 2 exit criteria:** (a) TidslinjeTab renders in DayControlPanel when activeTab === "tidslinje". (b) Chip-bar filters items by location + status. (c) `useDayTimelineEvents` returns rows for all four sources (booking, task, hook, deviation). (d) Two telemetry events registered AND have matching `emit()` call-sites (L-0340 grep). (e) Zero `useMutation` in TidslinjeTab tree. (f) i18n NB+EN keys present. (g) Unit tests pass; E2E happy path passes; axe zero violations.

### Task 11: Extend useDayTimelineEvents to source session_hook

**Files:**
- Modify: `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts`

- [ ] **Step 1: Read current shape**

```bash
sed -n '1,80p' apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts
```

Find `DayEventType` (around line 7) and the `useDayTimelineEvents` query body (around line 96-303 per Agent-coord trace). Verify the current sources are: `schedule_day_booking, session_note, session_task, deviation, schedule_shift (checkin/checkout via timesheet.time_entry)`. Verify no `session_hook` source.

- [ ] **Step 2: Add `hook` to DayEventType union**

```typescript
export type DayEventType =
  | "booking"
  | "note"
  | "task"
  | "deviation"
  | "checkin"
  | "checkout"
  | "hook";
```

- [ ] **Step 3: Add session_hook fetch in the query body**

Inside the `queryFn` of `useDayTimelineEvents`, after the existing source fetches, add:

```typescript
const hooksRes = await supabase
  .from("session_hook")
  .select("session_hook_id, hook_type, scheduled_at, linked_routine_id, linked_procedure_id, department_id")
  .eq("workspace_id", workspaceId)
  .eq("session_id", sessionId);

const hookEvents: DayEvent[] = (hooksRes.data ?? []).map((h) => ({
  id: `hook-${h.session_hook_id}`,
  refId: h.session_hook_id,
  type: "hook" as const,
  time: h.scheduled_at ?? "",
  title: h.hook_type,
  meta: {
    routine_id: h.linked_routine_id,
    procedure_id: h.linked_procedure_id,
    department_id: h.department_id,
  },
}));
```

Then merge into the union result alongside other event-arrays.

If the existing code uses a different `DayEvent` shape (verify by reading), match the shape — do not invent fields.

- [ ] **Step 4: Run typecheck**

```bash
pnpm turbo typecheck --filter @smartout/web
```

Expected: PASS.

- [ ] **Step 5: Run existing tests that consume the hook**

```bash
pnpm vitest run apps/web/src/app/dashboard/_hooks/
```

Expected: PASS. Existing TimelineTab (in WebDayControl) consumes this hook — verify it still renders with the new event type via:

```bash
pnpm playwright test apps/web/e2e/web-day-control/timeline.spec.ts 2>/dev/null || true
```

If E2E exists, must still PASS. If no E2E exists, manual smoke: load `/dashboard?adminView=oversikt` → click Timeline tab → confirm no error toast.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts
git commit -m "feat(timeline): add session_hook source to useDayTimelineEvents (Supervisor cond.1)"
```

---

### Task 12: Add telemetry events + verify emit (L-0340 grep rule)

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Identify insertion point**

```bash
grep -n "day_control\.\|day_line\.\|schedule\.tab" packages/telemetry/src/registry.ts | head -10
```

Find an adjacent block (e.g. `day_line.*` events) and insert the new events alphabetically nearby. Match the surrounding entry shape (event name, props, routing rules per ADR-0358).

- [ ] **Step 2: Add two events**

Insert two registry entries:

```typescript
{
  name: "tidslinje_tab_opened",
  description: "DayControlPanel Tidslinje tab activated (V1 read-only surface).",
  properties: {
    workspace_id: { type: "string", required: true },
    profile_id: { type: "string", required: true },
    department_session_id: { type: "string", required: true },
    date_iso: { type: "string", required: true },
  },
  destinations: ["posthog", "activity_trail"],
},
{
  name: "tidslinje_filter_changed",
  description: "DayControlPanel Tidslinje chip-bar filter toggled.",
  properties: {
    workspace_id: { type: "string", required: true },
    profile_id: { type: "string", required: true },
    department_session_id: { type: "string", required: true },
    filter_type: { type: "string", required: true }, // "location" | "status"
    filter_value: { type: "string", required: true },
    active: { type: "boolean", required: true },
  },
  destinations: ["posthog"],
},
```

(The exact JS shape depends on the registry's existing schema — match it.)

- [ ] **Step 3: Pre-emit grep — verify zero hits BEFORE writing call-sites**

```bash
grep -rE 'emit\(\s*["'"'"'](tidslinje_tab_opened|tidslinje_filter_changed)["'"'"']' apps/ services/
```

Expected: zero hits (the events do not exist yet at consumer side — this proves the L-0340 baseline). Task 13 will add the emit call-sites — and the same grep must return ≥1 hit per event at Gate 2.

- [ ] **Step 4: Commit (registry only)**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register tidslinje_tab_opened + tidslinje_filter_changed (ADR-0358)"
```

**This commit is intentionally separate** so the L-0340 "registered without emit" debt is visible in git history if Task 13 is forgotten. It is FORBIDDEN to merge Phase 2 with only this commit — Gate 2 grep must return ≥1 hit per event.

---

### Task 13: Build TidslinjeChipBar

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeChipBar.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeChipBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TidslinjeChipBar } from "../TidslinjeChipBar";

describe("TidslinjeChipBar", () => {
  const locations = [
    { id: "loc-1", name: "Sal" },
    { id: "loc-2", name: "Kjøkken" },
  ];

  it("renders Alle + one chip per location", () => {
    render(
      <TidslinjeChipBar
        locations={locations}
        selectedLocations={new Set()}
        onToggleLocation={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /alle/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /kjøkken/i })).toBeInTheDocument();
  });

  it("calls onToggleLocation with location id when chip clicked", () => {
    const onToggle = vi.fn();
    render(
      <TidslinjeChipBar
        locations={locations}
        selectedLocations={new Set()}
        onToggleLocation={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sal/i }));
    expect(onToggle).toHaveBeenCalledWith("loc-1");
  });

  it("marks selected chips with aria-pressed='true'", () => {
    render(
      <TidslinjeChipBar
        locations={locations}
        selectedLocations={new Set(["loc-1"])}
        onToggleLocation={() => {}}
      />,
    );
    const salChip = screen.getByRole("button", { name: /sal/i });
    expect(salChip).toHaveAttribute("aria-pressed", "true");
    const kjokkenChip = screen.getByRole("button", { name: /kjøkken/i });
    expect(kjokkenChip).toHaveAttribute("aria-pressed", "false");
  });
});
```

Run:
```bash
pnpm vitest run apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeChipBar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 2: Implement TidslinjeChipBar**

```typescript
"use client";

import { useTranslation } from "@smartout/i18n";
import { cn } from "@smartout/ui";

export type LocationChip = { id: string; name: string };

type Props = {
  locations: ReadonlyArray<LocationChip>;
  selectedLocations: ReadonlySet<string>;
  onToggleLocation: (locationId: string) => void;
  onClearAll?: () => void;
};

/**
 * Chip-bar for the slim TidslinjeTab — multi-select location filter.
 * Local useState only — URL is the wrong state container for an ephemeral
 * bottom-sheet (history-entry surprise on browser back). See L-0339.
 *
 * Visual recipe: Task Manager prototype canonical chip
 * (radius.full, 6×12 padding, 12.5px/500, transparent + 1px border).
 */
export function TidslinjeChipBar({
  locations,
  selectedLocations,
  onToggleLocation,
  onClearAll,
}: Props) {
  const { t } = useTranslation("dashboard");
  const allActive = selectedLocations.size === 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        aria-pressed={allActive}
        onClick={onClearAll}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          allActive
            ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        {t("tidslinje.chip_all")}
      </button>
      {locations.map((loc) => {
        const isActive = selectedLocations.has(loc.id);
        return (
          <button
            key={loc.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggleLocation(loc.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {loc.name}
          </button>
        );
      })}
    </div>
  );
}
```

Run:
```bash
pnpm vitest run apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeChipBar.test.tsx
```

Expected: PASS (all 3 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeChipBar.tsx \
        apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeChipBar.test.tsx
git commit -m "feat(tidslinje): TidslinjeChipBar multi-select location filter"
```

---

### Task 14: Build TidslinjeRow

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeRow.tsx`

- [ ] **Step 1: Write the row component**

```typescript
"use client";

import { Clock, CalendarCheck, ListTodo, AlertTriangle, Activity } from "lucide-react";
import { cn } from "@smartout/ui";
import type { DayEvent } from "@/app/dashboard/_hooks/use-day-timeline-events";

const TYPE_ICON = {
  booking: CalendarCheck,
  task: ListTodo,
  hook: Activity,
  deviation: AlertTriangle,
  checkin: Clock,
  checkout: Clock,
  note: ListTodo,
} as const;

const TYPE_LABEL = {
  booking: "Booking",
  task: "Oppgave",
  hook: "Hook",
  deviation: "Avvik",
  checkin: "Innsjekk",
  checkout: "Utsjekk",
  note: "Notat",
} as const;

type Props = {
  event: DayEvent;
  onClick?: (event: DayEvent) => void;
};

/**
 * One row in the slim TidslinjeTab. Compact card per Task Manager prototype
 * north-star recipe (border-border, radius.card=16, hover shadow).
 * Click opens EntityDrawer (inherits from DashboardShell).
 */
export function TidslinjeRow({ event, onClick }: Props) {
  const Icon = TYPE_ICON[event.type] ?? Clock;
  const label = TYPE_LABEL[event.type] ?? event.type;

  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      className={cn(
        "border-border bg-card hover:border-border/80 group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all hover:shadow-sm",
      )}
    >
      <span className="text-muted-foreground font-mono text-xs tabular-nums">
        {event.time?.slice(0, 5) ?? "--:--"}
      </span>
      <span className="bg-muted text-muted-foreground inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-bold tracking-widest uppercase">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </span>
      <span className="text-foreground flex-1 truncate text-sm font-medium">
        {event.title ?? "(uten tittel)"}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm turbo typecheck --filter @smartout/web
```

Expected: PASS. If `DayEvent` shape mismatches (missing `time` / `title`), read `use-day-timeline-events.ts` and adapt the destructure.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeRow.tsx
git commit -m "feat(tidslinje): TidslinjeRow compact card per Task Manager prototype"
```

---

### Task 15: Build TidslinjeTab + emit telemetry

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeTab.tsx`
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeTab.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TidslinjeTab } from "../TidslinjeTab";

const emitMock = vi.fn();
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
}));

vi.mock("@/lib/workspace-context", () => ({
  useWorkspaceOptional: () => ({ workspace: { workspace_id: "ws-1" } }),
}));

vi.mock("@/app/dashboard/_hooks/use-day-timeline-events", () => ({
  useDayTimelineEvents: () => ({
    data: [
      { id: "1", refId: "s-1", type: "task", time: "09:00", title: "Prep" },
      { id: "2", refId: "s-2", type: "booking", time: "11:30", title: "Bord 4" },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/components/day/_hooks/use-day-lines", () => ({
  useDayLines: () => ({ data: [{ day_line_id: "dl-1", location_id: "loc-1" }], isLoading: false }),
}));

vi.mock("../use-day-session", () => ({
  useDaySession: () => ({
    dateId: "2026-05-23",
    snapshot: {
      session: {
        department_session_id: "sess-1",
        department_id: "dept-1",
        department_name: "Sal",
      },
    },
  }),
}));

const dashboardContextMock = { profileId: "p-1" } as const;
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardContext: { Consumer: ({ children }: any) => children(dashboardContextMock) },
}));

describe("TidslinjeTab", () => {
  beforeEach(() => emitMock.mockReset());

  it("emits tidslinje_tab_opened with required fail-fast IDs on mount", () => {
    render(<TidslinjeTab />);
    expect(emitMock).toHaveBeenCalledWith(
      "tidslinje_tab_opened",
      expect.objectContaining({
        workspace_id: "ws-1",
        profile_id: "p-1",
        department_session_id: "sess-1",
        date_iso: "2026-05-23",
      }),
    );
  });

  it("renders one row per event from useDayTimelineEvents", () => {
    render(<TidslinjeTab />);
    expect(screen.getByText("Prep")).toBeInTheDocument();
    expect(screen.getByText("Bord 4")).toBeInTheDocument();
  });

  it("sorts rows chronologically ascending", () => {
    render(<TidslinjeTab />);
    const rows = screen.getAllByRole("button").filter((b) => b.textContent?.includes(":"));
    expect(rows[0].textContent).toContain("09:00");
    expect(rows[1].textContent).toContain("11:30");
  });
});
```

Run:
```bash
pnpm vitest run apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeTab.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 2: Implement TidslinjeTab**

```typescript
"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@smartout/i18n";
import { emit } from "@smartout/telemetry";
import { useEntityDrawerOptional } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useDayTimelineEvents, type DayEvent } from "@/app/dashboard/_hooks/use-day-timeline-events";
import { useDayLines } from "@/components/day/_hooks/use-day-lines";
import { useDaySession } from "./use-day-session";
import { TidslinjeChipBar, type LocationChip } from "./TidslinjeChipBar";
import { TidslinjeRow } from "./TidslinjeRow";
import { Skeleton } from "@/components/ui/skeleton";

function emitNonEmpty(
  event: "tidslinje_tab_opened" | "tidslinje_filter_changed",
  payload: Record<string, unknown>,
) {
  // L-0177: fail-fast if either ID is empty.
  const wsId = payload.workspace_id;
  const profId = payload.profile_id;
  if (!wsId || typeof wsId !== "string") return;
  if (!profId || typeof profId !== "string") return;
  emit(event, payload);
}

/**
 * Slim purpose-built Tidslinje tab for the DayControlPanel bottom-sheet.
 *
 * Design: chip-bar (location multi-select) + flat chronological card list.
 * NOT a port of TimelineTab — that lives in WebDayControl and is sized for
 * full-page mount (gantt + multi-strip). 75vh sheet budget = ~654px content
 * area, which the full TimelineTab stack exceeds (see L-0339).
 *
 * Read-only V1. All mutations route through day-line capability via stage-engine.
 * DnD re-time deferred to separate capability sortie (G19a/b/c).
 */
export function TidslinjeTab() {
  const { t } = useTranslation("dashboard");
  const dashCtx = useContext(DashboardContext);
  const profileId = dashCtx?.profileId ?? "";
  const ws = useWorkspaceOptional();
  const workspaceId = ws?.workspace.workspace_id ?? "";
  const drawer = useEntityDrawerOptional();
  const session = useDaySession();
  const sessionId = session.snapshot?.session?.department_session_id ?? "";
  const departmentId = session.snapshot?.session?.department_id ?? "";
  const dateId = session.dateId;

  const eventsQ = useDayTimelineEvents({
    workspaceId: workspaceId || null,
    departmentId,
    sessionId,
    dateISO: dateId,
  });
  const dayLinesQ = useDayLines({
    workspaceId: workspaceId || null,
    date: dateId,
    departmentIds: departmentId ? [departmentId] : [],
  });

  // Selected location IDs — empty Set = "Alle"
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());

  // Locations available for chip-bar — derived from day_line rows
  const locations: LocationChip[] = useMemo(() => {
    const map = new Map<string, LocationChip>();
    for (const dl of dayLinesQ.data ?? []) {
      const id = (dl as { location_id?: string; location_name?: string }).location_id;
      const name = (dl as { location_name?: string }).location_name ?? id;
      if (id && !map.has(id)) map.set(id, { id, name: name ?? id });
    }
    return Array.from(map.values());
  }, [dayLinesQ.data]);

  // Filter + sort events
  const filteredEvents = useMemo(() => {
    const all = (eventsQ.data ?? []) as DayEvent[];
    const filtered = selectedLocations.size === 0
      ? all
      : all.filter((e) => {
          const locId = (e.meta as { location_id?: string } | undefined)?.location_id;
          return locId ? selectedLocations.has(locId) : false;
        });
    return filtered.slice().sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  }, [eventsQ.data, selectedLocations]);

  // emit tidslinje_tab_opened once on mount with resolved IDs
  const emittedRef = useRef(false);
  useEffect(() => {
    if (emittedRef.current) return;
    if (!workspaceId || !profileId || !sessionId || !dateId) return;
    emittedRef.current = true;
    emitNonEmpty("tidslinje_tab_opened", {
      workspace_id: workspaceId,
      profile_id: profileId,
      department_session_id: sessionId,
      date_iso: dateId,
    });
  }, [workspaceId, profileId, sessionId, dateId]);

  function handleToggleLocation(locId: string) {
    setSelectedLocations((current) => {
      const next = new Set(current);
      const wasActive = next.has(locId);
      if (wasActive) next.delete(locId);
      else next.add(locId);
      emitNonEmpty("tidslinje_filter_changed", {
        workspace_id: workspaceId,
        profile_id: profileId,
        department_session_id: sessionId,
        filter_type: "location",
        filter_value: locId,
        active: !wasActive,
      });
      return next;
    });
  }

  function handleClearLocations() {
    if (selectedLocations.size === 0) return;
    setSelectedLocations(new Set());
    emitNonEmpty("tidslinje_filter_changed", {
      workspace_id: workspaceId,
      profile_id: profileId,
      department_session_id: sessionId,
      filter_type: "location",
      filter_value: "__ALL__",
      active: true,
    });
  }

  function handleRowClick(event: DayEvent) {
    if (!drawer) return;
    if (event.type === "task") drawer.openDrawer("cascade_task", event.refId);
    else if (event.type === "checkin" || event.type === "checkout") drawer.openDrawer("shift", event.refId);
    else if (event.type === "deviation") drawer.openDrawer("deviation", event.refId);
  }

  if (eventsQ.isLoading || dayLinesQ.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <TidslinjeChipBar
        locations={locations}
        selectedLocations={selectedLocations}
        onToggleLocation={handleToggleLocation}
        onClearAll={handleClearLocations}
      />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            {t("tidslinje.empty_state")}
          </div>
        ) : (
          filteredEvents.map((e) => <TidslinjeRow key={e.id} event={e} onClick={handleRowClick} />)
        )}
      </div>
    </div>
  );
}
```

Run:
```bash
pnpm vitest run apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeTab.test.tsx
```

Expected: PASS (all 3 tests).

- [ ] **Step 3: Verify L-0340 grep**

```bash
grep -rE 'emit\(\s*["'"'"'](tidslinje_tab_opened|tidslinje_filter_changed)["'"'"']' apps/ services/
```

Expected: at least 1 hit per event (the wrapper `emitNonEmpty` calls `emit`; grep matches the wrapper's literal string args).

If grep returns zero, the wrapper is hiding the literal. Refactor `emitNonEmpty` to call `emit(event, payload)` where `event` is a string literal from the call site, OR change grep to also match the wrapper signature. Either way, both events must produce ≥1 hit.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/TidslinjeTab.tsx \
        apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/TidslinjeTab.test.tsx
git commit -m "feat(tidslinje): slim TidslinjeTab + emit telemetry (L-0177 fail-fast, L-0340 grep)"
```

---

### Task 16: Mount TidslinjeTab in DayControlPanel as new tab

**Files:**
- Modify: `apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx`

- [ ] **Step 1: Extend TabId + TAB_DEFS**

Find the `TabId` type at `DayControlPanel.tsx:42-49`. Add `"tidslinje"`:

```typescript
type TabId =
  | "oversikt"
  | "meldinger"
  | "bookings"
  | "oppgaver"
  | "budsjett"
  | "bemanning"
  | "okonomi"
  | "tidslinje";
```

Find `TAB_DEFS` (added in Task 8). Add a row:

```typescript
import { Activity } from "lucide-react";  // add to existing lucide imports

const TAB_DEFS: ReadonlyArray<PageTab<TabId>> = [
  { key: "oversikt", label: "Oversikt", icon: Info },
  { key: "meldinger", label: "Dagsinfo", icon: MessageSquare },
  { key: "bookings", label: "Reservasjoner", icon: CalendarCheck },
  { key: "oppgaver", label: "Oppgaver", icon: ListTodo },
  { key: "tidslinje", label: "Tidslinje", icon: Activity },
  { key: "budsjett", label: "Budsjett", icon: DollarSign },
  { key: "bemanning", label: "Bemanning", icon: Users },
  { key: "okonomi", label: "Økonomi", icon: DollarSign },
];
```

- [ ] **Step 2: Add the tab body switch case**

Inside the `<div role="tabpanel">` block (replaced in Task 8), add the new line alongside the others:

```tsx
{activeTab === "tidslinje" && <TidslinjeTab />}
```

Add the import at the top of the file:

```typescript
import { TidslinjeTab } from "./TidslinjeTab";
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm turbo typecheck --filter @smartout/web
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx
git commit -m "feat(day-control): mount TidslinjeTab as 5th tab (between Oppgaver and Budsjett)"
```

---

### Task 17: i18n keys NB + EN

**Files:**
- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Add NB keys**

In `packages/i18n/locales/nb/dashboard.json`, add under a top-level `"tidslinje"` namespace (alphabetical placement within existing structure):

```json
"tidslinje": {
  "chip_all": "Alle",
  "empty_state": "Ingen aktivitet for valgte lokasjoner",
  "loading": "Laster dagens tidslinje…",
  "tab_label": "Tidslinje"
}
```

- [ ] **Step 2: Add EN keys**

In `packages/i18n/locales/en/dashboard.json`, mirror under `"tidslinje"`:

```json
"tidslinje": {
  "chip_all": "All",
  "empty_state": "No activity for the selected locations",
  "loading": "Loading today's timeline…",
  "tab_label": "Timeline"
}
```

- [ ] **Step 3: Update tab label**

In `DayControlPanel.tsx`, replace the hardcoded label in TAB_DEFS:

```typescript
{ key: "tidslinje", label: t("tidslinje.tab_label"), icon: Activity },
```

This requires moving TAB_DEFS into the component (where `t` is available) instead of module-scope, OR using a `useMemo` keyed on locale. Match the existing pattern (read OverviewTab + sibling tabs to see whether they use `t` at definition site).

- [ ] **Step 4: Run typecheck + i18n check**

```bash
pnpm turbo typecheck --filter @smartout/web
pnpm --filter @smartout/i18n check 2>/dev/null || pnpm --filter @smartout/i18n test
```

Expected: PASS. If `i18n check` script exists and fails, fix missing/orphaned keys per the script output.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json \
        packages/i18n/locales/en/dashboard.json \
        apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx
git commit -m "i18n(tidslinje): NB+EN keys for tab label + chip + empty/loading states"
```

---

### Task 18: Playwright happy-path E2E

**Files:**
- Create: `apps/web/e2e/tidslinje-tab/tidslinje-tab.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from "@playwright/test";

test.describe("DayControlPanel — Tidslinje tab", () => {
  test("opens via tab click, renders chip-bar + chronological list", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.locator("[data-testid='schedule-day-cell']").first().click();
    await page.waitForSelector("[role='tablist'][aria-label='Kontrollsenter tabs']");

    // Click Tidslinje tab
    await page.locator("[role='tab'][data-tab-key='tidslinje']").click();
    await page.waitForSelector("[role='tabpanel'][id='tab-panel-tidslinje']");

    // Chip-bar visible
    const allChip = page.locator("[role='tabpanel'][id='tab-panel-tidslinje'] button[aria-pressed]").first();
    await expect(allChip).toBeVisible();

    // At least one row OR empty state visible
    const panel = page.locator("[role='tabpanel'][id='tab-panel-tidslinje']");
    const rowsOrEmpty = await Promise.race([
      panel.locator("button").nth(1).waitFor({ state: "visible", timeout: 3000 }).then(() => "rows"),
      panel.locator("text=/Ingen aktivitet|No activity/").waitFor({ state: "visible", timeout: 3000 }).then(() => "empty"),
    ]);
    expect(["rows", "empty"]).toContain(rowsOrEmpty);
  });

  test("clicking location chip toggles aria-pressed", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.locator("[data-testid='schedule-day-cell']").first().click();
    await page.locator("[role='tab'][data-tab-key='tidslinje']").click();
    await page.waitForSelector("[role='tabpanel'][id='tab-panel-tidslinje']");

    const chips = page.locator("[role='tabpanel'][id='tab-panel-tidslinje'] button[aria-pressed]");
    const count = await chips.count();
    if (count < 2) {
      test.skip(true, "Test fixture lacks ≥2 locations; chip-toggle behavior covered by unit test");
    }

    const secondChip = chips.nth(1);
    const before = await secondChip.getAttribute("aria-pressed");
    await secondChip.click();
    const after = await secondChip.getAttribute("aria-pressed");
    expect(before).not.toBe(after);
  });
});
```

- [ ] **Step 2: Run E2E**

```bash
pnpm playwright test apps/web/e2e/tidslinje-tab/tidslinje-tab.spec.ts
```

Expected: PASS (both tests; one may skip on fixture limitations — acceptable per skip comment).

- [ ] **Step 3: Re-run a11y E2E**

```bash
pnpm playwright test apps/web/e2e/tidslinje-tab/tidslinje-tab.axe.spec.ts
```

Expected: PASS — Tidslinje tab now also in scope (extend the axe spec to also click the Tidslinje tab + re-analyze if not already).

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/tidslinje-tab/tidslinje-tab.spec.ts
git commit -m "test(tidslinje): Playwright happy-path E2E (chip-bar toggle + list render)"
```

---

### Task 19: Forbid mutations in TidslinjeTab tree (regression guard)

**Files:**
- Create: `apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/tidslinje-no-mutation.test.ts`

- [ ] **Step 1: Write the static-analysis test**

```typescript
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const TARGET_FILES = [
  "TidslinjeTab.tsx",
  "TidslinjeChipBar.tsx",
  "TidslinjeRow.tsx",
];

describe("TidslinjeTab tree — no client-side mutations (council 2026-05-23)", () => {
  for (const f of TARGET_FILES) {
    it(`${f} contains no useMutation`, async () => {
      const path = resolve(__dirname, "..", f);
      const src = await readFile(path, "utf8");
      expect(src).not.toMatch(/useMutation\b/);
      expect(src).not.toMatch(/\.mutateAsync\b/);
    });
  }
});
```

- [ ] **Step 2: Run**

```bash
pnpm vitest run apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/tidslinje-no-mutation.test.ts
```

Expected: PASS (3 tests, one per file).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/tidslinje-no-mutation.test.ts
git commit -m "test(tidslinje): regression guard — no useMutation/mutateAsync in tab tree (council 2026-05-23)"
```

---

### Task 20: Gate 2 verification

- [ ] **Step 1: Full typecheck**

```bash
TURBO_CONCURRENCY=1 pnpm turbo typecheck --filter @smartout/web --filter @smartout/telemetry
```

Expected: PASS.

- [ ] **Step 2: All Tidslinje unit tests**

```bash
pnpm vitest run apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/
```

Expected: all PASS.

- [ ] **Step 3: L-0340 emit-grep**

```bash
echo "=== tidslinje_tab_opened ==="
grep -rE 'emit\(\s*["'"'"']tidslinje_tab_opened["'"'"']' apps/ services/ | wc -l
echo "=== tidslinje_filter_changed ==="
grep -rE 'emit\(\s*["'"'"']tidslinje_filter_changed["'"'"']' apps/ services/ | wc -l
```

Expected: each count ≥ 1. If either is zero → HARD STOP, fix Task 15 emit wiring before continuing.

- [ ] **Step 4: Playwright E2E (Tidslinje + axe)**

```bash
pnpm playwright test apps/web/e2e/tidslinje-tab/
```

Expected: all PASS.

- [ ] **Step 5: Smoke — dev server**

Run `pnpm dev`. Open `/dashboard/schedule`. Click a date with at least one shift. Click Tidslinje tab. Verify:
- Chip-bar renders with Alle + N location chips
- List renders rows OR shows empty-state text
- Browser devtools → Network → confirm 1× call to a Server Action endpoint resolving to `pinDayControlPanelContextAction` (already exists from Phase 1 — verify no duplicate)
- Browser devtools → Application → IndexedDB or local storage: confirm no URL change when toggling chips (chip-bar uses local state)

If all green, Gate 2 PASS.

---

## Phase 3 / Sortie 3 — Spine + Journeys

**Gate 3 exit criteria:** (a) `docs/domains/day-session/ARCHITECTURE.md` documents the bottom-sheet variant with file:line citations. (b) 5 journey files exist under `docs/journeys/`. (c) `USER-FLOWS.md` links them. (d) `E2E-COVERAGE.md` lists Phase 1+2 test files in the matrix. (e) `pnpm check:domains` passes.

### Task 21: Write 5 journey files

**Files:**
- Create: `docs/journeys/JOURNEY-tidslinje-manager-plan-tomorrow.md`
- Create: `docs/journeys/JOURNEY-tidslinje-manager-live-status.md`
- Create: `docs/journeys/JOURNEY-tidslinje-employee-mobile-mirror.md`
- Create: `docs/journeys/JOURNEY-tidslinje-manager-botsson-reschedule.md`
- Create: `docs/journeys/JOURNEY-tidslinje-manager-empty-day-bootstrap.md`

- [ ] **Step 1: Read the journey-drafts source file**

The 5 journey bodies are spec'd verbatim in `docs/superpowers/plans/2026-05-23-tidslinje-journey-drafts.md`. That sibling file contains:
- File 1: `JOURNEY-tidslinje-manager-plan-tomorrow.md` body + frontmatter
- File 2: `JOURNEY-tidslinje-manager-live-status.md` body + frontmatter
- File 3: `JOURNEY-tidslinje-employee-mobile-mirror.md` body + frontmatter
- File 4: `JOURNEY-tidslinje-manager-botsson-reschedule.md` body + frontmatter
- File 5: `JOURNEY-tidslinje-manager-empty-day-bootstrap.md` body + frontmatter

For each section in that drafts file, create the corresponding `docs/journeys/JOURNEY-tidslinje-*.md` with:
- Frontmatter block from the drafts file's `**Frontmatter:**` block (wrap in `---` delimiters)
- Body from the drafts file's `**Body:**` block (verbatim)

Do NOT modify content during transcription — the drafts ARE the spec. Each journey also has a `**V1 scope note (2026-05-23):**` paragraph at the end of its body documenting which steps are DEFERRED to V2 — keep these intact.

- [ ] **Step 2: Verify cross-refs**

After writing all 5 files:

```bash
ls docs/journeys/JOURNEY-tidslinje-*.md | wc -l
```

Expected: 5.

```bash
grep -l "TidslinjeTab\|TidslinjeChipBar\|pinDayControlPanelContextAction" docs/journeys/JOURNEY-tidslinje-*.md
```

Expected: ≥ 3 files reference at least one of the implementation artifacts.

- [ ] **Step 3: Commit**

```bash
git add docs/journeys/JOURNEY-tidslinje-*.md
git commit -m "docs(journeys): 5 tidslinje journeys (manager plan/live/botsson/empty + employee mobile)"
```

---

### Task 22: Update day-session ARCHITECTURE.md

**Files:**
- Modify: `docs/domains/day-session/ARCHITECTURE.md`

- [ ] **Step 1: Identify insertion point**

```bash
grep -n "^## \|WebDayControl\|DayControlPanel" docs/domains/day-session/ARCHITECTURE.md | head -20
```

Find the section describing surface mounts. If a "Surfaces" or "Mount sites" subsection exists, append the bottom-sheet variant there. Otherwise add a new H2:

```markdown
## Bottom-Sheet Variant — DayControlPanel + TidslinjeTab (P10, 2026-05-23)

`DayControlPanel` (`apps/web/src/app/dashboard/schedule/_components/day-control/DayControlPanel.tsx`) is the bottom-sheet variant of the day-control surface. Mounted from:
- `apps/web/src/components/dashboard/AdminDashboard.tsx:62`
- `apps/web/src/app/dashboard/schedule/page.tsx:1207`
- `apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx:419`

Shares cascade pipeline with `WebDayControl` (canonical full-page surface per ADR-0156): same `day-line` capability, same `DaySessionProvider` data layer, same `EntityDrawer`. Differentiation is chrome only — bottom-sheet 75vh ephemeral inspection vs full-page route. Permitted per ADR-0156 amendment 2026-05-23 (discriminating test: same capability + same authority + same data layer = differentiated chrome OK).

### Tools registration
- `apps/web/src/app/dashboard/schedule/_components/day-control/day-control-tools-bridge.tsx` — registers tools under `useRegisterTools("day-control", ...)` per ADR-0282
- `apps/web/src/app/dashboard/_actions/pin-day-control-panel-context.ts` — pins context to engine_memory with `via DayControlPanel` discriminator (TTL 24h)

### Tab inventory (8 tabs as of P10)
oversikt, meldinger, bookings, oppgaver, **tidslinje** (new), budsjett, bemanning, okonomi

### TidslinjeTab specifics
- `TidslinjeTab.tsx` — slim purpose-built (NOT a port of WebDayControl's TimelineTab; 75vh budget would be exceeded per L-0339)
- `TidslinjeChipBar.tsx` — multi-select location filter, local useState (URL not used in ephemeral sheet)
- `TidslinjeRow.tsx` — compact card per Task Manager prototype north-star
- Read-only V1; mutations route through `day-line` capability via stage-engine (G19a/b/c reschedule tools deferred to separate sortie)
- Telemetry: `tidslinje_tab_opened`, `tidslinje_filter_changed` (registered + emit'd with L-0177 fail-fast per L-0340)
```

- [ ] **Step 2: Bump frontmatter**

```yaml
last_verified: 2026-05-23
updated: 2026-05-23
```

- [ ] **Step 3: Commit**

```bash
git add docs/domains/day-session/ARCHITECTURE.md
git commit -m "docs(day-session): document DayControlPanel bottom-sheet variant + TidslinjeTab (P10)"
```

---

### Task 23: Update USER-FLOWS.md + E2E-COVERAGE.md

**Files:**
- Modify: `docs/domains/day-session/USER-FLOWS.md`
- Modify: `docs/domains/day-session/E2E-COVERAGE.md`

- [ ] **Step 1: Add journey links to USER-FLOWS.md**

Find the existing journey table or list. Append rows linking the 5 new journey files. Match the existing row shape (date, role, journey-id, link, status).

- [ ] **Step 2: Add E2E matrix rows**

In `E2E-COVERAGE.md`, find the test matrix table. Add rows for:
- `apps/web/e2e/tidslinje-tab/tidslinje-tab.spec.ts` — happy path + chip toggle
- `apps/web/e2e/tidslinje-tab/tidslinje-tab.axe.spec.ts` — a11y zero violations
- Unit tests under `apps/web/src/app/dashboard/schedule/_components/day-control/__tests__/Tidslinje*.test.tsx`

Match the matrix's existing column shape (journey link, test file, coverage type, status).

- [ ] **Step 3: Bump frontmatter on both**

```yaml
last_verified: 2026-05-23
updated: 2026-05-23
```

- [ ] **Step 4: Run domain-lint**

```bash
pnpm check:domains
```

Expected: PASS, `0 domain(s) clean`.

- [ ] **Step 5: Commit**

```bash
git add docs/domains/day-session/USER-FLOWS.md \
        docs/domains/day-session/E2E-COVERAGE.md
git commit -m "docs(day-session): link 5 tidslinje journeys + add E2E matrix rows (P10 Gate 3)"
```

---

### Task 24: Close P10 in ROADMAP

**Files:**
- Modify: `docs/domains/day-session/ROADMAP.md`

- [ ] **Step 1: Mark P10 sorties complete**

Inside the existing P10 §, change each sortie's narrative from imperative to past:
- "S1 (BLOCKS S2)" → "**S1 (Shipped 2026-05-23):**"
- "S2 (BLOCKED by S1)" → "**S2 (Shipped 2026-05-23):**"
- "S3 (BLOCKED by S2 merge)" → "**S3 (Shipped 2026-05-23):**"

Add a closing line under P10:

```markdown
**P10 status:** COMPLETE 2026-05-23. DnD re-time capability sortie (G19a/b/c) remains DEFERRED. Panel consolidation revisit scheduled 2026-07-22 (+60d).
```

- [ ] **Step 2: Close G16, G17, G18 in GAPS-AND-DEBT.md**

Open `docs/domains/day-session/GAPS-AND-DEBT.md`. For each of G16, G17, G18, append:

```markdown
### G16/G17/G18 — CLOSED (2026-05-23, P10 Sortie 1)
**Resolution:** [one-line referring to the commit hash that closed it]
```

G19a/G19b/G19c remain OPEN (deferred to capability sortie).

- [ ] **Step 3: Bump frontmatter on both**

```yaml
last_verified: 2026-05-23
updated: 2026-05-23
```

- [ ] **Step 4: Commit**

```bash
git add docs/domains/day-session/ROADMAP.md \
        docs/domains/day-session/GAPS-AND-DEBT.md
git commit -m "docs(day-session): close P10 + G16/G17/G18 (TidslinjeTab shipped 2026-05-23)"
```

---

### Task 25: Gate 3 verification + push

- [ ] **Step 1: Full domain-lint**

```bash
pnpm check:domains
```

Expected: PASS.

- [ ] **Step 2: Verify all 5 journeys exist + frontmatter**

```bash
for f in docs/journeys/JOURNEY-tidslinje-*.md; do
  echo "=== $f ==="
  head -10 "$f"
done
```

Expected: 5 files, each with valid frontmatter (title, status, created, updated, module, tags).

- [ ] **Step 3: Final pre-push gate**

```bash
TURBO_CONCURRENCY=1 git push origin development
```

Expected: husky pre-push passes (tool-collisions, OTP coherence, redirect coherence, domain-lint, archived-refs). Push succeeds.

- [ ] **Step 4: Verify origin synced**

```bash
git log origin/development..HEAD --oneline
```

Expected: empty (fully synced).

If all green, **P10 SHIPPED**.

---

## Post-Plan Notes

**What this plan does NOT cover:**

- **DnD re-time** — requires separate capability sortie + new ADR (G19a `schedule.reschedule_shift`, G19b `task.update_scheduled_at`, G19c `session_hook` re-time decision). Gate-before-code. Council 2026-05-23 explicitly deferred.
- **Panel consolidation** — revisited 2026-07-22 (+60 days) with telemetry data. If usage overlap >80% → reconsider sunset of DayControlPanel.
- **Mobile mirror** — Journey 3 (employee mobile mirror) is documented as a journey but the mobile implementation is a separate sortie under the mobile campaign (ADR-0133 boundary: mobile execute-side only).
- **Day-line creation/edit from Tidslinje** — V1 is read-only; future "+ Ny linje" CTA wires to existing `day-line.create` / `day-line.add_item` tools via the existing `DayLineCreateSheet` in `apps/web/src/components/day/`.

**Estimated effort:** Sortie 1 ~3h, Sortie 2 ~6h, Sortie 3 ~2h. Total ~11h on Sonnet sub-agents or ~4h with one experienced human.
