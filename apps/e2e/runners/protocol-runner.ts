/**
 * Protocol Runner — Playwright executor for JourneyIR documents.
 *
 * Reads a `JourneyIR` (ADR-0178 v2), iterates through steps, executes typed
 * actions, checks typed gates, captures screenshots, and persists results.
 * This is the core orchestration layer of the Protocol Verification Engine.
 *
 * M3.5 (ADR-0178) — retargeted from `ProtocolDefinition` to `JourneyIR`:
 *   - No `ProtocolDefinition` / `../protocols/schema` imports.
 *   - Reads `ir.slug`, `ir.title`, `ir.module`, `ir.actor`, `ir.steps`,
 *     `step.key`, `step.order`, `step.actions`, `step.gate`, `step.screenshot`
 *     — all typed from `@smartout/journey-ir`.
 *   - Throws `RunnerInputError` when required runner-level fields
 *     (`actor`, `actions`, `gate`) are missing on an input IR. Authoring
 *     callers that omit these are not runner inputs; use the authoring
 *     UI (M4) for those shapes.
 *   - Name kept as `runProtocol` / `protocol-runner.ts` for caller-site
 *     stability; the "protocol" nomenclature is legacy file-naming only.
 */

import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  JourneyAction,
  JourneyGate,
  JourneyIR,
  JourneyStep,
  SpeedMultiplier,
} from "@smartout/journey-ir";
import { resolveSpeedMultiplier } from "@smartout/journey-ir";
import { resolveRuntimeSpeedProfile } from "./speed-profile-env";
import type {
  StepResult,
  ProtocolTestOutput,
  ProtocolRunResult,
  GateResult,
  FrictionData,
} from "../protocols/types";
import { checkGate } from "./gate-checker";
import {
  initProgress,
  markStepRunning,
  recordStepResult,
  finalizeProgress,
} from "./progress-writer";
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
// Input errors — surfaces runner-required fields missing on a v2 IR
// ---------------------------------------------------------------------------

/**
 * Thrown when a `JourneyIR` missing a runner-required field is passed to
 * `runProtocol`. `JourneyIR.actor` / `step.actions` / `step.gate` are
 * optional on the IR (authoring surface may omit them) but MANDATORY for
 * a runtime execution — better to throw with a clear path than proceed
 * with undefined behaviour.
 */
export class RunnerInputError extends Error {
  constructor(message: string, path: string) {
    super(`[protocol-runner] ${message} (at: ${path})`);
    this.name = "RunnerInputError";
  }
}

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

async function executeAction(
  page: Page,
  action: JourneyAction,
  vars: VariableContext,
  speedMultiplier: SpeedMultiplier,
): Promise<void> {
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
      await page.waitForTimeout(action.ms * speedMultiplier.settle);
      break;
  }
}

// ---------------------------------------------------------------------------
// Gate query summary — human-readable description of what a gate checks
// ---------------------------------------------------------------------------

