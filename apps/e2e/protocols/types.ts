/**
 * Protocol Verification Engine — Output Types
 *
 * Runtime result types produced by the protocol runner after executing
 * a protocol definition. These are NOT Zod schemas — they describe
 * what comes OUT of a test run, not what goes IN.
 */

/** Result of evaluating a single gate (db_record, ui_state, or url_match) */
export type GateResult = {
  passed: boolean;
  data?: Record<string, unknown> | null;
  error?: string;
};

/** Execution status of an individual protocol step */
export type StepStatus = "passed" | "failed" | "skipped" | "timeout";

/** Detailed timing breakdown for a single step */
export type StepTiming = {
  action_ms: number;
  settle_ms: number;
  gate_ms: number;
};

/** Result of executing a single protocol step */
export type StepResult = {
  step_id: string;
  step_order: number;
  title: string;
  status: StepStatus;
  gate_type: string;
  gate_query: Record<string, unknown>;
  gate_result: Record<string, unknown>;
  screenshot_path: string | null;
  duration_ms: number;
  timing: StepTiming;
};

/** Friction analysis data extracted from the protocol run */
export type FrictionData = {
  total_duration_ms: number;
  slowest_step: string;
  failed_gates: string[];
  notes: string[];
};

/** Full output of a protocol test run — all steps plus friction analysis */
export type ProtocolTestOutput = {
  protocol_id: string;
  protocol_name: string;
  steps: StepResult[];
  friction_data: FrictionData;
};

/** Top-level result returned by the protocol runner */
export type ProtocolRunResult = {
  success: boolean;
  output: ProtocolTestOutput;
  journey_test_run_id: string | null;
};
