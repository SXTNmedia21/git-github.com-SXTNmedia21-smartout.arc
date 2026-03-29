---
title: "Plan — Journey Testing System (Fas 1)"
status: done
updated: 2026-03-03
created: 2026-03-02
module: journey
tags: [testing, e2e, playwright, implementation-plan]
---

# Journey Testing System (Fas 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable automated E2E test execution and manual guided testing for journeys, with results logged to `journey_test_run` and status transitions triggered on pass/fail.

**Architecture:** Playwright MCP provides browser control via accessibility tree snapshots. Agent reads journey definitions from DB, executes steps via Playwright, logs results. Manual tests are agent-guided chat interactions that log structured step results. Both test types gate journey status progression.

**Tech Stack:** Playwright MCP, Supabase (existing tables), Next.js API routes, React (portal UI), Zod validation

**Design doc:** `docs/plans/2026-03-01-journey-testing-system-design.md`

---

## Task 1: Database Migration — Add test_type to journey_test_run

**Files:**

- Create: `supabase/migrations/20260302000000_journey_test_type.sql`
- Modify: `packages/types/src/journey.ts`
- Modify: `packages/types/src/enums.ts`

**Context:**

- `journey_test_run` table defined in `supabase/migrations/20260301140000_journey_system.sql:106-116`
- Current schema has: `journey_test_run_id`, `journey_id`, `workspace_id`, `result`, `duration_ms`, `error_message`, `test_output`, `triggered_by`, `created_at`
- No `test_type` column exists — need to distinguish automated vs manual runs

**Step 1: Write the migration**

```sql
-- Add test_type enum and column to journey_test_run
CREATE TYPE journey_test_type AS ENUM ('automated', 'manual');

ALTER TABLE journey_test_run
  ADD COLUMN test_type journey_test_type NOT NULL DEFAULT 'automated';

COMMENT ON COLUMN journey_test_run.test_type IS 'Whether this test was run by agent (automated) or human-guided (manual)';
```

**Step 2: Apply the migration locally**

Run: `cd /home/sxtnl/dev/smartout.ai && npx supabase db reset` or `npx supabase migration up`
Expected: Migration applies without error.

**Step 3: Regenerate database types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: `database.types.ts` updated with `journey_test_type` enum and `test_type` column.

**Step 4: Update journey types**

Add to `packages/types/src/enums.ts` (after `JourneyTestResultEnum` around line 214):

```typescript
export const JourneyTestTypeEnum = z.enum(["automated", "manual"]);
export type JourneyTestType = z.infer<typeof JourneyTestTypeEnum>;
```

Update `JourneyTestRunSchema` in `packages/types/src/journey.ts` (around line 99-109) to add:

```typescript
test_type: JourneyTestTypeEnum,
```

**Step 5: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors (new field has default, no existing code breaks)

**Step 6: Commit**

```bash
git add supabase/migrations/20260302000000_journey_test_type.sql packages/types/src/journey.ts packages/types/src/enums.ts packages/supabase/src/database.types.ts
git commit -m "feat(journey): add test_type column to journey_test_run"
```

---

## Task 2: Test-Runner API Endpoint

**Files:**

- Create: `apps/web/src/app/api/platform-admin/journeys/[id]/run-test/route.ts`
- Read: `apps/web/src/app/api/platform-admin/journeys/[id]/generate/route.ts` (pattern reference)
- Read: `apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.ts` (pattern reference)

**Context:**

- Generate endpoint at `apps/web/src/app/api/platform-admin/journeys/[id]/generate/route.ts:35-91` shows the pattern: check godmode, fetch journey+steps, do work, log event
- Transition endpoint at `apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.ts:48-124` shows status transition pattern
- Status transitions: `ready_test` → `testing` → `ready_validation` (from `apps/web/src/lib/journey/status-transitions.ts:25-27`)

**Step 1: Create the endpoint**

This endpoint receives automated test results from the agent and logs them. It does NOT run Playwright itself — the agent runs Playwright MCP directly, then calls this endpoint with results.

