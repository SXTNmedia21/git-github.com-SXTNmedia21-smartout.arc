/**
 * step-row.tsx — Single test result row.
 *
 * Renders a status icon, test title, and optional duration.
 * Failed rows with an error message are interactive so users can inspect
 * the failure detail in a parent-controlled callback.
 */

"use client";

import { Loader2, Check, X, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestStatus } from "../_hooks/use-e2e-runner";

type StepRowProps = {
  title: string;
  status: TestStatus;
  ms?: number;
  error?: string;
  onClickError?: (title: string, error: string) => void;
};

// Status icon — each state maps to a distinct visual so glanceability is high
function StatusIcon({ status }: { status: TestStatus }) {
  switch (status) {
    case "pending":
      return (
        <span className="text-muted-foreground flex h-4 w-4 items-center justify-center text-xs">
          ○
        </span>
      );
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-orange-400" />;
    case "pass":
      return <Check className="h-4 w-4 text-emerald-500" />;
    case "fail":
      return <X className="h-4 w-4 text-rose-500" />;
    case "skip":
      return <MinusCircle className="text-muted-foreground h-4 w-4" />;
  }
}

// Format milliseconds as a readable duration string
function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function StepRow({ title, status, ms, error, onClickError }: StepRowProps) {
  const isClickable = status === "fail" && !!error && !!onClickError;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded px-2 py-1 text-sm",
        isClickable && "hover:bg-muted/60 cursor-pointer",
        status === "running" && "bg-orange-500/5",
      )}
      onClick={isClickable ? () => onClickError(title, error) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClickError(title, error);
            }
          : undefined
      }
    >
      {/* Status icon — fixed width keeps title column aligned */}
      <span className="flex-shrink-0">
        <StatusIcon status={status} />
      </span>

      {/* Title — fills remaining space and truncates gracefully */}
      <span
        className={cn(
          "flex-1 truncate font-mono text-xs",
          status === "fail" && "text-rose-400",
          status === "skip" && "text-muted-foreground",
          status === "pass" && "text-foreground",
          status === "pending" && "text-muted-foreground",
          status === "running" && "text-orange-400",
        )}
      >
        {title}
      </span>

      {/* Duration — only shown once the test finishes */}
      {ms !== undefined && (
        <span className="text-muted-foreground flex-shrink-0 text-xs tabular-nums">
          {formatMs(ms)}
        </span>
      )}
    </div>
  );
}
