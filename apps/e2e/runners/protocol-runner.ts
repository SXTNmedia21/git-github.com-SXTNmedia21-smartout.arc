/**
 * Protocol Runner — Playwright executor for protocol definitions.
 *
 * Reads a protocol definition, iterates through steps, executes actions,
 * checks gates, captures screenshots, and persists results to the database.
 * This is the core orchestration layer of the Protocol Verification Engine.
 */

import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ProtocolDefinition, Action, Gate } from "../protocols/schema";
import type {
  StepResult,
  ProtocolTestOutput,
  ProtocolRunResult,
  GateResult,
  FrictionData,
} from "../protocols/types";
import { checkGate } from "./gate-checker";
import * as path from "path";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Variable context — auth credentials and fixture data for interpolation
// ---------------------------------------------------------------------------

type VariableContext = {
  auth: { email: string; password: string };
  fixture: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Runner configuration — viewport, timing, and output paths
// ---------------------------------------------------------------------------

const RUNNER_CONFIG = {
  viewport: { width: 1440, height: 900 },
  colorScheme: "light" as const,
  settleDelay: 1500,
  screenshotDir: "./test-results/protocols",
};

// ---------------------------------------------------------------------------
// Variable interpolation — replaces {{auth.email}}, {{fixture.x}}, etc.
// ---------------------------------------------------------------------------

function interpolate(template: string, vars: VariableContext): string {
  return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_match, group, key) => {
    if (group === "auth") {
      const authRecord = vars.auth as Record<string, string>;
      return authRecord[key] ?? _match;
    }
    if (group === "fixture") {
      return vars.fixture[key] ?? _match;
    }
    return _match;
  });
}

// ---------------------------------------------------------------------------
// Default variable context — uses env vars with sensible fallbacks
// ---------------------------------------------------------------------------

function buildDefaultContext(overrides?: Partial<VariableContext>): VariableContext {
  return {
    auth: {
      email: overrides?.auth?.email ?? process.env.E2E_EMAIL ?? "admin@smartout.local",
      password: overrides?.auth?.password ?? process.env.E2E_PASSWORD ?? "password123",
    },
    fixture: {
      ...overrides?.fixture,
    },
  };
}

// ---------------------------------------------------------------------------
// Action executor — dispatches browser interactions by action type
// ---------------------------------------------------------------------------

