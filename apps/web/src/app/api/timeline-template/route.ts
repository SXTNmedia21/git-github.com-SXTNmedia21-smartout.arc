/**
 * BFF /api/timeline-template
 *
 * POST — save a new timeline template (calls capability save_template tool).
 * GET  — list templates for a scope (calls capability list_templates tool).
 *
 * Identity (ADR-0151):
 *   workspace_id + profile_id are ALWAYS derived server-side via
 *   resolveTimelineTemplateAuth(). Never accepted from the request body.
 *   Empty-string identity triggers immediate 401.
 *
 * Authority (ADR-0099 / ADR-0204 / ADR-0287):
 *   Capability tools (save_template / list_templates) own the gate_action call
 *   via mutateWithGate. This BFF does NOT call gate_action directly — it
 *   delegates to the capability tool bodies which handle gate + mutate + emit.
 *
 * Channel (ADR-0078):
 *   Timeline template authoring is chat-only. ctx.channel is pinned to "chat"
 *   at the BFF layer; voice callers can not reach this surface.
 *
 * Error codes:
 *   400 — Zod validation failure (body or query params)
 *   401 — unauthenticated or empty identity
 *   409 — scope validation failure or name collision (from capability tool)
 *   500 — unexpected capability tool error
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Save flow + §BFF routes
 * ADR refs: ADR-0078, ADR-0099, ADR-0134, ADR-0151, ADR-0204, ADR-0287, ADR-0334
 *
 * ─── Manual smoke test examples ────────────────────────────────────────────────
 * # POST — save template (replace <TOKEN> with your session cookie value or Bearer token)
 * curl -X POST http://localhost:3060/api/timeline-template \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: <session-cookie>" \
 *   -d '{
 *     "name": "Helgevakt-oppsett",
 *     "scope_type": "department",
 *     "scope_id": "b0000000-0000-0000-0000-000000000001",
 *     "items_json": [
 *       {"kind":"schedule_shift","time_hhmm":"08:00","duration_min":480,
 *        "payload":{"role":"Servitør","position_id":null,"team_id":null,
 *                   "location_id":null,"zone":null,"notes":null}}
 *     ],
 *     "notes": "Standard helgeoppsett"
 *   }'
 * # Expected 201: { "ok": true, "template_id": "<uuid>" }
 *
 * # GET — list templates for a scope
 * curl "http://localhost:3060/api/timeline-template?scope_type=department&scope_id=b0000000-0000-0000-0000-000000000001" \
 *   -H "Cookie: <session-cookie>"
 * # Expected 200: { "ok": true, "templates": [...] }
 * ──────────────────────────────────────────────────────────────────────────────
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveTimelineTemplateAuth, rejectCrossOrigin } from "./_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { TimelineTemplateSaveSchema, ScopeType } from "@smartout/types";
import { saveTemplate, listTemplates } from "@smartout/ai/capabilities/timeline-template/tools";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { NonEmptyString } from "@smartout/telemetry/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET — list templates for a scope ─────────────────────────────────────────

const ListQuerySchema = z.object({
  scope_type: ScopeType,
  scope_id: z.string().uuid("scope_id must be a UUID"),
  include_archived: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── Identity ──────────────────────────────────────────────────────────────
  const auth = await resolveTimelineTemplateAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!auth.workspaceId || !auth.profileId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Query param validation ────────────────────────────────────────────────
  const searchParams = request.nextUrl.searchParams;
  const rawParams = {
    scope_type: searchParams.get("scope_type") ?? undefined,
    scope_id: searchParams.get("scope_id") ?? undefined,
    include_archived: searchParams.get("include_archived") ?? "false",
  };

  const parsed = ListQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Ugyldige query-parametere";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
  const params = parsed.data;

  // ─── Build tool context + delegate to capability ───────────────────────────
  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId as NonEmptyString,
    profileId: auth.profileId as NonEmptyString,
    userId: auth.userId,
    sessionId: "bff-timeline-template-list",
    channel: "chat", // ADR-0078: timeline authoring is chat-only
    supabaseAdmin: createAdminClient(),
  };

  try {
    const toolResult = await listTemplates.execute(
      {
        scope_type: params.scope_type,
        scope_id: params.scope_id,
        include_archived: params.include_archived,
      },
      ctx,
    );

    // Tool returns a JSON string or a plain string (no results).
    let parsed: unknown;
    try {
      parsed = JSON.parse(toolResult);
    } catch {
      // Plain string response (e.g. "Ingen maler funnet…")
      return NextResponse.json({ ok: true, templates: [], message: toolResult }, { status: 200 });
    }

    const result = parsed as { ok?: boolean; error?: string; templates?: unknown[] };

    if (result.ok === false) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }

    return NextResponse.json({ ok: true, templates: result.templates ?? [] }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/timeline-template] unexpected error", err);
    return NextResponse.json({ ok: false, error: "Intern feil — prøv igjen" }, { status: 500 });
  }
}

// ─── POST — save a new template ───────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ────────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Identity (ADR-0151) ───────────────────────────────────────────────────
  const auth = await resolveTimelineTemplateAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!auth.workspaceId || !auth.profileId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Body validation ────────────────────────────────────────────────────────
  let body: z.infer<typeof TimelineTemplateSaveSchema>;
  try {
    const raw = await request.json();
    body = TimelineTemplateSaveSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Ugyldig forespørsel")
        : "Ugyldig JSON";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // ─── Build tool context + delegate to capability ───────────────────────────
  // Capability tool owns gate_action + INSERT + emit per ADR-0287.
  // No gate_action call here — tool body handles it via mutateWithGate.
  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId as NonEmptyString,
    profileId: auth.profileId as NonEmptyString,
    userId: auth.userId,
    sessionId: "bff-timeline-template-save",
    channel: "chat", // ADR-0078: pinned at BFF layer
    supabaseAdmin: createAdminClient(),
  };

  try {
    const toolResult = await saveTemplate.execute(
      {
        name: body.name,
        scope_type: body.scope_type,
        scope_id: body.scope_id,
        items_json: body.items_json,
        notes: body.notes ?? null,
      },
      ctx,
    );

    let result: { ok?: boolean; error?: string; template_id?: string };
    try {
      result = JSON.parse(toolResult) as typeof result;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Uventet svar fra malopplager" },
        { status: 500 },
      );
    }

    if (result.ok === false) {
      // Name collision → 409; scope validation failure → 409; gate denied → 403.
      const isNameCollision = (result.error ?? "").includes("Navn finnes allerede");
      const isGateDenied = (result.error ?? "").startsWith("gate_denied");
      const isScope =
        (result.error ?? "").includes("Invalid scope") ||
        (result.error ?? "").includes("scope_validation_failed");

      if (isGateDenied) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
      }
      if (isNameCollision || isScope) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, template_id: result.template_id }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/timeline-template] unexpected error", err);
    return NextResponse.json({ ok: false, error: "Intern feil — prøv igjen" }, { status: 500 });
  }
}
