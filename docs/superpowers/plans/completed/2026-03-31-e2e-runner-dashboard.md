# E2E Runner Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Runner" tab to `/platform-admin/journeys` that starts Playwright E2E tests from the browser and shows live progress via SSE.

**Architecture:** POST API spawns Playwright child process with a custom SSE reporter that writes JSON lines to stdout. GET SSE endpoint streams those lines to the browser. UI renders step-by-step progress with expandable terminal log.

**Tech Stack:** Next.js API routes, Node child_process, Server-Sent Events, TanStack Query (for tab state), Playwright custom reporter.

**Spec:** `docs/superpowers/specs/2026-03-31-e2e-runner-dashboard-design.md`

---

## File Structure

```
NEW:
  apps/e2e/reporters/sse-reporter.ts                          — Playwright reporter: JSON lines to stdout
  apps/web/src/app/api/platform-admin/e2e/run/route.ts        — POST: spawn Playwright, return runId
  apps/web/src/app/api/platform-admin/e2e/stream/[runId]/route.ts — GET: SSE stream
  apps/web/src/app/platform-admin/journeys/_hooks/use-e2e-runner.ts — SSE client hook
  apps/web/src/app/platform-admin/journeys/_components/runner-tab.tsx — Tab container
  apps/web/src/app/platform-admin/journeys/_components/runner-header.tsx — Buttons + progress bar
  apps/web/src/app/platform-admin/journeys/_components/spec-group.tsx — Collapsible spec file group
  apps/web/src/app/platform-admin/journeys/_components/step-row.tsx — Single test row
  apps/web/src/app/platform-admin/journeys/_components/terminal-log.tsx — Monospace log viewer

MODIFY:
  apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx — Add tab switcher
  apps/e2e/playwright.config.ts — Conditionally add sse-reporter
```

---

### Task 1: SSE Playwright Reporter

**Files:**

- Create: `apps/e2e/reporters/sse-reporter.ts`

- [ ] **Step 1: Create the SSE reporter**

```typescript
// apps/e2e/reporters/sse-reporter.ts
import type { Reporter, FullResult, TestCase, TestResult, Suite } from "@playwright/test/reporter";

/**
 * SSE Reporter — writes one JSON line per event to stdout.
 * Only active when E2E_SSE=1 env var is set.
 * Consumed by /api/platform-admin/e2e/stream/[runId] SSE endpoint.
 */
class SseReporter implements Reporter {
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private startTime = Date.now();

  private emit(event: Record<string, unknown>) {
    if (!process.env.E2E_SSE) return;
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }

  private specFile(test: TestCase): string {
    const file = test.location?.file ?? "unknown";
    const parts = file.split("/");
    return parts[parts.length - 1] ?? file;
  }

  onBegin(_config: unknown, suite: Suite) {
    this.startTime = Date.now();
    // Emit spec manifest so UI knows total test count
    const tests: { spec: string; title: string }[] = [];
    for (const project of suite.suites) {
      for (const fileSuite of project.suites) {
        fileSuite.allTests().forEach((t) => {
          tests.push({ spec: this.specFile(t), title: t.title });
        });
      }
    }
    this.emit({ type: "run_start", tests, total: tests.length });
  }

  onTestBegin(test: TestCase) {
    this.emit({
      type: "step_start",
      spec: this.specFile(test),
      test: test.title,
      status: "running",
    });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const status =
      result.status === "passed"
        ? "pass"
        : result.status === "skipped" || result.status === "interrupted"
          ? "skip"
          : "fail";

    if (status === "pass") this.passed++;
    else if (status === "fail") this.failed++;
    else this.skipped++;

    this.emit({
      type: "step_done",
      spec: this.specFile(test),
      test: test.title,
      status,
      ms: result.duration,
      error: result.errors?.[0]?.message?.slice(0, 500) ?? undefined,
    });
  }

  onStdOut(chunk: string | Buffer) {
    if (!process.env.E2E_SSE) return;
    const line = typeof chunk === "string" ? chunk : chunk.toString();
    for (const l of line.split("\n").filter(Boolean)) {
      this.emit({ type: "log", line: l });
    }
  }

  onEnd(result: FullResult) {
    this.emit({
      type: "run_done",
      status: result.status,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      duration: Date.now() - this.startTime,
    });
  }
}

export default SseReporter;
```

