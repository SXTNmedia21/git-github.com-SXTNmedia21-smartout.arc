/**
 * use-e2e-runner.ts — Hook for managing live E2E test run state.
 *
 * Starts a Playwright run via POST /api/platform-admin/e2e/run, then opens
 * an EventSource to stream SSE events and build a live per-spec result map.
 * Consumers get reactive state without managing the SSE lifecycle themselves.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type TestStatus = "pending" | "running" | "pass" | "fail" | "skip";

export type TestResult = {
  title: string;
  status: TestStatus;
  ms?: number;
  error?: string;
};

export type SpecState = {
  tests: TestResult[];
};

export type RunSummary = {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
};

export type RunState = {
  runId: string | null;
  status: "idle" | "running" | "done";
  specs: Map<string, SpecState>;
  logs: string[];
  summary: RunSummary | null;
  error: string | null;
};

type StartRunOptions = {
  spec?: string;
  grep?: string;
  suite?: "smoke" | "full";
};

type UseE2eRunnerReturn = {
  state: RunState;
  startRun: (opts: StartRunOptions) => Promise<void>;
  isRunning: boolean;
};

// ── SSE event shapes (what the server sends) ─────────────────────────────────

type RunStartEvent = {
  type: "run_start";
  tests: Array<{ spec: string; title: string }>;
  total: number;
};

type StepStartEvent = {
  type: "step_start";
  spec: string;
  test: string;
};

type StepDoneEvent = {
  type: "step_done";
  spec: string;
  test: string;
  status: "pass" | "fail" | "skip";
  ms: number;
  error?: string;
};

type LogEvent = {
  type: "log";
  line: string;
};

type RunDoneEvent = {
  type: "run_done";
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
};

type SseEvent = RunStartEvent | StepStartEvent | StepDoneEvent | LogEvent | RunDoneEvent;

// ── Initial state factory ─────────────────────────────────────────────────────

function emptyState(): RunState {
  return {
    runId: null,
    status: "idle",
    specs: new Map(),
    logs: [],
    summary: null,
    error: null,
  };
}

const MAX_LOG_LINES = 500;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useE2eRunner(): UseE2eRunnerReturn {
  const [state, setState] = useState<RunState>(emptyState);

  // Keep an EventSource ref so we can close it on unmount or re-run
  const esRef = useRef<EventSource | null>(null);

  // Close and null-out the EventSource whenever we're done with it
  const closeStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => closeStream();
  }, [closeStream]);

  const startRun = useCallback(
    async (opts: StartRunOptions) => {
      // Don't allow a second concurrent run from the same client
      if (state.status === "running") return;

      // Reset state for the new run
      setState(emptyState());
      closeStream();

      // ── 1. POST to start the run ──────────────────────────────────────────
      let runId: string;
      try {
        const res = await fetch("/api/platform-admin/e2e/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        });

        if (res.status === 409) {
          // Another run is already active — let the user know
          const body = (await res.json().catch(() => ({}))) as { activeRunId?: string };
          setState((prev) => ({
            ...prev,
            error: `En kjøring er allerede aktiv${body.activeRunId ? ` (${body.activeRunId})` : ""}`,
          }));
          return;
        }

        if (!res.ok) {
          setState((prev) => ({ ...prev, error: `Feil ved oppstart: ${res.status}` }));
          return;
        }

        const data = (await res.json()) as { runId: string };
        runId = data.runId;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Ukjent nettverksfeil",
        }));
        return;
      }

      // Mark run as in-flight
      setState((prev) => ({ ...prev, runId, status: "running" }));

      // ── 2. Open SSE stream ────────────────────────────────────────────────
      const es = new EventSource(`/api/platform-admin/e2e/stream/${runId}`);
      esRef.current = es;

      es.onmessage = (ev: MessageEvent<string>) => {
        let event: SseEvent;
        try {
          event = JSON.parse(ev.data) as SseEvent;
        } catch {
          // Malformed line — ignore
          return;
        }

        setState((prev) => {
          // Work on a new Map so React detects the reference change
          const specs = new Map(prev.specs);

          switch (event.type) {
            case "run_start": {
              // Build the initial spec map with every test in pending state
              for (const t of event.tests) {
                const specState = specs.get(t.spec) ?? { tests: [] };
                specState.tests.push({ title: t.title, status: "pending" });
                specs.set(t.spec, { tests: [...specState.tests] });
              }
              return { ...prev, specs };
            }

            case "step_start": {
              const specState = specs.get(event.spec);
              if (specState) {
                const tests = specState.tests.map((t) =>
                  t.title === event.test ? { ...t, status: "running" as TestStatus } : t,
                );
                specs.set(event.spec, { tests });
              }
              return { ...prev, specs };
            }

            case "step_done": {
              const specState = specs.get(event.spec);
              if (specState) {
                const tests = specState.tests.map((t) =>
                  t.title === event.test
                    ? {
                        ...t,
                        status: event.status as TestStatus,
                        ms: event.ms,
                        error: event.error,
                      }
                    : t,
                );
                specs.set(event.spec, { tests });
              }
              return { ...prev, specs };
            }

            case "log": {
              const logs = [...prev.logs, event.line];
              // Keep log buffer from growing unbounded
              if (logs.length > MAX_LOG_LINES) logs.splice(0, logs.length - MAX_LOG_LINES);
              return { ...prev, logs };
            }

            case "run_done": {
              return {
                ...prev,
                status: "done",
                specs,
                summary: {
                  passed: event.passed,
                  failed: event.failed,
                  skipped: event.skipped,
                  duration: event.duration,
                },
              };
            }

            default:
              return prev;
          }
        });

        // Close the EventSource once the run is complete
        if ((event as SseEvent).type === "run_done") {
          closeStream();
        }
      };

      es.onerror = () => {
        setState((prev) => ({
          ...prev,
          status: prev.status === "done" ? "done" : "idle",
          error: prev.status === "done" ? prev.error : "Tapte tilkobling til teststrøm",
        }));
        closeStream();
      };
    },
    [state.status, closeStream],
  );

  return {
    state,
    startRun,
    isRunning: state.status === "running",
  };
}
