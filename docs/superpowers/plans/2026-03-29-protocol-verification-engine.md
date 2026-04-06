# Protocol Verification Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-layer system that executes Protokoll packages through Playwright, verifies each step via DB/UI control gates, and generates documentation, mission drafts, and UX audit reports.

**Architecture:** Layer 1 (TypeScript protocol definitions with Zod schemas) → Layer 2 (Playwright runner with gate checker) → Layer 3 (LLM output generators). Results stored as JSONB in existing `journey_test_run` table. No new DB tables.

**Tech Stack:** Playwright, Zod, Supabase JS (service role for gate checks), @smartout/telemetry

**Spec:** `docs/superpowers/specs/2026-03-29-protocol-verification-engine-design.md`

---

## File Structure

```
apps/e2e/
├── protocols/
│   ├── schema.ts                    ← Zod schemas (Gate, Action, Step, ProtocolDefinition)
│   ├── types.ts                     ← Output types (ProtocolTestOutput, GateResult, etc.)
│   ├── P-001-admin-onboarding.ts    ← First protocol definition
│   └── index.ts                     ← Re-exports all protocol definitions
├── runners/
│   ├── protocol-runner.ts           ← Main executor (iterate steps, call gate-checker)
│   └── gate-checker.ts              ← DB/UI/URL gate verification with polling
├── generators/
│   ├── docs-generator.ts            ← Screenshots + step text → markdown guide
│   ├── mission-generator.ts         ← Results → GeneratedMissionPackage JSON
│   └── audit-generator.ts           ← Timing data → UX friction report
├── tests/
│   └── protocol.spec.ts             ← Playwright test file that runs protocols
├── tsconfig.json                    ← Add protocols/, runners/, generators/ to include
supabase/migrations/
│   └── YYYYMMDDHHMMSS_add_protocol_test_type.sql  ← Add 'protocol' to journey_test_type enum
```

**Existing files modified:**

- `apps/e2e/tsconfig.json` — add new dirs to `include`
- `apps/e2e/package.json` — add `test:protocol` script

**Existing files NOT modified:**

- `packages/ai/src/missions/registry.ts` — out of scope
- `packages/ai/src/missions/types.ts` — out of scope
- `apps/e2e/reporters/journey-reporter.ts` — remains unchanged
- Any files in `apps/web/` — data-testid additions are a separate follow-up task

---

## Task 1: Protocol Definition Schema

**Files:**

- Create: `apps/e2e/protocols/schema.ts`
- Create: `apps/e2e/protocols/types.ts`

- [ ] **Step 1: Create the Zod schemas for protocol definitions**

```typescript
// apps/e2e/protocols/schema.ts
import { z } from "zod";

// ─── Gates ─────────────────────────────────────────────
export const DbRecordGateSchema = z.object({
  type: z.literal("db_record"),
  table: z.string(),
  where: z.record(z.unknown()),
  expect: z.record(z.unknown()),
  timeout_ms: z.number().default(10_000),
  retry_interval_ms: z.number().default(500),
});

export const UiStateGateSchema = z.object({
  type: z.literal("ui_state"),
  testid: z.string(),
  visible: z.boolean().default(true),
  timeout_ms: z.number().default(5_000),
});

export const UrlMatchGateSchema = z.object({
  type: z.literal("url_match"),
  pattern: z.string(),
  timeout_ms: z.number().default(10_000),
});

export const GateSchema = z.discriminatedUnion("type", [
  DbRecordGateSchema,
  UiStateGateSchema,
  UrlMatchGateSchema,
]);

// ─── Actions ───────────────────────────────────────────
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), url: z.string() }),
  z.object({ type: z.literal("fill"), testid: z.string(), value: z.string() }),
  z.object({ type: z.literal("click"), testid: z.string() }),
  z.object({ type: z.literal("click_text"), text: z.string() }),
  z.object({ type: z.literal("wait_visible"), testid: z.string() }),
  z.object({ type: z.literal("wait_hidden"), testid: z.string() }),
  z.object({ type: z.literal("settle"), ms: z.number().default(1500) }),
]);

// ─── Steps ─────────────────────────────────────────────
export const StepSchema = z.object({
  id: z.string(),
  order: z.number(),
  title: z.string(),
  description: z.string(),
  journey_step_slug: z.string().optional(),
  actions: z.array(ActionSchema),
  gate: GateSchema,
  screenshot: z.boolean().default(true),
});

// ─── Protocol Definition ───────────────────────────────
export const ProtocolDefinitionSchema = z.object({
  id: z.string(),
  package_id: z.string(),
  name: z.string(),
  actor: z.enum(["owner", "admin", "manager", "employee"]),
  platform: z.enum(["web", "mobile"]),
  auth_profile: z.enum(["admin", "employee", "godmode"]),
  entry_url: z.string(),
  preconditions: z.object({
    db_state: z
      .array(
        z.object({
          table: z.string(),
          where: z.record(z.unknown()),
          expect: z.record(z.unknown()),
        }),
      )
      .default([]),
  }),
  steps: z.array(StepSchema),
  success_gate: GateSchema,
});

export type ProtocolDefinition = z.infer<typeof ProtocolDefinitionSchema>;
export type ProtocolStep = z.infer<typeof StepSchema>;
export type Gate = z.infer<typeof GateSchema>;
export type Action = z.infer<typeof ActionSchema>;
```

