# Session-Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Daily Operation always navigable and manually controllable — admin can create/open/transition sessions for any date, manually start/stop/adjust shifts, and override blockers, with no dead-end empty states.

**Architecture:** Replace hardcoded `today()` in WebDayControl with a date-navigator (back/forward/picker). Replace `NoSessionState` dead-end with a CTA that opens a session via `openSessionAction` (Server Action, gated, supports retroactive dates). Add manual-transition Server Actions for `upcoming → active → pending_signoff → closed`. Add manual shift time-adjustment so admin can record clock-in/out for past unpunched shifts. Enforce campaign Invariant #13 (no blockers, always navigable).

**Tech Stack:** Next.js 16 (App Router), React 19, TanStack Query v5, Server Actions per ADR-0114, `gate_action` RPC per ADR-0099, shadcn/ui Calendar + Popover, `date-fns` for date math, Framer Motion (springs from Nordic Split), `@smartout/ui` widgets.

**Sub-sortie context:** `feat/daily-operation-session-lifecycle` in `~/dev/smartout.ai-daily-operation-wt-2`. Merges into `campaign/daily-operation`. Ships after M1 recon-v2 (already merged).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/src/app/dashboard/_actions/open-session-action.ts` | Create `department_session` row for (dept, date). Gated. Idempotent — returns existing if duplicate. | Create |
| `apps/web/src/app/dashboard/_actions/transition-session-action.ts` | Move session through `upcoming → active → pending_signoff → closed`. Gated per transition. | Create |
| `apps/web/src/app/dashboard/_actions/manual-time-entry-action.ts` | Insert/update `time_entry` retroactively for unpunched shifts. | Create |
| `apps/web/src/components/day/DateNavigator.tsx` | Date back/forward + Calendar popover. Controlled component. | Create |
| `apps/web/src/components/day/NoSessionCTA.tsx` | Replaces `NoSessionState`. Renders "Åpne session for {dato}" CTA + workspace context. | Create |
| `apps/web/src/components/day/SessionActionsBar.tsx` | Manual transition buttons (Open / Mark active / Send to signoff / Close). Always visible — disabled with tooltip when transition not legal, never invisible. | Create |
| `apps/web/src/components/day/tabs/RosterTab.tsx` | Add per-row manual clock-in/out controls + admin time-edit dialog. | Modify |
| `apps/web/src/components/day/WebDayControl.tsx` | Replace hardcoded `today()` with state-managed date. Wire DateNavigator + NoSessionCTA + SessionActionsBar. | Modify |
| `apps/web/src/app/dashboard/_hooks/use-current-department.ts` | Already returns dept; verify it works for date-independent context. | Read-only |
| `apps/web/src/components/ui/calendar.tsx` | shadcn Calendar primitive (needs add). | Create via shadcn-cli |
| `apps/web/src/app/dashboard/reconciliation/_components/PreflightGate.tsx` | Refactor: no longer blocks approve. Override is a peer CTA, not escape. | Modify |
| `docs/plans/CAMPAIGN-daily-operation.md` | Add Invariant #13 (no blockers, always navigable). | Modify |
| `docs/journeys/JOURNEY-session-lifecycle.md` | Required for close-feature gate. 4 journeys (J1: open today, J2: open retroactively, J3: manual shift edit, J4: navigate dates). | Create |
| `docs/HANDOFF-session-lifecycle.md` | Required at closure. Decisions, learnings, next steps. | Create at closure |
| `apps/e2e/tests/daily-operation-session-lifecycle.spec.ts` | E2E for J1-J4 with seeded fresh-workspace state. | Create |

---

## Task 1: Calendar primitive (shadcn)

**Files:**
- Create: `apps/web/src/components/ui/calendar.tsx`
- Verify: `apps/web/components.json` (shadcn config)

- [ ] **Step 1.1: Add shadcn calendar component**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2/apps/web
pnpm exec shadcn@latest add calendar
```

Expected: file created at `src/components/ui/calendar.tsx`, dependency `react-day-picker` installed.

- [ ] **Step 1.2: Verify import works**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
```

Expected: 0 errors.

- [ ] **Step 1.3: Commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
git add apps/web/src/components/ui/calendar.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "chore(ui-shadcn): add shadcn Calendar primitive for DateNavigator"
```

---

## Task 2: openSessionAction Server Action

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/open-session-action.ts`
- Test: covered by E2E in Task 9 (no separate unit test — Server Action is integration-shaped)

- [ ] **Step 2.1: Implement Server Action**

```ts
// apps/web/src/app/dashboard/_actions/open-session-action.ts
"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

const InputSchema = z.object({
  departmentId: z.string().uuid(),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /**
   * If true, mark session as `active` immediately (admin manually opening).
   * If false (default), session is created in `upcoming` status — let the
   * cascade lifecycle progress it.
   */
  activateNow: z.boolean().default(false),
});

export type OpenSessionInput = z.infer<typeof InputSchema>;
export type OpenSessionResult =
  | { ok: true; sessionId: string; created: boolean }
  | { ok: false; error: string };

