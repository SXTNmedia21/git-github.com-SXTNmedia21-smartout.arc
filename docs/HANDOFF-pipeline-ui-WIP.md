---
title: "WIP Handoff — swap-marketplace-pipeline-ui (paused 2026-05-16)"
feature: swap-marketplace-pipeline-ui
status: wip
updated: 2026-05-16
created: 2026-05-16
---

# WIP Handoff — Pipeline UI Sortie

> **Status:** Paused mid-wave. U0 + U3 shipped. U1/U2/U4 have full code blueprints below, ready for build-agent transcription.
> **Reason for pause:** Token budget heavy + frontend-designer agents stuck in skill-no-Write context (L-274 sibling pattern).
> **Resume strategy:** Next session dispatches `botsson-harness-builder` (sonnet) × 3 parallel with the blueprints below pasted into agent prompts. Agent transcribes + writes + commits.

## Shipped (4 of 7 tasks)

| Task | Commit | File |
|---|---|---|
| U0.1 list | `92464a9e6` | apps/web/src/app/api/admin/pipeline/route.ts |
| U0.2 detail | `fa737f7b3` | apps/web/src/app/api/admin/pipeline/[id]/route.ts |
| U0.3 lookup | `05a8219ed` | apps/web/src/app/api/schedule/shifts/[id]/pipeline/route.ts |
| U3 race toast | `02271a8ca` | 6 files (BFF 409 + web hooks + mobile use-swap.ts) |

## Remaining (3 of 7 tasks)

- **U1** admin override dashboard — 5 files, ~550 LOC blueprint below
- **U2** lock indicator web + mobile — 4 files, ~150 LOC blueprint below
- **U4** audit trail viewer — 1 file, ~390 LOC blueprint below

## Open BFF response-shape gotchas (from U0 agent reports)

- U0.1: `actor_profile_id` extracted from `context` JSONB — key may be `initiated_by` or `requester_profile_id` depending on blueprint. Verify against actual engine_state.context shape.
- U0.2: `activity_trail.workspace_id` nullable — platform-actor rows filtered out. U4 banner already accounts for this.
- U0.2: `activity_trail.data.channel` best-effort (not guaranteed in payload). Treat as informational.

## Pre-Resume Checks

```bash
cd /home/sxtnl/dev/smartout.ai-world-best-wfm-wt-1
git pull
pnpm install
pnpm turbo build --filter='@smartout/*'
pnpm --filter web typecheck   # baseline: clean
```

---

## U1 BLUEPRINT — Admin Override Dashboard

**Owner agent for resume:** `botsson-harness-builder` sonnet
**Files to create:** 5 files at `apps/web/src/app/dashboard/schedule/pipeline/`

### 1. `apps/web/src/app/dashboard/schedule/pipeline/loading.tsx` (~35 LOC)

```tsx
export default function PipelineLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-72 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 rounded-full bg-muted animate-pulse"
            style={{ animationDelay: `${i * 75}ms` }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-muted/60 backdrop-blur-xl border border-border animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
```

### 2. `apps/web/src/app/dashboard/schedule/pipeline/page.tsx` (~45 LOC)

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PipelineListClient } from "./_components/pipeline-list-client";

