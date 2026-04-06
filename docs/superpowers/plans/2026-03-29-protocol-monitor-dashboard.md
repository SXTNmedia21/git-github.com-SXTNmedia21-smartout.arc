# Protocol Monitor Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only dev tool that shows real-time protocol execution progress — steps passing/failing, timing, screenshots — in a dark-themed HTML dashboard.

**Architecture:** Runner writes `progress-{id}-{ts}.json` after each step. Vanilla HTML page polls the latest progress file every 1 second. No React, no build step, no server required beyond `npx serve`. Dark monospace theme.

**Tech Stack:** Vanilla HTML + CSS + JS, file-based polling, no dependencies

**Council decisions (2026-03-29):**

- Local-only dev tool — NOT for CI
- Dark theme, monospace font, no Nordic Split tokens
- Per-run file isolation (`progress-{protocol_id}-{timestamp}.json`)
- Colored CSS dots for status (not emoji)
- Pulse animation for running state
- Click-to-expand screenshots
- Auto-scroll to running step
- Sticky header with protocol name + elapsed time

---

## File Structure

```
apps/e2e/
├── runners/
│   ├── protocol-runner.ts      ← MODIFY: call progress-writer after each step
│   └── progress-writer.ts      ← CREATE: writes progress JSON after each step
├── monitor/
│   ├── index.html              ← CREATE: dashboard UI
│   └── serve.sh                ← CREATE: one-liner to serve the dashboard
```

---

### Task 1: Progress Writer

**Files:**

- Create: `apps/e2e/runners/progress-writer.ts`

- [ ] **Step 1: Create the progress writer module**

```typescript
// apps/e2e/runners/progress-writer.ts
import * as fs from "fs";
import * as path from "path";
import type { ProtocolDefinition } from "../protocols/schema";
import type { StepResult } from "../protocols/types";

/**
 * Writes a progress JSON file after each protocol step.
 * Used by the local monitor dashboard to show real-time execution.
 *
 * Files are per-run to avoid concurrency conflicts:
 * progress-{protocol_id}-{timestamp}.json
 */

export type ProgressStep = {
  id: string;
  order: number;
  title: string;
  status: "passed" | "failed" | "skipped" | "timeout" | "running" | "pending";
  duration_ms: number | null;
  gate_type: string;
  gate_summary: string;
  screenshot: string | null;
  started_at: string | null;
};

export type ProgressFile = {
  protocol_id: string;
  protocol_name: string;
  actor: string;
  status: "running" | "passed" | "failed";
  current_step: number;
  total_steps: number;
  started_at: string;
  updated_at: string;
  elapsed_ms: number;
  steps: ProgressStep[];
};

const PROGRESS_DIR = "./test-results/protocols";

let runTimestamp: string | null = null;
let runStartTime: number | null = null;

/**
 * Initialize progress tracking for a new protocol run.
 * Call this once at the start of runProtocol().
 */
export function initProgress(protocol: ProtocolDefinition): string {
  runTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  runStartTime = Date.now();

  const progressDir = path.resolve(PROGRESS_DIR);
  fs.mkdirSync(progressDir, { recursive: true });

  const progress: ProgressFile = {
    protocol_id: protocol.id,
    protocol_name: protocol.name,
    actor: protocol.actor,
    status: "running",
    current_step: 0,
    total_steps: protocol.steps.length,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    elapsed_ms: 0,
    steps: protocol.steps.map((s) => ({
      id: s.id,
      order: s.order,
      title: s.title,
      status: "pending",
      duration_ms: null,
      gate_type: s.gate.type,
      gate_summary: formatGateSummary(s.gate),
      screenshot: null,
      started_at: null,
    })),
  };

  const filePath = getProgressPath(protocol.id);
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2), "utf-8");
  return filePath;
}

/**
 * Mark a step as "running" — call before executing actions.
 */
export function markStepRunning(protocolId: string, stepIndex: number): void {
  const progress = readProgress(protocolId);
  if (!progress) return;

  progress.current_step = stepIndex + 1;
  progress.updated_at = new Date().toISOString();
  progress.elapsed_ms = runStartTime ? Date.now() - runStartTime : 0;
  progress.steps[stepIndex].status = "running";
  progress.steps[stepIndex].started_at = new Date().toISOString();

  writeProgress(protocolId, progress);
}

/**
 * Record a completed step result — call after gate check + screenshot.
 */
export function recordStepResult(protocolId: string, stepIndex: number, result: StepResult): void {
  const progress = readProgress(protocolId);
  if (!progress) return;

  progress.updated_at = new Date().toISOString();
  progress.elapsed_ms = runStartTime ? Date.now() - runStartTime : 0;
  progress.steps[stepIndex].status = result.status;
  progress.steps[stepIndex].duration_ms = result.duration_ms;
  progress.steps[stepIndex].screenshot = result.screenshot_path;

  writeProgress(protocolId, progress);
}

/**
 * Mark the entire run as complete (passed or failed).
 */
export function finalizeProgress(protocolId: string, passed: boolean): void {
  const progress = readProgress(protocolId);
  if (!progress) return;

  progress.status = passed ? "passed" : "failed";
  progress.updated_at = new Date().toISOString();
  progress.elapsed_ms = runStartTime ? Date.now() - runStartTime : 0;

  writeProgress(protocolId, progress);
}

// ─── Internal helpers ──────────────────────────────────

function getProgressPath(protocolId: string): string {
  return path.resolve(PROGRESS_DIR, `progress-${protocolId}-${runTimestamp}.json`);
}

function readProgress(protocolId: string): ProgressFile | null {
  const filePath = getProgressPath(protocolId);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ProgressFile;
  } catch {
    return null;
  }
}

function writeProgress(protocolId: string, progress: ProgressFile): void {
  const filePath = getProgressPath(protocolId);
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2), "utf-8");
}

function formatGateSummary(gate: ProtocolDefinition["steps"][0]["gate"]): string {
  switch (gate.type) {
    case "db_record":
      return `DB: ${gate.table} where ${JSON.stringify(gate.where)}`;
    case "ui_state":
      return `UI: [${gate.testid}] ${gate.visible ? "visible" : "hidden"}`;
    case "url_match":
      return `URL: ${gate.pattern}`;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /home/sxtnl/dev/wt-3/apps/e2e && npx tsc --noEmit 2>&1 | grep progress-writer || echo "0 errors"`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/runners/progress-writer.ts
