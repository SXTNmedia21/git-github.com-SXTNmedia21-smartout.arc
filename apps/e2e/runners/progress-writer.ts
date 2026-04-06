/**
 * Progress Writer — writes a JSON progress file after each protocol step.
 * The local monitor dashboard polls this file to show real-time execution.
 *
 * Files are per-run to avoid concurrency conflicts:
 * progress-{protocol_id}-{timestamp}.json
 */

import * as fs from "fs";
import * as path from "path";
import type { ProtocolDefinition } from "../protocols/schema";
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
      status: "pending" as const,
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

export function finalizeProgress(protocolId: string, passed: boolean): void {
  const progress = readProgress(protocolId);
  if (!progress) return;

  progress.status = passed ? "passed" : "failed";
  progress.updated_at = new Date().toISOString();
  progress.elapsed_ms = runStartTime ? Date.now() - runStartTime : 0;

  writeProgress(protocolId, progress);
}

function getProgressPath(protocolId: string): string {
  return path.resolve(PROGRESS_DIR, `progress-${protocolId}-${runTimestamp}.json`);
}

function readProgress(protocolId: string): ProgressFile | null {
  try {
    return JSON.parse(fs.readFileSync(getProgressPath(protocolId), "utf-8")) as ProgressFile;
  } catch {
    return null;
  }
}

function writeProgress(protocolId: string, progress: ProgressFile): void {
  fs.writeFileSync(getProgressPath(protocolId), JSON.stringify(progress, null, 2), "utf-8");
}

function formatGateSummary(gate: ProtocolDefinition["steps"][0]["gate"]): string {
  switch (gate.type) {
    case "db_record":
      return `DB: ${gate.table} where ${JSON.stringify(gate.where)}`;
    case "ui_state":
      return `UI: [${gate.testid}] ${gate.visible ? "visible" : "hidden"}`;
    case "url_match":
      return `URL: ${gate.pattern}`;
    case "telemetry_event":
      return `Event: ${gate.event_name}`;
  }
}