export const metadata = {
  title: "Pipeline — Admin Override",
};

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("role")
    .eq("user_identity_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "owner"].includes(profile.role ?? "")) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading text-3xl text-foreground">Pipeline-oversikt</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administrer og overstyr stoppede engine-prosesser
        </p>
      </div>
      <PipelineListClient />
    </div>
  );
}
```

### 3. `apps/web/src/app/dashboard/schedule/pipeline/_components/pipeline-list-client.tsx` (~155 LOC)

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { PipelineRow } from "./pipeline-row";
import { OverrideDrawer } from "./override-drawer";

type PipelineStatus = "all" | "pending" | "rejected" | "cancelled";

interface PipelineItem {
  id: string;
  blueprint: string;
  status: string;
  current_step: string | null;
  entity_id: string;
  started_at: string;
  actor_name: string | null;
}

interface ApiResponse { pipelines: PipelineItem[] }

const FILTER_LABELS: { value: PipelineStatus; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "pending", label: "Ventende" },
  { value: "rejected", label: "Avvist" },
  { value: "cancelled", label: "Kansellert" },
];

async function fetchPipelines(status: PipelineStatus): Promise<PipelineItem[]> {
  const params = status === "all" ? "" : `?status=${status}`;
  const res = await fetch(`/api/admin/pipeline${params}`);
  if (!res.ok) throw new Error("Kunne ikke laste pipelines");
  const data: ApiResponse = await res.json();
  return data.pipelines ?? [];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25 } },
};

interface PipelineListClientProps { initialFilter?: PipelineStatus }

export function PipelineListClient({ initialFilter = "rejected" }: PipelineListClientProps) {
  const [filter, setFilter] = useState<PipelineStatus>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-pipeline", filter],
    queryFn: () => fetchPipelines(filter),
    staleTime: 30_000,
  });

  const selectedPipeline = data?.find((p) => p.id === selectedId) ?? null;

  function handleRowClick(item: PipelineItem) {
    setSelectedId(item.id);
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setTimeout(() => setSelectedId(null), 300);
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {FILTER_LABELS.map(({ value, label }) => {
          const active = filter === value;
          return (
            <motion.button
              key={value}
              onClick={() => setFilter(value)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 45, damping: 24, mass: 2 }}
              className={[
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground border border-border",
              ].join(" ")}
            >
              {label}
            </motion.button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/60 border border-border animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          Kunne ikke laste pipelines. Prøv å laste siden på nytt.
        </div>
      ) : !data || data.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
          className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center"
        >
          <p className="text-sm text-muted-foreground">Ingen pipelines i denne statusen</p>
        </motion.div>
      ) : (
        <motion.div key={filter} variants={containerVariants}
          initial="hidden" animate="visible" className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {data.map((item) => (
              <motion.div key={item.id} variants={itemVariants} layout>
                <PipelineRow item={item} onClick={() => handleRowClick(item)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <OverrideDrawer
        open={drawerOpen}
        pipeline={selectedPipeline}
        onClose={handleDrawerClose}
      />
    </>
  );
}
```

### 4. `apps/web/src/app/dashboard/schedule/pipeline/_components/pipeline-row.tsx` (~120 LOC)

```tsx
"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { ChevronRight, GitBranch, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PipelineItem {
  id: string;
  blueprint: string;
  status: string;
  current_step: string | null;
  entity_id: string;
  started_at: string;
  actor_name: string | null;
}

interface PipelineRowProps { item: PipelineItem; onClick: () => void }

function blueprintLabel(blueprint: string): string {
  if (blueprint.includes("swap")) return "Vaktbytte";
  if (blueprint.includes("offer") || blueprint.includes("marketplace")) return "Vakttilbud";
  return blueprint;
}

function statusVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "rejected": return "destructive";
    case "cancelled": return "secondary";
    default: return "outline";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "rejected": return "Avvist";
    case "cancelled": return "Kansellert";
    case "pending": return "Ventende";
    case "active": return "Aktiv";
    case "completed": return "Fullført";
    default: return status;
  }
}

export function PipelineRow({ item, onClick }: PipelineRowProps) {
  const relativeTime = formatDistanceToNow(new Date(item.started_at), {
    addSuffix: true, locale: nb,
  });

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.998 }}
      transition={{ type: "spring", stiffness: 45, damping: 24, mass: 2 }}
      className={cn(
        "w-full text-left rounded-xl border border-border",
        "bg-background/80 backdrop-blur-xl",
        "px-5 py-4 flex items-center gap-4",
        "hover:border-foreground/20 hover:bg-background/90",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
        <GitBranch className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {blueprintLabel(item.blueprint)}
          </span>
          <Badge variant={statusVariant(item.status)}>
            {statusLabel(item.status)}
          </Badge>
          {item.current_step && (
            <span className="text-xs text-muted-foreground font-mono">
              {item.current_step}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Package className="w-3 h-3" />
            <span className="font-mono truncate max-w-[180px]">{item.entity_id}</span>
          </span>
          {item.actor_name && (
            <span className="text-xs text-muted-foreground">{item.actor_name}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{relativeTime}</span>
        </div>
      </div>

      <ChevronRight className="shrink-0 w-4 h-4 text-muted-foreground" />
    </motion.button>
  );
}
```