git commit -m "feat(protocol): add progress writer for live monitoring

Writes progress-{id}-{ts}.json after each step for dashboard polling.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Wire Progress Writer into Protocol Runner

**Files:**

- Modify: `apps/e2e/runners/protocol-runner.ts`

- [ ] **Step 1: Add progress writer calls to the runner**

At the top of `protocol-runner.ts`, add import:

```typescript
import {
  initProgress,
  markStepRunning,
  recordStepResult,
  finalizeProgress,
} from "./progress-writer";
```

In `runProtocol()`, add these calls:

**After viewport/colorScheme setup, before the step loop:**

```typescript
initProgress(protocol);
```

**At the start of each step iteration (before actions):**

```typescript
markStepRunning(protocol.id, i);
// where i is the step index from the for loop
```

**After recording a step result (both success and failure paths):**

```typescript
recordStepResult(protocol.id, i, stepResults[stepResults.length - 1]);
```

**After the step loop, before persistTestRun:**

```typescript
finalizeProgress(protocol.id, allPassed);
```

Note: The runner currently uses `for (const step of protocol.steps)` — change this to `for (let i = 0; i < protocol.steps.length; i++)` to have the index available, and reference `protocol.steps[i]` instead of `step`.

- [ ] **Step 2: Typecheck**

Run: `cd /home/sxtnl/dev/wt-3/apps/e2e && npx tsc --noEmit 2>&1 | grep protocol-runner || echo "0 errors"`
Expected: 0 errors

- [ ] **Step 3: Run the login smoke test to verify progress file is created**

Run: `cd /home/sxtnl/dev/wt-3/apps/e2e && SKIP_WEB_SERVER=1 SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=$(npx supabase status -o env 2>/dev/null | grep SERVICE_ROLE | cut -d'"' -f2) npx playwright test tests/protocol-login.spec.ts --project=web --reporter=list`
Expected: 1 passed + `progress-P-001-login-*.json` file in `test-results/protocols/`

- [ ] **Step 4: Verify progress file contents**

Run: `cat /home/sxtnl/dev/wt-3/apps/e2e/test-results/protocols/progress-P-001-login-*.json | head -30`
Expected: JSON with `status: "passed"`, 2 steps both `"passed"`, timing data

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/runners/protocol-runner.ts
git commit -m "feat(protocol): wire progress writer into runner loop

Progress JSON updated after each step for live dashboard monitoring.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Monitor Dashboard HTML

**Files:**

- Create: `apps/e2e/monitor/index.html`
- Create: `apps/e2e/monitor/serve.sh`

- [ ] **Step 1: Create the dashboard HTML**

