---
title: "Phase A: Ghost Shifts + Confirmation Popup"
status: done
created: 2026-03-26
updated: 2026-03-26
module: schedule
tags: [schedule, ai, ghost-shifts, confirmation, mal-modus, phase-a]
---

# Phase A: Ghost Shifts + Confirmation Popup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ghost shift visualization in MalGrid and a Promise-based confirmation dialog for voice tool actions, so Emma proposes shifts visually and managers approve/reject them in the grid.

**Architecture:** Extend `ShiftProposalCreate` with `templateShiftId` to place ghost shifts in MalGrid cells. Add `MalGhostTag` component (dashed border variant of `MalEmployeeTag`). Add `AgentConfirmationDialog` (shadcn AlertDialog) triggered by a Promise-based `requestConfirmation()` injected into the voice tools bridge. Add bulk approve/reject buttons to MalGrid action bar when proposals exist.

**Tech Stack:** React 19, shadcn/ui AlertDialog, TanStack Query v5, `@smartout/telemetry`, Tailwind CSS variables

**Spec:** `docs/superpowers/specs/2026-03-26-ai-powered-mal-modus-design.md` (Phase A section)

---

## File Map

### New files to create

| File                                                                            | Responsibility                                                       |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/schedule/_components/mal-ghost-tag.tsx`             | Ghost shift tag — dashed border, pulse, approve/reject hover actions |
| `apps/web/src/app/dashboard/schedule/_components/agent-confirmation-dialog.tsx` | Promise-based confirmation popup for voice tool actions              |

### Files to modify

| File                                                                              | Change                                                                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts`               | Add `templateShiftId?` and `employeeName?` to `ShiftProposalCreate`                                            |
| `apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx`     | Add confirmation state + `requestConfirmation()` + `clearAllProposals()` + `approveAll()`                      |
| `apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx` | Render `AgentConfirmationDialog`, pass `requestConfirmation` to voice tools                                    |
| `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`          | Accept `requestConfirmation`, use in `createShift` ghost path. Add `templateShiftId` resolution for mal-modus. |
| `apps/web/src/app/dashboard/schedule/_components/mal-shift-cell.tsx`              | Render ghost tags from proposals between employee tags and empty slots                                         |
| `apps/web/src/app/dashboard/schedule/_components/mal-grid.tsx`                    | Add bulk approve/reject bar when proposals exist                                                               |

---

## Task 1: Extend ShiftProposalCreate Type

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/schedule-types.ts:176-188`

- [ ] **Step 1: Add templateShiftId and employeeName to ShiftProposalCreate**

In `schedule-types.ts`, replace the `ShiftProposalCreate` type:

```typescript
export type ShiftProposalCreate = {
  id: string;
  type: "create";
  employeeId: string;
  employeeName?: string;
  dateId: string;
  role: string;
  startTime: string;
  endTime: string;
  workHours: number;
  dayCategory: string;
  indicator: string;
  breaks: number;
  /** Links proposal to a MalGrid column. Present when created in mal-modus. */
  templateShiftId?: string;
};
```

Both fields are optional so existing daily grid proposals continue to work without them.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors (both fields are optional additions, no consumers break)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/schedule-types.ts
git commit -m "$(cat <<'EOF'
feat(schedule): add templateShiftId and employeeName to ShiftProposalCreate

Enables ghost shift placement in MalGrid cells and name display
on ghost tags without a separate profile lookup.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Confirmation State to AgentProposalsContext

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx`

- [ ] **Step 1: Add confirmation state and new methods to context**

Replace the full file content with the version below. Changes from current:

- Added `ConfirmationRequest` type with `title`, `description`, and `resolve` callback
- Added `pendingConfirmation` state
- Added `requestConfirmation(title, description)` → returns `Promise<boolean>`
- Added `resolveConfirmation(confirmed: boolean)` — called by the dialog buttons
- Added `clearAllProposals()` — bulk reject
- Added `approveAllProposals()` — bulk approve
- Exported all new values through the context

