// ============================================
// queue.ts
// GET  /agent/queue        — list all tasks (Harness UI consumer)
// GET  /agent/queue/:id    — single task by id
// PUT  /agent/queue/:id    — patch status/last_result (called by personas at completion)
//
// Backed by a JSON file at infra/sixten/queue.json. The path is resolved via
// SIXTEN_QUEUE_PATH env var with a fallback to <REPO_ROOT>/infra/sixten/queue.json.
// In Docker, mount the file as /app/infra/sixten/queue.json (read+write).
//
// Phase 0.5 scope:
//   - Read-only listing for UI (full queue object).
//   - Status patches for personas at completion. No create/delete from API.
//   - Concurrent writes are guarded by mtime-checked optimistic locking
//     (read mtime, mutate, write only if mtime unchanged). Single dispatcher
//     + single agent path means contention is minimal in Phase 0.5.
//
// Why not a DB table:
//   ADR-0255 Phase 1 promotes queue items into engine_state rows (proper
//   workspace scoping, RLS, distributed claim). Phase 0.5 stays file-based
//   to validate the schema before paying migration cost.
//
// Connected to: infra/sixten/queue.json
// Connected to: infra/sixten/dispatcher.sh
// Connected to: ADR-0255 Phase 0.5 addendum
// ============================================

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { baseLogger } from "../../lib/logger.js";
import type { AppVariables } from "../../types/app-env.js";

const REPO_ROOT = process.env.REPO_ROOT ?? resolve(process.cwd(), "../..");
const QUEUE_PATH = process.env.SIXTEN_QUEUE_PATH ?? resolve(REPO_ROOT, "infra/sixten/queue.json");

// ── Schema ───────────────────────────────────────────────────────

const scheduleSchema = z.object({
  type: z.enum(["once", "recurring"]),
  interval_seconds: z.number().int().nonnegative().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  persona: z.string().min(1),
  missionPath: z.string().min(1),
  instruction: z.string(),
  schedule: scheduleSchema,
  status: z.enum(["pending", "in_progress", "completed", "failed", "paused"]),
  priority: z.number().int(),
  created_at: z.string().datetime(),
  last_run_at: z.string().datetime().nullable(),
  next_run_at: z.string().datetime().nullable(),
  last_result: z
    .object({
      terminal: z.string(),
      http_code: z.number().int().optional(),
    })
    .nullable(),
});

const queueFileSchema = z.object({
  version: z.literal(1),
  tasks: z.array(taskSchema),
});

type Task = z.infer<typeof taskSchema>;
type QueueFile = z.infer<typeof queueFileSchema>;

const patchSchema = z
  .object({
    status: z.enum(["pending", "in_progress", "completed", "failed", "paused"]).optional(),
    last_result: z
      .object({
        terminal: z.string(),
        http_code: z.number().int().optional(),
      })
      .nullable()
      .optional(),
    next_run_at: z.string().datetime().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "patch body must include at least one field",
  });

// ── File I/O ─────────────────────────────────────────────────────

async function readQueue(): Promise<{ queue: QueueFile; mtimeMs: number }> {
  const [raw, info] = await Promise.all([readFile(QUEUE_PATH, "utf8"), stat(QUEUE_PATH)]);
  const parsed = JSON.parse(raw);
  const queue = queueFileSchema.parse(parsed);
  return { queue, mtimeMs: info.mtimeMs };
}

async function writeQueue(queue: QueueFile, expectedMtimeMs: number): Promise<void> {
  const current = await stat(QUEUE_PATH);
  if (current.mtimeMs !== expectedMtimeMs) {
    throw new Error("QUEUE_MUTATED_CONCURRENTLY");
  }
  await writeFile(QUEUE_PATH, JSON.stringify(queue, null, 2) + "\n", "utf8");
}

// ── Routes ───────────────────────────────────────────────────────

const agentQueue = new Hono<{ Variables: AppVariables }>();

agentQueue.get("/agent/queue", async (c) => {
  try {
    const { queue } = await readQueue();
    return c.json({ ok: true, ...queue });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    baseLogger.warn({ err: msg, path: QUEUE_PATH }, "[agent-queue] read failed");
    return c.json({ ok: false, error: "QUEUE_READ_FAILED", message: msg }, 500);
  }
});

agentQueue.get("/agent/queue/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const { queue } = await readQueue();
    const task = queue.tasks.find((t) => t.id === id);
    if (!task) {
      return c.json({ ok: false, error: "TASK_NOT_FOUND", id }, 404);
    }
    return c.json({ ok: true, task });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ ok: false, error: "QUEUE_READ_FAILED", message: msg }, 500);
  }
});

agentQueue.put("/agent/queue/:id", zValidator("json", patchSchema), async (c) => {
  const id = c.req.param("id");
  const patch = c.req.valid("json");

  try {
    const { queue, mtimeMs } = await readQueue();
    const idx = queue.tasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      return c.json({ ok: false, error: "TASK_NOT_FOUND", id }, 404);
    }

    const current = queue.tasks[idx];
    const updated: Task = {
      ...current,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.last_result !== undefined ? { last_result: patch.last_result } : {}),
      ...(patch.next_run_at !== undefined ? { next_run_at: patch.next_run_at } : {}),
    };

    queue.tasks[idx] = updated;

    try {
      await writeQueue(queue, mtimeMs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "QUEUE_MUTATED_CONCURRENTLY") {
        return c.json({ ok: false, error: "QUEUE_MUTATED_CONCURRENTLY" }, 409);
      }
      throw e;
    }

    baseLogger.info({ id, patch }, "[agent-queue] task patched");
    return c.json({ ok: true, task: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    baseLogger.warn({ err: msg, id }, "[agent-queue] patch failed");
    return c.json({ ok: false, error: "QUEUE_PATCH_FAILED", message: msg }, 500);
  }
});

export { agentQueue };
