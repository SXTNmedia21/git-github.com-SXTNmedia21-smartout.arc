/**
 * Journey runner — spawns Playwright child process for a given compiled
 * IR slug, captures stdout/stderr lines + progress JSON.
 *
 * Mirrors apps/web/src/app/api/platform-admin/e2e/run/route.ts pattern
 * (single concurrent run, 10-min safety timeout, 5-min cleanup) but
 * pinned to file-based protocol slugs and adds speed-profile env var.
 */

import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import type { SpeedProfile } from "@smartout/journey-ir";

export type ActiveRun = {
  runId: string;
  slug: string;
  speedProfile: SpeedProfile;
  process: ChildProcess;
  startedAt: number;
  lines: string[];
  done: boolean;
  exitCode: number | null;
};

export const activeRuns = new Map<string, ActiveRun>();

const SAFETY_TIMEOUT_MS = 10 * 60 * 1000;
const CLEANUP_DELAY_MS = 5 * 60 * 1000;

export type StartRunInput = {
  slug: string;
  speedProfile: SpeedProfile;
  repoRoot: string;
};

export type StartRunResult = { ok: true; runId: string } | { ok: false; error: string };

export function startRun(input: StartRunInput): StartRunResult {
  const existing = [...activeRuns.values()].find((r) => !r.done);
  if (existing) return { ok: false, error: `Run already active: ${existing.runId}` };

  const runId = randomUUID().slice(0, 8);
  const e2eDir = path.join(input.repoRoot, "apps/e2e");

  const child = spawn(
    "npx",
    ["playwright", "test", "tests/protocol.spec.ts", "--project=web", "--reporter=list"],
    {
      cwd: e2eDir,
      env: {
        ...process.env,
        JOURNEY_SPEED_PROFILE: input.speedProfile,
        JOURNEY_PROTOCOL_SLUG: input.slug,
        SKIP_WEB_SERVER: "1",
        CI: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const run: ActiveRun = {
    runId,
    slug: input.slug,
    speedProfile: input.speedProfile,
    process: child,
    startedAt: Date.now(),
    lines: [],
    done: false,
    exitCode: null,
  };

  activeRuns.set(runId, run);

  child.stdout?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) run.lines.push(JSON.stringify({ type: "stdout", line }));
    }
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) run.lines.push(JSON.stringify({ type: "stderr", line }));
    }
  });

  child.on("exit", (code) => {
    run.done = true;
    run.exitCode = code;
    run.lines.push(JSON.stringify({ type: "done", exitCode: code }));
    setTimeout(() => activeRuns.delete(runId), CLEANUP_DELAY_MS);
  });

  setTimeout(() => {
    if (!run.done) {
      child.kill("SIGKILL");
      run.lines.push(JSON.stringify({ type: "killed", reason: "safety_timeout" }));
    }
  }, SAFETY_TIMEOUT_MS);

  return { ok: true, runId };
}

export function abortRun(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (!run || run.done) return false;
  run.process.kill("SIGTERM");
  return true;
}