- [ ] **Step 2: Create the output types**

```typescript
// apps/e2e/protocols/types.ts

/** Result of checking a single gate */
export type GateResult = {
  passed: boolean;
  data?: Record<string, unknown> | null;
  error?: string;
};

/** Result of executing a single step */
export type StepResult = {
  step_id: string;
  step_order: number;
  title: string;
  status: "passed" | "failed" | "skipped" | "timeout";
  gate_type: string;
  gate_query: Record<string, unknown>;
  gate_result: Record<string, unknown>;
  screenshot_path: string | null;
  duration_ms: number;
  timing: {
    action_ms: number;
    settle_ms: number;
    gate_ms: number;
  };
};

/** Full output stored in journey_test_run.test_output JSONB */
export type ProtocolTestOutput = {
  protocol_id: string;
  protocol_name: string;
  steps: StepResult[];
  friction_data: {
    total_duration_ms: number;
    slowest_step: string;
    failed_gates: string[];
    notes: string[];
  };
};

/** Return value from runProtocol() */
export type ProtocolRunResult = {
  success: boolean;
  output: ProtocolTestOutput;
  journey_test_run_id: string | null;
};
```

- [ ] **Step 3: Validate schemas parse correctly**

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/protocols/schema.ts apps/e2e/protocols/types.ts
git commit -m "feat(e2e): add protocol definition Zod schemas and output types

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Gate Checker

**Files:**

- Create: `apps/e2e/runners/gate-checker.ts`

- [ ] **Step 1: Create the gate checker with polling logic**

```typescript
// apps/e2e/runners/gate-checker.ts
import type { Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Gate } from "../protocols/schema";
import type { GateResult } from "../protocols/types";

/**
 * Checks whether a gate condition is met by polling until success or timeout.
 * Gates are the control mechanism that prevents the protocol runner from
 * advancing to the next step until the expected system state is confirmed.
 */
export async function checkGate(
  gate: Gate,
  page: Page,
  supabase: SupabaseClient,
): Promise<GateResult> {
  const timeout = gate.timeout_ms;
  const interval = gate.type === "db_record" ? gate.retry_interval_ms : 500;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const result = await checkOnce(gate, page, supabase);
    if (result.passed) return result;
    await new Promise((r) => setTimeout(r, interval));
  }

  return {
    passed: false,
    error: `Gate timeout after ${timeout}ms (type: ${gate.type})`,
  };
}

async function checkOnce(gate: Gate, page: Page, supabase: SupabaseClient): Promise<GateResult> {
  switch (gate.type) {
    case "db_record":
      return checkDbRecord(gate, supabase);
    case "ui_state":
      return checkUiState(gate, page);
    case "url_match":
      return checkUrlMatch(gate, page);
  }
}

async function checkDbRecord(
  gate: Extract<Gate, { type: "db_record" }>,
  supabase: SupabaseClient,
): Promise<GateResult> {
  const query = supabase.from(gate.table).select("*");

  for (const [key, value] of Object.entries(gate.where)) {
    query.eq(key, value as string);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { passed: false, error: `DB query failed: ${error.message}` };
  }

  // Check "exists" expectation
  if ("exists" in gate.expect) {
    if (gate.expect.exists === true && data) return { passed: true, data };
    if (gate.expect.exists === false && !data) return { passed: true, data: null };
    return { passed: false, data };
  }

  // Check field-level expectations
  if (!data) return { passed: false, error: "No row found" };

  for (const [key, expected] of Object.entries(gate.expect)) {
    if (data[key] !== expected) {
      return {
        passed: false,
        data,
        error: `Field ${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(data[key])}`,
      };
    }
  }

  return { passed: true, data };
}

async function checkUiState(
  gate: Extract<Gate, { type: "ui_state" }>,
  page: Page,
): Promise<GateResult> {
  const isVisible = await page
    .getByTestId(gate.testid)
    .isVisible({ timeout: 200 })
    .catch(() => false);

  if (isVisible === gate.visible) {
    return { passed: true };
  }

  return {
    passed: false,
    error: `Element [data-testid="${gate.testid}"] visible=${isVisible}, expected=${gate.visible}`,
  };
}

async function checkUrlMatch(
  gate: Extract<Gate, { type: "url_match" }>,
  page: Page,
): Promise<GateResult> {
  const url = page.url();
  if (new RegExp(gate.pattern).test(url)) {
    return { passed: true };
  }

  return {
    passed: false,
    error: `URL "${url}" does not match pattern "${gate.pattern}"`,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/runners/gate-checker.ts
git commit -m "feat(e2e): add gate checker with DB, UI, and URL polling

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Protocol Runner

**Files:**

- Create: `apps/e2e/runners/protocol-runner.ts`

- [ ] **Step 1: Create the protocol runner**

```typescript
// apps/e2e/runners/protocol-runner.ts
import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ProtocolDefinition, Action } from "../protocols/schema";
import type { StepResult, ProtocolTestOutput, ProtocolRunResult } from "../protocols/types";
import { checkGate } from "./gate-checker";
import * as path from "path";
import * as fs from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const RUNNER_CONFIG = {
  viewport: { width: 1440, height: 900 },
  colorScheme: "light" as const,
  settleDelay: 1500,
  screenshotDir: "./test-results/protocols",
};