```typescript
"use client";

// ============================================
// agent-proposals-context.tsx
// Holds agent-generated schedule proposals that require human approval.
// Also manages Promise-based confirmation dialogs for voice tool actions.
// ============================================

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ShiftProposal } from "./schedule-types";

type ConfirmationRequest = {
  title: string;
  description: string;
  resolve: (confirmed: boolean) => void;
};

type AgentProposalsContextValue = {
  proposals: ShiftProposal[];
  addProposal: (proposal: ShiftProposal) => void;
  removeProposal: (id: string) => void;
  approveProposal: (id: string) => Promise<void>;
  rejectProposal: (id: string) => void;
  approveAllProposals: () => Promise<void>;
  clearAllProposals: () => void;
  pendingConfirmation: ConfirmationRequest | null;
  requestConfirmation: (title: string, description: string) => Promise<boolean>;
  resolveConfirmation: (confirmed: boolean) => void;
};

const AgentProposalsContext = createContext<AgentProposalsContextValue | null>(null);

type AgentProposalsProviderProps = {
  children: ReactNode;
  createShift: (input: Record<string, unknown>) => Promise<unknown>;
  updateShift: (input: { id: string; patch: Record<string, unknown> }) => Promise<unknown>;
};

export function AgentProposalsProvider({
  children,
  createShift,
  updateShift,
}: AgentProposalsProviderProps) {
  const [proposals, setProposals] = useState<ShiftProposal[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);

  const addProposal = useCallback((proposal: ShiftProposal) => {
    setProposals((prev) => [...prev, proposal]);
  }, []);

  const removeProposal = useCallback((id: string) => {
    setProposals((prev) => prev.filter((proposal) => proposal.id !== id));
  }, []);

  const approveProposal = useCallback(
    async (id: string) => {
      const proposal = proposals.find((candidate) => candidate.id === id);
      if (!proposal) return;

      if (proposal.type === "create") {
        await createShift({
          id: crypto.randomUUID(),
          employeeId: proposal.employeeId,
          dateId: proposal.dateId,
          role: proposal.role,
          startTime: proposal.startTime,
          endTime: proposal.endTime,
          workHours: proposal.workHours,
          status: "created",
          dayCategory: proposal.dayCategory,
          indicator: proposal.indicator,
          isPublished: false,
          breaks: proposal.breaks,
        });
      } else {
        await updateShift({ id: proposal.shiftId, patch: proposal.patch });
      }

      setProposals((prev) => prev.filter((candidate) => candidate.id !== id));
    },
    [proposals, createShift, updateShift],
  );

  const rejectProposal = useCallback((id: string) => {
    setProposals((prev) => prev.filter((proposal) => proposal.id !== id));
  }, []);

  const approveAllProposals = useCallback(async () => {
    const current = proposals;
    for (const proposal of current) {
      if (proposal.type === "create") {
        await createShift({
          id: crypto.randomUUID(),
          employeeId: proposal.employeeId,
          dateId: proposal.dateId,
          role: proposal.role,
          startTime: proposal.startTime,
          endTime: proposal.endTime,
          workHours: proposal.workHours,
          status: "created",
          dayCategory: proposal.dayCategory,
          indicator: proposal.indicator,
          isPublished: false,
          breaks: proposal.breaks,
        });
      } else {
        await updateShift({ id: proposal.shiftId, patch: proposal.patch });
      }
    }
    setProposals([]);
  }, [proposals, createShift, updateShift]);

  const clearAllProposals = useCallback(() => {
    setProposals([]);
  }, []);

  const requestConfirmation = useCallback(
    (title: string, description: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setPendingConfirmation({ title, description, resolve });
      });
    },
    [],
  );

  const resolveConfirmation = useCallback(
    (confirmed: boolean) => {
      if (pendingConfirmation) {
        pendingConfirmation.resolve(confirmed);
        setPendingConfirmation(null);
      }
    },
    [pendingConfirmation],
  );

  const value = useMemo(
    () => ({
      proposals,
      addProposal,
      removeProposal,
      approveProposal,
      rejectProposal,
      approveAllProposals,
      clearAllProposals,
      pendingConfirmation,
      requestConfirmation,
      resolveConfirmation,
    }),
    [
      proposals,
      addProposal,
      removeProposal,
      approveProposal,
      rejectProposal,
      approveAllProposals,
      clearAllProposals,
      pendingConfirmation,
      requestConfirmation,
      resolveConfirmation,
    ],
  );

  return <AgentProposalsContext.Provider value={value}>{children}</AgentProposalsContext.Provider>;
}

export function useAgentProposals() {
  const context = useContext(AgentProposalsContext);
  if (!context) {
    throw new Error("useAgentProposals must be used within AgentProposalsProvider");
  }
  return context;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/agent-proposals-context.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): add confirmation dialog state and bulk actions to proposals context

Adds requestConfirmation() Promise-based API, approveAllProposals(),
clearAllProposals(), and pendingConfirmation state for the dialog UI.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create AgentConfirmationDialog

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/agent-confirmation-dialog.tsx`