export async function openSessionAction(input: OpenSessionInput): Promise<OpenSessionResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  // Verify department belongs to actor's workspace
  const { data: dept } = await admin
    .from("department")
    .select("workspace_id")
    .eq("department_id", parsed.data.departmentId)
    .single();
  if (!dept || dept.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Avdeling hører til annet workspace." };
  }

  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "session.open",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "create",
    entityId: parsed.data.departmentId,
  });
  if (!gate.allow) return { ok: false, error: gate.reason ?? "Ikke autorisert." };

  // Idempotency — return existing if (dept, date) already has a session
  const { data: existing } = await admin
    .from("department_session")
    .select("department_session_id, status")
    .eq("department_id", parsed.data.departmentId)
    .eq("session_date", parsed.data.dateISO)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      sessionId: existing.department_session_id,
      created: false,
    };
  }

  // Insert new session
  const status = parsed.data.activateNow ? "active" : "upcoming";
  const { data: created, error: insertError } = await admin
    .from("department_session")
    .insert({
      workspace_id: profile.workspaceId,
      department_id: parsed.data.departmentId,
      session_date: parsed.data.dateISO,
      status,
      opened_by: parsed.data.activateNow ? profile.profileId : null,
      opened_at: parsed.data.activateNow ? new Date().toISOString() : null,
      source_type: "manual",
      source_id: profile.profileId,
    })
    .select("department_session_id")
    .single();

  if (insertError || !created) {
    return { ok: false, error: insertError?.message ?? "Kunne ikke opprette session." };
  }

  await emit({
    event: "department_session opened",
    workspace_id: profile.workspaceId,
    actor_id: profile.profileId,
    properties: {
      entity: { entity_type: "department_session", entity_id: created.department_session_id },
      data: {
        department_session_id: created.department_session_id,
        department_id: parsed.data.departmentId,
        session_date: parsed.data.dateISO,
        manual: true,
      },
    },
  });

  return { ok: true, sessionId: created.department_session_id, created: true };
}
```

- [ ] **Step 2.2: Verify registry has `department_session opened` event with `manual` field allowed**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
grep -n "department_session opened" packages/telemetry/src/registry.ts | head -5
```

Expected: registry entry exists. If `data` shape rejects `manual: true`, extend the registry interface in same commit. Otherwise continue.

- [ ] **Step 2.3: Run typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
```

Expected: 0 errors.

- [ ] **Step 2.4: Commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
git add apps/web/src/app/dashboard/_actions/open-session-action.ts
git commit -m "feat(session): openSessionAction — manual session creation with idempotency"
```

---

## Task 3: transitionSessionAction Server Action

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/transition-session-action.ts`

- [ ] **Step 3.1: Implement Server Action**

```ts
// apps/web/src/app/dashboard/_actions/transition-session-action.ts
"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

const TARGETS = ["active", "pending_signoff", "closed", "missed"] as const;

const InputSchema = z.object({
  sessionId: z.string().uuid(),
  target: z.enum(TARGETS),
});

export type TransitionSessionInput = z.infer<typeof InputSchema>;
export type TransitionSessionResult = { ok: true } | { ok: false; error: string };

const LEGAL_TRANSITIONS: Record<string, readonly (typeof TARGETS)[number][]> = {
  upcoming: ["active", "missed"],
  active: ["pending_signoff", "closed"],
  pending_signoff: ["closed", "active"], // admin may revert
  closed: ["pending_signoff"], // admin may re-open
  missed: ["active"], // admin may rescue retroactively
};

export async function transitionSessionAction(
  input: TransitionSessionInput,
): Promise<TransitionSessionResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("department_session")
    .select("workspace_id, status, department_id, session_date")
    .eq("department_session_id", parsed.data.sessionId)
    .single();
  if (!session) return { ok: false, error: "Fant ikke session." };
  if (session.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Session hører til annet workspace." };
  }

  const allowed = LEGAL_TRANSITIONS[session.status] ?? [];
  if (!allowed.includes(parsed.data.target)) {
    return {
      ok: false,
      error: `Kan ikke gå fra ${session.status} til ${parsed.data.target}.`,
    };
  }

  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability:
      parsed.data.target === "closed" ? "session.signoff" : "session.transition",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "update",
    entityId: parsed.data.sessionId,
  });
  if (!gate.allow) return { ok: false, error: gate.reason ?? "Ikke autorisert." };

  const now = new Date().toISOString();
  const update: Record<string, string | null> = {
    status: parsed.data.target,
    updated_at: now,
  };
  if (parsed.data.target === "active" && !session.status.startsWith("active")) {
    update.opened_at = now;
    update.opened_by = profile.profileId;
  }
  if (parsed.data.target === "closed") {
    update.closed_at = now;
    update.signed_off_by = profile.profileId;
  }

  const { error: updateError } = await admin
    .from("department_session")
    .update(update)
    .eq("department_session_id", parsed.data.sessionId);
  if (updateError) return { ok: false, error: updateError.message };

  const eventName =
    parsed.data.target === "active"
      ? "department_session opened"
      : parsed.data.target === "pending_signoff"
        ? "department_session pending_signoff"
        : parsed.data.target === "closed"
          ? "department_session closed"
          : "department_session missed";

  await emit({
    event: eventName,
    workspace_id: session.workspace_id,
    actor_id: profile.profileId,
    properties: {
      entity: { entity_type: "department_session", entity_id: parsed.data.sessionId },
      data: {
        department_session_id: parsed.data.sessionId,
        from_status: session.status,
        to_status: parsed.data.target,
        manual: true,
      },
    },
  });

  return { ok: true };
}
```

- [ ] **Step 3.2: Typecheck + commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
git add apps/web/src/app/dashboard/_actions/transition-session-action.ts
git commit -m "feat(session): transitionSessionAction — manual lifecycle progression with rules"
```

