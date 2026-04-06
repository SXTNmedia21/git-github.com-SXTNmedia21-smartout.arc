/**
 * POST /api/platform-admin/e2e/run
 *
 * Spawns a Playwright child process for a given test spec, grep pattern, or suite.
 * Enforces a single concurrent run — returns 409 if one is already active.
 * The `activeRuns` map is exported so the companion SSE stream endpoint can read lines.
 */

import { NextResponse, type NextRequest } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import { getSuperAdminId } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export type ActiveRun = {
  process: ChildProcess;
  startedAt: number;
  lines: string[];
  done: boolean;
};

// Module-level store — one process per server instance, exported for the stream endpoint.
export const activeRuns = new Map<string, ActiveRun>();

const SAFETY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes after done

type RequestBody = {
  spec?: string;
  grep?: string;
  suite?: "smoke" | "full";
};

export async function POST(req: NextRequest) {
  // Auth guard — godmode only
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Allow only one concurrent run to keep server load predictable
  const activeRunEntry = [...activeRuns.entries()].find(([, run]) => !run.done);
  if (activeRunEntry) {
    const [activeRunId] = activeRunEntry;
    return NextResponse.json({ error: "Run already active", activeRunId }, { status: 409 });
  }

  const body: RequestBody = await req.json().catch(() => ({}));
  const { spec, grep, suite } = body;

  const runId = randomUUID().slice(0, 8);

  // Build Playwright CLI args
  const args: string[] = ["playwright", "test", "--project=web"];

  if (suite === "smoke") {
    args.push("--grep", "@smoke");
  } else if (grep) {
    args.push("--grep", grep);
  }

  if (spec) {
    args.push(`tests/${spec}`);
  }

  // Next.js cwd is apps/web — step up two levels to reach apps/e2e
  const cwd = path.resolve(process.cwd(), "../../apps/e2e");

  const child = spawn("npx", args, {
    cwd,
    env: {
      ...process.env,
      E2E_SSE: "1",
      SKIP_WEB_SERVER: "1",
      CI: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const run: ActiveRun = {
    process: child,
    startedAt: Date.now(),
    lines: [],
    done: false,
  };

  activeRuns.set(runId, run);

  // Collect stdout lines as structured JSON
  child.stdout?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) {
        run.lines.push(JSON.stringify({ type: "log", line }));
      }
    }
  });

  // Wrap stderr lines identically — callers can distinguish via type field if needed
  child.stderr?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) {
        run.lines.push(JSON.stringify({ type: "log", line }));
      }
    }
  });

  child.on("close", (code) => {
    run.lines.push(JSON.stringify({ type: "done", exitCode: code ?? -1 }));
    run.done = true;

    // Clean up after 5 minutes so the stream endpoint can still read lines after close
    setTimeout(() => {
      activeRuns.delete(runId);
    }, CLEANUP_DELAY_MS);
  });

  // Safety valve — kill the process after 10 minutes regardless
  const safetyTimer = setTimeout(() => {
    if (!run.done) {
      run.lines.push(
        JSON.stringify({ type: "log", line: "[runner] Safety timeout — killing process" }),
      );
      child.kill("SIGTERM");
    }
  }, SAFETY_TIMEOUT_MS);

  // Don't let the timer keep the Node process alive
  safetyTimer.unref();

  return NextResponse.json({ runId });
}