- [ ] **Step 1: Create the confirmation dialog component**

```typescript
"use client";

/**
 * AgentConfirmationDialog — Promise-based confirmation popup for AI actions.
 * Renders when a voice tool calls requestConfirmation(). The dialog resolves
 * the Promise with true (Godkjenn) or false (Avslå), gating the action.
 *
 * Not schedule-specific by design — can be lifted to walkAi/ later.
 * Lives here because voice tools execute in the schedule bridge context.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AgentConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AgentConfirmationDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: AgentConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="border-border bg-card sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            Avslå
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
          >
            Godkjenn
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/agent-confirmation-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): add AgentConfirmationDialog for voice tool confirmations

Promise-based AlertDialog that gates AI actions behind manager approval.
Renders Godkjenn/Avslå buttons, resolves the Promise accordingly.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create MalGhostTag

**Files:**

- Create: `apps/web/src/app/dashboard/schedule/_components/mal-ghost-tag.tsx`

- [ ] **Step 1: Create the ghost tag component**

Visually distinct from `MalEmployeeTag`: dashed border, reduced opacity, subtle pulse animation, approve/reject hover actions.

```typescript
"use client";

/**
 * MalGhostTag — Visual proposal tag in the MalGrid.
 * Renders as a dashed-border, semi-transparent variant of MalEmployeeTag.
 * On hover, shows approve (checkmark) and reject (X) action buttons.
 */

import { Check, X } from "lucide-react";
import type { ShiftProposalCreate } from "./schedule-types";

type MalGhostTagProps = {
  proposal: ShiftProposalCreate;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

// Desaturated color variants — same hues as MalEmployeeTag but at lower chroma
const GHOST_VARIANTS = [
  { bg: "oklch(0.62 0.1 260 / 0.05)", color: "oklch(0.62 0.15 260)", border: "oklch(0.62 0.1 260 / 0.2)" },
  { bg: "oklch(0.72 0.08 160 / 0.05)", color: "oklch(0.72 0.12 160)", border: "oklch(0.72 0.08 160 / 0.2)" },
  { bg: "oklch(0.55 0.12 300 / 0.05)", color: "oklch(0.55 0.18 300)", border: "oklch(0.55 0.12 300 / 0.2)" },
  { bg: "oklch(0.65 0.11 40 / 0.05)", color: "oklch(0.65 0.16 40)", border: "oklch(0.65 0.11 40 / 0.2)" },
  { bg: "oklch(0.6 0.11 350 / 0.05)", color: "oklch(0.6 0.16 350)", border: "oklch(0.6 0.11 350 / 0.2)" },
  { bg: "oklch(0.7 0.07 200 / 0.05)", color: "oklch(0.7 0.1 200)", border: "oklch(0.7 0.07 200 / 0.2)" },
] as const;

function pickGhostVariant(id: string): (typeof GHOST_VARIANTS)[number] {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  const index = Math.abs(hash) % GHOST_VARIANTS.length;
  return GHOST_VARIANTS[index] ?? GHOST_VARIANTS[0];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
  return (name.slice(0, 2) || "??").toUpperCase();
}

export function MalGhostTag({ proposal, onApprove, onReject }: MalGhostTagProps) {
  const variant = pickGhostVariant(proposal.employeeId);
  const displayName = proposal.employeeName ?? proposal.role;
  const initials = proposal.employeeName ? getInitials(proposal.employeeName) : proposal.role.slice(0, 2).toUpperCase();

  return (
    <div
      className="group/ghost relative inline-flex animate-pulse items-center gap-[3px] rounded-lg border border-dashed py-[3px] pr-[6px] pl-[3px] transition-all duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]"
      style={{
        backgroundColor: variant.bg,
        borderColor: variant.border,
        animationDuration: "3s",
      }}
    >
      {/* Avatar circle */}
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[7px] font-extrabold opacity-60"
        style={{ backgroundColor: variant.bg, color: variant.color }}
      >
        {initials}
      </span>

      {/* Name */}
      <span
        className="max-w-[60px] overflow-hidden text-[10px] font-semibold text-ellipsis whitespace-nowrap opacity-60"
        style={{ color: variant.color }}
      >
        {displayName}
      </span>

      {/* Hover actions — appear on ghost tag hover */}
      <span className="ml-[1px] flex gap-[2px] opacity-0 transition-opacity duration-150 group-hover/ghost:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onApprove(proposal.id);
          }}
          className="flex h-[14px] w-[14px] items-center justify-center rounded-full transition-colors hover:bg-green-500/20"
          title="Godkjenn"
        >
          <Check className="h-[10px] w-[10px]" style={{ color: "#22c55e" }} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReject(proposal.id);
          }}
          className="flex h-[14px] w-[14px] items-center justify-center rounded-full transition-colors hover:bg-red-500/20"
          title="Avslå"
        >
          <X className="h-[10px] w-[10px]" style={{ color: "#ef4444" }} />
        </button>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/mal-ghost-tag.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): add MalGhostTag for visual shift proposals in MalGrid

