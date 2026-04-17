---
title: strike-mcp Phase 1 — Multi-agent tmux execution guide
status: in_progress
created: 2026-04-07
updated: 2026-04-07
module: strike-mcp
tags: [execution, tmux, parallel, phase-1]
---

# strike-mcp Phase 1 — Multi-agent tmux execution guide

This is the handoff from planning to execution. The plan is at `docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md` — it has the full text of all 11 tasks including exact code. This guide tells you **how to run the plan in parallel tmux sessions with multiple Claude Code instances**.

## Why tmux + multi-agent

Running 11 tasks sequentially in one Claude Code session is slow and burns context. By splitting independent tasks across parallel tmux sessions (each running its own Claude Code instance), we get:

- Isolation — each worker has a fresh context focused on one task
- Parallelism — independent tasks run at wall-clock speed
- Resumability — if a worker dies, the others keep going

## Dependency graph

```
Task 1 (pnpm init)                  ✅ DONE (commit 380994d)
   │
   ├── Task 2 (logger)               ┐
   ├── Task 3 (config)               │  BATCH A — 4 parallel workers
   ├── Task 4 (errors + types)       │
   └── Task 7 (entities)             ┘
        │
        ▼
   Task 5 (listType)                 BATCH B — 1 worker
        │
        ▼
   Task 6 (listAll)                  BATCH C — 1 worker
        │
        ├── Task 8 (list_workspaces) ┐
        └── Task 9 (inspect_ws)      ┘  BATCH D — 2 parallel workers
        │
        ▼
   Task 10 (server entry)            BATCH E — 1 worker
        │
        ▼
   Task 11 (smoke test docs)         BATCH F — 1 worker
```

## Assumptions

- `main` branch exists in `~/dev/strike-mcp/` with Task 1's commit `380994d`
- `node_modules/` already populated in main repo
- You're on a machine with tmux installed
- You can spawn Claude Code in tmux with `claude` command (or however you launch it)

---

## Batch A — Foundation parallel workers

### Step A.1: Create 4 worktrees from main

Run this once in any shell:

```bash
cd ~/dev/strike-mcp

# Create branches and worktrees for all 4 parallel workers
for name in logger config errors entities; do
  git branch "batch-a-$name" main
  git worktree add "../strike-mcp-$name" "batch-a-$name"
done

# Install node_modules in each (fast, pnpm links from store)
for name in logger config errors entities; do
  (cd "../strike-mcp-$name" && pnpm install)
done

git worktree list
```

Expected output: five entries — main repo + 4 worktrees.

### Step A.2: Open 4 tmux sessions, one per worker

```bash
tmux new-session -d -s strike-logger   -c ~/dev/strike-mcp-logger
tmux new-session -d -s strike-config   -c ~/dev/strike-mcp-config
tmux new-session -d -s strike-errors   -c ~/dev/strike-mcp-errors
tmux new-session -d -s strike-entities -c ~/dev/strike-mcp-entities

tmux list-sessions
```

### Step A.3: In each tmux session, launch Claude Code and paste the matching prompt

**Attach to each session with `tmux attach -t <name>`**, launch Claude Code, then paste the prompt for that session. Prompts are below. Each prompt is self-contained — the worker does not need to read any other file except maybe `docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md` for broader context.

---

### Prompt A.1 — strike-logger worker (Task 2)

Paste this into Claude Code running in `~/dev/strike-mcp-logger/` on branch `batch-a-logger`:

````
You are implementing Task 2 of the strike-mcp Phase 1 plan in this worktree.

## Context

- Working directory: ~/dev/strike-mcp-logger (a worktree of strike-mcp)
- Branch: batch-a-logger
- strike-mcp is a TypeScript MCP server. See docs/superpowers/specs/2026-04-07-strike-mcp-design.md for the design.
- Task 1 (package init) is already done on main. Your job is Task 2 only.
- When done, commit and stop. A human will merge your branch back to main.

## Critical rule

The MCP protocol owns stdout for stdio transport. Any stray console.log corrupts JSON-RPC framing and the server silently breaks. The logger MUST write only to stderr. This is load-bearing — do not use console.log anywhere.

## Task 2: Logger utility (stderr-only)

**Files to create:**
- src/logger.ts
- tests/logger.test.ts

### Step 1: Write the failing test

Create tests/logger.test.ts:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "../src/logger.js";

