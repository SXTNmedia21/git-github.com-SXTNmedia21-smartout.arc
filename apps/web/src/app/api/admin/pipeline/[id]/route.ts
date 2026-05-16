/**
 * GET /api/admin/pipeline/[id]
 *
 * Returns a single pipeline instance (engine_state row) with its full audit
 * chain: gate_evaluation rows linked by engine_state_id FK, plus
 * activity_trail rows correlated by entity_id or correlation_id matching the
 * engine_state UUID. All entries merged and sorted chronologically ascending.
 *
 * Auth:  Cookie session, workspace_id server-derived (ADR-0151 fail-fast).
 * Role:  admin or owner only — 403 otherwise.
 * Scope: workspace-scoped — 404 on missing, 403 on cross-workspace ID.
 *
 * Read-only. No mutations.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerContext } from "@/lib/auth/get-server-context";
import { createAdminClient } from "@smartout/supabase/admin";

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

const PipelineInstanceSchema = z.object({
  pipeline_instance_id: z.string().uuid(),
  blueprint_id: z.string(),
  status: z.string(),
  current_step: z.number().nullable(),
  entity_id: z.string().nullable(),
  entity_type: z.string().nullable(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  context: z.record(z.unknown()),
});

const AuditEntrySchema = z.object({
  occurred_at: z.string(),
  event_name: z.string(),
  stage: z.string().nullable(),
  actor_profile_id: z.string().nullable(),
  channel: z.string().nullable(),
  gate_evaluation_id: z.string().nullable(),
  payload: z.record(z.unknown()),
});

const ResponseSchema = z.object({
  pipeline_instance: PipelineInstanceSchema,
  audit_chain: z.array(AuditEntrySchema),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a string stage from gate_evaluation.action_type or activity_trail.event. */
function extractStage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Expect patterns like "shift_swap_lifecycle.stage_0_propose" or
  // "pipeline.stage_proposed" — return as-is if dot-notation, else null.
  return raw.includes(".") ? raw : null;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth: server-derived identity (ADR-0151)
  const ctx = await getServerContext(request);
  if (!ctx) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!ctx.profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 403 });
  }

  // Role gate: admin/owner only
  if (ctx.profile.role !== "admin" && ctx.profile.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const workspaceId = ctx.profile.workspace_id;
  const { id } = await params;

  const admin = createAdminClient();

  // ---------------------------------------------------------------------------
  // 1. Fetch engine_state — workspace-scoped (ADR-0151 fail-fast)
  // ---------------------------------------------------------------------------
  const { data: stateRow, error: stateError } = await admin
    .from("engine_state")
    .select(
      "id, process_id, status, current_step, entity_id, entity_type, started_at, completed_at, context, workspace_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (stateError) {
    console.error("[api/admin/pipeline/[id]] engine_state fetch error:", stateError);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  if (!stateRow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // ADR-0151 fail-fast: cross-workspace ID attempt → 403, not 404
  if (stateRow.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ---------------------------------------------------------------------------
  // 2. Fetch gate_evaluation rows linked via engine_state_id FK
  // ---------------------------------------------------------------------------
  const { data: gateRows, error: gateError } = await admin
    .from("gate_evaluation")
    .select(
      "id, evaluated_at, action_type, actor_profile_id, channel, allow, reason, capability, downgrade_to, entity_id",
    )
    .eq("engine_state_id", id)
    .eq("workspace_id", workspaceId)
    .order("evaluated_at", { ascending: true });

  if (gateError) {
    console.error("[api/admin/pipeline/[id]] gate_evaluation fetch error:", gateError);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  // ---------------------------------------------------------------------------
  // 3. Fetch activity_trail rows correlated to this pipeline instance.
  //    activity_trail has no direct FK to engine_state; correlate via:
  //      a) entity_id = engine_state.id (most common — engine writes entity_id = state.id)
  //      b) correlation_id = engine_state.id (fallback correlation pattern)
  //    Both filters run; results de-duped by trail.id (bigint).
  // ---------------------------------------------------------------------------
  const [trailByEntity, trailByCorrelation] = await Promise.all([
    admin
      .from("activity_trail")
      .select(
        "id, created_at, event, actor_id, source, data, entity_id, entity_type, correlation_id",
      )
      .eq("entity_id", id)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    admin
      .from("activity_trail")
      .select(
        "id, created_at, event, actor_id, source, data, entity_id, entity_type, correlation_id",
      )
      .eq("correlation_id", id)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
  ]);

  if (trailByEntity.error) {
    console.error(
      "[api/admin/pipeline/[id]] activity_trail (entity) fetch error:",
      trailByEntity.error,
    );
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
  if (trailByCorrelation.error) {
    console.error(
      "[api/admin/pipeline/[id]] activity_trail (correlation) fetch error:",
      trailByCorrelation.error,
    );
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  // De-duplicate by numeric id
  const trailMap = new Map<number, (typeof trailByEntity.data)[number]>();
  for (const row of [...(trailByEntity.data ?? []), ...(trailByCorrelation.data ?? [])]) {
    trailMap.set(row.id, row);
  }
  const trailRows = Array.from(trailMap.values());

  // ---------------------------------------------------------------------------
  // 4. Build audit chain — merge gate + trail entries, sort chronologically
  // ---------------------------------------------------------------------------

  type AuditEntry = z.infer<typeof AuditEntrySchema>;

  const gateEntries: AuditEntry[] = (gateRows ?? []).map((g) => ({
    occurred_at: g.evaluated_at,
    event_name: `gate.${g.action_type}`,
    stage: extractStage(g.action_type),
    actor_profile_id: g.actor_profile_id,
    channel: g.channel,
    gate_evaluation_id: g.id,
    payload: {
      allow: g.allow,
      reason: g.reason ?? null,
      capability: g.capability,
      downgrade_to: g.downgrade_to ?? null,
      entity_id: g.entity_id ?? null,
    } satisfies Record<string, unknown>,
  }));

  const trailEntries: AuditEntry[] = trailRows.map((t) => ({
    occurred_at: t.created_at,
    event_name: t.event,
    stage: extractStage(t.event),
    actor_profile_id: t.actor_id,
    channel: ((t.data as Record<string, unknown> | null)?.channel as string | null) ?? null,
    gate_evaluation_id: null,
    payload: {
      source: t.source ?? null,
      entity_type: t.entity_type,
      ...(t.data && typeof t.data === "object" ? (t.data as Record<string, unknown>) : {}),
    } satisfies Record<string, unknown>,
  }));

  const auditChain: AuditEntry[] = [...gateEntries, ...trailEntries].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );

  // ---------------------------------------------------------------------------
  // 5. Build + validate response
  // ---------------------------------------------------------------------------

  const responsePayload = {
    pipeline_instance: {
      pipeline_instance_id: stateRow.id,
      blueprint_id: stateRow.process_id,
      status: stateRow.status,
      current_step: stateRow.current_step ?? null,
      entity_id: stateRow.entity_id,
      entity_type: stateRow.entity_type,
      started_at: stateRow.started_at,
      completed_at: stateRow.completed_at,
      context:
        stateRow.context && typeof stateRow.context === "object"
          ? (stateRow.context as Record<string, unknown>)
          : {},
    },
    audit_chain: auditChain,
  };

  const parsed = ResponseSchema.safeParse(responsePayload);
  if (!parsed.success) {
    console.error("[api/admin/pipeline/[id]] response validation failed:", parsed.error.flatten());
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json(parsed.data);
}
