/**
 * BFF PATCH /api/timeline-template/[id]
 *
 * Soft-archive a saved timeline template (sets is_archived=true).
 * Hard delete is not supported in v1 (no DELETE RLS policy).
 *
 * Identity (ADR-0151):
 *   workspace_id + profile_id derived server-side. Never from body or path.
 *   The template [id] path param is verified against workspace_id by the
 *   capability tool before any write (L-0177 — fail-fast, no silent fallback).
 *
 * Authority (ADR-0099 / ADR-0204 / ADR-0287):
 *   archive_template capability tool owns gate_action + UPDATE + emit.
 *   This BFF validates body + path param and delegates.
 *
 * Channel (ADR-0078): ctx.channel pinned to "chat".
 *
 * Error codes:
 *   400 — invalid body or non-UUID id param
 *   401 — unauthenticated or empty identity
 *   403 — gate denied
 *   404 — template not found or workspace mismatch (from tool, mapped to 404 here)
 *   409 — template already archived
 *   500 — unexpected tool error
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Archive flow
 * ADR refs: ADR-0078, ADR-0099, ADR-0134, ADR-0151, ADR-0204, ADR-0287, ADR-0334
 *
 * ─── Manual smoke test examples ────────────────────────────────────────────────
 * # PATCH — archive template (replace <id> and <session-cookie>)
 * curl -X PATCH http://localhost:3060/api/timeline-template/<template-uuid> \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: <session-cookie>" \
 *   -d '{"is_archived": true}'
 * # Expected 200: { "ok": true }
 * # Not found → 404: { "ok": false, "error": "Mal ikke funnet eller tilhører et annet workspace." }
 * # Already archived → 409: { "ok": false, "error": "Malen er allerede arkivert." }
 * ──────────────────────────────────────────────────────────────────────────────
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveTimelineTemplateAuth, rejectCrossOrigin } from "../_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { archiveTemplate } from "@smartout/ai/capabilities/timeline-template/tools";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { NonEmptyString } from "@smartout/telemetry/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ArchiveBodySchema = z
  .object({
    is_archived: z.literal(true, {
      errorMap: () => ({ message: "is_archived must be true — hard delete is not supported." }),
    }),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // ─── CORS guard ────────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Validate path param (L-0177 — explicit error on invalid id) ───────────
  const { id: templateId } = await params;
  if (!z.string().uuid().safeParse(templateId).success) {
    return NextResponse.json(
      { ok: false, error: "Ugyldig mal-ID — forventet UUID" },
      { status: 400 },
    );
  }

  // ─── Identity (ADR-0151) ───────────────────────────────────────────────────
  const auth = await resolveTimelineTemplateAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!auth.workspaceId || !auth.profileId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Body validation ────────────────────────────────────────────────────────
  let _body: z.infer<typeof ArchiveBodySchema>;
  try {
    const raw = await request.json();
    _body = ArchiveBodySchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Ugyldig forespørsel")
        : "Ugyldig JSON";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // ─── Build tool context + delegate to capability ───────────────────────────
  // archive_template verifies template belongs to workspace before gate (L-0177).
  // No duplicate workspace check here — tool body handles it with fail-fast 4xx equivalent.
  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId as NonEmptyString,
    profileId: auth.profileId as NonEmptyString,
    userId: auth.userId,
    sessionId: "bff-timeline-template-archive",
    channel: "chat", // ADR-0078: pinned at BFF layer
    supabaseAdmin: createAdminClient(),
  };

  try {
    const toolResult = await archiveTemplate.execute({ template_id: templateId }, ctx);

    let result: { ok?: boolean; error?: string; template_id?: string };
    try {
      result = JSON.parse(toolResult) as typeof result;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Uventet svar fra arkiveringsmotor" },
        { status: 500 },
      );
    }

    if (result.ok === false) {
      const isNotFound =
        (result.error ?? "").includes("ikke funnet") ||
        (result.error ?? "").includes("annet workspace");
      const isAlreadyArchived = (result.error ?? "").includes("allerede arkivert");
      const isGateDenied = (result.error ?? "").startsWith("gate_denied");

      if (isGateDenied) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
      }
      if (isNotFound) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
      }
      if (isAlreadyArchived) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /api/timeline-template/[id]] unexpected error", err);
    return NextResponse.json({ ok: false, error: "Intern feil — prøv igjen" }, { status: 500 });
  }
}