```typescript
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RunTestBodySchema = z.object({
  result: z.enum(["pass", "fail", "skip"]),
  duration_ms: z.number().int().nonnegative().optional(),
  error_message: z.string().optional(),
  test_output: z.record(z.unknown()).optional(),
  test_type: z.enum(["automated", "manual"]).default("automated"),
  auto_transition: z.boolean().default(true),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: journeyId } = await params;

  // Auth: godmode check (same pattern as generate endpoint)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: identity } = await supabase
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!identity?.is_godmode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse body
  const body = await req.json();
  const parsed = RunTestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { result, duration_ms, error_message, test_output, test_type, auto_transition } =
    parsed.data;

  // Fetch journey to verify it exists and get current status
  const { data: journey, error: journeyError } = await supabase
    .from("journey")
    .select("journey_id, status, workspace_id")
    .eq("journey_id", journeyId)
    .single();

  if (journeyError || !journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  // Insert test run
  const { data: testRun, error: insertError } = await supabase
    .from("journey_test_run")
    .insert({
      journey_id: journeyId,
      workspace_id: journey.workspace_id,
      result,
      duration_ms: duration_ms ?? null,
      error_message: error_message ?? null,
      test_output: test_output ?? null,
      test_type,
      triggered_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to insert test run", details: insertError.message },
      { status: 500 },
    );
  }

  // Update journey last_test_result and last_test_run_at
  await supabase
    .from("journey")
    .update({
      last_test_result: result,
      last_test_run_at: new Date().toISOString(),
    })
    .eq("journey_id", journeyId);

  // Log journey event
  await supabase.from("journey_event").insert({
    journey_id: journeyId,
    workspace_id: journey.workspace_id,
    event_type: "test_run",
    metadata: {
      test_run_id: testRun.journey_test_run_id,
      result,
      test_type,
      duration_ms,
    },
    actor_id: user.id,
  });

  // Auto-transition if test passed and auto_transition is true
  let transitioned = false;
  if (result === "pass" && auto_transition) {
    // automated pass: ready_test → testing, testing → ready_validation
    // manual pass: ready_validation → implemented
    const transitionMap: Record<string, string> = {
      ready_test: "testing",
      testing: "ready_validation",
      ready_validation: "implemented",
    };

    const nextStatus = transitionMap[journey.status];
    if (nextStatus) {
      // For manual tests, only transition ready_validation → implemented
      // For automated tests, transition ready_test → testing and testing → ready_validation
      const shouldTransition =
        (test_type === "automated" && ["ready_test", "testing"].includes(journey.status)) ||
        (test_type === "manual" && journey.status === "ready_validation");

      if (shouldTransition) {
        await supabase.from("journey").update({ status: nextStatus }).eq("journey_id", journeyId);

        await supabase.from("journey_event").insert({
          journey_id: journeyId,
          workspace_id: journey.workspace_id,
          event_type: "status_change",
          from_status: journey.status,
          to_status: nextStatus,
          metadata: { triggered_by_test: testRun.journey_test_run_id },
          actor_id: user.id,
        });

        transitioned = true;
      }
    }
  }

  return NextResponse.json({
    test_run: testRun,
    transitioned,
    journey_status: transitioned
      ? result === "pass"
        ? test_type === "manual"
          ? "implemented"
          : journey.status === "ready_test"
            ? "testing"
            : "ready_validation"
        : journey.status
      : journey.status,
  });
}
```

**Step 2: Verify the endpoint compiles**

Run: `pnpm turbo typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/\[id\]/run-test/route.ts
git commit -m "feat(journey): add test-runner API endpoint"
```

---

## Task 3: Test History API Endpoint

**Files:**

- Create: `apps/web/src/app/api/platform-admin/journeys/[id]/test-runs/route.ts`

**Context:**

- Portal needs to display test history per journey
- `journey_test_run` table has all the data, just need a GET endpoint

**Step 1: Create the endpoint**

```typescript
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: journeyId } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: identity } = await supabase
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!identity?.is_godmode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch test runs ordered by most recent
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");

  const { data: testRuns, error } = await supabase
    .from("journey_test_run")
    .select("*")
    .eq("journey_id", journeyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch test runs", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ test_runs: testRuns });
}
```