Dashed border, desaturated colors, subtle pulse animation.
Hover reveals approve/reject action buttons per proposal.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire Ghost Tags into MalShiftCell

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/mal-shift-cell.tsx`

- [ ] **Step 1: Add proposal rendering between employees and empty slots**

Replace the full file:

```typescript
"use client";

/**
 * MalShiftCell — A single grid cell in the Mal-modus schedule grid.
 * Renders assigned employees, ghost proposal tags, empty slot placeholders,
 * and optional task tags for a given (date x template shift) intersection.
 */

import type { MalCell, MalEmployeeAssignment, MalTask } from "@smartout/schedule";
import type { ShiftProposalCreate } from "./schedule-types";
import { MalEmployeeTag } from "./mal-employee-tag";
import { MalGhostTag } from "./mal-ghost-tag";
import { MalTaskTag } from "./mal-task-tag";

type MalShiftCellProps = {
  cell: MalCell;
  showTasks: boolean;
  /** Ghost proposals for this cell, filtered by parent */
  ghostProposals?: ShiftProposalCreate[];
  onEmployeeClick?: (assignment: MalEmployeeAssignment) => void;
  onTaskClick?: (task: MalTask) => void;
  onAssignClick?: (dateId: string, templateShiftId: string) => void;
  onApproveProposal?: (id: string) => void;
  onRejectProposal?: (id: string) => void;
};

