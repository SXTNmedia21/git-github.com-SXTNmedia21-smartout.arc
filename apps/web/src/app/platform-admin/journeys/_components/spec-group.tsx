/**
 * spec-group.tsx — Collapsible group showing all tests within a single spec file.
 *
 * The group header shows the filename and a pass/fail tally at a glance.
 * A per-spec "Kör" button lets the user re-run just this file in isolation.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StepRow } from "./step-row";
import type { TestResult } from "../_hooks/use-e2e-runner";

type SpecGroupProps = {
  filename: string;
  tests: TestResult[];
  isRunning: boolean;
  onRun: (spec: string) => void;
  onClickError?: (title: string, error: string) => void;
};

export function SpecGroup({ filename, tests, isRunning, onRun, onClickError }: SpecGroupProps) {
  // Default to expanded so progress is visible without extra clicks during a run
  const [open, setOpen] = useState(true);

  const passed = tests.filter((t) => t.status === "pass").length;
  const failed = tests.filter((t) => t.status === "fail").length;
  const total = tests.length;

  const allPassed = passed === total && total > 0;
  const hasFailed = failed > 0;

  return (
    <div className="border-border rounded-lg border">
      {/* Spec header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
          )}

          {/* Filename */}
          <span className="flex-1 truncate font-mono text-sm">{filename}</span>
        </button>

        {/* Pass/fail tally */}
        <div className="flex items-center gap-1.5 text-xs tabular-nums">
          {total > 0 && (
            <>
              <span
                className={cn(
                  "font-medium",
                  allPassed ? "text-emerald-500" : "text-muted-foreground",
                )}
              >
                {passed}/{total}
              </span>
              {hasFailed && <span className="font-medium text-rose-500">{failed} feil</span>}
            </>
          )}
        </div>

        {/* Per-spec run button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRun(filename)}
          disabled={isRunning}
          className="h-6 px-2 text-xs"
        >
          <Play className="mr-1 h-3 w-3" />
          Kör
        </Button>
      </div>

      {/* Test rows — hidden when collapsed */}
      {open && (
        <div className="border-border border-t px-2 py-1">
          {tests.map((test) => (
            <StepRow
              key={test.title}
              title={test.title}
              status={test.status}
              ms={test.ms}
              error={test.error}
              onClickError={onClickError}
            />
          ))}
        </div>
      )}
    </div>
  );
}