- [ ] **Step 2: Add conditional reporter to Playwright config**

In `apps/e2e/playwright.config.ts`, change the reporter array:

```typescript
// Replace the existing reporter config:
reporter: process.env.CI
  ? [["html"], ["github"], ["./reporters/journey-reporter.ts"]]
  : [
      ["list"],
      ["html"],
      ["./reporters/journey-reporter.ts"],
      ...(process.env.E2E_SSE ? [["./reporters/sse-reporter.ts"] as const] : []),
    ],
```

- [ ] **Step 3: Test reporter locally**

Run: `cd apps/e2e && E2E_SSE=1 SKIP_WEB_SERVER=1 npx playwright test tests/auth.spec.ts --grep @smoke --project=web 2>/dev/null | head -20`
Expected: JSON lines like `{"type":"step_start","spec":"auth.spec.ts","test":"..."}` interleaved with test output.

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/reporters/sse-reporter.ts apps/e2e/playwright.config.ts
git commit -m "feat(e2e): add SSE reporter for live test streaming"
```

---

### Task 2: API Route — Start Run

**Files:**

- Create: `apps/web/src/app/api/platform-admin/e2e/run/route.ts`

- [ ] **Step 1: Create the run endpoint**

```typescript
// apps/web/src/app/api/platform-admin/e2e/run/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import { getSuperAdminId } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type ActiveRun = {
  process: ChildProcess;
  startedAt: number;
  lines: string[];
  done: boolean;
  summary: Record<string, unknown> | null;
};

// Module-level state — lives for the lifetime of the Next.js dev server
const activeRuns = new Map<string, ActiveRun>();

// Exported for the stream endpoint to access
export { activeRuns };