async function executeAction(page: Page, action: Action, vars: VariableContext): Promise<void> {
  // Dismiss Next.js dev overlay before any interaction (it intercepts pointer events)
  await page
    .evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    })
    .catch(() => {});

  switch (action.type) {
    case "navigate":
      await page.goto(interpolate(action.url, vars));
      break;

    case "fill":
      await page.getByTestId(action.testid).fill(interpolate(action.value, vars));
      break;

    case "click":
      await page.getByTestId(action.testid).click({ force: true });
      break;

    case "click_text":
      await page.getByText(action.text, { exact: false }).first().click({ force: true });
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

// ---------------------------------------------------------------------------
// Gate query summary — human-readable description of what a gate checks
// ---------------------------------------------------------------------------

function buildGateQuery(gate: Gate): Record<string, unknown> {
  switch (gate.type) {
    case "db_record":
      return { table: gate.table, where: gate.where };
    case "ui_state":
      return { testid: gate.testid, visible: gate.visible };
    case "url_match":
      return { pattern: gate.pattern };
    case "telemetry_event":
      return { event_name: gate.event_name, actor_id: gate.actor_id };
  }
}

// ---------------------------------------------------------------------------
// Screenshot capture — deterministic naming for visual diffing
// ---------------------------------------------------------------------------

function buildScreenshotPath(
  protocolId: string,
  actor: string,
  stepOrder: number,
  stepId: string,
): string {
  const orderPadded = String(stepOrder).padStart(2, "0");
  const { colorScheme, viewport } = RUNNER_CONFIG;
  const filename = `${protocolId}_${actor}_${orderPadded}_${stepId}_${colorScheme}_${viewport.width}x${viewport.height}.png`;
  return path.join(RUNNER_CONFIG.screenshotDir, filename);
}

// ---------------------------------------------------------------------------
// Friction data builder — extracts timing anomalies from step results
// ---------------------------------------------------------------------------

function buildFrictionData(steps: StepResult[]): FrictionData {
  const totalDurationMs = steps.reduce((sum, s) => sum + s.duration_ms, 0);

  let slowestStep = steps[0]?.step_id ?? "unknown";
  let slowestMs = 0;
  for (const step of steps) {
    if (step.duration_ms > slowestMs) {
      slowestMs = step.duration_ms;
      slowestStep = step.step_id;
    }
  }

  const failedGates = steps.filter((s) => s.status !== "passed").map((s) => s.step_id);

  const notes: string[] = [];
  for (const step of steps) {
    if (step.timing.gate_ms > 5000) {
      notes.push(`Step ${step.step_id} gate took ${step.timing.gate_ms}ms`);
    }
  }

  return {
    total_duration_ms: totalDurationMs,
    slowest_step: slowestStep,
    failed_gates: failedGates,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Result persistence — stores test run in journey_test_run table
// ---------------------------------------------------------------------------

async function persistTestRun(
  supabase: SupabaseClient,
  protocol: ProtocolDefinition,
  output: ProtocolTestOutput,
  passed: boolean,
): Promise<string | null> {
  // Look up the journey record by package_id code or protocol id slug
  const { data: journey, error: journeyError } = await supabase
    .from("journey")
    .select("journey_id, workspace_id")
    .or(`code.eq.${protocol.package_id},slug.eq.${protocol.id.toLowerCase()}`)
    .maybeSingle();

  if (journeyError || !journey) {
    console.warn(
      `[protocol-runner] No journey found for protocol ${protocol.id} (package: ${protocol.package_id}). Skipping persistence.`,
    );
    return null;
  }

  // Collect error messages from failed steps
  const failedSteps = output.steps.filter((s) => s.status !== "passed");
  const errorMessage =
    failedSteps.length > 0
      ? failedSteps.map((s) => `Step ${s.step_id}: ${JSON.stringify(s.gate_result)}`).join("; ")
      : null;

  const { data: run, error: insertError } = await supabase
    .from("journey_test_run")
    .insert({
      journey_id: journey.journey_id,
      workspace_id: journey.workspace_id,
      result: passed ? "pass" : "fail",
      test_type: "protocol",
      duration_ms: output.friction_data.total_duration_ms,
      error_message: errorMessage,
      test_output: output as unknown as Record<string, unknown>,
    })
    .select("journey_test_run_id")
    .single();

  if (insertError) {
    console.error(`[protocol-runner] Failed to persist test run: ${insertError.message}`);
    return null;
  }

  return run.journey_test_run_id as string;
}

// ---------------------------------------------------------------------------
// Main runner — executes a full protocol and returns structured results
// ---------------------------------------------------------------------------

/**
 * Run a protocol definition against a Playwright page.
 *
 * For each step: execute actions → settle for animations → check gate →
 * capture screenshot → record timing. If a gate fails, execution stops
 * and partial results are returned.
 *
 * Results are persisted to the journey_test_run table via Supabase when
 * a matching journey record exists.
 */
export async function runProtocol(
  page: Page,
  protocol: ProtocolDefinition,
  variables?: Partial<VariableContext>,
): Promise<ProtocolRunResult> {
  const vars = buildDefaultContext(variables);
  const stepResults: StepResult[] = [];

  // Configure viewport and media for consistent rendering
  await page.setViewportSize(RUNNER_CONFIG.viewport);
  await page.emulateMedia({ colorScheme: RUNNER_CONFIG.colorScheme });

  // Ensure screenshot directory exists
  fs.mkdirSync(RUNNER_CONFIG.screenshotDir, { recursive: true });

  // Create Supabase client for gate checks and persistence
  const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let allPassed = true;

  for (const step of protocol.steps) {
    const stepStart = Date.now();
    let actionMs = 0;
    let settleMs = 0;
    let gateMs = 0;
    let gateResult: GateResult = { passed: false, error: "Not evaluated" };
    let screenshotPath: string | null = null;
    let stepFailed = false;

    // 1. EXECUTE actions
    const actionStart = Date.now();
    try {
      for (const action of step.actions) {
        await executeAction(page, action, vars);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      gateResult = { passed: false, error: `Action failed: ${errorMessage}` };
      stepFailed = true;
    }
    actionMs = Date.now() - actionStart;

    // 2. SETTLE — wait for spring animations to complete
    if (!stepFailed) {
      const settleStart = Date.now();
      await page.waitForTimeout(RUNNER_CONFIG.settleDelay);
      settleMs = Date.now() - settleStart;
    }

    // 3. CHECK gate
    if (!stepFailed) {
      const gateStart = Date.now();
      gateResult = await checkGate(step.gate, page, supabase);
      gateMs = Date.now() - gateStart;

      if (!gateResult.passed) {
        stepFailed = true;
      }
    }

    // 4. CAPTURE screenshot (if configured for this step)
    if (step.screenshot) {
      const ssPath = buildScreenshotPath(protocol.id, protocol.actor, step.order, step.id);
      try {
        await page.screenshot({ path: ssPath, fullPage: false });
        screenshotPath = ssPath;
      } catch (err) {
        console.warn(
          `[protocol-runner] Screenshot failed for step ${step.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 5. RECORD timing and gate result
    const durationMs = Date.now() - stepStart;
    const stepResult: StepResult = {
      step_id: step.id,
      step_order: step.order,
      title: step.title,
      status: stepFailed ? "failed" : "passed",
      gate_type: step.gate.type,
      gate_query: buildGateQuery(step.gate),
      gate_result: {
        passed: gateResult.passed,
        ...(gateResult.data !== undefined ? { data: gateResult.data } : {}),
        ...(gateResult.error !== undefined ? { error: gateResult.error } : {}),
      },
      screenshot_path: screenshotPath,
      duration_ms: durationMs,
      timing: {
        action_ms: actionMs,
        settle_ms: settleMs,
        gate_ms: gateMs,
      },
    };

    stepResults.push(stepResult);

    // 6. If gate fails → STOP, persist partial results
    if (stepFailed) {
      allPassed = false;
      break;
    }
  }

  // Build the full test output with friction analysis
  const output: ProtocolTestOutput = {
    protocol_id: protocol.id,
    protocol_name: protocol.name,
    steps: stepResults,
    friction_data: buildFrictionData(stepResults),
  };

  // Persist to database (non-blocking — failures are logged, not thrown)
  const journeyTestRunId = await persistTestRun(supabase, protocol, output, allPassed);

  return {
    success: allPassed,
    output,
    journey_test_run_id: journeyTestRunId,
  };
}
