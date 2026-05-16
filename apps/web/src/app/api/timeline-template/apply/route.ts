/**
 * BFF POST /api/timeline-template/apply
 *
 * Apply a saved timeline template to a target date. Instantiates all template
 * items as real D6 rows (schedule_shift, session_hook, session_task,
 * session_note, deviation) in a single exec callback inside mutateWithGate.
 *
 * Identity (ADR-0151):
 *   workspace_id + profile_id derived server-side. Never from body.
 *   Empty-string identity triggers 401 immediately (L-0177).
 *
 * Authority (ADR-0099 / ADR-0204 / ADR-0287):
 *   apply_template capability tool owns gate_action + all D6 INSERTs + emit.
 *   This BFF validates the request body and delegates; no gate call here.
 *
 * Channel (ADR-0078):
 *   ctx.channel pinned to "chat" — template apply is a web authoring operation.
 *
 * Past-date guard (ADR-0334):
 *   The capability tool validates target_date >= startOfOsloDay(now).
 *   The BFF does not duplicate this check — trust the tool body (L-0176).
 *
 * Error codes:
 *   400 — Zod validation failure or past-date rejection from tool
 *   401 — unauthenticated or empty identity
 *   403 — gate denied (authority level / role floor)
 *   409 — scope entity no longer exists
 *   500 — partial transaction failure (errors array non-empty)
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Apply flow
 * ADR refs: ADR-0078, ADR-0099, ADR-0134, ADR-0151, ADR-0204, ADR-0287, ADR-0334
 *
 * ─── Manual smoke test examples ────────────────────────────────────────────────
 * # POST — apply template (replace <uuid>s and <session-cookie>)
 * curl -X POST http://localhost:3060/api/timeline-template/apply \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: <session-cookie>" \
 *   -d '{
 *     "template_id": "<template-uuid>",
 *     "target_date": "2026-06-20",
 *     "freeform_mapping": {"2": "task", "5": "skip"}
 *   }'
 * # Expected 200: { "ok": true, "materialized": {"schedule_shift":1,"session_task":1}, "errors": [] }
 * # Past date → 400: { "ok": false, "error": "target_date må være i dag eller senere..." }
 * # Deleted scope → 409: { "ok": false, "error": "Scope-entiteten finnes ikke lenger..." }
 * ──────────────────────────────────────────────────────────────────────────────
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveTimelineTemplateAuth, rejectCrossOrigin } from "../_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { TimelineTemplateApplySchema } from "@smartout/types";
import { applyTemplate } from "@smartout/ai/capabilities/timeline-template/tools";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { NonEmptyString } from "@smartout/telemetry/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  let body: z.infer<typeof TimelineTemplateApplySchema>;
  try {
    const raw = await request.json();
    body = TimelineTemplateApplySchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Ugyldig forespørsel")
        : "Ugyldig JSON";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // ─── Build tool context + delegate to capability ───────────────────────────
  // apply_template owns: gate_action + per-item D6 INSERTs + all emits (ADR-0287).
  // template_id in body is verified by the tool against workspace_id (L-0177).
  // No duplicate verification here — capability body handles it with fail-fast.
  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId as NonEmptyString,
    profileId: auth.profileId as NonEmptyString,
    userId: auth.userId,
    sessionId: "bff-timeline-template-apply",
    channel: "chat", // ADR-0078: pinned at BFF layer
    supabaseAdmin: createAdminClient(),
  };

  try {
    const toolResult = await applyTemplate.execute(
      {
        template_id: body.template_id,
        target_date: body.target_date,
        freeform_mapping: body.freeform_mapping ?? {},
      },
      ctx,
    );

    let result: {
      ok?: boolean;
      error?: string;
      materialized?: Record<string, number>;
      errors?: { code: string; message: string }[];
    };
    try {
      result = JSON.parse(toolResult) as typeof result;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Uventet svar fra applikasjonsmotor" },
        { status: 500 },
      );
    }

    if (result.ok === false) {
      const isGateDenied = (result.error ?? "").startsWith("gate_denied");
      const isScopeMissing = (result.error ?? "").includes("finnes ikke lenger");
      const isPastDate = (result.error ?? "").includes("target_date må være");
      const hasErrors = (result.errors?.length ?? 0) > 0;

      if (isGateDenied) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
      }
      if (isScopeMissing) {
        return NextResponse.json(
          { ok: false, error: result.error, errors: result.errors ?? [] },
          { status: 409 },
        );
      }
      if (isPastDate) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }
      if (hasErrors) {
        // Partial transaction failure — tool rolled back exec but returned error detail.
        return NextResponse.json(
          { ok: false, materialized: {}, errors: result.errors ?? [] },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        materialized: result.materialized ?? {},
        errors: result.errors ?? [],
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[POST /api/timeline-template/apply] unexpected error", err);
    return NextResponse.json(
      { ok: false, materialized: {}, errors: [{ code: "unexpected", message: String(err) }] },
      { status: 500 },
    );
  }
}