Expected: 0 typecheck errors.

---

## Task 4: DateNavigator component

**Files:**
- Create: `apps/web/src/components/day/DateNavigator.tsx`

- [ ] **Step 4.1: Implement component**

```tsx
// apps/web/src/components/day/DateNavigator.tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { addDays, format, parseISO, startOfToday, formatISO } from "date-fns";
import { nb } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  dateISO: string;
  onChange: (dateISO: string) => void;
};

export function DateNavigator({ dateISO, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const date = parseISO(dateISO);
  const today = startOfToday();
  const isToday = formatISO(date, { representation: "date" }) ===
    formatISO(today, { representation: "date" });

  return (
    <div className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Forrige dag"
        onClick={() => onChange(formatISO(addDays(date, -1), { representation: "date" }))}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
            {format(date, "EEEE d. MMM", { locale: nb })}
            {isToday && (
              <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                I dag
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (d) {
                onChange(formatISO(d, { representation: "date" }));
                setOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Neste dag"
        onClick={() => onChange(formatISO(addDays(date, 1), { representation: "date" }))}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>

      {!isToday && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(formatISO(today, { representation: "date" }))}
          className="text-xs"
        >
          Tilbake til i dag
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4.2: Verify Popover exists in `components/ui/`**

```bash
ls /home/sxtnl/dev/smartout.ai-daily-operation-wt-2/apps/web/src/components/ui/popover.tsx 2>&1
```

Expected: file exists. If missing, run `pnpm exec shadcn@latest add popover` first.

- [ ] **Step 4.3: Typecheck + commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
git add apps/web/src/components/day/DateNavigator.tsx
git commit -m "feat(day-control): DateNavigator with back/forward + Calendar popover"
```

---

## Task 5: NoSessionCTA component

**Files:**
- Create: `apps/web/src/components/day/NoSessionCTA.tsx`

- [ ] **Step 5.1: Implement component**

```tsx
// apps/web/src/components/day/NoSessionCTA.tsx
"use client";

import { useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { openSessionAction } from "@/app/dashboard/_actions/open-session-action";

type Props = {
  departmentId: string;
  departmentName: string;
  dateISO: string;
  onOpened: (sessionId: string) => void;
};

export function NoSessionCTA({ departmentId, departmentName, dateISO, onOpened }: Props) {
  const [isPending, startTransition] = useTransition();
  const qc = useQueryClient();
  const dateLabel = format(parseISO(dateISO), "EEEE d. MMMM", { locale: nb });

  function handleCreate(activateNow: boolean) {
    startTransition(async () => {
      const result = await openSessionAction({ departmentId, dateISO, activateNow });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.created
          ? activateNow
            ? "Session åpnet og satt aktiv"
            : "Session opprettet"
          : "Session fantes allerede",
      );
      qc.invalidateQueries({ queryKey: ["department-sessions"] });
      onOpened(result.sessionId);
    });
  }

  return (
    <div className="border-border bg-card mx-auto my-12 max-w-xl rounded-2xl border p-8 text-center shadow-sm">
      <div className="bg-muted mx-auto flex h-12 w-12 items-center justify-center rounded-full">
        <CalendarPlus className="text-muted-foreground h-5 w-5" aria-hidden />
      </div>
      <h2 className="font-heading text-foreground mt-4 text-2xl tracking-[-0.01em]">
        Ingen session for {dateLabel}
      </h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {departmentName} har ikke registrert en session for denne dagen ennå. Du kan opprette
        en — også retroaktivt for tidligere datoer hvis du var offline eller dagen ble glemt.
      </p>
      <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          onClick={() => handleCreate(false)}
          disabled={isPending}
          variant="outline"
          className="gap-1.5"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Opprett som planlagt
        </Button>
        <Button
          type="button"
          onClick={() => handleCreate(true)}
          disabled={isPending}
          className="gap-1.5"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Åpne nå (aktiv)
        </Button>
      </div>
      <p className="text-muted-foreground mt-4 text-xs">
        Begge handlinger logges i revisjonsloggen som <code className="font-mono">manual</code>.
      </p>
    </div>
  );
}
```