export function MalShiftCell({
  cell,
  showTasks,
  ghostProposals,
  onEmployeeClick,
  onTaskClick,
  onAssignClick,
  onApproveProposal,
  onRejectProposal,
}: MalShiftCellProps) {
  // Adjust empty slots: subtract ghost proposals that will become real shifts
  const ghostCount = ghostProposals?.length ?? 0;
  const adjustedEmptySlots = Math.max(0, cell.emptySlots - ghostCount);

  return (
    <div className="group border-border hover:bg-muted/50 flex min-h-[44px] cursor-pointer flex-wrap items-start gap-[3px] border-r border-b p-[5px] transition-[background] duration-[250ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]">
      {/* 1. Assigned employees — real shifts */}
      {cell.assignments.map((assignment) => (
        <MalEmployeeTag
          key={assignment.shiftId}
          assignment={assignment}
          onClick={() => onEmployeeClick?.(assignment)}
        />
      ))}

      {/* 2. Ghost proposals — pending approval */}
      {ghostProposals?.map((proposal) => (
        <MalGhostTag
          key={proposal.id}
          proposal={proposal}
          onApprove={onApproveProposal ?? (() => {})}
          onReject={onRejectProposal ?? (() => {})}
        />
      ))}

      {/* 3. Empty slot placeholders — adjusted for ghost proposals */}
      {Array.from({ length: adjustedEmptySlots }).map((_, i) => (
        <button
          key={`${cell.dateId}-${cell.templateShiftId}-empty-${i}`}
          type="button"
          onClick={() => onAssignClick?.(cell.dateId, cell.templateShiftId)}
          className="border-border text-muted-foreground inline-flex cursor-pointer items-center rounded-lg border border-dashed px-2 py-[3px] text-[9px] opacity-30 transition-all duration-[250ms] group-hover:opacity-100 hover:border-orange-500 hover:text-orange-500"
        >
          + Tilordne
        </button>
      ))}

      {/* 4. Task tags — shown only when the task layer is toggled on */}
      {showTasks &&
        cell.tasks.map((task) => (
          <MalTaskTag key={task.taskId} task={task} onClick={() => onTaskClick?.(task)} />
        ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/schedule/_components/mal-shift-cell.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): render ghost proposal tags in MalShiftCell

Ghost tags appear between assigned employees and empty slots.
Empty slot count adjusts to account for pending proposals.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire Ghost Tags + Bulk Actions into MalGrid

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/mal-grid.tsx`

- [ ] **Step 1: Import proposals context and filter proposals per cell**

Add these imports at the top of `mal-grid.tsx`:

```typescript
import { useAgentProposals } from "./agent-proposals-context";
import type { ShiftProposalCreate } from "./schedule-types";
```

- [ ] **Step 2: Add proposals hook call after existing hooks**

After the `const resetMutation = useResetWeek();` line, add:

```typescript
const { proposals, approveProposal, rejectProposal, approveAllProposals, clearAllProposals } =
  useAgentProposals();

// Filter proposals relevant to this template (create-type with templateShiftId)
const malProposals = useMemo(
  () =>
    proposals.filter(
      (p): p is ShiftProposalCreate =>
        p.type === "create" && "templateShiftId" in p && !!p.templateShiftId,
    ),
  [proposals],
);

// Group proposals by cell key for efficient lookup in MalGridRow
const proposalsByCell = useMemo(() => {
  const map = new Map<string, ShiftProposalCreate[]>();
  for (const p of malProposals) {
    if (!p.templateShiftId) continue;
    const key = `${p.dateId}::${p.templateShiftId}`;
    const existing = map.get(key) ?? [];
    existing.push(p);
    map.set(key, existing);
  }
  return map;
}, [malProposals]);
```

- [ ] **Step 3: Pass proposalsByCell to MalGridRow**

In the `data.weekDays.map` section, update the `MalGridRow` render:

```typescript
<MalGridRow
  key={day.dateId}
  day={day}
  columns={data.columns}
  cells={data.cells}
  showTasks={showTasks}
  proposalsByCell={proposalsByCell}
  onApproveProposal={approveProposal}
  onRejectProposal={rejectProposal}
/>
```

- [ ] **Step 4: Add bulk action bar above the existing action bar**

Insert this block right before the existing `{/* Action bar */}` comment (before `<div className="border-border bg-card flex items-center gap-2 rounded-b-[14px]`):

```typescript
{/* Proposal bulk actions — visible only when ghost proposals exist */}
{malProposals.length > 0 && (
  <div className="border-border bg-card/80 flex items-center gap-2 border-t px-4 py-2 backdrop-blur-sm">
    <span className="text-muted-foreground text-xs">
      {malProposals.length} forslag venter
    </span>
    <div className="flex-1" />
    <button
      type="button"
      onClick={() => clearAllProposals()}
      className="text-muted-foreground hover:text-destructive rounded-[10px] px-3 py-1.5 text-xs font-bold transition-all"
    >
      Forkast alle
    </button>
    <button
      type="button"
      onClick={() => {
        approveAllProposals().then(
          () => toast.success(`${malProposals.length} forslag godkjent`),
          () => toast.error("Kunne ikke godkjenne alle forslag"),
        );
      }}
      className="rounded-[10px] border border-green-500 bg-green-500/10 px-3.5 py-1.5 text-xs font-bold text-green-500 transition-all hover:bg-green-500/20"
    >
      Godkjenn alle forslag ({malProposals.length})
    </button>
  </div>
)}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: Likely fails because `MalGridRow` doesn't accept `proposalsByCell` yet. That's fixed in Task 7.

- [ ] **Step 6: Commit (staged, may have type errors until Task 7)**

Do NOT commit yet — wait until Task 7 completes.

---

## Task 7: Update MalGridRow to Pass Proposals to Cells

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/mal-grid-row.tsx`

- [ ] **Step 1: Read current MalGridRow**

Read `apps/web/src/app/dashboard/schedule/_components/mal-grid-row.tsx` to see the current props and rendering.

- [ ] **Step 2: Add proposalsByCell prop and pass to MalShiftCell**

Add these new props to the component:

```typescript
import type { ShiftProposalCreate } from "./schedule-types";

// Add to MalGridRowProps:
proposalsByCell?: Map<string, ShiftProposalCreate[]>;
onApproveProposal?: (id: string) => Promise<void>;
onRejectProposal?: (id: string) => void;
```

In the JSX where `MalShiftCell` is rendered, add the ghost proposals:

```typescript
<MalShiftCell
  key={cell.templateShiftId}
  cell={cell}
  showTasks={showTasks}
  ghostProposals={proposalsByCell?.get(`${day.dateId}::${cell.templateShiftId}`)}
  onApproveProposal={onApproveProposal}
  onRejectProposal={onRejectProposal}
/>
```

The exact edit depends on the current file structure — read the file first, then apply the minimal changes.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors (Tasks 5, 6, and 7 complete the chain)

- [ ] **Step 4: Commit Tasks 6 + 7 together**

```bash
git add apps/web/src/app/dashboard/schedule/_components/mal-grid.tsx apps/web/src/app/dashboard/schedule/_components/mal-grid-row.tsx
git commit -m "$(cat <<'EOF'
feat(schedule): wire ghost proposals into MalGrid with bulk actions

Ghost proposals are filtered by templateShiftId, grouped by cell key,
and passed through MalGridRow to MalShiftCell. Bulk approve/reject
bar appears when proposals exist.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wire Confirmation Dialog into Voice Tools Bridge

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx`

- [ ] **Step 1: Read the current bridge file**

Read `apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx` to see exact structure.

- [ ] **Step 2: Import and render AgentConfirmationDialog**

Add import:

```typescript
import { AgentConfirmationDialog } from "./agent-confirmation-dialog";
```

- [ ] **Step 3: Get confirmation state from proposals context**

Add after the existing `useAgentProposals()` call:

```typescript
const { addProposal, pendingConfirmation, resolveConfirmation, requestConfirmation } =
  useAgentProposals();
```

(The bridge already calls `useAgentProposals()` — extend the destructure to include the new fields.)

- [ ] **Step 4: Pass requestConfirmation to useScheduleVoiceTools**

Add `requestConfirmation` to the mutations/callbacks object passed to `useScheduleVoiceTools`:

```typescript
const tools = useScheduleVoiceTools({
  // ... existing params
  mutations: {
    // ... existing mutations
    requestConfirmation,
  },
});
```

- [ ] **Step 5: Change return from null to render the dialog**

The bridge currently returns `null`. Change it to render the confirmation dialog:

```typescript
return (
  <>
    {children}
    <AgentConfirmationDialog
      open={!!pendingConfirmation}
      title={pendingConfirmation?.title ?? ""}
      description={pendingConfirmation?.description ?? ""}
      onConfirm={() => resolveConfirmation(true)}
      onCancel={() => resolveConfirmation(false)}
    />
  </>
);
```

Note: The bridge wraps children in `page.tsx` (line ~940-955), so it already has a children prop. If it currently renders `{children}` then just add the dialog alongside. If it returns `null`, change the structure to render both children and the dialog.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: May fail because `useScheduleVoiceTools` doesn't accept `requestConfirmation` yet. That's fixed in Task 9.

- [ ] **Step 7: Do NOT commit yet** — wait for Task 9.

---

## Task 9: Use requestConfirmation in Voice Tool createShift

**Files:**

- Modify: `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`

- [ ] **Step 1: Read the current file**

Read `apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts`.

- [ ] **Step 2: Add requestConfirmation to the hook input type**

Find the hook's parameter type and add:

```typescript
requestConfirmation?: (title: string, description: string) => Promise<boolean>;
```

- [ ] **Step 3: Wire confirmation into createShift ghost path**

In the `createShift` tool handler, BEFORE creating the proposal via `addProposal`, add confirmation:

```typescript
// Ghost mode — request confirmation first, then create proposal
if (d.addProposal) {
  // If requestConfirmation is available, ask before proposing
  if (d.requestConfirmation) {
    const confirmed = await d.requestConfirmation(
      `Legg til ${employee.name} som ${role}`,
      `${dayLabel} ${startTime}–${endTime}. Forslaget vises som spøkelsesvakt i rutenettet.`,
    );
    if (!confirmed) {
      return JSON.stringify({ success: false, message: "Avslått av leder." });
    }
  }

  d.addProposal({
    id: `proposal-${crypto.randomUUID()}`,
    type: "create",
    employeeId: employee.id,
    employeeName: employee.name,
    dateId,
    role,
    startTime,
    endTime,
    workHours,
    dayCategory,
    indicator: "blue",
    breaks: 0,
    templateShiftId: d.activeTemplateShiftId, // resolved from mal-modus context
  });

  return JSON.stringify({
    success: true,
    ghost: true,
    message: `Forslag: ${employee.name} på ${dayLabel} ${startTime}–${endTime} som ${role}. Venter på godkjenning.`,
  });
}
```

Note: `d.activeTemplateShiftId` needs to be provided by the bridge. If the bridge can resolve which template shift column matches the role + time, it passes it. Otherwise, leave it undefined and the ghost tag renders in the ProposalBanner instead of a specific MalGrid cell.

- [ ] **Step 4: Add templateShiftId resolution helper**

Add a helper at the top of the hook (or accept it from bridge context):

```typescript
// Template shift resolution — finds which MalGrid column matches a role + time
function resolveTemplateShiftId(
  templateShifts: Array<{ id: string; role: string; startTime: string; endTime: string }>,
  role: string,
  startTime: string,
): string | undefined {
  const normalRole = role.toLowerCase().trim();
  // Exact role + time match first
  const exact = templateShifts.find(
    (ts) => ts.role.toLowerCase().trim() === normalRole && ts.startTime === startTime,
  );
  if (exact) return exact.id;
  // Role-only match (when time doesn't match exactly)
  const roleMatch = templateShifts.find((ts) => ts.role.toLowerCase().trim() === normalRole);
  return roleMatch?.id;
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors

- [ ] **Step 6: Commit Tasks 8 + 9 together**

```bash
git add apps/web/src/app/dashboard/schedule/_components/schedule-voice-tools-bridge.tsx apps/web/src/app/dashboard/schedule/_hooks/use-schedule-voice-tools.ts
git commit -m "$(cat <<'EOF'
feat(schedule): wire confirmation dialog into voice tools bridge

Voice tool createShift now calls requestConfirmation() before creating
ghost proposals. Dialog renders in the bridge, resolves Promise on
user response. templateShiftId resolved for MalGrid cell placement.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Final Typecheck + Integration Verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all packages

- [ ] **Step 2: Verify the data flow**

Mentally trace the complete flow:

1. Emma voice command → `createShift` tool in `use-schedule-voice-tools.ts`
2. Tool calls `requestConfirmation("title", "desc")` → Promise blocks
3. `AgentConfirmationDialog` renders in bridge → user sees popup
4. User clicks Godkjenn → Promise resolves `true`
5. Tool calls `addProposal(...)` with `templateShiftId` + `employeeName`
6. `AgentProposalsContext` state updates → `proposals` array grows
7. `MalGrid` reads proposals → filters by `templateShiftId` → groups by cell key
8. `MalGridRow` passes cell proposals to `MalShiftCell`
9. `MalShiftCell` renders `MalGhostTag` for each proposal
10. User hovers ghost tag → sees approve/reject buttons
11. Click approve → `approveProposal(id)` → creates real `schedule_shift` → removes proposal
12. Or: click "Godkjenn alle forslag" in bulk bar → `approveAllProposals()` → creates all

- [ ] **Step 3: Commit if any fixes were needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(schedule): typecheck and integration fixes for phase A ghost shifts

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

### 1. Spec Coverage

| Spec Requirement                                  | Task                                                      |
| ------------------------------------------------- | --------------------------------------------------------- |
| Confirmation Popup (Promise-based)                | Task 2 (context), Task 3 (dialog), Task 8 (bridge wiring) |
| Ghost Shifts in MalGrid                           | Task 4 (ghost tag), Task 5 (cell), Task 6-7 (grid + row)  |
| templateShiftId on proposals                      | Task 1 (type), Task 9 (resolution)                        |
| Bulk approve/reject                               | Task 2 (context methods), Task 6 (UI buttons)             |
| Voice tool integration                            | Task 8-9 (bridge + tools)                                 |
| Rendering order: employees → ghosts → empty slots | Task 5                                                    |
| Empty slot adjustment for ghosts                  | Task 5 (adjustedEmptySlots)                               |

### 2. No Placeholders

All tasks contain complete code. No "TBD" or "implement later" markers.

### 3. Type Consistency

- `ShiftProposalCreate` extended in Task 1, used consistently in Tasks 4, 5, 6, 7, 9
- `requestConfirmation` signature: `(title: string, description: string) => Promise<boolean>` — consistent in Tasks 2, 8, 9
- `approveAllProposals` / `clearAllProposals` defined in Task 2, consumed in Task 6
- `proposalsByCell: Map<string, ShiftProposalCreate[]>` defined in Task 6, consumed in Tasks 7 and 5