```html
<!-- apps/e2e/monitor/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Protocol Monitor</title>
    <style>
      :root {
        --bg: #1a1a2e;
        --bg-card: #16213e;
        --bg-hover: #1a2744;
        --text: #e0e0e0;
        --text-dim: #8892a4;
        --green: #22c55e;
        --amber: #f59e0b;
        --red: #ef4444;
        --gray: #4b5563;
        --mono: "SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", monospace;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: var(--mono);
        background: var(--bg);
        color: var(--text);
        font-size: 13px;
        line-height: 1.6;
      }

      /* Sticky header */
      .header {
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--bg);
        border-bottom: 1px solid var(--gray);
        padding: 16px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .header h1 {
        font-size: 14px;
        font-weight: 600;
      }
      .header .protocol-id {
        color: var(--text-dim);
        font-size: 12px;
      }
      .header .elapsed {
        color: var(--text-dim);
        font-size: 12px;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .status-badge.running {
        background: rgba(245, 158, 11, 0.15);
        color: var(--amber);
      }
      .status-badge.passed {
        background: rgba(34, 197, 94, 0.15);
        color: var(--green);
      }
      .status-badge.failed {
        background: rgba(239, 68, 68, 0.15);
        color: var(--red);
      }

      /* Step list */
      .steps {
        padding: 16px 24px;
      }

      .step {
        display: grid;
        grid-template-columns: 24px 1fr 80px;
        gap: 12px;
        align-items: start;
        padding: 12px 0;
        border-bottom: 1px solid rgba(75, 85, 99, 0.3);
      }

      .step:last-child {
        border-bottom: none;
      }

      /* Status dots */
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-top: 4px;
      }

      .dot.passed {
        background: var(--green);
      }
      .dot.failed {
        background: var(--red);
      }
      .dot.timeout {
        background: var(--red);
      }
      .dot.pending {
        border: 2px solid var(--gray);
        background: transparent;
      }
      .dot.skipped {
        background: var(--gray);
        width: 10px;
        height: 2px;
        border-radius: 1px;
        margin-top: 8px;
      }

      .dot.running {
        background: var(--amber);
        animation: pulse 1.5s ease-in-out infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }

      .step-info h3 {
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 2px;
      }

      .step-info .gate {
        font-size: 11px;
        color: var(--text-dim);
        font-family: var(--mono);
      }

      .step-timing {
        text-align: right;
        font-size: 12px;
        color: var(--text-dim);
      }

      .step-timing.slow {
        color: var(--amber);
      }

      /* Screenshot thumbnail */
      .screenshot-thumb {
        width: 120px;
        height: 75px;
        object-fit: cover;
        border-radius: 4px;
        border: 1px solid var(--gray);
        margin-top: 8px;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .screenshot-thumb:hover {
        opacity: 0.8;
      }

      /* Fullscreen overlay */
      .overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.9);
        z-index: 100;
        cursor: pointer;
        align-items: center;
        justify-content: center;
      }

      .overlay.active {
        display: flex;
      }

      .overlay img {
        max-width: 95vw;
        max-height: 95vh;
        border-radius: 8px;
      }

      /* Footer timing */
      .footer {
        position: sticky;
        bottom: 0;
        background: var(--bg-card);
        border-top: 1px solid var(--gray);
        padding: 12px 24px;
        font-size: 11px;
        color: var(--text-dim);
        display: flex;
        gap: 24px;
      }

      /* Banner */
      .local-banner {
        background: rgba(245, 158, 11, 0.1);
        color: var(--amber);
        text-align: center;
        padding: 4px;
        font-size: 10px;
      }

      /* Empty state */
      .empty {
        text-align: center;
        padding: 80px 24px;
        color: var(--text-dim);
      }

      .empty h2 {
        font-size: 16px;
        margin-bottom: 8px;
        color: var(--text);
      }
    </style>
  </head>
  <body>
    <div class="local-banner">LOCAL DEVELOPMENT TOOL — not for CI</div>

    <div id="app">
      <div class="empty">
        <h2>Protocol Monitor</h2>
        <p>Waiting for protocol run...</p>
        <p style="margin-top: 8px; font-size: 11px;">Run: pnpm --filter e2e test:protocol</p>
      </div>
    </div>

    <div class="overlay" id="overlay" onclick="this.classList.remove('active')">
      <img id="overlay-img" src="" alt="Screenshot" />
    </div>

    <script>
      const POLL_INTERVAL = 1000;
      const RESULTS_BASE = "..";
      let lastJson = "";

      async function findLatestProgress() {
        try {
          const resp = await fetch(RESULTS_BASE + "/");
          if (!resp.ok) return null;
          const html = await resp.text();
          const matches = html.match(/progress-[^"<]+\.json/g);
          if (!matches || matches.length === 0) return null;
          return matches.sort().pop();
        } catch {
          return null;
        }
      }

      async function poll() {
        const file = await findLatestProgress();
        if (!file) return;

        try {
          const resp = await fetch(RESULTS_BASE + "/" + file + "?t=" + Date.now());
          if (!resp.ok) return;
          const json = await resp.text();
          if (json === lastJson) return;
          lastJson = json;
          render(JSON.parse(json));
        } catch {
          /* ignore */
        }
      }

      function render(data) {
        document.title = `${data.status === "running" ? "⏳" : data.status === "passed" ? "✅" : "❌"} ${data.protocol_id}`;

        const passed = data.steps.filter((s) => s.status === "passed").length;
        const failed = data.steps.filter((s) => ["failed", "timeout"].includes(s.status)).length;

        let html = `
        <div class="header">
          <div class="header-left">
            <h1>${data.protocol_name}</h1>
            <span class="protocol-id">${data.protocol_id}</span>
            <span class="status-badge ${data.status}">${data.status}</span>
          </div>
          <div>
            <span class="elapsed">${(data.elapsed_ms / 1000).toFixed(1)}s</span>
            &nbsp;·&nbsp;
            <span class="elapsed">${passed}/${data.total_steps} passed</span>
            ${failed > 0 ? `&nbsp;·&nbsp;<span style="color:var(--red)">${failed} failed</span>` : ""}
          </div>
        </div>
        <div class="steps">
      `;

        for (const step of data.steps) {
          const duration =
            step.duration_ms != null ? (step.duration_ms / 1000).toFixed(1) + "s" : "";
          const isSlow = step.duration_ms != null && step.duration_ms > 10000;
          const timingClass = isSlow ? "step-timing slow" : "step-timing";

          html += `
          <div class="step" ${step.status === "running" ? 'id="running-step"' : ""}>
            <div class="dot ${step.status}"></div>
            <div class="step-info">
              <h3>${step.order}. ${step.title}</h3>
              <div class="gate">${step.gate_summary}</div>
              ${step.screenshot ? `<img class="screenshot-thumb" src="${RESULTS_BASE}/${step.screenshot.split("test-results/protocols/").pop()}" onclick="showScreenshot(this.src)" alt="Step ${step.order}">` : ""}
            </div>
            <div class="${timingClass}">
              ${step.status === "running" ? '<span style="color:var(--amber)">running...</span>' : duration}
            </div>
          </div>
        `;
        }

        html += "</div>";

        const totalMs = data.steps.reduce((sum, s) => sum + (s.duration_ms || 0), 0);
        html += `
        <div class="footer">
          <span>Total: ${(totalMs / 1000).toFixed(1)}s</span>
          <span>Steps: ${data.current_step}/${data.total_steps}</span>
          <span>Updated: ${new Date(data.updated_at).toLocaleTimeString()}</span>
        </div>
      `;

        document.getElementById("app").innerHTML = html;

        const running = document.getElementById("running-step");
        if (running) running.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      function showScreenshot(src) {
        document.getElementById("overlay-img").src = src;
        document.getElementById("overlay").classList.add("active");
      }

      setInterval(poll, POLL_INTERVAL);
      poll();
    </script>
  </body>
</html>
```