function buildGateQuery(gate: JourneyGate): Record<string, unknown> {
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
  slug: string,
  actor: string,
  stepOrder: number,
  stepKey: string,
): string {
  const orderPadded = String(stepOrder).padStart(2, "0");
  const { colorScheme, viewport } = RUNNER_CONFIG;
  const filename = `${slug}_${actor}_${orderPadded}_${stepKey}_${colorScheme}_${viewport.width}x${viewport.height}.png`;
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
  ir: JourneyIR,
  output: ProtocolTestOutput,
  passed: boolean,
): Promise<string | null> {
  // Look up the journey record by module code or slug
  const { data: journey, error: journeyError } = await supabase
    .from("journey")
    .select("journey_id, workspace_id")
    .or(`code.eq.${ir.module},slug.eq.${ir.slug.toLowerCase()}`)
    .maybeSingle();

  if (journeyError || !journey) {
    console.warn(
      `[protocol-runner] No journey found for IR ${ir.slug} (module: ${ir.module}). Skipping persistence.`,
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
// Runner input guard — enforce runner-required IR fields
// ---------------------------------------------------------------------------

/**
 * JourneyIR v2 makes several fields optional at the schema level so
 * authoring consumers (M4 UI, docs/mission/audit generators) can parse a
 * partial IR. The runner however requires each of these to execute a step
 * deterministically. This guard throws with a precise path when one is
 * missing — loud failure beats silent wrong behaviour.
 */
function assertRunnerInputs(ir: JourneyIR): asserts ir is JourneyIR & {
  actor: NonNullable<JourneyIR["actor"]>;
  steps: readonly (JourneyStep & {
    actions: readonly JourneyAction[];
    gate: JourneyGate;
  })[];
} {
  if (ir.actor === undefined) {
    throw new RunnerInputError("JourneyIR.actor is required for a runtime run", "$.actor");
  }
  ir.steps.forEach((step, index) => {
    if (step.actions === undefined) {
      throw new RunnerInputError(
        "step.actions is required for a runtime run (IR v2)",
        `$.steps[${index}].actions`,
      );
    }
    if (step.gate === undefined) {
      throw new RunnerInputError(
        "step.gate is required for a runtime run (IR v2)",
        `$.steps[${index}].gate`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Main runner — executes a full JourneyIR run and returns structured results
// ---------------------------------------------------------------------------

/**
 * Run a `JourneyIR` document against a Playwright page.
 *
 * For each step: execute actions → settle for animations → check gate →
 * capture screenshot → record timing. If a gate fails, execution stops
 * and partial results are returned.
 *
 * Results are persisted to the `journey_test_run` table via Supabase when
 * a matching `journey` row exists.
 *
 * M3.5 (ADR-0178): input is `JourneyIR`, not a legacy protocol shape.
 * Samples emit `JourneyIR` v2 directly; the migration adapter has been
 * retired (ADR-0174 C.11 closed at M3.5 exit).
 */
export async function runProtocol(
  page: Page,
  ir: JourneyIR,
  variables?: Partial<VariableContext>,
): Promise<ProtocolRunResult> {
  assertRunnerInputs(ir);

  const vars = buildDefaultContext(variables);
  const stepResults: StepResult[] = [];

  const speedProfile = resolveRuntimeSpeedProfile(ir.speed_profile);
  const speedMultiplier = resolveSpeedMultiplier(speedProfile);
  console.log(`[runner] speed profile: ${speedProfile} (settle×${speedMultiplier.settle})`);

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

  // Initialize progress file for live dashboard monitoring
  initProgress(ir);

  for (let i = 0; i < ir.steps.length; i++) {
    const step = ir.steps[i]!;
    const actions = step.actions!;
    const gate = step.gate!;
    const stepOrder = step.order ?? i + 1;

    markStepRunning(ir.slug, i);
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
      for (const action of actions) {
        await executeAction(page, action, vars, speedMultiplier);
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
      await page.waitForTimeout(RUNNER_CONFIG.settleDelay * speedMultiplier.settle);
      settleMs = Date.now() - settleStart;
    }

    // 3. CHECK gate
    if (!stepFailed) {
      const gateStart = Date.now();
      gateResult = await checkGate(gate, page, supabase, speedMultiplier);
      gateMs = Date.now() - gateStart;

      if (!gateResult.passed) {
        stepFailed = true;
      }
    }

    // 4. CAPTURE screenshot (if configured for this step — default true)
    const shouldScreenshot = step.screenshot ?? true;
    if (shouldScreenshot) {
      const ssPath = buildScreenshotPath(ir.slug, ir.actor, stepOrder, step.key);
      try {
        await page.screenshot({ path: ssPath, fullPage: false });
        screenshotPath = ssPath;
      } catch (err) {
        console.warn(
          `[protocol-runner] Screenshot failed for step ${step.key}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 5. RECORD timing and gate result
    const durationMs = Date.now() - stepStart;
    const stepResult: StepResult = {
      step_id: step.key,
      step_order: stepOrder,
      title: step.title,
      status: stepFailed ? "failed" : "passed",
      gate_type: gate.type,
      gate_query: buildGateQuery(gate),
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
    recordStepResult(ir.slug, i, stepResult);

    // 6. If gate fails → STOP, persist partial results
    if (stepFailed) {
      allPassed = false;
      break;
    }
  }

  // Build the full test output with friction analysis
  const output: ProtocolTestOutput = {
    protocol_id: ir.slug,
    protocol_name: ir.title,
    steps: stepResults,
    friction_data: buildFrictionData(stepResults),
  };

  // Finalize progress file
  finalizeProgress(ir.slug, allPassed);

  // Persist to database (non-blocking — failures are logged, not thrown)
  const journeyTestRunId = await persistTestRun(supabase, ir, output, allPassed);

  return {
    success: allPassed,
    output,
    journey_test_run_id: journeyTestRunId,
  };
}