### 5. `apps/web/src/app/dashboard/schedule/pipeline/_components/override-drawer.tsx` (~195 LOC)

> Full source preserved in conversation history (above this handoff). Reproducing here in compact form — see Sheet wrapper + Textarea with min-20-char validation + chat-dispatch via `window.dispatchEvent(new CustomEvent('botsson:open-with-prompt', { detail: { prompt } }))`.

```tsx
"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

interface PipelineItem {
  id: string;
  blueprint: string;
  status: string;
  current_step: string | null;
  entity_id: string;
  started_at: string;
  actor_name: string | null;
}

interface OverrideDrawerProps {
  open: boolean;
  pipeline: PipelineItem | null;
  onClose: () => void;
}

const MIN_CHARS = 20;
const MAX_CHARS = 500;

function blueprintLabel(b: string): string {
  if (b.includes("swap")) return "Vaktbytte";
  if (b.includes("offer") || b.includes("marketplace")) return "Vakttilbud";
  return b;
}

function statusVariant(s: string): "default" | "destructive" | "secondary" | "outline" {
  switch (s) {
    case "rejected": return "destructive";
    case "cancelled": return "secondary";
    default: return "outline";
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "rejected": return "Avvist";
    case "cancelled": return "Kansellert";
    case "pending": return "Ventende";
    case "active": return "Aktiv";
    default: return s;
  }
}

export function OverrideDrawer({ open, pipeline, onClose }: OverrideDrawerProps) {
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const charCount = reason.trim().length;
  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const showError = reason.length > 0 && charCount < MIN_CHARS;
  const showOverLimit = charCount > MAX_CHARS;

  const handleDispatch = useCallback(() => {
    if (!pipeline || !isValid) return;
    const prompt = `Override pipeline ${pipeline.id} (${blueprintLabel(pipeline.blueprint)}). Begrunnelse: ${reason.trim()}`;
    // ADR-0240: dispatch via Botsson chat, never direct mutation API
    window.dispatchEvent(new CustomEvent("botsson:open-with-prompt", { detail: { prompt } }));
    void queryClient.invalidateQueries({ queryKey: ["admin-pipeline"] });
    onClose();
  }, [pipeline, reason, isValid, queryClient, onClose]);

  function handleOpenChange(o: boolean) {
    if (!o) {
      onClose();
      setTimeout(() => setReason(""), 300);
    }
  }

  const relativeTime = pipeline?.started_at
    ? formatDistanceToNow(new Date(pipeline.started_at), { addSuffix: true, locale: nb })
    : "";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={cn("w-full sm:max-w-[480px]", "bg-background/95 backdrop-blur-xl border-l border-border")}
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="font-heading text-xl text-foreground">Override pipeline</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Skriv en begrunnelse og send til Botsson for behandling
          </SheetDescription>
        </SheetHeader>

        {pipeline && (
          <div className="flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
              className={cn("rounded-xl border border-border", "bg-muted/40 backdrop-blur-xl p-4", "flex flex-col gap-3")}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground">{blueprintLabel(pipeline.blueprint)}</span>
                <Badge variant={statusVariant(pipeline.status)}>{statusLabel(pipeline.status)}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {pipeline.current_step && (
                  <><span className="text-muted-foreground">Steg</span>
                    <span className="font-mono text-foreground truncate">{pipeline.current_step}</span></>
                )}
                <span className="text-muted-foreground">Enhet</span>
                <span className="font-mono text-foreground truncate">{pipeline.entity_id}</span>
                {pipeline.actor_name && (
                  <><span className="text-muted-foreground">Aktør</span>
                    <span className="text-foreground">{pipeline.actor_name}</span></>
                )}
                <span className="text-muted-foreground">Startet</span>
                <span className="text-foreground">{relativeTime}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2, delay: 0.05 }}
              className="flex flex-col gap-2"
            >
              <label htmlFor="override-reason" className="text-sm font-medium text-foreground">Begrunnelse</label>
              <Textarea
                id="override-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Beskriv hvorfor denne pipelinen skal overstyres..."
                className={cn("min-h-[120px] resize-none", "bg-background/60 backdrop-blur-sm",
                  showError || showOverLimit ? "border-destructive focus-visible:ring-destructive" : "")}
                maxLength={MAX_CHARS + 50}
              />
              <div className="flex items-center justify-between">
                {showError ? (
                  <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    Begrunnelse må være minst {MIN_CHARS} tegn
                  </p>
                ) : showOverLimit ? (
                  <p className="text-xs text-destructive flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    Maks {MAX_CHARS} tegn tillatt
                  </p>
                ) : <span />}
                <span className={cn("text-xs tabular-nums",
                  showOverLimit ? "text-destructive" : "text-muted-foreground")}>
                  {charCount}/{MAX_CHARS}
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2, delay: 0.1 }}
            >
              <Button onClick={handleDispatch} disabled={!isValid} className="w-full gap-2">
                <MessageSquare className="w-4 h-4" />
                Send override
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Åpner Botsson-chat med forhåndsutfylt melding
              </p>
            </motion.div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

---

## U2 BLUEPRINT — Pipeline-Lock Indicator (Web + Mobile)

**Owner agent for resume:** `botsson-harness-builder` sonnet
**Files:** 2 new + 2 modified

### 1. NEW: `apps/web/src/app/dashboard/schedule/_hooks/use-shift-pipeline.ts` (~50 LOC)

```ts
import { useQuery } from "@tanstack/react-query";

