/**
 * ADR-0298 Sortie 4 — personal task creation BFF for mobile AddSheet.
 *
 * POST /api/mobile/tasks/personal
 *
 * Creates a personal_task for the authenticated mobile user. Delegates
 * directly to the task.create_personal tool body (same pattern as
 * /api/mobile/tasks/[id]/complete POST — no HTTP round-trip to stage-engine).
 *
 * Identity contract (ADR-0151):
 *   - Bearer JWT ONLY. workspace_id and profile_id are ALWAYS server-derived.
 *   - Body MUST NOT contain workspace_id, profile_id, or actor_id — strict
 *     schema rejects unknown keys.
 *
 * Emit contract:
 *   - Do NOT emit here — createPersonal.execute() owns gate + mutation + emit.
 *   - Double-emit guard: BFF is a thin dispatcher, not a mutation owner.
 *
 * References: ADR-0078, ADR-0099, ADR-0132, ADR-0134, ADR-0151, ADR-0298.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveMobileActor } from "../../_shared/actor";
import { createAdminClient } from "@smartout/supabase/admin";
import { createPersonal } from "@smartout/ai/capabilities/task/tools";
import type { NonEmptyString } from "@smartout/telemetry/server";

export const runtime = "nodejs";

// ─── Request schema ──────────────────────────────────────────────────────────
// Mirrors task.create_personal tool schema (ADR-0298 Sortie 3) minus
// workspace_id / profile_id which are ALWAYS server-derived (ADR-0151).
// .strict() rejects unknown keys — no identity forgery surface.

const Body = z
  .object({
    title: z.string().trim().min(1).max(200),
    due_at: z.string().datetime().optional().nullable(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  })
  .strict();

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Bearer auth — identity ALWAYS server-derived from JWT (ADR-0151).
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

  // 2. Parse + validate body.
  let body: z.infer<typeof Body>;
  try {
    const raw = await request.json();
    body = Body.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Ugyldig forespørsel")
        : "Ugyldig JSON";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }

  // 3. Synthesize AgentToolContext and invoke task.create_personal tool body directly.
  //    Direct import (ADR-0298 Sortie 4 preferred path — no HTTP round-trip to
  //    stage-engine for a single-machine BFF call). Channel='system' bypasses
  //    the voice-guard inside createPersonal.execute() — mobile BFF is not voice.
  //    Do NOT emit here — tool body owns gate + mutation + "task created" emit.
  const supabaseAdmin = createAdminClient();
  const ctx = {
    workspaceId: actor.workspaceId as NonEmptyString,
    profileId: actor.profileId as NonEmptyString,
    userId: actor.userId,
    sessionId: "mobile-bff",
    channel: "system" as const,
    supabaseAdmin,
  };

  const toolResult = await createPersonal.execute(
    {
      title: body.title,
      due_at: body.due_at ?? undefined,
      priority: body.priority ?? "normal",
    },
    ctx,
  );

  let parsed: { id?: string; ok?: boolean; error?: string } = {};
  try {
    parsed = JSON.parse(toolResult) as { id?: string; ok?: boolean; error?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Uventet svar fra oppgavemotor" },
      { status: 500 },
    );
  }

  // Tool returns { id } on success, { ok: false, error } on failure.
  if (parsed.ok === false || (!parsed.id && !parsed.ok)) {
    const isAuth =
      (parsed.error ?? "").includes("ikke_tillatt") ||
      (parsed.error ?? "").includes("not_found_or_unauthorized");
    return NextResponse.json(
      { ok: false, error: parsed.error ?? "feil" },
      { status: isAuth ? 403 : 422 },
    );
  }

  return NextResponse.json({ ok: true, id: parsed.id }, { status: 200 });
}
