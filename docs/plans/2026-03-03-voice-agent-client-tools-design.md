---
title: Voice Agent Client Tools — Schedule Page
status: approved
updated: 2026-03-03
created: 2026-03-03
module: ai
tags: [voice, ultravox, schedule, client-tools, design]
---

# Voice Agent Client Tools — Schedule Page

## Goal

Make the Ultravox voice agent context-aware on the schedule page. The agent should see live schedule data (shifts, employees, coverage) and be able to create/update/delete/publish shifts — all via client-side tools running in the browser with direct access to React state.

## Architecture

**Client tools** run JavaScript in the browser instead of HTTP callbacks to a server. This gives:

- Zero-latency data access (reads from TanStack Query cache)
- Automatic live-sync (tools always read current React state)
- Mutations via same optimistic update path as the UI
- No server-side state sync infrastructure needed

```
User speaks → Ultravox → Agent wants data → Calls "getScheduleState"
                                                    ↓
                                        Client tool handler runs
                                        in browser (React hook)
                                                    ↓
                                        Reads from TanStack Query cache
                                                    ↓
                                        Returns JSON to agent
                                        (zero HTTP round-trips)
```

## Tools (8)

| Tool                  | Type  | Description                                                          |
| --------------------- | ----- | -------------------------------------------------------------------- |
| `getScheduleState`    | Read  | Current week, filters, shift counts, coverage summary, employee list |
| `getShiftsForDay`     | Read  | All shifts for a specific day with employee names, times, roles      |
| `getEmployeeSchedule` | Read  | One employee's shifts + absences for current week                    |
| `getCoverage`         | Read  | Staffing gaps per day — where are we short?                          |
| `createShift`         | Write | Create new shift (employee, date, time, role)                        |
| `updateShift`         | Write | Modify existing shift (time, role, notes)                            |
| `deleteShift`         | Write | Remove a shift                                                       |
| `publishShifts`       | Write | Publish draft shifts (single or batch)                               |

## Components

### 1. `useScheduleVoiceTools()` hook

New file: `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`

- Has access to all existing schedule hooks (useShifts, useEmployees, useAbsences, etc.)
- Returns `{ toolDefinitions, toolImplementations }`
- Tool definitions = Ultravox `temporaryTool` format with `client: {}`
- Tool implementations = functions that read/write via existing hooks

### 2. Updated `voice-assistant.tsx`

- New prop: `clientTools?: { definitions: SelectedTool[], implementations: Record<string, ClientToolImplementation> }`
- Registers implementations via `session.registerToolImplementation()` before `joinCall()`
- Sends definitions to backend in request body

### 3. Updated `/api/wizard/start`

- Accepts `selectedTools` array in request body
- Includes them in Ultravox call creation payload

### 4. Schedule page integration

```tsx
const { toolDefinitions, toolImplementations } = useScheduleVoiceTools();
<VoiceAssistant
  missionId="shift-assistant"
  clientTools={{ definitions: toolDefinitions, implementations: toolImplementations }}
/>;
```

### 5. Updated `shift-assistant` system prompt

- Instructions to call `getScheduleState` first when conversation starts
- Awareness that it has live schedule data access
- Instructions to respond with concrete numbers and names

## Scope

- Schedule page only (expandable to other pages later)
- Full read + write capability
- Live-sync via client tools (always reads latest React state)

## Decisions

- **Client tools over Stage Engine** — zero latency, direct React state access, no sync infrastructure
- **8 tools** — focused set covering the main schedule operations
- **Schedule-first** — prove the pattern on one page, then expand
