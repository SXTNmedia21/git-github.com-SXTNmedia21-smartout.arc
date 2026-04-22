// apps/web/src/components/journey/Fjernkontroll.tsx
//
// Fjernkontroll — runtime agent-guided journey UI (ADR-0177, M5.1).
//
// Loads a `journey_version` row client-side (RLS-scoped JWT), validates
// its IR, hosts the 6-state machine, renders per-step rows, and
// subscribes to `engine_event` realtime for the `journey stuck` signal
// emitted by the stuck-detector Edge Function (M5.3).
//
// WHY client component:
//   - Realtime subscription requires a long-lived browser client.
//   - State machine lives in the browser — no server round-trip per
//     transition. This keeps latency < 30s per council SLA for
//     stuck-detection-to-UI (ADR-0175 §Stuck).
//
// SECURITY:
//   - The admin test-run page (apps/web/.../versions/[id]/run/page.tsx)
//     gates access server-side via `getSuperAdminId()` before rendering
//     this component. Non-admin users never see Fjernkontroll in M5.1.
//   - Database reads use the RLS-enforced browser client; if the JWT
//     lacks workspace_id on the row, the query returns zero rows and
//     we render an empty state. No service-role key crosses the wire.
//
// TOKENS:
//   All colours via Nordic Split semantic tokens (R5.1-4).
//   useReducedMotion() is respected on every animated element.
//   ARIA live region announces state transitions.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import {
  JourneyIRSchema,
  type JourneyIR,
  type JourneyStep as JourneyIRStep,
} from "@smartout/journey-ir";
import { cn } from "@/lib/utils";
import { FJERN_SPRING } from "./fjernkontroll-spring";
import { useFjernkontrollMachine, type FjernkontrollState } from "./useFjernkontrollMachine";
import { FjernkontrollStep, type StepStatus } from "./FjernkontrollStep";
import { FjernkontrollActions } from "./FjernkontrollActions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type FjernkontrollProps = {
  /** The `journey_version.journey_version_id` to run. Required. */
  journeyVersionId: string;
  /**
   * Optional existing run. When set, the Fjernkontroll subscribes to
   * `engine_event` realtime filtered by this run_id. When unset, the
   * machine is in `idle` and the user must click Start (which in M5.2
   * will trigger the `journey.run_guided` server action). M5.1 wires
   * only the UI half — server-action handoff lands in the runtime
   * follow-up sub-sortie.
   */
  runId?: string;
  className?: string;
};

// ---------------------------------------------------------------------------
// State -> visual config (tokens only)
// ---------------------------------------------------------------------------

type StateVisual = {
  label: string;
  description: string;
  Icon: typeof AlertTriangle;
  tone: string;
  ring: string;
};