**Step 2: Typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/\[id\]/test-runs/route.ts
git commit -m "feat(journey): add test history GET endpoint"
```

---

## Task 4: Portal UI — Test Tab Upgrade

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Context:**

- Current `OutputTabContent` component (lines 163-250) generates E2E skeleton on demand
- Need to add: test history display, run-test button, manual-test button, result badges
- Tabs section at lines 560-656 — the `e2e` tab needs replacing

**Step 1: Create a new TestTabContent component**

Add ABOVE the existing `OutputTabContent` component (around line 163) in the same file. This component replaces the E2E tab with a proper testing interface.

```tsx
function TestTabContent({
  journeyId,
  journeyStatus,
}: {
  journeyId: string;
  journeyStatus: string;
}) {
  const [testRuns, setTestRuns] = useState<
    Array<{
      journey_test_run_id: string;
      result: string;
      test_type: string;
      duration_ms: number | null;
      error_message: string | null;
      test_output: Record<string, unknown> | null;
      created_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  const fetchTestRuns = useCallback(async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/platform-admin/journeys/${journeyId}/test-runs`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setTestRuns(data.test_runs ?? []);
    }
    setLoading(false);
  }, [journeyId, supabase]);

  useEffect(() => {
    fetchTestRuns();
  }, [fetchTestRuns]);

  const handleGenerate = async () => {
    setGenerating(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/platform-admin/journeys/${journeyId}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type: "e2e" }),
    });
    if (res.ok) {
      const data = await res.json();
      setGeneratedCode(data.content);
    }
    setGenerating(false);
  };

  const resultBadge = (result: string) => {
    const colors: Record<string, string> = {
      pass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      fail: "bg-red-500/10 text-red-500 border-red-500/20",
      skip: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      running: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    };
    return (
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colors[result] ?? "bg-muted text-muted-foreground"}`}
      >
        {result}
      </span>
    );
  };

  const typeBadge = (type: string) => (
    <span className="bg-muted text-muted-foreground inline-flex items-center rounded-md px-2 py-0.5 text-xs">
      {type}
    </span>
  );

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate E2E Skeleton"}
        </Button>
      </div>

      {/* Generated code (collapsible) */}
      {generatedCode && (
        <div className="bg-muted/50 rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Generated E2E Test</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(generatedCode)}
            >
              Copy
            </Button>
          </div>
          <pre className="bg-background max-h-80 overflow-auto rounded p-3 text-xs">
            <code>{generatedCode}</code>
          </pre>
        </div>
      )}

      {/* Test history */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Test History</h3>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : testRuns.length === 0 ? (
          <p className="text-muted-foreground text-sm">No test runs yet.</p>
        ) : (
          <div className="space-y-2">
            {testRuns.map((run) => (
              <div
                key={run.journey_test_run_id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  {resultBadge(run.result)}
                  {typeBadge(run.test_type)}
                  {run.duration_ms && (
                    <span className="text-muted-foreground text-xs">{run.duration_ms}ms</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {run.error_message && (
                    <span className="max-w-xs truncate text-xs text-red-400">
                      {run.error_message}
                    </span>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {new Date(run.created_at).toLocaleString("sv-SE")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Replace the E2E tab content**

In the Tabs section (around line 590), replace:

```tsx
<TabsContent value="e2e">
  <OutputTabContent
    journeyId={journey.journey_id}
    outputType="e2e"
    label="E2E Test"
    isCode={true}
  />
</TabsContent>
```

With:

```tsx
<TabsContent value="e2e">
  <TestTabContent journeyId={journey.journey_id} journeyStatus={journey.status} />
</TabsContent>
```

**Step 3: Add missing imports if needed**

Ensure `useState`, `useEffect`, `useCallback` are imported, and `Button` from shadcn/ui is imported. Check existing imports at top of file.

**Step 4: Typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors

**Step 5: Visual verification**

Run: `pnpm --filter web dev`
Navigate to: `http://localhost:3050/platform-admin/journeys/<any-journey-id>`
Click the "E2E Test" tab.
Expected: See "Generate E2E Skeleton" button + "No test runs yet" message.

**Step 6: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/\[id\]/_components/journey-detail-client.tsx
git commit -m "feat(journey): upgrade E2E tab with test history and run actions"
```

---

## Task 5: Playwright MCP Configuration

**Files:**

- Modify: Project-level `.claude/settings.json` or `.claude/settings.local.json`

**Context:**

- Current MCP servers in `~/.claude/settings.json` include: supabase, linear, github, vercel, context7
- Need to add Playwright MCP for agent-driven browser testing
- Playwright MCP uses accessibility tree snapshots by default (not screenshots)

**Step 1: Add Playwright MCP to settings**

Add to the `mcpServers` section in the appropriate settings file:

```json
{
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@latest"]
  }
}
```

**Step 2: Verify MCP server starts**

Run: `npx @playwright/mcp@latest --help`
Expected: Help output showing available options.

**Step 3: Test the MCP connection**

Start a new Claude Code session and verify Playwright tools are available. The agent should be able to see tools like `browser_navigate`, `browser_click`, `browser_snapshot`, etc.

**Step 4: Commit**

```bash
git add .claude/settings.json
git commit -m "feat(journey): add Playwright MCP server configuration"
```

---

## Task 6: Journey Test Agent Skill

**Files:**

- Create: `.claude/skills/journey-test.md`

**Context:**

- Agent needs structured instructions for how to run a journey test
- Reads journey definition → seeds data → runs Playwright steps → logs results
- This skill is what the agent invokes when asked "test journey J-015"

**Step 1: Write the skill**

````markdown
---
name: journey-test
description: Run an automated E2E test for a Smartout journey using Playwright MCP. Use when asked to "test journey", "run journey test", "kör test för journey", or similar.
---

# Journey Test Execution

## Trigger

User says: "test journey J-XXX", "kör test", "run test for journey", or similar.

## Process

### 1. Load journey definition

Read the journey from Supabase:

```sql
SELECT j.*, array_agg(js.* ORDER BY js.step_order) as steps
FROM journey j
LEFT JOIN journey_step js ON js.journey_id = j.journey_id
WHERE j.code = 'J-XXX'
GROUP BY j.journey_id;
```
````

Verify status is `ready_test` or `testing`. If not, inform user.

### 2. Check preconditions

Read `journey.preconditions` array. For each:

- Verify via Supabase query or Playwright that precondition is met
- If not met, attempt to seed the required data
- If cannot seed, report and abort

### 3. Execute steps via Playwright MCP

For each `journey_step` in order:

1. Navigate to `step.screen` URL (relative to localhost:3050)
2. Take accessibility snapshot (`browser_snapshot`)
3. Execute `step.action` by finding matching elements in the accessibility tree
4. Verify `step.expects` against the resulting accessibility tree
5. Log step result (pass/fail + details)

### 4. Final assertion

Check `journey.test_assertion` against the final page state.

### 5. Log results

POST to `/api/platform-admin/journeys/{id}/run-test`:

```json
{
  "result": "pass" | "fail",
  "duration_ms": <elapsed>,
  "test_type": "automated",
  "error_message": "<if failed>",
  "test_output": {
    "steps": [
      {"step": 1, "result": "pass", "snapshot": "..."},
      {"step": 2, "result": "fail", "error": "Element not found"}
    ]
  },
  "auto_transition": true
}
```

### 6. Report

Tell the user:

- Which steps passed/failed
- Final result
- Whether journey status was transitioned
- Screenshot or snapshot of failure point if applicable

## Important

- Always use accessibility tree (snapshot mode), not vision mode
- Use `data-testid` attributes when available, fall back to role+name matching
- Timeout per step: 10 seconds
- Max retries per step: 2 (for flaky elements)
- If self-healing a selector: log what changed in test_output

````

**Step 2: Verify the skill file is valid**

Run: `cat .claude/skills/journey-test.md | head -5`
Expected: Valid YAML frontmatter.

**Step 3: Commit**

```bash
git add .claude/skills/journey-test.md
git commit -m "feat(journey): add journey-test agent skill"
````

---

## Task 7: Manual Test Guide Skill

**Files:**

- Create: `.claude/skills/journey-manual-test.md`

**Context:**

- Agent guides Pontus through manual testing step by step in chat
- Reads journey definition, presents each step, waits for confirmation
- Logs structured results at the end

**Step 1: Write the skill**

```markdown
---
name: journey-manual-test
description: Guide a manual test for a Smartout journey. Use when asked to "manuellt test", "guided test", "manual test for journey", "validera journey", or similar.
---

# Manual Journey Test Guide

## Trigger

User says: "manuellt test J-XXX", "guide me through testing", "validera journey", or similar.

## Process

### 1. Load journey definition

Same query as journey-test skill. Verify status is `ready_validation`.

### 2. Present overview

Show:

- Journey title and code
- Number of steps
- Preconditions (what must be true before starting)
- Expected outcome on success

### 3. Guide step by step

For EACH `journey_step`, present ONE step at a time:
```

**Steg {N}/{total}: {step.title}**

Gå till: {step.screen}
Gör: {step.action}
Förväntat resultat: {step.expects}

Stämmer det? (ja/nej/kommentar)

```

Wait for user response before proceeding.

### 4. Record results

After each step, record:
- step number
- result: "pass" or "fail"
- note: user's comment (if any)

### 5. Present summary

After all steps:

```

**Resultat: {X}/{total} steg godkända**

Steg som felade:

- Steg {N}: {note}

Vill du godkänna denna journey som "implemented"?

````

### 6. Log and transition

If user approves, POST to `/api/platform-admin/journeys/{id}/run-test`:

```json
{
  "result": "pass",
  "test_type": "manual",
  "test_output": {
    "type": "manual",
    "steps": [
      {"step": 1, "result": "pass", "note": null},
      {"step": 2, "result": "fail", "note": "Dropdown tom"}
    ]
  },
  "auto_transition": true
}
````

If user rejects or steps failed, POST with `"result": "fail"`.

## Important

- ONE step at a time. Never dump all steps at once.
- Wait for explicit user confirmation per step.
- Use Swedish for instructions (match journey language).
- Include the URL to navigate to for each step.
- If step fails, ask for details — what did they see instead?

````

**Step 2: Verify skill file**

Run: `cat .claude/skills/journey-manual-test.md | head -5`
Expected: Valid YAML frontmatter.

**Step 3: Commit**

```bash
git add .claude/skills/journey-manual-test.md
git commit -m "feat(journey): add manual test guide skill"
````

---

## Task 8: Update WORKLOG and Documentation

**Files:**

- Modify: `docs/WORKLOG.md` (or create `docs/worklogs/WORKLOG-journey-testing.md`)
- Modify: `docs/INDEX.md` (add reference to new plan)

**Step 1: Log the work in WORKLOG**

Add entry for journey testing system implementation.

**Step 2: Register plan in INDEX.md**

Add to the plans section:

```markdown
| 2026-03-02 | `plans/2026-03-02-journey-testing-implementation.md` | Journey Testing System (Fas 1) | journey |
```

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs(journey): add testing system plan and update worklog"
```

---

## Summary — Task Order

| Task | Description                      | Dependencies | Est.   |
| ---- | -------------------------------- | ------------ | ------ |
| 1    | DB migration: `test_type` column | None         | 5 min  |
| 2    | Test-runner API endpoint         | Task 1       | 10 min |
| 3    | Test history API endpoint        | Task 1       | 5 min  |
| 4    | Portal UI: test tab upgrade      | Tasks 2, 3   | 15 min |
| 5    | Playwright MCP config            | None         | 5 min  |
| 6    | Journey test agent skill         | Task 2       | 10 min |
| 7    | Manual test guide skill          | Task 2       | 10 min |
| 8    | WORKLOG + docs                   | All          | 5 min  |

Tasks 1 and 5 can run in parallel. Tasks 2 and 3 depend on 1. Task 4 depends on 2+3. Tasks 6 and 7 depend on 2. Task 8 is last.

```
[Task 1] ──→ [Task 2] ──→ [Task 4]
    │              │
    │              ├──→ [Task 6]
    │              └──→ [Task 7]
    └──→ [Task 3] ──┘
[Task 5] (parallel)
                         [Task 8] (last)
```
