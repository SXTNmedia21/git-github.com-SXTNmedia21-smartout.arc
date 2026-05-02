// ============================================
// dispatch.ts
// POST /agent/dispatch — Sixten persona wake endpoint.
//
// Accepts { persona, missionPath } and invokes the registered persona
// handler. Currently supports persona=sixten only.
//
// Auth: inherits stage-engine auth middleware. In dev mode (no DEV_API_KEY
// configured), auth is skipped per existing middleware convention.
//
// Sixten dispatch model:
//   1. Validate missionPath exists + read MISSION.md, LICENSE.md, FLOW.md, RESCUE-PROMPT.md
//   2. Spawn `claude --agent sixten` subprocess with mission context as stdin prompt
//   3. Wait for subprocess exit (timeout: 300s)
//   4. Return { ok, persona, missionPath, output, durationMs }
//
// Why no engine_state write:
//   Phase 0 Sixten is a manual-trigger persona. engine_state integration
//   is Phase 1+ (when heartbeat-dispatcher picks up sixten-tagged rows).
//   The wake-sixten.sh CLI script calls this endpoint directly.
//   ADR-0255 tracks the full integration design.
//
// Connected to: src/index.ts (registered as app.route)
// Connected to: .claude/agents/sixten.md (persona definition)
// Connected to: docs/journeys/<slug>/ (mission folders)
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { baseLogger } from "../../lib/logger.js";
import type { AppVariables } from "../../types/app-env.js";

// Repo root: honour explicit override, otherwise walk up two from cwd.
const REPO_ROOT = process.env.REPO_ROOT ?? resolve(process.cwd(), "../..");

// Sixten agent path
const SIXTEN_AGENT_PATH = resolve(REPO_ROOT, ".claude/agents/sixten.md");

// Registered persona handlers
const REGISTERED_PERSONAS = ["sixten"] as const;
type RegisteredPersona = (typeof REGISTERED_PERSONAS)[number];

const agentDispatch = new Hono<{ Variables: AppVariables }>();

const dispatchSchema = z.object({
  persona: z.enum(REGISTERED_PERSONAS, {
    errorMap: () => ({
      message: `persona must be one of: ${REGISTERED_PERSONAS.join(", ")}`,
    }),
  }),
  missionPath: z
    .string()
    .min(1)
    .describe("Relative path under repo root, e.g. docs/journeys/dev-sixten-hello"),
});

// ── Mission folder reader ────────────────────────────────────────

async function readMissionFolder(missionPath: string): Promise<{
  missionMd: string;
  licenseMd: string;
  flowMd: string;
  rescueMd: string;
}> {
  // Resolve to absolute path. Accept both absolute and repo-relative.
  const absPath = isAbsolute(missionPath) ? missionPath : resolve(REPO_ROOT, missionPath);

  const [missionMd, licenseMd, flowMd, rescueMd] = await Promise.all([
    readFile(resolve(absPath, "MISSION.md"), "utf8"),
    readFile(resolve(absPath, "LICENSE.md"), "utf8"),
    readFile(resolve(absPath, "FLOW.md"), "utf8"),
    readFile(resolve(absPath, "RESCUE-PROMPT.md"), "utf8"),
  ]);

  return { missionMd, licenseMd, flowMd, rescueMd };
}

// ── Sixten persona dispatch ──────────────────────────────────────

/**
 * Build the startup prompt for Sixten from the loaded mission files.
 * This is the full context Sixten receives when he wakes.
 */
function buildSixtenStartupPrompt(missionFolder: {
  missionMd: string;
  licenseMd: string;
  flowMd: string;
  rescueMd: string;
  missionPath: string;
}): string {
  const { missionMd, licenseMd, flowMd, rescueMd, missionPath } = missionFolder;

  return `You are sixten, waking under mission dispatch.

Mission folder loaded: ${missionPath}

=== MISSION.md ===
${missionMd}

=== LICENSE.md ===
${licenseMd}

=== FLOW.md ===
${flowMd}

=== RESCUE-PROMPT.md ===
${rescueMd}

===

You have been dispatched by the mission-pool worker. Read the mission above. Execute every stage in MISSION.md in order. When you have completed all stages and produced the required output, write a brief terminal status: "SIXTEN_MISSION_COMPLETE: <mission_id>".

Constraints from LICENSE.md are binding. If you cannot satisfy a constraint, write "SIXTEN_MISSION_BLOCKED: <reason>" and stop.

Begin.`;
}