const STATE_VISUAL: Record<FjernkontrollState, StateVisual> = {
  idle: {
    label: "Klar",
    description: "Trykk start for å kjøre gjennom reisen.",
    Icon: CircleDashed,
    tone: "text-muted-foreground",
    ring: "ring-border",
  },
  running: {
    label: "Kjører",
    description: "Reisen pågår. Følg trinnene.",
    Icon: CircleDashed,
    tone: "text-foreground",
    ring: "ring-foreground/20",
  },
  paused: {
    label: "Pauset",
    description: "Reisen er midlertidig stoppet.",
    Icon: CircleDashed,
    tone: "text-muted-foreground",
    ring: "ring-border",
  },
  stuck: {
    label: "Fast",
    description: "Et trinn har stanset. Prøv igjen eller be om hjelp.",
    Icon: AlertTriangle,
    tone: "text-foreground",
    ring: "ring-border",
  },
  completed: {
    label: "Fullført",
    description: "Reisen er gjennomført.",
    Icon: CheckCircle2,
    tone: "text-foreground",
    ring: "ring-foreground/10",
  },
  failed: {
    label: "Feilet",
    description: "Reisen stoppet på grunn av en feil.",
    Icon: XCircle,
    tone: "text-destructive",
    ring: "ring-destructive/20",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Fjernkontroll({ journeyVersionId, runId, className }: FjernkontrollProps) {
  const prefersReducedMotion = useReducedMotion();
  const machine = useFjernkontrollMachine({
    initialState: runId ? "running" : "idle",
  });
  const { snapshot, start, pause, resume, retry } = machine;

  const [ir, setIr] = useState<JourneyIR | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep the latest handlers accessible inside the realtime callback
  // without forcing the channel to re-subscribe on every render.
  const machineRef = useRef(machine);
  useEffect(() => {
    machineRef.current = machine;
  }, [machine]);

  // ---- Load IR (client-side, RLS-scoped) ----
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("journey_version")
        .select("ir_json")
        .eq("journey_version_id", journeyVersionId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadError(error?.message ?? "Fant ikke reisen.");
        return;
      }
      const parsed = JourneyIRSchema.safeParse(data.ir_json);
      if (!parsed.success) {
        setLoadError("JourneyIR er ugyldig — kan ikke starte kjøring.");
        return;
      }
      setIr(parsed.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyVersionId]);

  // ---- Subscribe to engine_event realtime for journey.stuck ----
  useEffect(() => {
    if (!runId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`journey-run:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "engine_event",
          // engine_event has no entity_id column; run_id lives inside payload (JSONB).
          // Realtime filter only supports top-level columns, so we prefix-match event_type
          // and narrow to this run_id client-side.
          filter: `event_type=like.journey.%`,
        },
        (event) => {
          const row = event.new as Record<string, unknown> | undefined;
          const eventType = row?.event_type as string | undefined;
          const props = (row?.payload ?? {}) as Record<string, unknown>;
          if (props.run_id !== runId) return;
          if (eventType === "journey.stuck") {
            machineRef.current.markStuck(props.step_key as string | undefined);
          } else if (eventType === "journey.completed") {
            machineRef.current.markCompleted();
          } else if (eventType === "journey.run_failed") {
            machineRef.current.markFailed(props.error_code as string | undefined);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [runId]);

  // ---- Derive per-step status from the state machine snapshot ----
  const stepStatuses = useMemo<StepStatus[]>(() => {
    if (!ir) return [];
    return ir.steps.map((_step: JourneyIRStep, idx: number) => {
      if (snapshot.state === "idle") return "pending";
      if (snapshot.state === "completed") return "completed";
      if (snapshot.state === "failed")
        return idx < snapshot.currentStepIndex ? "completed" : "failed";
      if (idx < snapshot.currentStepIndex) return "completed";
      if (idx === snapshot.currentStepIndex) {
        if (snapshot.state === "paused") return "paused";
        if (snapshot.state === "stuck") return "stuck";
        return "running";
      }
      return "pending";
    });
  }, [ir, snapshot]);

  const visual = STATE_VISUAL[snapshot.state];

  if (loadError) {
    return (
      <section
        className={cn(
          "border-border bg-background rounded-lg border p-4",
          "text-muted-foreground text-sm",
          className,
        )}
        role="alert"
      >
        {loadError}
      </section>
    );
  }

  if (!ir) {
    return (
      <section
        className={cn("border-border bg-background rounded-lg border p-4", className)}
        aria-busy
      >
        <p className="text-muted-foreground text-sm">Laster reise...</p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "border-border bg-background flex flex-col gap-4 rounded-lg border p-4 ring-1",
        visual.ring,
        className,
      )}
      aria-label={`Fjernkontroll: ${ir.title}`}
    >
      {/* Live region — announces every state transition to assistive tech. */}
      <div role="status" aria-live="polite" className="sr-only">
        Reise {ir.title}: {visual.label}. {visual.description}
      </div>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">{ir.module}</p>
          <h2 className="font-heading text-foreground truncate text-lg">{ir.title}</h2>
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={snapshot.state}
            className={cn(
              "border-border bg-muted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              visual.tone,
            )}
            initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { type: "spring", ...FJERN_SPRING }
            }
          >
            <visual.Icon className="size-3.5" aria-hidden />
            {visual.label}
          </motion.span>
        </AnimatePresence>
      </header>

      <p className="text-muted-foreground text-sm">{visual.description}</p>

      <ol className="flex flex-col gap-2">
        {ir.steps.map((step: JourneyIRStep, idx: number) => (
          <FjernkontrollStep
            key={step.key}
            index={idx}
            title={step.title}
            description={step.description ?? step.action}
            status={stepStatuses[idx] ?? "pending"}
            isCurrent={idx === snapshot.currentStepIndex && snapshot.state !== "idle"}
          />
        ))}
      </ol>

      <footer className="border-border flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-muted-foreground text-xs">
          {snapshot.currentStepIndex + 1} av {ir.steps.length}
        </p>
        <FjernkontrollActions
          state={snapshot.state}
          onStart={start}
          onPause={pause}
          onResume={resume}
          onRetry={retry}
        />
      </footer>
    </section>
  );
}
