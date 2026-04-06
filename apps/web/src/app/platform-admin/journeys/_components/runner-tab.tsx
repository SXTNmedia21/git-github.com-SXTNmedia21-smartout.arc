/**
 * runner-tab.tsx — Main container for the E2E test runner UI.
 *
 * Composes RunnerHeader, SpecGroups, and TerminalLog into a single panel.
 * All live state comes from useE2eRunner; this component is purely presentational.
 */

"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useE2eRunner } from "../_hooks/use-e2e-runner";
import { RunnerHeader } from "./runner-header";
import { SpecGroup } from "./spec-group";
import { TerminalLog } from "./terminal-log";

// Error detail dialog — kept inline to avoid a separate file for a small modal
function ErrorDialog({
  title,
  error,
  onClose,
}: {
  title: string;
  error: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background border-border max-w-lg rounded-lg border p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 font-medium text-rose-500">{title}</p>
        <pre className="bg-muted/50 max-h-64 overflow-auto rounded p-3 font-mono text-xs whitespace-pre-wrap">
          {error}
        </pre>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground mt-4 text-sm underline"
        >
          Lukk
        </button>
      </div>
    </div>
  );
}

export function RunnerTab() {
  const { state, startRun, isRunning } = useE2eRunner();

  // Error detail popup — clicking a failed row populates this
  const [errorDetail, setErrorDetail] = useState<{ title: string; error: string } | null>(null);

  const specEntries = [...state.specs.entries()];

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" />
            E2E Test Runner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls and status overview */}
          <RunnerHeader
            state={state}
            isRunning={isRunning}
            onRunSmoke={() => startRun({ suite: "smoke" })}
            onRunAll={() => startRun({ suite: "full" })}
          />

          {/* Empty state — prompt to start */}
          {state.status === "idle" && specEntries.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Klikk «Kör smoke» eller «Kör alle» for å starte testene.
            </p>
          )}

          {/* Per-spec result groups */}
          {specEntries.length > 0 && (
            <div className="space-y-2">
              {specEntries.map(([filename, specState]) => (
                <SpecGroup
                  key={filename}
                  filename={filename}
                  tests={specState.tests}
                  isRunning={isRunning}
                  onRun={(spec) => startRun({ spec })}
                  onClickError={(title, error) => setErrorDetail({ title, error })}
                />
              ))}
            </div>
          )}

          {/* Live log output */}
          <TerminalLog lines={state.logs} />
        </CardContent>
      </Card>

      {/* Error detail overlay */}
      {errorDetail && (
        <ErrorDialog
          title={errorDetail.title}
          error={errorDetail.error}
          onClose={() => setErrorDetail(null)}
        />
      )}
    </>
  );
}