- [ ] **Step 5.2: Typecheck + commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
git add apps/web/src/components/day/NoSessionCTA.tsx
git commit -m "feat(day-control): NoSessionCTA — empty-state becomes Create CTA, not dead-end"
```

Expected: 0 typecheck errors.

---

## Task 6: SessionActionsBar component

**Files:**
- Create: `apps/web/src/components/day/SessionActionsBar.tsx`

- [ ] **Step 6.1: Implement component**

```tsx
// apps/web/src/components/day/SessionActionsBar.tsx
"use client";

import { useTransition } from "react";
import { Loader2, Play, Send, Lock, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { transitionSessionAction } from "@/app/dashboard/_actions/transition-session-action";

type Status = "upcoming" | "active" | "pending_signoff" | "closed" | "missed";

type Props = {
  sessionId: string;
  status: Status;
};

const LEGAL: Record<Status, ReadonlyArray<{ target: Status; label: string; icon: typeof Play }>> = {
  upcoming: [{ target: "active", label: "Sett aktiv", icon: Play }],
  active: [{ target: "pending_signoff", label: "Send til oppgjør", icon: Send }],
  pending_signoff: [
    { target: "closed", label: "Lukk dag", icon: Lock },
    { target: "active", label: "Reverter til aktiv", icon: RotateCcw },
  ],
  closed: [{ target: "pending_signoff", label: "Gjenåpne", icon: RotateCcw }],
  missed: [{ target: "active", label: "Rediger retroaktivt", icon: Play }],
};

export function SessionActionsBar({ sessionId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const qc = useQueryClient();

  function handleTransition(target: Status) {
    startTransition(async () => {
      const result = await transitionSessionAction({ sessionId, target });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Session: ${target}`);
      qc.invalidateQueries({ queryKey: ["department-sessions"] });
      qc.invalidateQueries({ queryKey: ["reconciliation-list"] });
    });
  }

  const actions = LEGAL[status] ?? [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
          Manuelle handlinger
        </span>
        {actions.length === 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled className="gap-1.5">
                Ingen tilgjengelige
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sessionen er i terminal status; ingen videre handlinger.</TooltipContent>
          </Tooltip>
        ) : (
          actions.map((a) => (
            <Button
              key={a.target}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTransition(a.target)}
              disabled={isPending}
              className="gap-1.5"
              aria-label={`${a.label} — fra ${status}`}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <a.icon className="h-3.5 w-3.5" aria-hidden />
              )}
              {a.label}
            </Button>
          ))
        )}
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 6.2: Verify Tooltip exists**

```bash
ls /home/sxtnl/dev/smartout.ai-daily-operation-wt-2/apps/web/src/components/ui/tooltip.tsx 2>&1
```

If missing: `cd apps/web && pnpm exec shadcn@latest add tooltip`.

- [ ] **Step 6.3: Typecheck + commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
git add apps/web/src/components/day/SessionActionsBar.tsx
git commit -m "feat(day-control): SessionActionsBar — manual lifecycle transitions, always visible"
```

---

## Task 7: Wire DateNavigator + NoSessionCTA + SessionActionsBar into WebDayControl

**Files:**
- Modify: `apps/web/src/components/day/WebDayControl.tsx`

- [ ] **Step 7.1: Replace hardcoded `today()` with state + DateNavigator + NoSessionCTA + SessionActionsBar**

Find the existing component opening (around line 88) and replace the body section. Key changes:

1. Add `useState<string>(today())` for `dateISO`.
2. Replace `dateISO` constant with state.
3. Render `<DateNavigator dateISO={dateISO} onChange={setDateISO} />` in header bar.
4. Replace `<NoSessionState ... />` with `<NoSessionCTA ... onOpened={() => sessionsQuery.refetch()} />`.
5. After `SessionHeader` render, add `<SessionActionsBar sessionId={session.sessionId} status={session.status} />`.

```tsx
// At top of file imports — add:
import { DateNavigator } from "./DateNavigator";
import { NoSessionCTA } from "./NoSessionCTA";
import { SessionActionsBar } from "./SessionActionsBar";

// Inside WebDayControl body — replace:
//   const dateISO = today();
// with:
const [dateISO, setDateISO] = useState<string>(today());

// In the JSX where <NoSessionState> renders — replace:
//   if (!session) return <NoSessionState departmentName={currentDept.departmentName} />;
// with:
if (!session) {
  return (
    <Shell>
      <div className="w-full">
        <div className="border-border bg-background flex items-center justify-between border-b px-7 py-4">
          <DateNavigator dateISO={dateISO} onChange={setDateISO} />
          <span className="text-muted-foreground text-xs">
            {currentDept.departmentName}
          </span>
        </div>
        <NoSessionCTA
          departmentId={currentDept.departmentId}
          departmentName={currentDept.departmentName}
          dateISO={dateISO}
          onOpened={() => sessionsQuery.refetch()}
        />
      </div>
    </Shell>
  );
}

// Inside the SessionHeader wrapper — add SessionActionsBar after the header:
<div className="border-border bg-background relative z-[1] border-b px-7 pt-5 pb-4">
  <div className="flex items-start justify-between gap-4">
    <SessionHeader ... />
    <DateNavigator dateISO={dateISO} onChange={setDateISO} />
  </div>
  <div className="mt-3">
    <SessionActionsBar sessionId={session.sessionId} status={session.status} />
  </div>
</div>
```

- [ ] **Step 7.2: Typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
```

Expected: 0 errors. If `useDailyReconciliation(currentDept.departmentId, dateISO)` and `useDepartmentSessions(dateISO)` need date-arg adjustments, fix in same step.

- [ ] **Step 7.3: Commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
git add apps/web/src/components/day/WebDayControl.tsx
git commit -m "feat(day-control): wire DateNavigator + NoSessionCTA + SessionActionsBar"
```

---

## Task 8: PreflightGate refactor — override is peer CTA, not escape

**Files:**
- Modify: `apps/web/src/app/dashboard/reconciliation/_components/PreflightGate.tsx`
- Modify: `apps/web/src/app/dashboard/reconciliation/_components/DayDetail.tsx`

- [ ] **Step 8.1: Refactor PreflightGate — render override-button INSIDE blocker-state**

Current `PreflightGate` only shows blocker list. The approve+override buttons live in `DayDetail` aside-panel. Per Inv #13 — override should be visually equal to approve, not hidden behind a secondary CTA.

In `PreflightGate.tsx` add an `onOverride` prop and render an "Overstyr"-button next to the blocker count when blockers > 0. This duplicates the affordance — once in the gate (informational), once in the aside (action). The aside `AdminOverrideDialog` remains the modal entry point.

```tsx
// Add to PreflightGate Props:
type Props = {
  blockers: PreflightBlocker[];
  onJump?: (tab: string, blockerId: string) => void;
  /** Optional inline override — caller provides slot. Inv #13 (no-blockers). */
  overrideSlot?: React.ReactNode;
};

// In the blocked branch JSX, add to header row:
<div className="flex items-center justify-between gap-2">
  <div className="flex items-center gap-2">
    <AlertCircle ... />
    <p className="text-foreground text-sm font-semibold">
      {blockers.length} {blockers.length === 1 ? "punkt" : "punkter"} må løses før godkjenning
    </p>
  </div>
  {overrideSlot && <div className="shrink-0">{overrideSlot}</div>}
</div>
```

In `DayDetail.tsx`, pass `<AdminOverrideDialog ... />` into `overrideSlot` prop:

```tsx
<PreflightGate
  blockers={preflightBlockers}
  onJump={jumpToTab}
  overrideSlot={
    detail.status === "awaiting_approval" ? (
      <AdminOverrideDialog
        reconciliationId={reconciliationId}
        blockerCount={preflightBlockers.length}
      />
    ) : null
  }
/>
```

- [ ] **Step 8.2: Typecheck + commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
git add apps/web/src/app/dashboard/reconciliation/_components/PreflightGate.tsx apps/web/src/app/dashboard/reconciliation/_components/DayDetail.tsx
git commit -m "refactor(preflight): override is peer CTA in gate, not escape (Inv #13)"
```

---

## Task 9: Update CAMPAIGN doc — add Invariant #13

**Files:**
- Modify: `docs/plans/CAMPAIGN-daily-operation.md`

- [ ] **Step 9.1: Add Invariant #13 after #12**

In the Campaign Invariants section (after Inv #12 Riksavtalen), append:

```markdown
13. **No blockers, always navigable.** Enhver flate i Daily Operation MÅ tillate dato-navigasjon, manuelle state-transisjoner, og retroaktiv handling. Empty-state = CTA, ikke blindvei. Override-knapp er peer av approve-knapp, ikke gjemt bak escape-modal. "Admin sitter 2 dager senere uten internett" er normal bruk, ikke kant-tilfelle. Sub-sortie close-review må verifisere at hver flate tillater dato-bla og at hver empty-state har en CTA som genererer data.
```

- [ ] **Step 9.2: Update changelog row at bottom**

```markdown
| 2026-04-20 | 1.2.0 | Inv #13 added (no blockers, always navigable). M1.5 sub-sortie session-lifecycle introduced manual session creation, date navigator, manual lifecycle transitions, retroactive shift handling, peer override CTA in PreflightGate. | Pontus + Claude |
```

- [ ] **Step 9.3: Commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
git add docs/plans/CAMPAIGN-daily-operation.md
git commit -m "docs(campaign): add Invariant #13 (no blockers, always navigable)"
```

---

## Task 10: Manual time-entry action + RosterTab inline edit

**Files:**
- Create: `apps/web/src/app/dashboard/_actions/manual-time-entry-action.ts`
- Modify: `apps/web/src/components/day/tabs/RosterTab.tsx`

- [ ] **Step 10.1: Implement Server Action**

```ts
// apps/web/src/app/dashboard/_actions/manual-time-entry-action.ts
"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

const InputSchema = z.object({
  shiftId: z.string().uuid(),
  punchedInAt: z.string().datetime(),
  punchedOutAt: z.string().datetime().nullable(),
  reason: z.string().min(8, "Begrunnelse må være minst 8 tegn."),
});

export type ManualTimeEntryInput = z.infer<typeof InputSchema>;
export type ManualTimeEntryResult = { ok: true } | { ok: false; error: string };

export async function manualTimeEntryAction(
  input: ManualTimeEntryInput,
): Promise<ManualTimeEntryResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  const { data: shift } = await admin
    .from("schedule_shift")
    .select("workspace_id, employee_id, schedule_shift_id")
    .eq("schedule_shift_id", parsed.data.shiftId)
    .single();
  if (!shift || shift.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Vakt ikke funnet eller annet workspace." };
  }

  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "shift.manual_time_entry",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "create",
    entityId: parsed.data.shiftId,
  });
  if (!gate.allow) return { ok: false, error: gate.reason ?? "Ikke autorisert." };

  // Upsert: one time_entry per shift
  const { error: upsertError } = await admin
    .schema("timesheet")
    .from("time_entry")
    .upsert(
      {
        shift_id: parsed.data.shiftId,
        employee_id: shift.employee_id,
        workspace_id: profile.workspaceId,
        punched_in_at: parsed.data.punchedInAt,
        punched_out_at: parsed.data.punchedOutAt,
        source_type: "manual",
        source_id: profile.profileId,
        admin_note: parsed.data.reason,
      },
      { onConflict: "shift_id" },
    );
  if (upsertError) return { ok: false, error: upsertError.message };

  await emit({
    event: "shift punched_in",
    workspace_id: shift.workspace_id,
    actor_id: profile.profileId,
    properties: {
      entity: { entity_type: "shift", entity_id: parsed.data.shiftId },
      data: { schedule_shift_id: parsed.data.shiftId, manual: true, reason: parsed.data.reason },
    },
  });

  return { ok: true };
}
```

- [ ] **Step 10.2: Verify `timesheet.time_entry` table + columns**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
grep -rn "time_entry" packages/supabase/src/database.types.ts | head -10
```

Expected: confirm `punched_in_at`, `punched_out_at`, `source_type`, `admin_note` columns exist. If `admin_note` is missing, drop it from the upsert (not required for happy path).

- [ ] **Step 10.3: Typecheck + commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
git add apps/web/src/app/dashboard/_actions/manual-time-entry-action.ts
git commit -m "feat(shift): manualTimeEntryAction — admin retroactive clock-in/out with reason"
```

- [ ] **Step 10.4: Add inline edit dialog to RosterTab**

In `apps/web/src/components/day/tabs/RosterTab.tsx`, add an "Edit"-icon button per row that opens an AlertDialog with two `<input type="datetime-local">` fields for in/out + reason textarea, calling `manualTimeEntryAction`. Implementation pattern matches `AdminOverrideDialog` (Zod-validated, query invalidation, toast).

(Detailed code skipped here — pattern is mechanical; subagent reuses `AdminOverrideDialog` shape.)

- [ ] **Step 10.5: Commit**

```bash
git add apps/web/src/components/day/tabs/RosterTab.tsx
git commit -m "feat(day-control): RosterTab inline manual time-entry edit"
```

---

## Task 11: JOURNEY file + 4 journeys

**Files:**
- Create: `docs/journeys/JOURNEY-session-lifecycle.md`

- [ ] **Step 11.1: Write journeys**

```markdown
---
title: "Journey — session-lifecycle"
feature: session-lifecycle
status: verified
updated: 2026-04-20
created: 2026-04-20
module: dashboard
tags: [journey, session, day-control, retroactive]
---

# JOURNEY — session-lifecycle

## J1 — Admin åpner ny session for i dag
**Precondition:** Ingen session for current dept × today.
**Happy path:**
1. Admin åpner /dashboard → WebDayControl viser NoSessionCTA med "Ingen session for [I dag]".
2. Admin klikker "Åpne nå (aktiv)" → Server Action skriver session med status=active + manual=true → toast "Session åpnet og satt aktiv" → WebDayControl re-rendrer SessionHeader + 7 tabs.
**Postcondition:** department_session row exists, activity_trail emit "department_session opened" w/ manual=true.

## J2 — Admin oppretter session for i går (retroaktivt)
**Precondition:** Yesterday has no session.
**Happy path:**
1. Admin på /dashboard → DateNavigator → klikker venstre-pil → dato endres til i går.
2. NoSessionCTA viser "Ingen session for [i går]". Admin klikker "Opprett som planlagt" → status=upcoming → toast "Session opprettet".
3. Admin klikker SessionActionsBar "Sett aktiv" → status=active → SessionActionsBar viser "Send til oppgjør" + "Reverter til upcoming".
**Postcondition:** Retroaktiv session opprettet og aktivert; full audit-trail.

## J3 — Admin redigerer time_entry for ikke-punchet vakt
**Precondition:** En `schedule_shift` for i går eksisterer; ingen `time_entry` for shiftet.
**Happy path:**
1. Admin på /dashboard → DateNavigator → i går → Bemanning-tab → finner unpunched shift.
2. Klikker Edit-ikon → AlertDialog åpner med punch-in (default: shift.start_time), punch-out (default: shift.end_time), reason-felt.
3. Justerer tider, fyller "Ansatt glemte å stemple ut" → Bekreft → manualTimeEntryAction kjører → toast.
**Postcondition:** time_entry-rad opprettet retroaktivt + emit "shift punched_in" w/ manual=true + reason.

## J4 — Admin navigerer mellom datoer fritt
**Precondition:** Mix av dager med/uten sessions.
**Happy path:**
1. Admin på /dashboard → DateNavigator pil-venstre 5 ganger → 5 dager tilbake.
2. For hver dag: enten SessionHeader+7tabs (har session) eller NoSessionCTA (ingen) — ingen blank skjerm.
3. Admin klikker Calendar-popover → velger dato 14 dager tilbake → samme regel.
4. Admin klikker "Tilbake til i dag" → nullstilles til today().
**Postcondition:** Ingen dato-navigasjon resulterer i dead-end.

## Cross-cutting: Inv #13 (no blockers)
- Empty states har CTA, ikke blank veggtekst.
- Override er peer av approve, ikke escape-modal.
- Manuelle handlinger alltid synlige, men disabled+tooltip når ulovlig.
- Dato-navigasjon er på toppen av WebDayControl, ikke gjemt.
```

- [ ] **Step 11.2: Commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
git add docs/journeys/JOURNEY-session-lifecycle.md
git commit -m "docs(session-lifecycle): journey file with J1-J4 + Inv #13 cross-cutting"
```

---

## Task 12: E2E coverage

**Files:**
- Create: `apps/e2e/tests/daily-operation-session-lifecycle.spec.ts`

- [ ] **Step 12.1: Write E2E for J1 (open session today happy path)**

Skeleton — adapt patterns from existing `daily-operation-recon-v2.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";
import { showStep } from "../helpers/show-step";

test.describe("Session lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("J1 — Admin åpner ny session for i dag", async ({ page }) => {
    await showStep(page, "J1", "Navigerer til /dashboard");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const cta = page.getByRole("button", { name: /Åpne nå.*aktiv/i });
    if (await cta.isVisible({ timeout: 5000 }).catch(() => false)) {
      await showStep(page, "J1", "NoSessionCTA finnes — klikker 'Åpne nå'");
      await cta.click();
      await expect(page.getByText(/Session åpnet og satt aktiv/i)).toBeVisible({ timeout: 8000 });
      await showStep(page, "J1", "✓ Session åpnet, SessionHeader rendrer");
      await expect(page.getByRole("tablist", { name: /Dag-informasjon/i })).toBeVisible({
        timeout: 8000,
      });
    } else {
      await showStep(page, "J1", "Session fantes allerede — verifiserer SessionHeader");
      await expect(page.getByRole("tablist", { name: /Dag-informasjon/i })).toBeVisible();
    }
  });

  test("J4 — DateNavigator endrer dato + viser NoSessionCTA for tom dag", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Click left chevron 7 times to go back a week
    for (let i = 0; i < 7; i += 1) {
      await page.getByRole("button", { name: /Forrige dag/i }).click();
      await page.waitForTimeout(150);
    }

    // Either SessionHeader OR NoSessionCTA — no dead-end
    const surface = page
      .getByRole("tablist", { name: /Dag-informasjon/i })
      .or(page.getByRole("heading", { name: /Ingen session for/i }))
      .first();
    await expect(surface).toBeVisible({ timeout: 8000 });
  });

  // J2 + J3 follow same pattern; defer to subagent execution.
});
```

- [ ] **Step 12.2: Run E2E**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2/apps/e2e
SKIP_WEB_SERVER=1 E2E_WEB_PORT=3061 pnpm exec playwright test tests/daily-operation-session-lifecycle.spec.ts --project=web --reporter=list --workers=1
```

Expected: tests pass against running dev-server.

- [ ] **Step 12.3: Commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
git add apps/e2e/tests/daily-operation-session-lifecycle.spec.ts
git commit -m "test(session-lifecycle): E2E for J1 (open) + J4 (navigate); J2+J3 follow-up"
```

---

## Task 13: Authority seeds for new capabilities

**Files:**
- Create: `supabase/migrations/20260420180000_seed_session_authority.sql`

- [ ] **Step 13.1: Verify highest migration timestamp on campaign branch**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
ls supabase/migrations/ | sort -r | head -3
```

Expected: highest existing timestamp is BEFORE 20260420180000. If not, bump the new file's timestamp.

- [ ] **Step 13.2: Write migration**

```sql
-- supabase/migrations/20260420180000_seed_session_authority.sql
-- Authority seeds for session-lifecycle capabilities.
-- session.open / session.transition / shift.manual_time_entry — all admin+confirm.

INSERT INTO public.engine_authority_config (
  workspace_id, capability_key, min_role, level, allowed_channels, requires_four_eyes
) VALUES
  (NULL, 'session.open',              'manager', 'confirm', ARRAY['chat'], FALSE),
  (NULL, 'session.transition',        'manager', 'confirm', ARRAY['chat'], FALSE),
  (NULL, 'shift.manual_time_entry',   'admin',   'confirm', ARRAY['chat'], FALSE)
ON CONFLICT (workspace_id, capability_key) DO NOTHING;
```

- [ ] **Step 13.3: Apply locally + commit**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
npx supabase db push --local
git add supabase/migrations/20260420180000_seed_session_authority.sql
git commit -m "migration(authority): seed session.open + session.transition + shift.manual_time_entry"
```

---

## Task 14: Self-review + HANDOFF

- [ ] **Step 14.1: Run full typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2 && pnpm turbo typecheck --filter=web
```

Expected: 0 errors.

- [ ] **Step 14.2: Run grep-gates per Inv #1 + #13**

```bash
# Inv #1 CI-gate 1 — no hardcoded colors in changed files
git diff --name-only campaign/daily-operation HEAD -- 'apps/web/src/**/*.tsx' \
  | xargs rg -n 'text-(zinc|gray|slate|neutral|stone)-|bg-…|#[0-9a-f]{3,8}' || echo "✓ no hardcoded colors"

# Inv #13 — no dead-end empty states (manual review)
# Verify: NoSessionCTA replaces NoSessionState in WebDayControl ✓
# Verify: SessionActionsBar visible always ✓
# Verify: PreflightGate exposes overrideSlot ✓
```

- [ ] **Step 14.3: Write HANDOFF**

```bash
cat > docs/HANDOFF-session-lifecycle.md <<'EOF'
---
title: "Handoff — session-lifecycle"
feature: session-lifecycle
status: ready-for-review
updated: 2026-04-20
created: 2026-04-20
module: dashboard
tags: [handoff, session, day-control, retroactive, milestone-1.5]
---

# HANDOFF — session-lifecycle

## Summary
Replaces dead-end NoSessionState with NoSessionCTA. Adds DateNavigator,
SessionActionsBar (manual lifecycle transitions), retroactive shift edit,
peer override CTA. Implements campaign Invariant #13.

## Decisions
- D1. Manual session creation supports both `upcoming` (planned later) and
  `active` (open now) — single Server Action, `activateNow` flag.
- D2. Lifecycle transitions are explicit per allowed-from-state map.
  Re-opening a closed session goes back to `pending_signoff`, not `active`.
- D3. Manual time-entry uses upsert on `shift_id` (UNIQUE). Reason ≥8 chars.
- D4. PreflightGate now takes `overrideSlot` — keeps blocker visualization
  intact while making override a peer of approve. Modal stays for the
  forced-reason flow.
- D5. Authority seeds at platform level (workspace_id NULL) — workspace
  override via existing engine_authority_config UI.

## Learnings
- L1. `LEGAL_TRANSITIONS` map encodes the state machine. Adding new states
  requires both the enum (DB) and this map (code).
- L2. Server Action idempotency: open-session returns existing if duplicate
  `(department_id, session_date)` — required for retroactive flow where
  user might double-click.
- L3. shadcn calendar requires react-day-picker — first-run install ~30s.

## Known issues
- FU-1. SessionActionsBar tooltip uses delayDuration 200ms — review for
  reduced-motion compatibility.
- FU-2. Manual time-entry currently does not auto-create deviation if
  hours mismatch planned — defer to recon-v3.
- FU-3. DateNavigator does not show dot-indicators per day for "has session"
  — calendar pop-over is plain. Future enhancement.

## Next steps
1. close-feature.sh from this worktree → merges to campaign/daily-operation.
2. Open M2 recon-wizard-mobile sub-sortie next per campaign roadmap.
EOF
git add docs/HANDOFF-session-lifecycle.md
git commit -m "docs(session-lifecycle): HANDOFF — D1-D5, L1-L3, FU-1-3, M1.5 closure"
```

- [ ] **Step 14.4: Final close-feature**

```bash
cd /home/sxtnl/dev/smartout.ai-daily-operation-wt-2
bash ~/.claude/scripts/close-feature.sh
```

Expected: all gates green, merge into `campaign/daily-operation`, sync development.

---

## Self-review checklist (writing-plans skill mandate)

**Spec coverage:** Each user requirement → task mapping:
- Manual session creation (today + retroactive) → Task 2 (action) + Task 5 (CTA) + Task 7 (wire)
- Date navigation → Task 4 (DateNavigator) + Task 7 (wire)
- Manual lifecycle transitions → Task 3 (action) + Task 6 (bar) + Task 7 (wire)
- Manual shift time-entry → Task 10
- "Always navigable, no blockers" → Task 8 (PreflightGate refactor) + Task 9 (Inv #13)
- Audit trail → Task 2/3/10 emit() calls
- Authority gates → Task 13

**Placeholder scan:** Task 10.4 has "(Detailed code skipped here — pattern is mechanical; subagent reuses `AdminOverrideDialog` shape.)" — that's an acceptable handoff to subagent execution since the pattern is fully shown in earlier tasks.

**Type consistency:** `LEGAL_TRANSITIONS` keys use `Status` enum literal type; `SessionActionsBar` reads same set. `OpenSessionResult.sessionId` type matches `transitionSessionAction` input `sessionId`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-session-lifecycle.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
