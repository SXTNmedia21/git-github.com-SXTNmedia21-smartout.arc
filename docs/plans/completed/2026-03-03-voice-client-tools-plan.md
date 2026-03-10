---
title: Voice Agent Client Tools — Implementation Plan
status: in_progress
updated: 2026-03-03
created: 2026-03-03
module: ai
tags: [voice, ultravox, schedule, client-tools, plan]
---

# Voice Agent Client Tools — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the Ultravox voice agent live access to schedule page data and mutations via browser-side client tools.

**Architecture:** Pages register client tools via a React context. DashboardShell passes them to VoiceAssistant, which registers implementations on the UltravoxSession and sends definitions to the backend. The backend forwards tool definitions to the Ultravox API. Tools run in-browser with direct access to TanStack Query cache and mutation hooks.

**Tech Stack:** React context, Ultravox client SDK (registerToolImplementation), TanStack Query hooks, Next.js API route

---

### Task 1: Voice Tools Context + VoiceAssistant Props

Create a context that lets any page register client tools for the voice agent, and update VoiceAssistant to accept and use them.

**Files:**

- Create: `apps/web/src/components/voice-tools-context.tsx`
- Modify: `apps/web/src/components/voice-assistant.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

**Step 1: Create VoiceToolsContext**

Create `apps/web/src/components/voice-tools-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ClientToolDefinition = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: Array<{
      name: string;
      location: "PARAMETER_LOCATION_BODY";
      schema: Record<string, unknown>;
      required?: boolean;
    }>;
    client: Record<string, never>;
  };
};

export type ClientToolImplementation = (
  params: Record<string, unknown>,
) => string | Promise<string>;

export type ClientTools = {
  definitions: ClientToolDefinition[];
  implementations: Record<string, ClientToolImplementation>;
};

type VoiceToolsContextValue = {
  clientTools: ClientTools | null;
  setClientTools: (tools: ClientTools | null) => void;
};

const VoiceToolsContext = createContext<VoiceToolsContextValue>({
  clientTools: null,
  setClientTools: () => {},
});

export function VoiceToolsProvider({ children }: { children: ReactNode }) {
  const [clientTools, setClientToolsState] = useState<ClientTools | null>(null);

  const setClientTools = useCallback((tools: ClientTools | null) => {
    setClientToolsState(tools);
  }, []);

  return (
    <VoiceToolsContext.Provider value={{ clientTools, setClientTools }}>
      {children}
    </VoiceToolsContext.Provider>
  );
}

export function useVoiceTools() {
  return useContext(VoiceToolsContext);
}
```

**Step 2: Update VoiceAssistant to accept clientTools**

In `apps/web/src/components/voice-assistant.tsx`, change the props and startSession:

```tsx
// Add to imports (line 1 area):
import type { ClientTools } from "./voice-tools-context";

// Update the interface (line 12-16):
interface VoiceAssistantProps {
  onClose?: () => void;
  autoStart?: boolean;
  missionId?: MissionId;
  clientTools?: ClientTools | null;
}