type VariableContext = {
  auth: { email: string; password: string };
  fixture: Record<string, string>;
};

/**
 * Executes a protocol definition against a live Playwright page.
 *
 * Iterates through each step: runs actions, waits for animation settle,
 * checks the control gate, and captures a screenshot. If any gate fails,
 * execution stops and partial results are persisted.
 */
export async function runProtocol(
  page: Page,
  protocol: ProtocolDefinition,
  variables?: Partial<VariableContext>,
): Promise<ProtocolRunResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const vars: VariableContext = {
    auth: {
      email: variables?.auth?.email ?? process.env.E2E_EMAIL ?? "admin@smartout.local",
      password: variables?.auth?.password ?? process.env.E2E_PASSWORD ?? "password123",
    },
    fixture: variables?.fixture ?? {},
  };

  // Ensure screenshot directory exists
  const screenshotDir = path.resolve(RUNNER_CONFIG.screenshotDir, protocol.id);
  fs.mkdirSync(screenshotDir, { recursive: true });

  // Set viewport and color scheme
  await page.setViewportSize(RUNNER_CONFIG.viewport);
  await page.emulateMedia({ colorScheme: RUNNER_CONFIG.colorScheme });

  const stepResults: StepResult[] = [];
  let allPassed = true;

  for (const step of protocol.steps) {
    const stepStart = Date.now();

    // 1. EXECUTE actions
    const actionStart = Date.now();
    let actionFailed = false;
    try {
      for (const action of step.actions) {
        await executeAction(page, action, vars);
      }
    } catch (err) {
      actionFailed = true;
      const errorMsg = err instanceof Error ? err.message : String(err);
      stepResults.push({
        step_id: step.id,
        step_order: step.order,
        title: step.title,
        status: "failed",
        gate_type: step.gate.type,
        gate_query: {},
        gate_result: { error: `Action failed: ${errorMsg}` },
        screenshot_path: null,
        duration_ms: Date.now() - stepStart,
        timing: { action_ms: Date.now() - actionStart, settle_ms: 0, gate_ms: 0 },
      });
      allPassed = false;
      break;
    }
    const actionMs = Date.now() - actionStart;

    // 2. SETTLE for spring animations
    const settleStart = Date.now();
    await page.waitForTimeout(RUNNER_CONFIG.settleDelay);
    const settleMs = Date.now() - settleStart;

    // 3. CHECK gate
    const gateStart = Date.now();
    const gateResult = await checkGate(step.gate, page, supabase);
    const gateMs = Date.now() - gateStart;

    // 4. CAPTURE screenshot
    let screenshotPath: string | null = null;
    if (step.screenshot) {
      const filename = `${protocol.id}_${protocol.actor}_${String(step.order).padStart(2, "0")}_${step.id}_${RUNNER_CONFIG.colorScheme}_${RUNNER_CONFIG.viewport.width}x${RUNNER_CONFIG.viewport.height}.png`;
      screenshotPath = path.join(screenshotDir, filename);
      await page.screenshot({ path: screenshotPath, fullPage: false });
    }

    // 5. RECORD
    const status = gateResult.passed ? "passed" : "timeout";
    stepResults.push({
      step_id: step.id,
      step_order: step.order,
      title: step.title,
      status,
      gate_type: step.gate.type,
      gate_query:
        step.gate.type === "db_record"
          ? { table: step.gate.table, where: step.gate.where }
          : step.gate.type === "ui_state"
            ? { testid: step.gate.testid, visible: step.gate.visible }
            : { pattern: step.gate.pattern },
      gate_result: gateResult.data ? { data: gateResult.data } : { error: gateResult.error },
      screenshot_path: screenshotPath,
      duration_ms: Date.now() - stepStart,
      timing: { action_ms: actionMs, settle_ms: settleMs, gate_ms: gateMs },
    });

    if (!gateResult.passed) {
      allPassed = false;
      break;
    }
  }

  // Build output
  const output: ProtocolTestOutput = {
    protocol_id: protocol.id,
    protocol_name: protocol.name,
    steps: stepResults,
    friction_data: {
      total_duration_ms: stepResults.reduce((sum, s) => sum + s.duration_ms, 0),
      slowest_step:
        stepResults.length > 0
          ? stepResults.reduce((a, b) => (a.duration_ms > b.duration_ms ? a : b)).step_id
          : "",
      failed_gates: stepResults.filter((s) => s.status !== "passed").map((s) => s.step_id),
      notes: stepResults
        .filter((s) => s.timing.gate_ms > 5000)
        .map((s) => `Step "${s.title}" gate took ${s.timing.gate_ms}ms`),
    },
  };

  // Persist to journey_test_run
  const runId = await persistTestRun(supabase, protocol, output, allPassed);

  return { success: allPassed, output, journey_test_run_id: runId };
}

async function executeAction(page: Page, action: Action, vars: VariableContext): Promise<void> {
  const interpolate = (s: string): string =>
    s.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_match, group, key) => {
      if (group === "auth") return (vars.auth as Record<string, string>)[key] ?? "";
      if (group === "fixture") return vars.fixture[key] ?? "";
      return "";
    });

  switch (action.type) {
    case "navigate":
      await page.goto(interpolate(action.url));
      break;
    case "fill":
      await page.getByTestId(action.testid).fill(interpolate(action.value));
      break;
    case "click":
      await page.getByTestId(action.testid).click();
      break;
    case "click_text":
      await page.getByText(action.text, { exact: false }).first().click();
      break;
    case "wait_visible":
      await page.getByTestId(action.testid).waitFor({ state: "visible", timeout: 10_000 });
      break;
    case "wait_hidden":
      await page.getByTestId(action.testid).waitFor({ state: "hidden", timeout: 10_000 });
      break;
    case "settle":
      await page.waitForTimeout(action.ms);
      break;
  }
}