export type ShiftPipelineStatus = {
  pipeline_instance_id: string;
  blueprint_id: string;
  status: string;
} | null;

type PipelineResponse = { pipeline: ShiftPipelineStatus };

async function fetchShiftPipeline(shiftId: string): Promise<PipelineResponse> {
  const res = await fetch(`/api/schedule/shifts/${shiftId}/pipeline`);
  if (!res.ok) throw new Error(`pipeline fetch failed: ${res.status}`);
  return res.json() as Promise<PipelineResponse>;
}

export function useShiftPipeline(shiftId: string) {
  return useQuery({
    queryKey: ["shift-pipeline", shiftId],
    queryFn: () => fetchShiftPipeline(shiftId),
    staleTime: 10_000,
    retry: false,
  });
}

export function resolvePipelineLabel(blueprintId: string): string {
  if (blueprintId === "shift_swap_lifecycle") return "Vaktbytte under behandling";
  if (blueprintId === "marketplace_lifecycle") return "Åpent vakttilbud — venter på godkjenning";
  return "I behandling";
}
```

### 2. NEW: `apps/web/src/app/dashboard/schedule/_components/PipelineLockBadge.tsx` (~40 LOC)

```tsx
"use client";

import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useShiftPipeline, resolvePipelineLabel } from "../_hooks/use-shift-pipeline";

interface PipelineLockBadgeProps { shiftId: string }