/**
 * Invoke Sixten via the claude CLI subprocess.
 * Returns the full stdout + exit code.
 *
 * The claude CLI is invoked with:
 *   claude --agent sixten.md --print "<startup-prompt>"
 *
 * --print runs non-interactively and returns when the agent produces a
 * terminal response. Output goes to stdout. This is the same flag used
 * by CI integrations.
 *
 * Phase 0 constraint: this endpoint must be called from a host environment
 * where the claude CLI is installed and accessible. When stage-engine runs
 * inside Docker, CLAUDE_CLI_PATH must point to the claude binary mounted
 * inside the container, or the request must come from the host CLI
 * (wake-sixten.sh calls claude directly). Phase 1 will use the Anthropic SDK
 * directly to eliminate the CLI dependency.
 */
async function invokeSixten(
  startupPrompt: string,
  timeoutMs = 300_000,
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    // claude CLI path: prefer PATH lookup, then explicit home path
    const claudePath = process.env.CLAUDE_CLI_PATH ?? "claude";

    const proc = spawn(claudePath, ["--agent", SIXTEN_AGENT_PATH, "--print", startupPrompt], {
      cwd: REPO_ROOT,
      env: { ...process.env },
      // stdin: inherit (not needed — prompt is via --print flag)
      // stdout: captured
      // stderr: captured
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Sixten dispatch timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      const exitCode = code ?? 1;

      if (stderr) {
        baseLogger.warn({ stderr: stderr.slice(0, 500) }, "[sixten-dispatch] stderr output");
      }

      resolve({ output: stdout, exitCode });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Route handler ────────────────────────────────────────────────

agentDispatch.post("/agent/dispatch", zValidator("json", dispatchSchema), async (c) => {
  const { persona, missionPath } = c.req.valid("json");
  const startTs = Date.now();

  baseLogger.info({ persona, missionPath }, "[agent-dispatch] dispatch request received");

  // ── 1. Load mission folder ────────────────────────────────────
  let missionFolder: Awaited<ReturnType<typeof readMissionFolder>>;
  try {
    missionFolder = await readMissionFolder(missionPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    baseLogger.warn({ missionPath, err: msg }, "[agent-dispatch] mission folder load failed");
    return c.json(
      {
        ok: false,
        error: "MISSION_NOT_FOUND",
        message: `Mission folder not found or missing required files: ${msg}`,
        missionPath,
      },
      404,
    );
  }

  // ── 2. Dispatch by persona ────────────────────────────────────
  if (persona === "sixten") {
    const startupPrompt = buildSixtenStartupPrompt({ ...missionFolder, missionPath });

    let result: { output: string; exitCode: number };
    try {
      result = await invokeSixten(startupPrompt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      baseLogger.error({ err: msg }, "[agent-dispatch] sixten invocation failed");
      return c.json(
        {
          ok: false,
          error: "PERSONA_INVOKE_FAILED",
          message: msg,
          persona,
          missionPath,
        },
        500,
      );
    }

    const durationMs = Date.now() - startTs;
    const missionComplete = result.output.includes("SIXTEN_MISSION_COMPLETE:");
    const missionBlocked = result.output.includes("SIXTEN_MISSION_BLOCKED:");

    baseLogger.info(
      { persona, missionPath, exitCode: result.exitCode, durationMs, missionComplete },
      "[agent-dispatch] dispatch complete",
    );

    return c.json({
      ok: result.exitCode === 0 && !missionBlocked,
      persona,
      missionPath,
      missionComplete,
      missionBlocked,
      exitCode: result.exitCode,
      durationMs,
      // First 2000 chars of output for caller inspection
      outputPreview: result.output.slice(0, 2000),
    });
  }

  // Should be unreachable due to zod enum validation
  return c.json({ ok: false, error: "UNKNOWN_PERSONA", persona }, 400);
});

export { agentDispatch };
