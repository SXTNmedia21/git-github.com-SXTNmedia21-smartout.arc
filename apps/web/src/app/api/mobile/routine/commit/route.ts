// 2B step 2: commit the reviewed draft. Identity from JWT (ADR-0151), gate_action
// (C4), then the atomic fn_create_routine_from_draft RPC. Route emits (server-side).
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveMobileActor } from "../../_shared/actor";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

const NewLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().length(2).optional(),
});
const StepSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  is_required: z.boolean().default(true),
  estimated_minutes: z.number().int().min(1).nullable().default(null),
});
const BodySchema = z
  .object({
    routine_name: z.string().min(1).max(200),
    trigger_type: z.enum(["scheduled", "event"]),
    trigger_config: z.record(z.unknown()).default({}),
    location_id: z.string().uuid().nullable().default(null),
    new_location: NewLocationSchema.nullable().default(null),
    team_ids: z.array(z.string().min(1)).default([]),
    protocol_id: z.string().uuid().nullable().default(null),
    steps: z.array(StepSchema).min(1).max(50),
    source_reference: z.string().min(1),
  })
  .strict()
  .refine((b) => b.location_id !== null || b.new_location !== null, {
    message: "location_required",
  });

export async function POST(request: NextRequest | Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const actor = await resolveMobileActor(token);
  if (!actor || !actor.workspaceId || !actor.profileId) {
    return NextResponse.json({ ok: false, error: "Ugyldig aktørkontekst" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? (err.errors[0]?.message ?? "Ugyldig forespørsel")
        : "Ugyldig JSON";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }

  const admin = createAdminClient();

  const { data: gate, error: gateErr } = await admin.rpc("gate_action", {
    p_workspace_id: actor.workspaceId,
    p_capability: "routine",
    p_channel: "system",
    p_actor_profile_id: actor.profileId,
    p_action_type: "routine.create_from_image",
    p_approvers_present: [actor.profileId],
  });
  if (gateErr || (gate as { allow?: boolean })?.allow !== true) {
    return NextResponse.json(
      { ok: false, error: (gate as { reason?: string })?.reason ?? "ikke_tillatt" },
      { status: 403 },
    );
  }

  const { data: result, error: rpcErr } = await admin.rpc("fn_create_routine_from_draft", {
    p_workspace_id: actor.workspaceId,
    p_actor_profile_id: actor.profileId,
    p_routine_name: body.routine_name,
    p_trigger_type: body.trigger_type,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_trigger_config: body.trigger_config as any,
    p_steps: body.steps as any,
    p_source_reference: body.source_reference,
    p_location_id: body.location_id ?? undefined,
    p_new_location: body.new_location ?? undefined,
    p_team_ids: body.team_ids,
    p_protocol_id: body.protocol_id ?? undefined,
  });
  const res = result as {
    ok: true;
    routine_id: string;
    procedure_id: string;
    location_id: string;
    governance_status: "unassigned" | "attached";
  } | null;
  if (rpcErr || !res?.ok) {
    return NextResponse.json(
      { ok: false, error: rpcErr?.message ?? "commit_failed" },
      { status: 422 },
    );
  }

  await emit({
    event: "routine.created_from_image",
    workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
    actor_id: nonEmpty(actor.profileId, "actor_id"),
    properties: {
      entity: { entity_type: "routine", entity_id: res.routine_id },
      data: {
        routine_id: res.routine_id,
        procedure_id: res.procedure_id,
        location_id: res.location_id,
        governance_status: res.governance_status,
        step_count: body.steps.length,
        source_reference: body.source_reference,
      },
    },
  });
  if (res.governance_status === "unassigned") {
    await emit({
      event: "routine.governance_unassigned",
      workspace_id: nonEmpty(actor.workspaceId, "workspace_id"),
      actor_id: nonEmpty(actor.profileId, "actor_id"),
      properties: {
        entity: { entity_type: "routine", entity_id: res.routine_id },
        data: { routine_id: res.routine_id, source_reference: body.source_reference },
      },
    });
  }
  return NextResponse.json({ ok: true, routine_id: res.routine_id }, { status: 200 });
}