describe("logger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it("writes info messages to stderr, not stdout", () => {
    const log = createLogger("test");
    log.info("hello");
    expect(stderrSpy).toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("includes the scope name in the output", () => {
    const log = createLogger("bubble-client");
    log.info("fetching");
    const call = stderrSpy.mock.calls[0]?.[0]?.toString() ?? "";
    expect(call).toContain("bubble-client");
    expect(call).toContain("fetching");
  });

  it("serializes structured fields", () => {
    const log = createLogger("test");
    log.info("event", { count: 42, name: "alpha" });
    const call = stderrSpy.mock.calls[0]?.[0]?.toString() ?? "";
    expect(call).toContain("count=42");
    expect(call).toContain('name="alpha"');
  });

  it("has warn and error methods that also go to stderr", () => {
    const log = createLogger("test");
    log.warn("careful");
    log.error("broken");
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
```

### Step 2: Run the test to verify it fails

Run: pnpm test
Expected: FAIL — "Cannot find module '../src/logger.js'"

### Step 3: Implement the logger

Create src/logger.ts:

```ts
type Level = "info" | "warn" | "error";

type Fields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

function formatFields(fields?: Fields): string {
  if (!fields) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      parts.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    } else {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function write(level: Level, scope: string, message: string, fields?: Fields): void {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${level.toUpperCase()} [${scope}] ${message}${formatFields(fields)}\n`;
  process.stderr.write(line);
}

export function createLogger(scope: string): Logger {
  return {
    info: (message, fields) => write("info", scope, message, fields),
    warn: (message, fields) => write("warn", scope, message, fields),
    error: (message, fields) => write("error", scope, message, fields),
  };
}
```

### Step 4: Run the test to verify it passes

Run: pnpm test
Expected: all 4 logger tests pass.

### Step 5: Commit

```bash
git add -A
git commit -m "feat(logger): add stderr-only logger that never touches stdout"
```

### Step 6: Report

Report DONE with test output and commit SHA. Then stop.
````

---

### Prompt A.2 — strike-config worker (Task 3)

Paste this into Claude Code running in `~/dev/strike-mcp-config/` on branch `batch-a-config`:

````
You are implementing Task 3 of the strike-mcp Phase 1 plan in this worktree.

## Context

- Working directory: ~/dev/strike-mcp-config
- Branch: batch-a-config
- Task 1 is already done. Your job is Task 3 only (config loader).
- When done, commit and stop. A human will merge your branch back to main.

## Task 3: Config loading from environment

Env vars expected:
- BUBBLE_APP_URL — e.g. "https://smartout.bubbleapps.io"
- BUBBLE_API_TOKEN — Bearer token

**Files to create:**
- src/config.ts
- tests/config.test.ts

### Step 1: Write the failing test

Create tests/config.test.ts:

```ts
import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../src/config.js";

describe("loadConfig", () => {
  it("returns a valid config when all env vars are present", () => {
    const env = {
      BUBBLE_APP_URL: "https://smartout.bubbleapps.io",
      BUBBLE_API_TOKEN: "secret-token",
    };
    const config = loadConfig(env);
    expect(config.bubbleAppUrl).toBe("https://smartout.bubbleapps.io");
    expect(config.bubbleApiToken).toBe("secret-token");
  });

  it("strips a trailing slash from BUBBLE_APP_URL", () => {
    const env = {
      BUBBLE_APP_URL: "https://smartout.bubbleapps.io/",
      BUBBLE_API_TOKEN: "secret-token",
    };
    const config = loadConfig(env);
    expect(config.bubbleAppUrl).toBe("https://smartout.bubbleapps.io");
  });

  it("throws ConfigError when BUBBLE_APP_URL is missing", () => {
    expect(() => loadConfig({ BUBBLE_API_TOKEN: "x" })).toThrow(ConfigError);
    expect(() => loadConfig({ BUBBLE_API_TOKEN: "x" })).toThrow(/BUBBLE_APP_URL/);
  });

  it("throws ConfigError when BUBBLE_API_TOKEN is missing", () => {
    expect(() => loadConfig({ BUBBLE_APP_URL: "https://x" })).toThrow(ConfigError);
    expect(() => loadConfig({ BUBBLE_APP_URL: "https://x" })).toThrow(/BUBBLE_API_TOKEN/);
  });

  it("throws ConfigError when BUBBLE_APP_URL is not http(s)", () => {
    expect(() =>
      loadConfig({ BUBBLE_APP_URL: "smartout.bubbleapps.io", BUBBLE_API_TOKEN: "x" }),
    ).toThrow(/must start with http/);
  });
});
```

### Step 2: Run the test to verify it fails

Run: pnpm test
Expected: FAIL — module not found

### Step 3: Implement src/config.ts

```ts
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface Config {
  bubbleAppUrl: string;
  bubbleApiToken: string;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const rawUrl = env.BUBBLE_APP_URL;
  const token = env.BUBBLE_API_TOKEN;

  if (!rawUrl || rawUrl.trim() === "") {
    throw new ConfigError("BUBBLE_APP_URL environment variable is required");
  }
  if (!token || token.trim() === "") {
    throw new ConfigError("BUBBLE_API_TOKEN environment variable is required");
  }
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    throw new ConfigError("BUBBLE_APP_URL must start with http:// or https://");
  }

  const bubbleAppUrl = rawUrl.replace(/\/+$/, "");
  return { bubbleAppUrl, bubbleApiToken: token };
}
```

### Step 4: Run the test to verify it passes

Run: pnpm test
Expected: all 5 config tests pass.

### Step 5: Commit

```bash
git add -A
git commit -m "feat(config): add env-based config loader with validation"
```

### Step 6: Report

Report DONE with test output and commit SHA. Then stop.
````

---

### Prompt A.3 — strike-errors worker (Task 4)

Paste this into Claude Code running in `~/dev/strike-mcp-errors/` on branch `batch-a-errors`:

See Task 4 in `docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md` for the full text. This worker creates `src/bubble/errors.ts`, `src/bubble/types.ts`, and `tests/bubble/errors.test.ts`. The plan has exact code. When done, commit with message `feat(bubble): add typed errors and Data API response types` and stop.

**Quick paste-ready prompt:**

````
You are implementing Task 4 of strike-mcp Phase 1 in this worktree.

## Context

- Working directory: ~/dev/strike-mcp-errors
- Branch: batch-a-errors
- Task 1 done. Your job is Task 4 only.
- When done, commit and stop. A human will merge.

## Task 4: Bubble client — errors and types

Read Task 4 from docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md — it has the full text with all code blocks. Execute all steps (1-6) exactly as specified.

Files to create:
- src/bubble/errors.ts
- src/bubble/types.ts
- tests/bubble/errors.test.ts

Commit message: feat(bubble): add typed errors and Data API response types

Report DONE with test output and commit SHA when finished. Stop after reporting.
````

---

### Prompt A.4 — strike-entities worker (Task 7)

Paste this into Claude Code running in `~/dev/strike-mcp-entities/` on branch `batch-a-entities`:

````
You are implementing Task 7 of strike-mcp Phase 1 in this worktree.

## Context

- Working directory: ~/dev/strike-mcp-entities
- Branch: batch-a-entities
- Task 1 done. Your job is Task 7 only (entity registry).
- When done, commit and stop. A human will merge.

## Note on Bubble type names

The bubbleType values in the registry are PROVISIONAL — our best guess without having verified against the real Bubble schema. Phase 2 will verify and correct them. For now, use exactly the names specified in the plan.

## Task 7: Entity registry

Read Task 7 from docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md — it has the full text with all code blocks. Execute all steps (1-5) exactly as specified.

Files to create:
- src/entities.ts
- tests/entities.test.ts

Commit message: feat(entities): add entity registry as single source of truth

Report DONE with test output and commit SHA when finished. Stop after reporting.
````

---

### Step A.4: Monitor workers

In another shell:

```bash
# Watch all 4 worker branches
watch -n 5 'for d in ~/dev/strike-mcp-logger ~/dev/strike-mcp-config ~/dev/strike-mcp-errors ~/dev/strike-mcp-entities; do
  echo "=== $(basename $d) ==="
  git -C "$d" log --oneline -3
done'
```

Or attach to any session with `tmux attach -t strike-<name>` and watch the Claude Code conversation.

### Step A.5: Merge workers back to main

When all 4 workers have reported DONE:

```bash
cd ~/dev/strike-mcp

# Merge all four branches in any order (they touch different files, no conflicts expected)
git merge --no-ff batch-a-logger   -m "merge: batch-a logger worker"
git merge --no-ff batch-a-config   -m "merge: batch-a config worker"
git merge --no-ff batch-a-errors   -m "merge: batch-a errors worker"
git merge --no-ff batch-a-entities -m "merge: batch-a entities worker"

# Verify everything still builds and tests pass
pnpm install  # in case any worktree modified package.json (shouldn't have)
pnpm typecheck
pnpm test

git log --oneline
```

Expected: all tests pass, 8 commits total (1 init + 4 feat + 4 merge, or 1 init + 4 feat if fast-forward was used).

### Step A.6: Tear down Batch A worktrees and tmux sessions

```bash
cd ~/dev/strike-mcp

for name in logger config errors entities; do
  git worktree remove "../strike-mcp-$name"
  git branch -d "batch-a-$name"
done

tmux kill-session -t strike-logger
tmux kill-session -t strike-config
tmux kill-session -t strike-errors
tmux kill-session -t strike-entities
```

---

## Batch B — Task 5 (BubbleClient.listType)

Sequential. Single worker. Touches src/bubble/client.ts which depends on config.ts and errors.ts from Batch A. Run this in main repo OR a fresh worktree — your call.

Simplest path: run in main repo.

```bash
cd ~/dev/strike-mcp
# Launch Claude Code here and prompt with Task 5 from the plan
```

Prompt:

```
You are implementing Task 5 of strike-mcp Phase 1 in the main repo.
Working directory: ~/dev/strike-mcp
Batch A is already merged — config.ts, errors.ts, types.ts, logger.ts all exist.
Read Task 5 from docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md and execute all steps.
Commit message: feat(bubble): add BubbleClient.listType with auth, pagination params, typed errors
Report DONE when finished.
```

---

## Batch C — Task 6 (BubbleClient.listAll)

Same pattern as Batch B. Single worker in main repo.

Prompt:

```
You are implementing Task 6 of strike-mcp Phase 1 in the main repo.
Task 5 is already complete — src/bubble/client.ts exists with listType.
Read Task 6 from docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md — it ADDS listAll to the existing client class.
Commit message: feat(bubble): add listAll for full-collection pagination with optional cap
Report DONE when finished.
```

---

## Batch D — Tasks 8 + 9 (parallel tool workers)

Two workers touching different files (`src/tools/list_workspaces.ts` vs `src/tools/inspect_workspace.ts`). Note: inspect_workspace.ts imports ToolContext from list_workspaces.ts — so Task 8 must finish OR the worker on Task 9 must define ToolContext locally first. Simpler: run Task 8 alone first, then Task 9 alone. OR run both in parallel and accept that the Task 9 worker may need a quick fix if import fails.

Safer: run sequentially.

Prompts for sequential execution:

```
# Task 8
You are implementing Task 8 of strike-mcp Phase 1.
Read Task 8 from docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md.
Commit message: feat(tools): add list_workspaces tool with fallback name resolution
Report DONE when finished.
```

```
# Task 9 (after Task 8 is committed)
You are implementing Task 9 of strike-mcp Phase 1.
Read Task 9 from docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md.
Commit message: feat(tools): add inspect_workspace tool with per-entity error handling
Report DONE when finished.
```

---

## Batch E — Task 10 (MCP server entry)

Single worker in main repo.

```
You are implementing Task 10 of strike-mcp Phase 1.
Read Task 10 from docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md.
Commit message: feat(server): wire MCP stdio server with tool dispatch
IMPORTANT: The @modelcontextprotocol/sdk API shape may differ slightly from what the plan shows. If pnpm build fails with import errors, check node_modules/@modelcontextprotocol/sdk README for the exact import paths and adjust. Do not change behavior, only import surface.
Report DONE when finished.
```

---

## Batch F — Task 11 (smoke test docs)

Single worker. Writes docs only, no code. Ends with a MANUAL smoke test that requires real Bubble credentials from 1Password — you run that manually outside Claude Code.

```
You are implementing Task 11 of strike-mcp Phase 1.
Read Task 11 from docs/superpowers/plans/2026-04-07-strike-mcp-phase-1.md.
This task creates .mcp.json.example and appends smoke-test docs to README.
Commit message: docs: add Claude Code registration example and smoke test procedure
Do NOT run the manual smoke test (steps 3 of task) — the human will do that with real credentials.
Report DONE when finished.
```

---

## After Phase 1

When all batches are done:
1. Run the smoke test manually with real Bubble credentials (1Password: find the Bubble API token)
2. Register strike-mcp with Claude Code via .mcp.json
3. Verify list_workspaces and inspect_workspace work against production Bubble
4. If the smoke test reveals wrong Bubble type names (Task 9 errors array will show them), note them for Phase 2 to correct

Then write Plan 2 (Phase 2 — research engine) with any learnings from Phase 1 baked in.
