/**
 * BFF /api/mobile/tasks/[id]/complete — mobile completes a task.
 *
 * PATCH (legacy, session_task only):
 *   Body MUST be empty (strict schema rejects unknown keys).
 *   Delegates to completeSessionTaskAction with channel='system'.
 *
 * POST (ADR-0298 Sortie 3 — source-dispatched complete):
 *   Body: { source: 'session'|'personal'|'day_ad_hoc'|'emma' }.
 *   Delegates directly to task.complete tool body (direct import).
 *   Covers all four task sources via the capability tool's source dispatcher.
 *   No emit here — the tool body owns gate + mutation + emit.
 *
 * Per ADR-0132 + ADR-0151 + Spec §4.6:
 * - Bearer JWT only; identity ALWAYS derived from JWT (never request body).
 * - Double-emit guard: do NOT add emit() here — tool body emits "task completed".
 *
 * References: ADR-0078, ADR-0099, ADR-0114, ADR-0132, ADR-0134,
 *             ADR-0151, ADR-0266, ADR-0298.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveMobileActor } from "../../../_shared/actor";
import { completeSessionTaskAction } from "@/app/dashboard/_actions/complete-session-task-action";
import { createAdminClient } from "@smartout/supabase/admin";
import { complete } from "@smartout/ai/capabilities/task/tools";
import type { NonEmptyString } from "@smartout/telemetry/server";

export const runtime = "nodejs";

// ─── PATCH — legacy session_task complete (empty body) ──────────────────────

// Strict empty-body schema — rejects ALL unknown keys per ADR-0151.
const PatchRequestSchema = z.object({}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // 1. Validate path param via z.string().uuid() (NOT loose regex).
  const { id: taskId } = await params;
  if (!z.string().uuid().safeParse(taskId).success) {
    return NextResponse.json({ ok: false, error: "Ugyldig oppgave-ID" }, { status: 422 });
  }

  // 2. Bearer auth.
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const actor = await resolveMobileActor(bearerToken);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse body — strict empty object.
  let bodyRaw: unknown = {};
  try {
    const text = await request.text();
    bodyRaw = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Ugyldig JSON" }, { status: 422 });
  }
  const parsed = PatchRequestSchema.safeParse(bodyRaw);
  if (!parsed.success) {
    const path = parsed.error.errors[0]?.path.join(".") ?? "ukjent";
    return NextResponse.json(
      { ok: false, error: `Body inneholder ulovlige felt: ${path}` },
      { status: 422 },
    );
  }

  // 4. Delegate.
  const result = await completeSessionTaskAction(taskId, actor, "system");
  if (result.ok === false) {
    const isAuth =
      result.error.startsWith("Ikke autorisert") || result.error.includes("annet arbeidsrom");
    return NextResponse.json({ ok: false, error: result.error }, { status: isAuth ? 403 : 422 });
  }
  return NextResponse.json({ ok: true, taskId: result.taskId }, { status: 200 });
}

// ─── POST — source-dispatched complete (ADR-0298 Sortie 3) ──────────────────

const PostRequestSchema = z
  .object({
    source: z.enum(["session", "personal", "day_ad_hoc", "emma"]),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // 1. Validate path param.
  const { id: taskId } = await params;
  if (!z.string().uuid().safeParse(taskId).success) {
    return NextResponse.json({ ok: false, error: "Ugyldig oppgave-ID" }, { status: 422 });
  }

  // 2. Bearer auth — identity ALWAYS server-derived from JWT (ADR-0151).
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const actor = await resolveMobileActor(bearerToken);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Fail-fast on empty identity (ADR-0134 / L-0177 — never pass "" to emit()).
  if (!actor.workspaceId || !actor.profileId) {
    return NextResponse.json({ ok: false, error: "Ugyldig aktørkontekst" }, { status: 403 });
  }

  // 3. Parse + validate body.
  let body: z.infer<typeof PostRequestSchema>;
  try {
    const raw = await request.json();
    body = PostRequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Ugyldig forespørsel")
        : "Ugyldig JSON";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }

  // 4. Synthesize AgentToolContext and invoke task.complete tool body directly.
  //    Direct import path (ADR-0298 Sortie 3 preferred path — no HTTP round-trip
  //    via stage-engine for a single-machine BFF call).
  //    Do NOT emit here — complete.execute() owns gate + mutation + "task completed" emit.
  const supabaseAdmin = createAdminClient();
  const ctx = {
    workspaceId: actor.workspaceId as NonEmptyString,
    profileId: actor.profileId as NonEmptyString,
    userId: actor.userId,
    sessionId: "mobile-bff",
    channel: "system" as const,
    supabaseAdmin,
  };

  const toolResult = await complete.execute({ id: taskId, source: body.source }, ctx);

  let parsed: { ok?: boolean; error?: string } = {};
  try {
    parsed = JSON.parse(toolResult) as { ok?: boolean; error?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Uventet svar fra oppgavemotor" },
      { status: 500 },
    );
  }

  if (parsed.ok === false) {
    const isAuth =
      (parsed.error ?? "").includes("not_found_or_unauthorized") ||
      (parsed.error ?? "").includes("ikke_tillatt");
    return NextResponse.json(
      { ok: false, error: parsed.error ?? "feil" },
      { status: isAuth ? 403 : 422 },
    );
  }

  return NextResponse.json({ ok: true, taskId }, { status: 200 });
}