async function persistTestRun(
  supabase: SupabaseClient,
  protocol: ProtocolDefinition,
  output: ProtocolTestOutput,
  passed: boolean,
): Promise<string | null> {
  // Look up the journey by package_id pattern to find journey_id + workspace_id
  const { data: journey } = await supabase
    .from("journey")
    .select("journey_id, workspace_id")
    .or(`code.eq.${protocol.package_id},slug.eq.${protocol.id.toLowerCase()}`)
    .maybeSingle();

  if (!journey) {
    console.warn(
      `[ProtocolRunner] No journey found for ${protocol.package_id} — skipping DB persist`,
    );
    return null;
  }

  const { data, error } = await supabase
    .from("journey_test_run")
    .insert({
      journey_id: journey.journey_id,
      workspace_id: journey.workspace_id,
      result: passed ? "pass" : "fail",
      test_type: "protocol",
      duration_ms: output.friction_data.total_duration_ms,
      error_message: passed
        ? null
        : output.steps
            .filter((s) => s.status !== "passed")
            .map((s) => `${s.title}: ${s.gate_result.error ?? s.status}`)
            .join("\n"),
      test_output: output,
    })
    .select("journey_test_run_id")
    .single();

  if (error) {
    console.warn(`[ProtocolRunner] Failed to persist test run: ${error.message}`);
    return null;
  }

  return data.journey_test_run_id;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/runners/protocol-runner.ts
git commit -m "feat(e2e): add protocol runner with action executor and result persistence

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Database Migration

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_protocol_test_type.sql`

- [ ] **Step 1: Create migration to add 'protocol' to journey_test_type enum**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_protocol_test_type.sql
-- Adds 'protocol' value to the journey_test_type enum.
-- Used by the Protocol Verification Engine runner to distinguish
-- protocol-driven test runs from automated (Playwright) and manual runs.

ALTER TYPE journey_test_type ADD VALUE IF NOT EXISTS 'protocol';

COMMENT ON TYPE journey_test_type IS 'automated = Playwright E2E, manual = human QA, protocol = Protocol Verification Engine';
```

- [ ] **Step 2: Run the migration against local Supabase**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/YYYYMMDDHHMMSS_add_protocol_test_type.sql`
Expected: `ALTER TYPE` / `COMMENT`

- [ ] **Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: File updated with new enum value

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_add_protocol_test_type.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add 'protocol' value to journey_test_type enum

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Update E2E Config

**Files:**

- Modify: `apps/e2e/tsconfig.json`
- Modify: `apps/e2e/package.json`
- Create: `apps/e2e/protocols/index.ts`

- [ ] **Step 1: Update tsconfig.json to include new directories**

In `apps/e2e/tsconfig.json`, change the `include` array:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": [
    "tests/**/*.ts",
    "helpers/**/*.ts",
    "protocols/**/*.ts",
    "runners/**/*.ts",
    "generators/**/*.ts",
    "reporters/**/*.ts",
    "playwright.config.ts"
  ]
}
```

- [ ] **Step 2: Add test:protocol script to package.json**

Add to `apps/e2e/package.json` scripts:

```json
"test:protocol": "bash ./scripts/playwright-with-libs.sh pnpm exec playwright test tests/protocol.spec.ts"
```

- [ ] **Step 3: Create protocols index**

```typescript
// apps/e2e/protocols/index.ts
export { ProtocolDefinitionSchema, type ProtocolDefinition } from "./schema";
export type { ProtocolTestOutput, ProtocolRunResult } from "./types";
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/tsconfig.json apps/e2e/package.json apps/e2e/protocols/index.ts
git commit -m "chore(e2e): update config for protocol runner directories

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: P-001 Admin Onboarding Protocol Definition

**Files:**

- Create: `apps/e2e/protocols/P-001-admin-onboarding.ts`

This is the first real protocol definition. It maps to `docs/Protokol/admin-onboarding-package/Journey.md`. Because the onboarding wizard may not have all `data-testid` attributes yet, steps use fallback selectors where needed. The protocol covers the manual (non-voice) path through onboarding.

- [ ] **Step 1: Create P-001 protocol definition**

```typescript
// apps/e2e/protocols/P-001-admin-onboarding.ts
import type { ProtocolDefinition } from "./schema";

/**
 * P-001: Admin Onboarding
 *
 * Maps to: docs/Protokol/admin-onboarding-package/Journey.md
 * Actor: Owner (admin) creating a new workspace
 * Path: /login → /onboarding → (9 steps) → /dashboard
 *
 * This protocol tests the MANUAL mode (not voice-assisted).
 * Each step has a control gate that must pass before advancing.
 */
export const P001_ADMIN_ONBOARDING: ProtocolDefinition = {
  id: "P-001",
  package_id: "JP-R001-ADMIN-ONBOARDING",
  name: "Admin Onboarding",
  actor: "owner",
  platform: "web",
  auth_profile: "admin",
  entry_url: "/login",
  preconditions: {
    db_state: [],
  },
  steps: [
    {
      id: "1_login",
      order: 1,
      title: "Innlogging",
      description: "Admin logger inn med e-post og passord. Systemet autentiserer brukeren.",
      actions: [
        { type: "navigate", url: "/login" },
        { type: "settle", ms: 1000 },
        { type: "fill", testid: "login-email", value: "{{auth.email}}" },
        { type: "fill", testid: "login-password", value: "{{auth.password}}" },
        { type: "click", testid: "login-submit" },
      ],
      gate: {
        type: "url_match",
        pattern: "/(dashboard|onboarding|setup|select-workspace)",
        timeout_ms: 15_000,
      },
      screenshot: true,
    },
    {
      id: "2_navigate_onboarding",
      order: 2,
      title: "Naviger til onboarding",
      description: "Systemet dirigerer til onboarding-flyten for nye workspaces.",
      actions: [
        { type: "navigate", url: "/onboarding" },
        { type: "settle", ms: 1500 },
      ],
      gate: {
        type: "url_match",
        pattern: "/onboarding",
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      id: "3_hero_section",
      order: 3,
      title: "Velkomstskjerm",
      description:
        "Bruker ser velkomstskjermen med valg mellom assistert og manuelt oppsett. Velger manuelt.",
      actions: [
        { type: "wait_visible", testid: "onboarding-hero" },
        { type: "click", testid: "onboarding-manual-mode" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-business",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "4_business_info",
      order: 4,
      title: "Bedriftsinformasjon",
      description: "Admin fyller inn bedriftsnavn og by. Systemet søker i Brønnøysund.",
      actions: [
        { type: "fill", testid: "input-company-name", value: "E2E Test Restaurant" },
        { type: "fill", testid: "input-company-city", value: "Oslo" },
        { type: "click", testid: "onboarding-search-company" },
        { type: "settle", ms: 3000 },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-season",
        visible: true,
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      id: "5_season",
      order: 5,
      title: "Sesongoppsett",
      description: "System foreslår sesong basert på bransje. Admin bekrefter eller justerer.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-season" },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-departments",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "6_departments",
      order: 6,
      title: "Avdelinger",
      description: "System genererer bransjetilpassede avdelinger. Admin bekrefter.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-departments" },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-locations",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "7_locations",
      order: 7,
      title: "Lokasjoner og soner",
      description: "Admin bekrefter lokasjoner funnet via scraping eller legger til manuelt.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-locations" },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-procedures",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "8_procedures",
      order: 8,
      title: "Prosedyrer",
      description: "System foreslår standard prosedyrer for bransjen. Admin bekrefter.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-procedures" },
        { type: "click", testid: "onboarding-next-btn" },
      ],
      gate: {
        type: "ui_state",
        testid: "onboarding-step-final",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      id: "9_finalize",
      order: 9,
      title: "Ferdigstilling",
      description:
        "Admin aktiverer workspace. System oppretter alle entiteter og navigerer til dashboard.",
      actions: [
        { type: "wait_visible", testid: "onboarding-step-final" },
        { type: "click", testid: "onboarding-finalize-btn" },
        { type: "settle", ms: 3000 },
      ],
      gate: {
        type: "url_match",
        pattern: "/dashboard",
        timeout_ms: 30_000,
      },
      screenshot: true,
    },
  ],
  success_gate: {
    type: "url_match",
    pattern: "/dashboard",
    timeout_ms: 5_000,
  },
};
```

- [ ] **Step 2: Validate with Zod**

Add a quick validation at the bottom of the file (temporary, remove after verification):

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/protocols/P-001-admin-onboarding.ts
git commit -m "feat(e2e): add P-001 admin onboarding protocol definition

Maps to docs/Protokol/admin-onboarding-package/Journey.md
Manual mode path: login → 9 onboarding steps → dashboard

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Playwright Test File

**Files:**

- Create: `apps/e2e/tests/protocol.spec.ts`

- [ ] **Step 1: Create the Playwright test that invokes the runner**

```typescript
// apps/e2e/tests/protocol.spec.ts
import { test, expect } from "@playwright/test";
import { runProtocol } from "../runners/protocol-runner";
import { P001_ADMIN_ONBOARDING } from "../protocols/P-001-admin-onboarding";

/**
 * Protocol Verification Tests
 *
 * These tests execute full protocol definitions against a live app.
 * Each protocol is a complete user journey with control gates between steps.
 * Results are persisted to journey_test_run with test_type='protocol'.
 */
test.describe("Protocol Verification", () => {
  test.describe("journey:admin-onboarding", () => {
    test("P-001: Admin Onboarding — full journey", async ({ page }) => {
      test.slow(); // Protocol runs are multi-step, need extra timeout

      const result = await runProtocol(page, P001_ADMIN_ONBOARDING);

      // Log step results for debugging
      for (const step of result.output.steps) {
        console.log(
          `  [${step.status.toUpperCase()}] Step ${step.step_order}: ${step.title} (${step.duration_ms}ms)`,
        );
      }

      expect(result.success).toBe(true);
      expect(result.output.friction_data.failed_gates).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/tests/protocol.spec.ts
git commit -m "feat(e2e): add protocol verification test for P-001

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Docs Generator (Layer 3)

**Files:**

- Create: `apps/e2e/generators/docs-generator.ts`

- [ ] **Step 1: Create the documentation generator**

```typescript
// apps/e2e/generators/docs-generator.ts
import * as fs from "fs";
import * as path from "path";
import type { ProtocolTestOutput } from "../protocols/types";
import type { ProtocolDefinition } from "../protocols/schema";

/**
 * Generates a markdown user guide from protocol run results.
 *
 * Takes the step results (with screenshots) and the protocol definition
 * (with descriptions) and produces a step-by-step guide with images.
 *
 * Output: docs/guides/GUIDE-{protocol_id}.md
 */
export function generateDocs(
  protocol: ProtocolDefinition,
  output: ProtocolTestOutput,
  outputDir: string = path.resolve(process.cwd(), "../../docs/guides"),
): string {
  fs.mkdirSync(outputDir, { recursive: true });

  const lines: string[] = [
    "---",
    `title: "Guide: ${protocol.name}"`,
    `protocol_id: ${protocol.id}`,
    `generated: ${new Date().toISOString().slice(0, 10)}`,
    `status: draft`,
    "---",
    "",
    `# ${protocol.name} — Steg-for-steg`,
    "",
  ];

  for (const step of output.steps) {
    const def = protocol.steps.find((s) => s.id === step.step_id);
    if (!def) continue;

    lines.push(`## ${step.step_order}. ${step.title}`);
    lines.push("");

    if (step.screenshot_path) {
      const relPath = path.relative(outputDir, step.screenshot_path);
      lines.push(`![Steg ${step.step_order}](${relPath})`);
      lines.push("");
    }

    lines.push(def.description);
    lines.push("");

    if (step.status !== "passed") {
      lines.push(`> **Status:** ${step.status} — ${step.gate_result.error ?? "Gate failed"}`);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(`*Generert av Protocol Verification Engine ${new Date().toISOString().slice(0, 10)}*`);

  const content = lines.join("\n");
  const filePath = path.join(outputDir, `GUIDE-${protocol.id}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  return filePath;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/generators/docs-generator.ts
git commit -m "feat(e2e): add docs generator for protocol run screenshots

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Mission Generator (Layer 3)

**Files:**

- Create: `apps/e2e/generators/mission-generator.ts`

- [ ] **Step 1: Create the mission draft generator**

```typescript
// apps/e2e/generators/mission-generator.ts
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import type { ProtocolTestOutput } from "../protocols/types";
import type { ProtocolDefinition } from "../protocols/schema";

/**
 * Schema for the generated mission package.
 * Targets engine_missions + engine_stages DB tables (not registry.ts).
 * All generated missions are drafts — is_active is always false.
 */
export const GeneratedMissionPackageSchema = z.object({
  mission: z.object({
    name: z.string(),
    description: z.string(),
    system_prompt: z.string(),
    mode: z.enum(["sequential", "free", "hybrid"]).default("sequential"),
    language: z.enum(["no", "en", "sv"]).default("no"),
    is_active: z.literal(false),
  }),
  stages: z.array(
    z.object({
      stage_order: z.number(),
      name: z.string(),
      goal: z.string(),
      instructions: z.string(),
      success_criteria: z.string(),
      escalation_instructions: z.string().optional(),
      creative_freedom: z.number().min(0).max(1).default(0.3),
      emotion_hint: z.string().optional(),
      is_required: z.boolean().default(true),
      journey_step_slug: z.string().optional(),
      tool_hints: z.array(z.string()).optional(),
    }),
  ),
  guardrails: z.array(
    z.object({
      stage_order: z.number(),
      description: z.string(),
      source: z.enum(["license", "journey", "observed"]),
    }),
  ),
});

export type GeneratedMissionPackage = z.infer<typeof GeneratedMissionPackageSchema>;

/**
 * Generates a draft mission package from protocol run results.
 *
 * This produces a scaffolded mission structure based on the protocol steps.
 * The system_prompt and instructions are templates that need human review
 * and enrichment before being inserted into engine_missions/engine_stages.
 *
 * Output: docs/missions/MISSION-DRAFT-{protocol_id}.json
 */
export function generateMissionDraft(
  protocol: ProtocolDefinition,
  output: ProtocolTestOutput,
  outputDir: string = path.resolve(process.cwd(), "../../docs/missions"),
): string {
  fs.mkdirSync(outputDir, { recursive: true });

  const missionPackage: GeneratedMissionPackage = {
    mission: {
      name: `${protocol.name} Mission`,
      description: `AI-assisted guide for: ${protocol.name}. Generated from protocol run.`,
      system_prompt: `Du er en AI-assistent som hjelper brukeren gjennom ${protocol.name}.\n\nDenne misjonen har ${protocol.steps.length} steg. Guide brukeren gjennom hvert steg.\n\n[HUMAN REVIEW REQUIRED: Enrich with domain knowledge, tone, and tool instructions]`,
      mode: "sequential",
      language: "no",
      is_active: false,
    },
    stages: protocol.steps.map((step, i) => ({
      stage_order: i + 1,
      name: step.title,
      goal: step.description,
      instructions: `Guide brukeren gjennom: ${step.title}.\n[HUMAN REVIEW REQUIRED]`,
      success_criteria: formatGateAsCriteria(step.gate),
      is_required: true,
      creative_freedom: 0.3,
      journey_step_slug: step.journey_step_slug,
    })),
    guardrails: protocol.steps
      .filter((s) => s.gate.type === "db_record")
      .map((s) => ({
        stage_order: s.order,
        description: `Gate: ${s.gate.type} on ${(s.gate as { table?: string }).table ?? "unknown"}`,
        source: "journey" as const,
      })),
  };

  // Validate with Zod
  GeneratedMissionPackageSchema.parse(missionPackage);

  const filePath = path.join(outputDir, `MISSION-DRAFT-${protocol.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(missionPackage, null, 2), "utf-8");

  return filePath;
}

function formatGateAsCriteria(gate: ProtocolDefinition["steps"][0]["gate"]): string {
  switch (gate.type) {
    case "db_record":
      return `DB record exists in ${gate.table} matching ${JSON.stringify(gate.where)}`;
    case "ui_state":
      return `Element [data-testid="${gate.testid}"] is ${gate.visible ? "visible" : "hidden"}`;
    case "url_match":
      return `URL matches pattern: ${gate.pattern}`;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/generators/mission-generator.ts
git commit -m "feat(e2e): add mission draft generator targeting engine_missions schema

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Audit Generator (Layer 3)

**Files:**

- Create: `apps/e2e/generators/audit-generator.ts`

- [ ] **Step 1: Create the UX audit report generator**

```typescript
// apps/e2e/generators/audit-generator.ts
import * as fs from "fs";
import * as path from "path";
import type { ProtocolTestOutput } from "../protocols/types";
import type { ProtocolDefinition } from "../protocols/schema";

/**
 * Generates a UX audit report from protocol run timing data.
 *
 * This is a data-driven report based on measured metrics (timing, pass/fail).
 * Friction scores and qualitative observations require LLM post-processing
 * which is NOT done here — this generates the raw audit data as markdown.
 *
 * Output: docs/audits/AUDIT-{protocol_id}-{date}.md
 */
export function generateAudit(
  protocol: ProtocolDefinition,
  output: ProtocolTestOutput,
  outputDir: string = path.resolve(process.cwd(), "../../docs/audits"),
): string {
  fs.mkdirSync(outputDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    "---",
    `title: "UX Audit: ${protocol.name}"`,
    `protocol_id: ${protocol.id}`,
    `generated: ${date}`,
    `status: draft`,
    "---",
    "",
    `# UX Audit — ${protocol.name}`,
    "",
    `**Total duration:** ${output.friction_data.total_duration_ms}ms`,
    `**Steps:** ${output.steps.length}`,
    `**Passed:** ${output.steps.filter((s) => s.status === "passed").length}`,
    `**Failed:** ${output.steps.filter((s) => s.status !== "passed").length}`,
    `**Slowest step:** ${output.friction_data.slowest_step}`,
    "",
    "## Per-Step Timing",
    "",
    "| Step | Title | Total ms | Action ms | Settle ms | Gate ms | Status |",
    "|------|-------|----------|-----------|-----------|---------|--------|",
  ];

  for (const step of output.steps) {
    lines.push(
      `| ${step.step_order} | ${step.title} | ${step.duration_ms} | ${step.timing.action_ms} | ${step.timing.settle_ms} | ${step.timing.gate_ms} | ${step.status} |`,
    );
  }

  lines.push("");

  if (output.friction_data.notes.length > 0) {
    lines.push("## Observations");
    lines.push("");
    for (const note of output.friction_data.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  if (output.friction_data.failed_gates.length > 0) {
    lines.push("## Failed Gates");
    lines.push("");
    for (const gate of output.friction_data.failed_gates) {
      const step = output.steps.find((s) => s.step_id === gate);
      lines.push(`- **${gate}**: ${step?.gate_result.error ?? "Unknown error"}`);
    }
    lines.push("");
  }

  lines.push("## Improvement Recommendations");
  lines.push("");
  lines.push(
    "*[LLM post-processing required — run `pnpm protocol:generate P-XXX` for AI-enriched analysis]*",
  );
  lines.push("");
  lines.push("---");
  lines.push(`*Generated by Protocol Verification Engine ${date}*`);

  const content = lines.join("\n");
  const filePath = path.join(outputDir, `AUDIT-${protocol.id}-${date}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  return filePath;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/generators/audit-generator.ts
git commit -m "feat(e2e): add UX audit report generator from protocol timing data

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Integration — Wire Generators Into Test

**Files:**

- Modify: `apps/e2e/tests/protocol.spec.ts`

- [ ] **Step 1: Update protocol.spec.ts to call generators after run**

Replace the entire file content:

```typescript
// apps/e2e/tests/protocol.spec.ts
import { test, expect } from "@playwright/test";
import { runProtocol } from "../runners/protocol-runner";
import { P001_ADMIN_ONBOARDING } from "../protocols/P-001-admin-onboarding";
import { generateDocs } from "../generators/docs-generator";
import { generateMissionDraft } from "../generators/mission-generator";
import { generateAudit } from "../generators/audit-generator";

/**
 * Protocol Verification Tests
 *
 * Each protocol is a complete user journey with control gates between steps.
 * After execution, generators produce docs, mission drafts, and UX audits.
 * Results are persisted to journey_test_run with test_type='protocol'.
 */
test.describe("Protocol Verification", () => {
  test.describe("journey:admin-onboarding", () => {
    test("P-001: Admin Onboarding — full journey", async ({ page }) => {
      test.slow();

      const result = await runProtocol(page, P001_ADMIN_ONBOARDING);

      // Log step results
      for (const step of result.output.steps) {
        console.log(
          `  [${step.status.toUpperCase()}] Step ${step.step_order}: ${step.title} (${step.duration_ms}ms)`,
        );
      }

      // Generate outputs regardless of pass/fail (partial results are useful)
      const docsPath = generateDocs(P001_ADMIN_ONBOARDING, result.output);
      console.log(`  [DOCS] Generated: ${docsPath}`);

      const missionPath = generateMissionDraft(P001_ADMIN_ONBOARDING, result.output);
      console.log(`  [MISSION] Generated: ${missionPath}`);

      const auditPath = generateAudit(P001_ADMIN_ONBOARDING, result.output);
      console.log(`  [AUDIT] Generated: ${auditPath}`);

      // Assert success
      expect(result.success).toBe(true);
      expect(result.output.friction_data.failed_gates).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/e2e && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/tests/protocol.spec.ts
git commit -m "feat(e2e): wire docs, mission, and audit generators into protocol test

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: ADR — Protocol Verification Engine Architecture

**Files:**

- Modify: `docs/decisions/0000-decision-log.md` (add entry)
- Create: `docs/decisions/00XX-protocol-verification-engine.md`

- [ ] **Step 1: Write the ADR**

Create `docs/decisions/00XX-protocol-verification-engine.md` (use next available number):

```markdown
---
title: "ADR-00XX: Protocol Verification Engine Architecture"
status: accepted
updated: 2026-03-29
created: 2026-03-29
module: testing
tags: [adr, protocol, verification, mission, journey]
---

# ADR-00XX: Protocol Verification Engine Architecture

## Context

Smartout has Protokoll packages (Journey + Mission + Roadmap + License) as markdown docs that describe user workflows. We need a system to execute these workflows automatically, verify each step passes, and generate documentation, AI mission drafts, and UX audit reports.

The existing journey system (ADR-0031) provides a metadata registry with 68 journey definitions. ADR-0038 defines output generators (E2E, doc, Linear, Botsson) from journey definitions.

## Decisions

### 1. Generator targets engine_missions + engine_stages, not AgentMission registry

The `AgentMission` type in `registry.ts` is Ultravox-specific (voice, clientTools, monolithic systemPrompt). The Stage Engine's database schema (`engine_missions` + `engine_stages`) is the proper target for structured missions with per-stage goals, instructions, and success criteria.

### 2. journey_step is read-only input

The Protocol Runner reads `journey_step` data for linkage but never writes to it. Protocol definitions are TypeScript files in `apps/e2e/protocols/` containing Playwright-specific execution details (selectors, actions, gates) that don't belong in the journey metadata registry.

### 3. Step results stored as JSONB in journey_test_run.test_output

No new table. Step results are always queried in context of a test run. JSONB avoids RLS, workspace_id, updated_at overhead for a table with no independent lifecycle. A new `'protocol'` value is added to the `journey_test_type` enum.

### 4. Generated missions are always drafts

Generated missions enter with `is_active: false`. Human review is mandatory before they become live. The LLM cannot produce production-ready systemPrompts or tool configurations.

### 5. Protocol definitions are TypeScript, not JSON

TypeScript files provide compile-time validation via Zod schemas, IDE support, and natural composition with Playwright fixtures. They live in `apps/e2e/protocols/`.

### 6. This EXTENDS ADR-0031 and ADR-0038

The Protocol Verification Engine is an additional consumer of the journey metadata registry, not a replacement. It extends the testing capability with control gates and multi-output generation.

## Consequences

- Protocol definitions must be maintained alongside Journey.md docs
- UI changes require updating both the markdown docs and the protocol testid selectors
- Generated missions require human review workflow before production use
```

- [ ] **Step 2: Register in decision log**

Add entry to `docs/decisions/0000-decision-log.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/00XX-protocol-verification-engine.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr): protocol verification engine architecture decisions

Covers: mission target (DB not registry), JSONB storage, read-only
journey_step, draft missions, TypeScript definitions, ADR-0031/0038 extension

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | What                     | Files             | Est.   |
| ---- | ------------------------ | ----------------- | ------ |
| 1    | Protocol schemas + types | 2 create          | 5 min  |
| 2    | Gate checker             | 1 create          | 5 min  |
| 3    | Protocol runner          | 1 create          | 10 min |
| 4    | DB migration             | 1 create, 1 regen | 5 min  |
| 5    | E2E config update        | 3 modify/create   | 3 min  |
| 6    | P-001 definition         | 1 create          | 10 min |
| 7    | Playwright test file     | 1 create          | 3 min  |
| 8    | Docs generator           | 1 create          | 5 min  |
| 9    | Mission generator        | 1 create          | 5 min  |
| 10   | Audit generator          | 1 create          | 5 min  |
| 11   | Wire generators          | 1 modify          | 3 min  |
| 12   | ADR                      | 2 create/modify   | 5 min  |

**Total: 12 tasks, ~64 minutes estimated**

**Note:** P-001 will NOT pass on first run because the onboarding wizard doesn't have `data-testid` attributes yet. That's expected — the protocol definition documents what testids are needed. Adding testids to `apps/web/` components is a separate task (out of scope per spec Section 11).
