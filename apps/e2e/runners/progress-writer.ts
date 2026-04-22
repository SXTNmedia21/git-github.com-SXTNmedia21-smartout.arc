/**
 * Progress Writer — writes a JSON progress file after each run step.
 * The local monitor dashboard polls this file to show real-time execution.
 *
 * Files are per-run to avoid concurrency conflicts:
 * progress-{slug}-{timestamp}.json
 *
 * M3.5 (ADR-0178): migrated from `ProtocolDefinition` input to `JourneyIR`
 * to keep the runner fully on the canonical IR primitive.
 */

import * as fs from "fs";
import * as path from "path";
import type { JourneyGate, JourneyIR } from "@smartout/journey-ir";
import type { StepResult } from "../protocols/types";

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

export function initProgress(ir: JourneyIR): string {
  runTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  runStartTime = Date.now();

  const progressDir = path.resolve(PROGRESS_DIR);
  fs.mkdirSync(progressDir, { recursive: true });

  const progress: ProgressFile = {
    protocol_id: ir.slug,
    protocol_name: ir.title,
    actor: ir.actor ?? "unknown",
    status: "running",
    current_step: 0,
    total_steps: ir.steps.length,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    elapsed_ms: 0,
    steps: ir.steps.map((s, i) => ({
      id: s.key,
      order: s.order ?? i + 1,
      title: s.title,
      status: "pending" as const,
      duration_ms: null,
      gate_type: s.gate?.type ?? "unknown",
      gate_summary: s.gate ? formatGateSummary(s.gate) : s.assertion,
      screenshot: null,
      started_at: null,
    })),
  };

  const filePath = getProgressPath(ir.slug);
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2), "utf-8");
  return filePath;
}

export function markStepRunning(slug: string, stepIndex: number): void {
  const progress = readProgress(slug);
  if (!progress) return;

  progress.current_step = stepIndex + 1;
  progress.updated_at = new Date().toISOString();
  progress.elapsed_ms = runStartTime ? Date.now() - runStartTime : 0;
  progress.steps[stepIndex].status = "running";
  progress.steps[stepIndex].started_at = new Date().toISOString();

  writeProgress(slug, progress);
}

export function recordStepResult(slug: string, stepIndex: number, result: StepResult): void {
  const progress = readProgress(slug);
  if (!progress) return;

  progress.updated_at = new Date().toISOString();
  progress.elapsed_ms = runStartTime ? Date.now() - runStartTime : 0;
  progress.steps[stepIndex].status = result.status;
  progress.steps[stepIndex].duration_ms = result.duration_ms;
  progress.steps[stepIndex].screenshot = result.screenshot_path;

  writeProgress(slug, progress);
}

export function finalizeProgress(slug: string, passed: boolean): void {
  const progress = readProgress(slug);
  if (!progress) return;

  progress.status = passed ? "passed" : "failed";
  progress.updated_at = new Date().toISOString();
  progress.elapsed_ms = runStartTime ? Date.now() - runStartTime : 0;

  writeProgress(slug, progress);
}

function getProgressPath(slug: string): string {
  return path.resolve(PROGRESS_DIR, `progress-${slug}-${runTimestamp}.json`);
}

function readProgress(slug: string): ProgressFile | null {
  try {
    return JSON.parse(fs.readFileSync(getProgressPath(slug), "utf-8")) as ProgressFile;
  } catch {
    return null;
  }
}

function writeProgress(slug: string, progress: ProgressFile): void {
  fs.writeFileSync(getProgressPath(slug), JSON.stringify(progress, null, 2), "utf-8");
}

function formatGateSummary(gate: JourneyGate): string {
  switch (gate.type) {
    case "db_record":
      return `DB: ${gate.table} where ${JSON.stringify(gate.where)}`;
    case "ui_state":
      return `UI: [${gate.testid}] ${gate.visible === false ? "hidden" : "visible"}`;
    case "url_match":
      return `URL: ${gate.pattern}`;
    case "telemetry_event":
      return `Event: ${gate.event_name}`;
  }
}
