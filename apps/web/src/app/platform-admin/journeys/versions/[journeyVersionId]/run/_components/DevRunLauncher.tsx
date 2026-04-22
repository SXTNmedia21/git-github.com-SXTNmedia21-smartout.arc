// apps/web/src/app/platform-admin/journeys/versions/[journeyVersionId]/run/_components/DevRunLauncher.tsx
//
// DevRunLauncher — client wrapper that owns the Start-click → Server Action →
// runId hand-off, then renders the Fjernkontroll with the resulting run id.
//
// WHY a separate component:
//   - Fjernkontroll is the runtime UI (state machine + realtime subscription).
//     It accepts a `runId?: string` prop; when set, it subscribes to engine_event
//     rows filtered by that run. Wrapping Fjernkontroll lets us own the "start
//     a run" side effect without changing the runtime component.
//   - The admin test-run page stays a Server Component — only this launcher
//     needs `"use client"`.
//
// FLOW:
//   1. Initial render → Fjernkontroll(idle) + "Start test-kjøring" button.
//   2. Click → startDevRunAction({journeyVersionId}).
//   3. Button disabled while in flight (prevents double-dispatch).
//   4. On success → store runId + pass to Fjernkontroll, which triggers its
//      engine_event realtime subscription. The Fjernkontroll internal state
//      machine starts in `running` when a runId is present.
//   5. On error → surface the reason inline; the Fjernkontroll remains in idle.
//
// Nordic Split tokens only (R5.1-4):
//   bg-foreground / text-background for primary; text-destructive for errors.
//   Button height h-11 = 44pt minimum touch target.

"use client";

import { useState, useTransition } from "react";
import { Play, AlertCircle, Loader2 } from "lucide-react";
import { Fjernkontroll } from "@/components/journey/Fjernkontroll";
import { cn } from "@/lib/utils";
import { startDevRunAction } from "../actions/start-dev-run";

export type DevRunLauncherProps = {
  journeyVersionId: string;
};

export function DevRunLauncher({ journeyVersionId }: DevRunLauncherProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      const result = await startDevRunAction({ journeyVersionId });
      if (result.ok) {
        setRunId(result.runId);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Start control — hidden once a run is live; restart is exposed
          via Fjernkontroll's own terminal-state buttons. */}
      {!runId && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={isPending}
            data-testid="start-dev-run"
            className={cn(
              "bg-foreground text-background hover:bg-foreground/90",
              "inline-flex h-11 w-fit items-center gap-2 rounded-md px-4 text-sm font-medium",
              "focus-visible:ring-foreground/40 focus-visible:ring-2 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-50",
              "transition-opacity",
            )}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
            {isPending ? "Starter..." : "Start test-kjøring"}
          </button>

          {error && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/5 text-destructive inline-flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 flex-shrink-0" aria-hidden />
              <span className="font-mono text-xs">{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Fjernkontroll — idle when runId is null, subscribes + running when set.
          The component is keyed on runId so switching in a new run_id cleanly
          remounts the machine + subscription. */}
      <Fjernkontroll
        key={runId ?? "idle"}
        journeyVersionId={journeyVersionId}
        runId={runId ?? undefined}
      />
    </div>
  );
}