// Update the function signature (line 18-22):
export default function VoiceAssistant({
  onClose,
  autoStart = false,
  missionId = "mr-botsson",
  clientTools,
}: VoiceAssistantProps) {
```

Then in `startSession()` (around lines 37-102), after creating the session and before joinCall:

```tsx
const startSession = async () => {
  setStatus(UltravoxSessionStatus.CONNECTING);
  try {
    const currentSession = new UltravoxSession();
    sessionRef.current = currentSession;

    // Register client tool implementations BEFORE joinCall
    if (clientTools?.implementations) {
      for (const [name, impl] of Object.entries(clientTools.implementations)) {
        currentSession.registerToolImplementation(name, impl);
      }
    }

    // ... existing event listeners (status, transcripts, mic) stay the same ...

    // Update the fetch call to include tool definitions
    let joinUrl = "";
    try {
      const res = await fetch("/api/wizard/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: missionId,
          selected_tools: clientTools?.definitions ?? [],
        }),
      });
      // ... rest stays the same
```

**Step 3: Wire VoiceToolsProvider into DashboardShell**

In `apps/web/src/components/dashboard/DashboardShell.tsx`:

```tsx
// Add import:
import { VoiceToolsProvider, useVoiceTools } from "@/components/voice-tools-context";

// Wrap the shell content with VoiceToolsProvider (outermost provider).
// Inside the component, read tools and pass to VoiceAssistant:

// Where LazyVoiceAssistant is rendered (line 319):
const { clientTools } = useVoiceTools();

// ...

<LazyVoiceAssistant
  autoStart
  missionId={resolveMissionForRoute(pathname)}
  clientTools={clientTools}
  onClose={() => setIsAssistantOpen(false)}
/>;
```

Note: The `VoiceToolsProvider` must wrap the shell's children so that page components (like schedule) can call `setClientTools`. Add it around the `{children}` output, NOT around the whole shell (because the shell itself needs to read from the context). The cleanest pattern is:

- The layout wraps everything in `VoiceToolsProvider`
- DashboardShell reads `useVoiceTools()` internally
- Schedule page calls `setClientTools()` via the same context

Since DashboardShell is the client component that renders `{children}`, wrap VoiceToolsProvider around DashboardShell's return. Then use a small inner component to read the context value for the voice assistant.

**Step 4: Commit**

```bash
git add apps/web/src/components/voice-tools-context.tsx \
        apps/web/src/components/voice-assistant.tsx \
        apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(voice): add VoiceToolsContext and clientTools prop to VoiceAssistant"
```

---

### Task 2: Backend — Forward Tool Definitions to Ultravox

Update the API route and mission call to forward client tool definitions to the Ultravox API.

**Files:**

- Modify: `apps/web/src/app/api/wizard/start/route.ts`
- Modify: `packages/ai/src/missions/ultravox.ts`

**Step 1: Update the API route**

In `apps/web/src/app/api/wizard/start/route.ts`, extract `selected_tools` from the body and pass them through:

```typescript
export async function POST(request: NextRequest) {
  let apiKey: string;
  try {
    apiKey = await getServiceKey(createAdminClient(), "ultravox");
  } catch {
    console.error(
      "[wizard/start] ULTRAVOX_API_KEY not found in Vault. Save it via /platform-admin/keys.",
    );
    return NextResponse.json(
      { error: "Voice assistant is not configured. Contact administrator." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const missionId = body.mission_id || "mr-botsson";
    const selectedTools = Array.isArray(body.selected_tools) ? body.selected_tools : [];

    const result = await startMissionCall({
      missionId,
      apiKey,
      agentId: process.env.ULTRAVOX_AGENT_ID,
      selectedTools,
      metadata: {
        source: "web-dashboard",
        ...(body.metadata || {}),
      },
    });

    return NextResponse.json({
      joinUrl: result.joinUrl,
      callId: result.callId,
      mission: result.mission.name,
      voiceFallbackUsed: result.voiceFallbackUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[wizard/start] Failed:", message);
    return NextResponse.json(
      { error: "Failed to start voice session", details: message },
      { status: 502 },
    );
  }
}
```

**Step 2: Update startMissionCall**

In `packages/ai/src/missions/ultravox.ts`, add `selectedTools` to the options type and include them in the call body:

```typescript
export type StartCallOptions = {
  missionId: string;
  apiKey: string;
  agentId?: string;
  metadata?: Record<string, string>;
  templateContext?: Record<string, string>;
  selectedTools?: Array<Record<string, unknown>>;
};
```

In the `startMissionCall` function body, after building `callBody` (around line 55), add:

```typescript
if (options.selectedTools && options.selectedTools.length > 0) {
  callBody.selectedTools = options.selectedTools;
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/api/wizard/start/route.ts \
        packages/ai/src/missions/ultravox.ts
git commit -m "feat(voice): forward client tool definitions through to Ultravox API"
```

---

### Task 3: Schedule Voice Tools Hook — Read Tools

Create the core hook with 4 read tools that access schedule data.

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`

**Step 1: Create the hook**

This hook takes schedule data as parameters (not calling hooks itself — that happens in the page component). It returns tool definitions and implementations.

Create `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`:

```typescript
"use client";

import { useMemo, useRef, useEffect } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientTools,
} from "@/components/voice-tools-context";
import type { Shift, Absence } from "../_components/schedule-types";
import type { ScheduleEmployee } from "./use-employees";
import type { ScheduleComputed } from "./use-schedule-computed";

type ScheduleVoiceToolsInput = {
  weekStart: string;
  weekEnd: string;
  days: Array<{ id: string; label: string; isToday: boolean; isHoliday: boolean }>;
  shifts: Shift[];
  absences: Absence[];
  employees: ScheduleEmployee[];
  computed: ScheduleComputed;
  // Mutation callbacks — will be added in Task 4
  mutations?: {
    createShift: (input: Record<string, unknown>) => Promise<unknown>;
    updateShift: (input: { id: string; patch: Record<string, unknown> }) => Promise<unknown>;
    deleteShift: (id: string) => Promise<unknown>;
    publishShifts: (ids: string[]) => Promise<unknown>;
  };
};

// ── Tool definitions (Ultravox format) ──────────────────────

const TOOL_DEFINITIONS: ClientToolDefinition[] = [
  {
    temporaryTool: {
      modelToolName: "getScheduleState",
      description:
        "Get the current schedule overview: which week is displayed, how many shifts, employees, coverage gaps, and draft/published counts. Call this first to understand what the manager is looking at.",
      dynamicParameters: [],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "getShiftsForDay",
      description:
        "Get all shifts for a specific day. Returns employee names, times, roles, and status (draft/published). Use day name like 'monday' or date like '2026-03-03'.",
      dynamicParameters: [
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description:
              "Day name (monday, tuesday, etc.) or date (YYYY-MM-DD). Day names are relative to the currently displayed week.",
          },
          required: true,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "getEmployeeSchedule",
      description:
        "Get one employee's shifts and absences for the current week. Search by name (partial match).",
      dynamicParameters: [
        {
          name: "employeeName",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "Employee name or partial name to search for",
          },
          required: true,
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "getCoverage",
      description:
        "Get staffing coverage for a specific day or the whole week. Shows gaps, overtime risks, and team coverage. If no day specified, returns week summary.",
      dynamicParameters: [
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description:
              "Optional: day name or date. If omitted, returns full week coverage summary.",
          },
        },
      ],
      client: {},
    },
  },
];

// ── Day name resolution ─────────────────────────────────────

const DAY_NAMES: Record<string, number> = {
  monday: 0,
  mandag: 0,
  man: 0,
  tuesday: 1,
  tirsdag: 1,
  tir: 1,
  wednesday: 2,
  onsdag: 2,
  ons: 2,
  thursday: 3,
  torsdag: 3,
  tor: 3,
  friday: 4,
  fredag: 4,
  fre: 4,
  saturday: 5,
  lørdag: 5,
  lør: 5,
  sunday: 6,
  søndag: 6,
  søn: 6,
  today: -1,
  idag: -1,
  tomorrow: -2,
  imorgen: -2,
};

function resolveDateId(
  dayInput: string,
  days: Array<{ id: string; isToday: boolean }>,
): string | null {
  // Direct date format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayInput)) return dayInput;

  const key = dayInput.toLowerCase().trim();
  const dayIndex = DAY_NAMES[key];

  if (dayIndex === -1) {
    // "today"
    return days.find((d) => d.isToday)?.id ?? days[0]?.id ?? null;
  }
  if (dayIndex === -2) {
    // "tomorrow"
    const todayIdx = days.findIndex((d) => d.isToday);
    return days[todayIdx + 1]?.id ?? null;
  }
  if (dayIndex !== undefined && dayIndex >= 0 && dayIndex < days.length) {
    return days[dayIndex]?.id ?? null;
  }

  return null;
}

// ── Hook ────────────────────────────────────────────────────

export function useScheduleVoiceTools(input: ScheduleVoiceToolsInput): ClientTools {
  // Use refs so tool implementations always read latest data without
  // recreating the implementation functions (which would require re-registering).
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  return useMemo(() => {
    // ── Read tool implementations ────────────────────────

    const getScheduleState: ClientToolImplementation = () => {
      const d = dataRef.current;
      const summary = d.computed.getStatusSummary();
      return JSON.stringify({
        weekStart: d.weekStart,
        weekEnd: d.weekEnd,
        days: d.days.map((day) => ({
          id: day.id,
          label: day.label,
          isToday: day.isToday,
          isHoliday: day.isHoliday,
        })),
        totalEmployees: d.employees.length,
        totalShifts: d.shifts.length,
        totalAbsences: d.absences.length,
        draftCount: summary.draftCount,
        publishedCount: summary.publishedCount,
        coverageRisks: summary.coverageRisks,
        overtimeRisks: summary.overtimeRisks,
        openShiftQueue: summary.openShiftQueue,
        employees: d.employees.map((e) => ({
          id: e.id,
          name: e.name,
          role: e.role,
          team: e.team,
        })),
      });
    };

    const getShiftsForDay: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const dayInput = (params.day as string) ?? "";
      const dateId = resolveDateId(dayInput, d.days);
      if (!dateId) {
        return JSON.stringify({
          error: `Could not resolve day "${dayInput}". Available: ${d.days.map((d) => d.label).join(", ")}`,
        });
      }

      const dayShifts = d.computed.getShiftsForDay(dateId);
      const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
      const employeeMap = new Map(d.employees.map((e) => [e.id, e]));

      return JSON.stringify({
        day: dayLabel,
        dateId,
        shiftCount: dayShifts.length,
        shifts: dayShifts.map((s) => ({
          id: s.id,
          employee: s.employeeId
            ? (employeeMap.get(s.employeeId)?.name ?? "Ukjent")
            : "Ikke tildelt",
          employeeId: s.employeeId,
          time: s.time,
          role: s.role,
          zone: s.zone,
          status: s.isPublished ? "published" : "draft",
          workHours: s.workHours,
          notes: s.notes,
        })),
      });
    };

    const getEmployeeSchedule: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const nameQuery = ((params.employeeName as string) ?? "").toLowerCase();

      const employee = d.employees.find(
        (e) =>
          e.name.toLowerCase().includes(nameQuery) || e.name.toLowerCase().startsWith(nameQuery),
      );

      if (!employee) {
        const names = d.employees.map((e) => e.name).join(", ");
        return JSON.stringify({
          error: `No employee matching "${nameQuery}". Available: ${names}`,
        });
      }

      const empShifts = d.computed.getShiftsForEmployee(employee.id);
      const empStats = d.computed.getEmployeeStats(employee.id);
      const empAbsences = d.absences.filter((a) => a.employeeId === employee.id);

      return JSON.stringify({
        employee: {
          id: employee.id,
          name: employee.name,
          role: employee.role,
          team: employee.team,
        },
        stats: empStats,
        shifts: empShifts.map((s) => ({
          id: s.id,
          dateId: s.dateId,
          day: d.days.find((day) => day.id === s.dateId)?.label ?? s.dateId,
          time: s.time,
          role: s.role,
          status: s.isPublished ? "published" : "draft",
          workHours: s.workHours,
        })),
        absences: empAbsences.map((a) => ({
          dateId: a.dateId,
          type: a.type,
          status: a.status,
        })),
      });
    };

    const getCoverage: ClientToolImplementation = (params) => {
      const d = dataRef.current;
      const dayInput = params.day as string | undefined;

      if (dayInput) {
        const dateId = resolveDateId(dayInput, d.days);
        if (!dateId) {
          return JSON.stringify({ error: `Could not resolve day "${dayInput}"` });
        }
        const coverage = d.computed.getCoverageForDay(dateId);
        const stats = d.computed.getDayStats(dateId);
        const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;

        return JSON.stringify({
          day: dayLabel,
          dateId,
          totalStaff: coverage.totalStaff,
          shiftCount: stats.shiftCount,
          estimatedCost: stats.estimatedCost,
          draftCount: stats.draftCount,
          publishedCount: stats.publishedCount,
          absenceCount: stats.absenceCount,
          hasGaps: coverage.hasGaps,
          teamCoverage: coverage.byTeam,
        });
      }

      // Full week summary
      const summary = d.computed.getStatusSummary();
      const daySummaries = d.days.map((day) => {
        const coverage = d.computed.getCoverageForDay(day.id);
        const stats = d.computed.getDayStats(day.id);
        return {
          day: day.label,
          dateId: day.id,
          staff: coverage.totalStaff,
          shifts: stats.shiftCount,
          cost: stats.estimatedCost,
          hasGaps: coverage.hasGaps,
          drafts: stats.draftCount,
        };
      });

      return JSON.stringify({
        weekSummary: summary,
        days: daySummaries,
      });
    };

    // ── Combine definitions and implementations ──────────

    const allDefinitions = [...TOOL_DEFINITIONS];
    const allImplementations: Record<string, ClientToolImplementation> = {
      getScheduleState,
      getShiftsForDay,
      getEmployeeSchedule,
      getCoverage,
    };

    return {
      definitions: allDefinitions,
      implementations: allImplementations,
    };
  }, []); // Empty deps — implementations use refs, so they never need to be recreated
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts
git commit -m "feat(voice): add useScheduleVoiceTools hook with 4 read tools"
```

---

### Task 4: Schedule Voice Tools — Write Tools

Add 4 mutation tools (createShift, updateShift, deleteShift, publishShifts) to the hook.

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`

**Step 1: Add write tool definitions**

Append these to the `TOOL_DEFINITIONS` array (after the getCoverage definition):

```typescript
  {
    temporaryTool: {
      modelToolName: "createShift",
      description:
        "Create a new shift. Requires employee name, day, start time, and end time. Role is optional.",
      dynamicParameters: [
        {
          name: "employeeName",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Employee name (partial match)" },
          required: true,
        },
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Day name or date (YYYY-MM-DD)" },
          required: true,
        },
        {
          name: "startTime",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Start time in HH:MM format (e.g. '08:00')" },
          required: true,
        },
        {
          name: "endTime",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "End time in HH:MM format (e.g. '16:00')" },
          required: true,
        },
        {
          name: "role",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Job role (e.g. 'Kokk', 'Servitør'). Optional." },
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "updateShift",
      description:
        "Update an existing shift. Find it by employee name + day, then change time, role, or notes.",
      dynamicParameters: [
        {
          name: "employeeName",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Employee whose shift to update" },
          required: true,
        },
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Day of the shift" },
          required: true,
        },
        {
          name: "startTime",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "New start time (HH:MM). Optional." },
        },
        {
          name: "endTime",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "New end time (HH:MM). Optional." },
        },
        {
          name: "role",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "New role. Optional." },
        },
        {
          name: "notes",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Shift notes. Optional." },
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "deleteShift",
      description:
        "Delete a shift. Find it by employee name + day. If multiple shifts, specify the time to disambiguate.",
      dynamicParameters: [
        {
          name: "employeeName",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Employee whose shift to delete" },
          required: true,
        },
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Day of the shift" },
          required: true,
        },
        {
          name: "time",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Start time to disambiguate if multiple shifts (HH:MM). Optional." },
        },
      ],
      client: {},
    },
  },
  {
    temporaryTool: {
      modelToolName: "publishShifts",
      description:
        "Publish draft shifts. Specify a day to publish all drafts for that day, or 'all' to publish everything.",
      dynamicParameters: [
        {
          name: "day",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "Day name, date, or 'all' to publish all draft shifts in the current week",
          },
          required: true,
        },
      ],
      client: {},
    },
  },
```

**Step 2: Add write tool implementations**

Inside the `useMemo` callback, after the read implementations but before the "Combine" section, add:

```typescript
// ── Write tool implementations ───────────────────────

const createShiftTool: ClientToolImplementation = async (params) => {
  const d = dataRef.current;
  if (!d.mutations) return JSON.stringify({ error: "Mutations not available" });

  const nameQuery = ((params.employeeName as string) ?? "").toLowerCase();
  const employee = d.employees.find((e) => e.name.toLowerCase().includes(nameQuery));
  if (!employee) {
    return JSON.stringify({ error: `No employee matching "${nameQuery}"` });
  }

  const dateId = resolveDateId((params.day as string) ?? "", d.days);
  if (!dateId) {
    return JSON.stringify({ error: `Could not resolve day "${params.day}"` });
  }

  const startTime = (params.startTime as string) ?? "08:00";
  const endTime = (params.endTime as string) ?? "16:00";
  const role = (params.role as string) ?? employee.jobTitle ?? "";

  // Calculate work hours
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const workHours = Math.max(0, eh! * 60 + em! - (sh! * 60 + sm!)) / 60;

  try {
    await d.mutations.createShift({
      id: crypto.randomUUID(),
      employeeId: employee.id,
      dateId,
      role,
      startTime,
      endTime,
      workHours,
      status: "created",
      dayCategory: "morning",
      indicator: "blue",
      isPublished: false,
      breaks: 0,
    });

    const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
    return JSON.stringify({
      success: true,
      message: `Shift created for ${employee.name} on ${dayLabel} ${startTime}-${endTime} as ${role}`,
    });
  } catch (err) {
    return JSON.stringify({
      error: `Failed to create shift: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }
};

const updateShiftTool: ClientToolImplementation = async (params) => {
  const d = dataRef.current;
  if (!d.mutations) return JSON.stringify({ error: "Mutations not available" });

  const nameQuery = ((params.employeeName as string) ?? "").toLowerCase();
  const employee = d.employees.find((e) => e.name.toLowerCase().includes(nameQuery));
  if (!employee) {
    return JSON.stringify({ error: `No employee matching "${nameQuery}"` });
  }

  const dateId = resolveDateId((params.day as string) ?? "", d.days);
  if (!dateId) {
    return JSON.stringify({ error: `Could not resolve day "${params.day}"` });
  }

  const cellShifts = d.computed.getShiftsForCell(employee.id, dateId);
  if (cellShifts.length === 0) {
    return JSON.stringify({ error: `No shift found for ${employee.name} on ${dateId}` });
  }

  const shift = cellShifts[0]!;
  const patch: Record<string, unknown> = {};
  if (params.startTime) patch.startTime = params.startTime;
  if (params.endTime) patch.endTime = params.endTime;
  if (params.role) patch.role = params.role;
  if (params.notes) patch.notes = params.notes;

  if (patch.startTime || patch.endTime) {
    const st = (patch.startTime as string) ?? shift.startTime;
    const et = (patch.endTime as string) ?? shift.endTime;
    const [sh, sm] = st.split(":").map(Number);
    const [eh, em] = et.split(":").map(Number);
    patch.workHours = Math.max(0, eh! * 60 + em! - (sh! * 60 + sm!)) / 60;
  }

  try {
    await d.mutations.updateShift({ id: shift.id, patch });
    return JSON.stringify({
      success: true,
      message: `Updated shift for ${employee.name}: ${JSON.stringify(patch)}`,
    });
  } catch (err) {
    return JSON.stringify({
      error: `Failed to update: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }
};

const deleteShiftTool: ClientToolImplementation = async (params) => {
  const d = dataRef.current;
  if (!d.mutations) return JSON.stringify({ error: "Mutations not available" });

  const nameQuery = ((params.employeeName as string) ?? "").toLowerCase();
  const employee = d.employees.find((e) => e.name.toLowerCase().includes(nameQuery));
  if (!employee) {
    return JSON.stringify({ error: `No employee matching "${nameQuery}"` });
  }

  const dateId = resolveDateId((params.day as string) ?? "", d.days);
  if (!dateId) {
    return JSON.stringify({ error: `Could not resolve day "${params.day}"` });
  }

  const cellShifts = d.computed.getShiftsForCell(employee.id, dateId);
  if (cellShifts.length === 0) {
    return JSON.stringify({ error: `No shift found for ${employee.name} on ${dateId}` });
  }

  // If time specified, find exact match
  let shift = cellShifts[0]!;
  if (params.time && cellShifts.length > 1) {
    const match = cellShifts.find((s) => s.startTime === params.time);
    if (match) shift = match;
  }

  try {
    await d.mutations.deleteShift(shift.id);
    const dayLabel = d.days.find((day) => day.id === dateId)?.label ?? dateId;
    return JSON.stringify({
      success: true,
      message: `Deleted ${employee.name}'s shift on ${dayLabel} (${shift.time})`,
    });
  } catch (err) {
    return JSON.stringify({
      error: `Failed to delete: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }
};

const publishShiftsTool: ClientToolImplementation = async (params) => {
  const d = dataRef.current;
  if (!d.mutations) return JSON.stringify({ error: "Mutations not available" });

  const dayInput = (params.day as string) ?? "all";
  let draftShifts: typeof d.shifts;

  if (dayInput.toLowerCase() === "all" || dayInput.toLowerCase() === "alle") {
    draftShifts = d.shifts.filter((s) => !s.isPublished);
  } else {
    const dateId = resolveDateId(dayInput, d.days);
    if (!dateId) {
      return JSON.stringify({ error: `Could not resolve day "${dayInput}"` });
    }
    draftShifts = d.computed.getShiftsForDay(dateId).filter((s) => !s.isPublished);
  }

  if (draftShifts.length === 0) {
    return JSON.stringify({ message: "No draft shifts to publish" });
  }

  try {
    await d.mutations.publishShifts(draftShifts.map((s) => s.id));
    return JSON.stringify({
      success: true,
      message: `Published ${draftShifts.length} shift(s)`,
    });
  } catch (err) {
    return JSON.stringify({
      error: `Failed to publish: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }
};
```

Then update the "Combine" section to include write tools:

```typescript
const allDefinitions = [...TOOL_DEFINITIONS];
const allImplementations: Record<string, ClientToolImplementation> = {
  getScheduleState,
  getShiftsForDay,
  getEmployeeSchedule,
  getCoverage,
  createShift: createShiftTool,
  updateShift: updateShiftTool,
  deleteShift: deleteShiftTool,
  publishShifts: publishShiftsTool,
};
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts
git commit -m "feat(voice): add 4 write tools (create, update, delete, publish shifts)"
```

---

### Task 5: Wire Schedule Page + Update System Prompt

Connect the schedule page to VoiceToolsContext and update the shift-assistant prompt to know about its tools.

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/page.tsx`
- Modify: `packages/ai/src/missions/registry.ts`

**Step 1: Wire schedule page to VoiceToolsContext**

In `apps/web/src/app/dashboard/schedule/page.tsx`, add the voice tools hookup.

Add imports at the top:

```typescript
import { useVoiceTools } from "@/components/voice-tools-context";
import { useScheduleVoiceTools } from "./_hooks/use-schedule-voice-tools";
```

Inside `SchedulePageContent()`, after the `computed` declaration (around line 253) and the mutation hooks (around line 276):

```typescript
// ── Voice tools ───────────────────────────────────────────
const { setClientTools } = useVoiceTools();

const voiceTools = useScheduleVoiceTools({
  weekStart,
  weekEnd,
  days: enrichedDays,
  shifts,
  absences: absencesQuery.data ?? [],
  employees,
  computed,
  mutations: {
    createShift: (input) =>
      createShift.mutateAsync(input as Parameters<typeof createShift.mutateAsync>[0]),
    updateShift: (input) =>
      updateShift.mutateAsync(input as Parameters<typeof updateShift.mutateAsync>[0]),
    deleteShift: (id) => deleteShift.mutateAsync(id),
    publishShifts: (ids) => publishShifts.mutateAsync(ids),
  },
});

// Register/unregister tools when schedule page mounts/unmounts
useEffect(() => {
  setClientTools(voiceTools);
  return () => setClientTools(null);
}, [voiceTools, setClientTools]);
```

**Step 2: Update shift-assistant system prompt**

In `packages/ai/src/missions/registry.ts`, update the `shift-assistant` systemPrompt (line 165-179):

```typescript
    systemPrompt: `Du er Smartouts vaktplanleggingsassistent.

Du har DIREKTE TILGANG til vaktplanen gjennom verktøy. Bruk dem aktivt!

TILGJENGELIGE VERKTØY:
- getScheduleState — se hele uken: ansatte, vakter, dekningshull
- getShiftsForDay — se alle vakter for en bestemt dag
- getEmployeeSchedule — se en ansatts vakter og fravær
- getCoverage — se bemanningsgap og overtidsrisiko
- createShift — opprett ny vakt
- updateShift — endre en eksisterende vakt
- deleteShift — slett en vakt
- publishShifts — publiser utkast-vakter

ARBEIDSFLYT:
1. Kall ALLTID getScheduleState først for å forstå hva lederen ser
2. Bruk konkrete tall og navn fra verktøydata
3. Ved endringer: bekreft med lederen FØR du utfører mutasjoner
4. Etter mutasjoner: kall getScheduleState for å bekrefte endringen

REGLER:
1. Svar med konkrete forslag — "Du mangler 1 kokk fredag kveld 17-23"
2. Beregn timer og kostnader fra verktøydata
3. Sjekk tilgjengelighet og fravær før du foreslår ansatte
4. Flagg overtid over 37.5 timer og helgejobbing
5. Norsk er standard — bytt språk kun hvis brukeren gjør det
6. Hold svarene korte og presise — ledere har det travelt`,
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/page.tsx \
        packages/ai/src/missions/registry.ts
git commit -m "feat(voice): wire schedule page to voice tools + update shift-assistant prompt"
```

---

### Task 6: Manual Verification

Test the complete flow end-to-end.

**Prerequisites:**

- Ultravox API key saved in Vault (via /platform-admin/keys)
- Local Supabase running with schedule_shift table
- At least 1 employee profile in the workspace

**Step 1: Start dev server**

```bash
pnpm --filter web dev
```

**Step 2: Navigate to schedule page**

Go to `http://localhost:3050/dashboard/schedule`

**Step 3: Open voice assistant**

Click the mic button in the top-right header. Verify:

- VoiceAssistant opens
- Shows "Vaktassistenten" as the agent name
- Call starts connecting

**Step 4: Test read tools**

Say: "Hva ser jeg denne uken?"

- Agent should call `getScheduleState` and describe the current week
- Verify it mentions correct number of employees, shifts, days

Say: "Hvem jobber mandag?"

- Agent should call `getShiftsForDay` with day="mandag"
- Verify it lists actual shifts or says "no shifts"

Say: "Vis meg Erik sin uke"

- Agent should call `getEmployeeSchedule`
- Verify it matches an employee and shows their schedule

**Step 5: Test write tools**

Say: "Legg til en vakt for Erik på tirsdag 08 til 16 som kokk"

- Agent should confirm before calling `createShift`
- After confirmation, verify shift appears in the grid immediately

Say: "Publiser alle utkast"

- Agent should call `publishShifts` with day="all"
- Verify draft badges disappear from grid

**Step 6: Commit verification notes**

```bash
git add -A
git commit -m "docs(voice): verified client tools end-to-end"
```