export function PipelineLockBadge({ shiftId }: PipelineLockBadgeProps) {
  const { data } = useShiftPipeline(shiftId);
  if (!data?.pipeline) return null;

  const label = resolvePipelineLabel(data.pipeline.blueprint_id);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="absolute top-1 right-1 z-10 flex items-center justify-center">
            <Lock className="size-3 text-amber-500" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-48 text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### 3. MODIFY: `apps/web/src/app/dashboard/schedule/_components/week-grid.tsx`

- Find shift-cell rendering
- Add `relative` to cell container
- Import `PipelineLockBadge`
- Render `<PipelineLockBadge shiftId={shift.id} />` inside cell

### 4. NEW: `apps/mobile/src/hooks/queries/use-shift-pipeline.ts` (~55 LOC)

Mobile parity — Bearer auth pattern matching existing mobile hooks (e.g. `use-swap-requests.ts`).

### 5. MODIFY: `apps/mobile/src/components/shift/ShiftCard.tsx`

- Conditional badge in top-right
- Inline Text label (no tooltip on mobile)
- Norwegian copy same as web

### Bulk-fetch flag

V1 uses individual fetches with 10s stale time + TanStack auto-dedup. Bulk endpoint `GET /api/schedule/shifts/pipeline?ids=...` recommended as V2 follow-up.

---

## U4 BLUEPRINT — Audit Trail Viewer

**Owner agent for resume:** `botsson-harness-builder` sonnet
**File:** 1 new, ~390 LOC at `apps/web/src/app/dashboard/schedule/pipeline/_components/audit-drawer.tsx`

**Interface contract:**

```ts
export type AuditDrawerProps = {
  pipelineId: string;  // engine_state.id
  open: boolean;
  onClose: () => void;
};
```

**Key features (full source in conversation history above):**

- shadcn Sheet right side, 600px max-w-[95vw]
- TanStack Query `['admin-pipeline', pipelineId, 'detail']` → `GET /api/admin/pipeline/[id]`
- staleTime 30s, gcTime 60s (NB: if TanStack Query v4, rename `gcTime` → `cacheTime`)
- Header: blueprint badge + instance id (Geist Mono) + status pill + "Lukk"
- Sub-header: started_at + completed_at + entity_id link
- Body: chronological audit_chain ascending
- Per event row:
  - Stage icon (Lucide: Clock/ChevronRight/CheckCircle/XCircle/Ban/Shield/Info)
  - Stage label discriminated:
    - `pipeline.stage_proposed` → "Foreslått"
    - `pipeline.stage_consented` → "Samtykket"
    - `pipeline.stage_approved` → "Godkjent"
    - `pipeline.stage_rejected` → "Avvist"
    - `pipeline.stage_cancelled` → "Avbrutt"
    - `pipeline.stage_overridden` → "Overstyrt"
  - Actor display_name | UUID truncated
  - Channel chip (MessageSquare icon)
  - gate_evaluation_id CopyableId component (clipboard copy + Geist Mono)
  - Reason text (rejection_reason | override_reason)
- Override events styled distinctly:
  - `bg-purple-500/10 border-purple-500/30`
  - Shield icon, `text-purple-300/400`
  - No `--governance` Nordic Split token exists yet — purple fallback per spec
- Platform-actor banner: when status='complete' but no terminal event in chain → "Plattform-handlinger vises ikke i listen"
- Empty state: "Ingen aktivitet ennå"
- Loading: LoadingSkeleton component
- Error: AlertTriangle + "Kunne ikke laste hendelseslogg"

**Date-fns import:** `formatDistanceToNow, format` from `date-fns`; `nb` locale from `date-fns/locale`.

**Spring physics:** `{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }` (Nordic Split canonical).

---

## Resume Sequence

```bash
# 1. Pre-flight
cd /home/sxtnl/dev/smartout.ai-world-best-wfm-wt-1
git pull && pnpm install && pnpm turbo build --filter='@smartout/*'

# 2. Dispatch 3 build agents in parallel with embedded blueprints
#    (paste each U1/U2/U4 blueprint into a botsson-harness-builder sonnet prompt)

# 3. After all 3 commit: 
pnpm turbo typecheck   # expect 52/52 FULL TURBO

# 4. U6 E2E spec extension to apps/e2e/protocols/p-swap-marketplace-pipeline.ts

# 5. U7 HANDOFF + decision log

# 6. close-feature.sh
```

## Risks / Open Questions

1. **Tooltip component path** — `@/components/ui/tooltip` exists per shadcn convention; verify if new install needed
2. **Textarea + Sheet components** — both standard shadcn; verify available in `apps/web/src/components/ui/`
3. **Botsson chat event listener** — `'botsson:open-with-prompt'` custom event must be wired in `BotssonShell` or similar; if listener doesn't exist, drawer dispatch is no-op. Verify or scope wiring as additional U1 task.
4. **U0.1 actor_name field** — TBD whether endpoint returns `actor_name` or just `actor_profile_id`. May need profile lookup in BFF or fallback to UUID in UI.
5. **Mobile sonner-native** — does not exist; U3 used `Alert.alert` from react-native instead. U2 mobile parity uses inline Text label same approach.