- [ ] **Step 2: Create serve script**

```bash
#!/usr/bin/env bash
# apps/e2e/monitor/serve.sh
# Serves the protocol monitor dashboard.
# Open http://localhost:3333 in your browser.
echo "Protocol Monitor: http://localhost:3333"
echo "Watching: $(cd "$(dirname "$0")/../test-results/protocols" && pwd)"
npx serve "$(dirname "$0")/../test-results/protocols" -l 3333 -s --no-clipboard
```

Make it executable: `chmod +x apps/e2e/monitor/serve.sh`

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/monitor/
git commit -m "feat(protocol): add local protocol monitor dashboard

Dark theme, monospace, vanilla HTML. Polls progress JSON every 1s.
Auto-scrolls to running step. Click-to-expand screenshots.
Local dev tool only — not for CI.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add monitor script to package.json

**Files:**

- Modify: `apps/e2e/package.json`

- [ ] **Step 1: Add monitor script**

Add to the `scripts` section:

```json
"monitor": "bash ./monitor/serve.sh"
```

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/package.json
git commit -m "chore(protocol): add monitor script to package.json

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | What                | Files    | Est.   |
| ---- | ------------------- | -------- | ------ |
| 1    | Progress writer     | 1 create | 5 min  |
| 2    | Wire into runner    | 1 modify | 5 min  |
| 3    | Dashboard HTML      | 2 create | 10 min |
| 4    | Package.json script | 1 modify | 2 min  |

**Total: 4 tasks, ~22 minutes**

**Usage after implementation:**

```bash
# Terminal 1: Run protocols
pnpm --filter e2e test:protocol

# Terminal 2: Watch live
pnpm --filter e2e monitor
# Open http://localhost:3333
```

**Note:** The dashboard reads from `test-results/protocols/` which is gitignored. The HTML and serve script ARE committed — the data they display is not.