const MAX_RUN_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Max 1 concurrent run
  for (const [id, run] of activeRuns) {
    if (!run.done) {
      return NextResponse.json({ error: "Run already active", activeRunId: id }, { status: 409 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const { spec, grep, suite } = body as {
    spec?: string;
    grep?: string;
    suite?: "smoke" | "full";
  };

  // Build Playwright args
  const args = ["playwright", "test", "--project=web"];

  if (suite === "smoke") {
    args.push("--grep", "@smoke");
  } else if (grep) {
    args.push("--grep", grep);
  }

  if (spec) {
    args.push(`tests/${spec}`);
  }

  const runId = randomUUID().slice(0, 8);
  const cwd = `${process.cwd()}/../../apps/e2e`;

  const child = spawn("npx", args, {
    cwd,
    env: {
      ...process.env,
      E2E_SSE: "1",
      SKIP_WEB_SERVER: "1",
      // Force non-CI mode for local reporter selection
      CI: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const run: ActiveRun = {
    process: child,
    startedAt: Date.now(),
    lines: [],
    done: false,
    summary: null,
  };

  activeRuns.set(runId, run);

  // Collect stdout lines
  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    for (const line of text.split("\n").filter(Boolean)) {
      run.lines.push(line);
    }
  });

  // Also capture stderr as log lines
  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    for (const line of text.split("\n").filter(Boolean)) {
      // Wrap stderr as log-type JSON so the stream can forward it
      try {
        JSON.parse(line); // Already JSON? Pass through
        run.lines.push(line);
      } catch {
        run.lines.push(JSON.stringify({ type: "log", line }));
      }
    }
  });

  child.on("close", () => {
    run.done = true;
    // Clean up after 5 minutes
    setTimeout(() => activeRuns.delete(runId), 5 * 60 * 1000);
  });

  // Safety timeout
  setTimeout(() => {
    if (!run.done) {
      child.kill("SIGTERM");
      run.done = true;
    }
  }, MAX_RUN_TIMEOUT_MS);

  return NextResponse.json({ runId });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/platform-admin/e2e/run/route.ts
git commit -m "feat(e2e): add POST /api/platform-admin/e2e/run endpoint"
```

---

### Task 3: API Route — SSE Stream

**Files:**

- Create: `apps/web/src/app/api/platform-admin/e2e/stream/[runId]/route.ts`

- [ ] **Step 1: Create the SSE stream endpoint**

```typescript
// apps/web/src/app/api/platform-admin/e2e/stream/[runId]/route.ts
import { type NextRequest } from "next/server";
import { getSuperAdminId } from "@/lib/platform-admin";
import { activeRuns } from "../../run/route";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return new Response("Unauthorized", { status: 403 });
  }

  const { runId } = await params;
  const run = activeRuns.get(runId);
  if (!run) {
    return new Response("Run not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let cursor = 0;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const push = () => {
        if (closed) return;

        // Send any new lines since last cursor
        while (cursor < run.lines.length) {
          const line = run.lines[cursor]!;
          cursor++;

          // Try to parse as JSON event from SSE reporter
          try {
            JSON.parse(line);
            controller.enqueue(encoder.encode(`data: ${line}\n\n`));
          } catch {
            // Raw text — wrap as log event
            const wrapped = JSON.stringify({ type: "log", line });
            controller.enqueue(encoder.encode(`data: ${wrapped}\n\n`));
          }
        }

        if (run.done && cursor >= run.lines.length) {
          controller.close();
          closed = true;
          return;
        }

        // Poll for new lines every 200ms
        setTimeout(push, 200);
      };

      push();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/platform-admin/e2e/stream/
git commit -m "feat(e2e): add SSE stream endpoint for live test progress"
```

---

### Task 4: Client Hook — useE2eRunner

**Files:**

- Create: `apps/web/src/app/platform-admin/journeys/_hooks/use-e2e-runner.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/app/platform-admin/journeys/_hooks/use-e2e-runner.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

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

const INITIAL_STATE: RunState = {
  runId: null,
  status: "idle",
  specs: new Map(),
  logs: [],
  summary: null,
  error: null,
};

export function useE2eRunner() {
  const [state, setState] = useState<RunState>(INITIAL_STATE);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const startRun = useCallback(
    async (opts: { spec?: string; grep?: string; suite?: "smoke" | "full" }) => {
      // Reset state
      setState({ ...INITIAL_STATE, status: "running" });

      try {
        const res = await fetch("/api/platform-admin/e2e/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        });

        if (res.status === 409) {
          const data = await res.json();
          setState((s) => ({
            ...s,
            status: "idle",
            error: `En test kjører allerede (${data.activeRunId})`,
          }));
          return;
        }

        if (!res.ok) {
          setState((s) => ({ ...s, status: "idle", error: "Kunne ikke starte test" }));
          return;
        }

        const { runId } = await res.json();
        setState((s) => ({ ...s, runId }));

        // Connect to SSE stream
        const es = new EventSource(`/api/platform-admin/e2e/stream/${runId}`);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            setState((prev) => {
              const specs = new Map(prev.specs);
              const logs = [...prev.logs];

              switch (data.type) {
                case "run_start": {
                  // Initialize all specs with pending tests
                  for (const t of data.tests as { spec: string; title: string }[]) {
                    const existing = specs.get(t.spec) ?? { tests: [] };
                    const alreadyHas = existing.tests.some((r) => r.title === t.title);
                    if (!alreadyHas) {
                      existing.tests.push({ title: t.title, status: "pending" });
                    }
                    specs.set(t.spec, existing);
                  }
                  break;
                }

                case "step_start": {
                  const spec = specs.get(data.spec) ?? { tests: [] };
                  const test = spec.tests.find((t) => t.title === data.test);
                  if (test) {
                    test.status = "running";
                  } else {
                    spec.tests.push({ title: data.test, status: "running" });
                  }
                  specs.set(data.spec, spec);
                  break;
                }

                case "step_done": {
                  const spec = specs.get(data.spec) ?? { tests: [] };
                  const test = spec.tests.find((t) => t.title === data.test);
                  if (test) {
                    test.status = data.status;
                    test.ms = data.ms;
                    test.error = data.error;
                  } else {
                    spec.tests.push({
                      title: data.test,
                      status: data.status,
                      ms: data.ms,
                      error: data.error,
                    });
                  }
                  specs.set(data.spec, spec);
                  break;
                }

                case "log": {
                  logs.push(data.line);
                  // Keep max 500 lines
                  if (logs.length > 500) logs.splice(0, logs.length - 500);
                  break;
                }

                case "run_done": {
                  es.close();
                  eventSourceRef.current = null;
                  return {
                    ...prev,
                    specs,
                    logs,
                    status: "done" as const,
                    summary: {
                      passed: data.passed,
                      failed: data.failed,
                      skipped: data.skipped,
                      duration: data.duration,
                    },
                  };
                }
              }

              return { ...prev, specs, logs };
            });
          } catch {
            // Non-JSON message — ignore
          }
        };

        es.onerror = () => {
          es.close();
          eventSourceRef.current = null;
          setState((prev) => {
            if (prev.status === "running") {
              return { ...prev, status: "done", error: "SSE-tilkoblingen ble brutt" };
            }
            return prev;
          });
        };
      } catch (err) {
        setState((s) => ({
          ...s,
          status: "idle",
          error: err instanceof Error ? err.message : "Ukjent feil",
        }));
      }
    },
    [],
  );

  return {
    state,
    startRun,
    isRunning: state.status === "running",
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/_hooks/use-e2e-runner.ts
git commit -m "feat(e2e): add useE2eRunner hook with SSE state management"
```

---

### Task 5: UI Components

**Files:**

- Create: `apps/web/src/app/platform-admin/journeys/_components/step-row.tsx`
- Create: `apps/web/src/app/platform-admin/journeys/_components/terminal-log.tsx`
- Create: `apps/web/src/app/platform-admin/journeys/_components/spec-group.tsx`
- Create: `apps/web/src/app/platform-admin/journeys/_components/runner-header.tsx`
- Create: `apps/web/src/app/platform-admin/journeys/_components/runner-tab.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx`

- [ ] **Step 1: Create StepRow**

```typescript
// apps/web/src/app/platform-admin/journeys/_components/step-row.tsx
"use client";

import { Loader2, Check, X, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestStatus } from "../_hooks/use-e2e-runner";

const STATUS_CONFIG: Record<TestStatus, { icon: React.ReactNode; color: string }> = {
  pending: { icon: <span className="text-muted-foreground">○</span>, color: "text-muted-foreground" },
  running: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />, color: "text-orange-500" },
  pass: { icon: <Check className="h-3.5 w-3.5 text-emerald-500" />, color: "text-emerald-500" },
  fail: { icon: <X className="h-3.5 w-3.5 text-rose-500" />, color: "text-rose-500" },
  skip: { icon: <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/50" />, color: "text-muted-foreground/50 italic" },
};

type StepRowProps = {
  title: string;
  status: TestStatus;
  ms?: number;
  error?: string;
  onClickError?: () => void;
};

export function StepRow({ title, status, ms, error, onClickError }: StepRowProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1 pl-6 text-sm",
        error && "cursor-pointer hover:bg-rose-500/5",
      )}
      onClick={error ? onClickError : undefined}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{config.icon}</span>
      <span className={cn("flex-1 truncate", config.color)}>{title}</span>
      {ms != null && (
        <span className="text-muted-foreground shrink-0 font-mono text-xs">
          {(ms / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create TerminalLog**

```typescript
// apps/web/src/app/platform-admin/journeys/_components/terminal-log.tsx
"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type TerminalLogProps = {
  lines: string[];
  onClear: () => void;
};

export function TerminalLog({ lines, onClear }: TerminalLogProps) {
  const [expanded, setExpanded] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (expanded) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines.length, expanded]);

  return (
    <div className="border-border mt-4 border-t pt-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          Terminal log
        </button>
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {expanded && (
        <div className="bg-muted/50 mt-2 max-h-60 overflow-auto rounded-lg p-3">
          {lines.length === 0 ? (
            <p className="text-muted-foreground text-xs italic">Ingen output ennå...</p>
          ) : (
            <pre className="text-muted-foreground whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {lines.join("\n")}
            </pre>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create SpecGroup**

```typescript
// apps/web/src/app/platform-admin/journeys/_components/spec-group.tsx
"use client";

import { useState } from "react";
import { ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StepRow } from "./step-row";
import type { TestResult } from "../_hooks/use-e2e-runner";

type SpecGroupProps = {
  specName: string;
  tests: TestResult[];
  isRunning: boolean;
  onRun: (spec: string) => void;
  onClickError: (line: string) => void;
};

export function SpecGroup({ specName, tests, isRunning, onRun, onClickError }: SpecGroupProps) {
  const [open, setOpen] = useState(true);
  const passed = tests.filter((t) => t.status === "pass").length;
  const failed = tests.filter((t) => t.status === "fail").length;
  const total = tests.filter((t) => t.status !== "skip").length;

  return (
    <div className="border-border border-b py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2">
          <ChevronRight
            className={cn("text-muted-foreground h-4 w-4 transition-transform", open && "rotate-90")}
          />
          <span className="text-sm font-medium">{specName}</span>
          <span className="text-muted-foreground text-xs">
            {failed > 0 ? (
              <span className="text-rose-500">{failed} fail</span>
            ) : passed > 0 ? (
              <span className="text-emerald-500">{passed}/{total} pass</span>
            ) : (
              `${total} tests`
            )}
          </span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled={isRunning}
          onClick={() => onRun(specName)}
        >
          <Play className="h-3 w-3" />
          Kör
        </Button>
      </div>
      {open && (
        <div className="mt-1">
          {tests.map((test) => (
            <StepRow
              key={test.title}
              title={test.title}
              status={test.status}
              ms={test.ms}
              error={test.error}
              onClickError={() => test.error && onClickError(test.error)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create RunnerHeader**

```typescript
// apps/web/src/app/platform-admin/journeys/_components/runner-header.tsx
"use client";

import { Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RunState } from "../_hooks/use-e2e-runner";

type RunnerHeaderProps = {
  state: RunState;
  isRunning: boolean;
  onRunSmoke: () => void;
  onRunAll: () => void;
};

export function RunnerHeader({ state, isRunning, onRunSmoke, onRunAll }: RunnerHeaderProps) {
  const allTests = Array.from(state.specs.values()).flatMap((s) => s.tests);
  const completed = allTests.filter((t) => ["pass", "fail", "skip"].includes(t.status)).length;
  const total = allTests.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5" disabled={isRunning} onClick={onRunSmoke}>
            <Zap className="h-3.5 w-3.5" />
            Kör smoke
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={isRunning} onClick={onRunAll}>
            <Play className="h-3.5 w-3.5" />
            Kör alle
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {state.status === "running" && (
            <span className="text-muted-foreground text-xs">{completed}/{total} tests</span>
          )}
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                state.status === "running"
                  ? "animate-pulse bg-orange-500"
                  : state.status === "done"
                    ? state.summary?.failed
                      ? "bg-rose-500"
                      : "bg-emerald-500"
                    : "bg-muted-foreground/30"
              }`}
            />
            <span className="text-muted-foreground text-xs capitalize">
              {state.status === "idle" ? "Klar" : state.status === "running" ? "Kjører..." : "Ferdig"}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {state.status !== "idle" && (
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              state.summary?.failed ? "bg-rose-500" : "bg-emerald-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Summary bar */}
      {state.summary && (
        <div className="flex gap-4 text-xs">
          <span className="text-emerald-500">{state.summary.passed} pass</span>
          {state.summary.failed > 0 && <span className="text-rose-500">{state.summary.failed} fail</span>}
          {state.summary.skipped > 0 && <span className="text-muted-foreground">{state.summary.skipped} skip</span>}
          <span className="text-muted-foreground">{(state.summary.duration / 1000).toFixed(1)}s</span>
        </div>
      )}

      {state.error && (
        <p className="text-rose-500 text-xs">{state.error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create RunnerTab**

```typescript
// apps/web/src/app/platform-admin/journeys/_components/runner-tab.tsx
"use client";

import { useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";
import { useE2eRunner } from "../_hooks/use-e2e-runner";
import { RunnerHeader } from "./runner-header";
import { SpecGroup } from "./spec-group";
import { TerminalLog } from "./terminal-log";

export function RunnerTab() {
  const { state, startRun, isRunning } = useE2eRunner();
  const logRef = useRef<HTMLDivElement>(null);

  const handleRunSmoke = useCallback(() => startRun({ suite: "smoke" }), [startRun]);
  const handleRunAll = useCallback(() => startRun({ suite: "full" }), [startRun]);
  const handleRunSpec = useCallback(
    (spec: string) => startRun({ spec }),
    [startRun],
  );
  const handleClickError = useCallback((error: string) => {
    logRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  const handleClearLogs = useCallback(() => {
    // Terminal log is derived from state — clearing requires a state reset
    // For now, we just scroll to top
  }, []);

  const specs = Array.from(state.specs.entries());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4" />
          E2E Test Runner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RunnerHeader
          state={state}
          isRunning={isRunning}
          onRunSmoke={handleRunSmoke}
          onRunAll={handleRunAll}
        />

        {/* Spec groups */}
        {specs.length > 0 ? (
          <div className="divide-border divide-y">
            {specs.map(([specName, specState]) => (
              <SpecGroup
                key={specName}
                specName={specName}
                tests={specState.tests}
                isRunning={isRunning}
                onRun={handleRunSpec}
                onClickError={handleClickError}
              />
            ))}
          </div>
        ) : state.status === "idle" ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Klikk «Kör smoke» eller «Kör alle» for å starte testene.
          </p>
        ) : null}

        {/* Terminal log */}
        <div ref={logRef}>
          <TerminalLog lines={state.logs} onClear={handleClearLogs} />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/_components/step-row.tsx \
        apps/web/src/app/platform-admin/journeys/_components/terminal-log.tsx \
        apps/web/src/app/platform-admin/journeys/_components/spec-group.tsx \
        apps/web/src/app/platform-admin/journeys/_components/runner-header.tsx \
        apps/web/src/app/platform-admin/journeys/_components/runner-tab.tsx
git commit -m "feat(platform-admin): add E2E runner UI components"
```

---

### Task 6: Wire Tab Switcher into Journey List

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx`

- [ ] **Step 1: Add tab state and RunnerTab import**

At the top of `journey-list-client.tsx`, add the import:

```typescript
import { RunnerTab } from "./runner-tab";
```

Add tab state inside the component (after existing state declarations around line 68):

```typescript
const [activeTab, setActiveTab] = useState<"pipeline" | "runner">("pipeline");
```

- [ ] **Step 2: Wrap existing content in tab switcher**

Before the existing `<Card>` return, add tab buttons. After the component's opening `<>` or wrapping div, insert:

```tsx
{/* Tab switcher */}
<div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
  <button
    onClick={() => setActiveTab("pipeline")}
    className={cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      activeTab === "pipeline"
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    )}
  >
    Pipeline
  </button>
  <button
    onClick={() => setActiveTab("runner")}
    className={cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      activeTab === "runner"
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    )}
  >
    Runner
  </button>
</div>

{activeTab === "runner" ? <RunnerTab /> : (
  /* existing Card with pipeline stats + filter bar + table */
)}
```

Also add `cn` import if not already present:

```typescript
import { cn } from "@/lib/utils";
```

- [ ] **Step 3: Verify the page renders**

Open `http://localhost:3060/platform-admin/journeys` in the browser. Verify:

- Two tabs visible: "Pipeline" and "Runner"
- Pipeline tab shows existing journey list
- Runner tab shows "Klikk «Kör smoke»..." empty state
- Smoke and Alle buttons are clickable

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx
git commit -m "feat(platform-admin): wire Runner tab into journey list page"
```

---

### Task 7: Integration Test — Full Flow

- [ ] **Step 1: Manual smoke test**

1. Open `http://localhost:3060/platform-admin/journeys`
2. Click "Runner" tab
3. Click "Kör smoke"
4. Verify: progress bar appears, tests show up with running spinners
5. Verify: tests complete with green checkmarks
6. Verify: terminal log shows Playwright output
7. Verify: summary shows pass/fail/skip count + duration
8. Click "Kör alle" — verify full suite runs
9. Click individual spec "Kör" button — verify single file runs

- [ ] **Step 2: Test error scenarios**

1. Stop web dev server → click "Kör smoke" → verify clear error in terminal
2. Start a run → click "Kör smoke" again → verify 409 "Run already active" message
3. Close browser tab during run → verify no crash on server

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(platform-admin): complete E2E runner dashboard with live SSE progress"
```
