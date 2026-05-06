/**
 * POST /api/contracts/admin-fill-pii — admin fills in employee PII on behalf.
 *
 * What: Validates caller is admin/owner in workspace, then delegates to
 *       admin_submit_employee_pii RPC (SECURITY DEFINER) which enforces
 *       cross-workspace fail-fast, høy-PII ack gate, write, and audit.
 * Why:  ADR-0077 amendment — admin-on-behalf PII fill during contract dispatch
 *       when employee has not yet submitted required data.
 *
 * Security:
 *   - workspace_id derived server-side from JWT (ADR-0151 forgery defence)
 *   - role check in RPC (admin/owner only)
 *   - NEVER logs or returns field values — only field_group (ADR-0077)
 *
 * Telemetry:
 *   - Emits payroll.admin_filled_pii with count only (NO values)
 *   - Routing: posthog + logger + activity_trail + engine_event (ADR-0004)
 *   - Mount-site: MissingInfoSheet emits contract.send_blocked.missing_fields
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";

const AdminFillPiiBodySchema = z.object({
  target_profile_id: z.string().uuid(),
  field_group: z.enum(["identity", "banking", "address"]),
  values: z.record(z.string(), z.string()),
  high_pii_acknowledged: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // ADR-0151: resolve caller identity server-side from JWT
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 });
  }

  // Resolve actor profile + workspace from JWT (never from body — ADR-0151)
  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!actorProfile) {
    return NextResponse.json({ error: "Ingen aktiv profil funnet" }, { status: 403 });
  }

  // Pre-flight role check — RPC also enforces this, but fail fast in BFF layer
  if (!["admin", "owner"].includes(actorProfile.role)) {
    return NextResponse.json(
      { error: "Kun administratorer kan fylle inn opplysninger på vegne av ansatte" },
      { status: 403 },
    );
  }

  // Parse + validate request body
  const rawBody = await request.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "Ugyldig forespørsel" }, { status: 400 });
  }

  const parsed = AdminFillPiiBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Ugyldig forespørsel" },
      { status: 400 },
    );
  }

  const { target_profile_id, field_group, values, high_pii_acknowledged } = parsed.data;

  // Delegate to SECURITY DEFINER RPC — enforces cross-workspace, høy-PII ack, write, audit.
  // RPC added 2026-05-06 via migration 20260526000000; database.types.ts regen happens
  // in a separate sortie (typegen-after-sortie pattern). Args verified server-side by
  // the SECURITY DEFINER function signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
    "admin_submit_employee_pii",
    {
      p_workspace_id: actorProfile.workspace_id,
      p_target_profile_id: target_profile_id,
      p_field_group: field_group,
      p_values: values,
      p_high_pii_acknowledged: high_pii_acknowledged,
    },
  );

  if (rpcError) {
    const msg = rpcError.message ?? "";

    // Høy-PII ack missing — UI must show confirmation dialog first
    if (msg.includes("High-PII")) {
      return NextResponse.json(
        {
          error: "Bekreftelse fra ansatt kreves for sensitive opplysninger",
          code: "high_pii_required",
          field_group,
        },
        { status: 422 },
      );
    }

    // Cross-workspace — should never reach UI, but surface if it does
    if (msg.includes("cross-workspace")) {
      return NextResponse.json(
        { error: "Profilen tilhører ikke ditt arbeidsområde", code: "cross_workspace" },
        { status: 403 },
      );
    }

    // Caller not admin/owner
    if (msg.includes("not admin/owner")) {
      return NextResponse.json(
        { error: "Kun administratorer kan utføre denne handlingen" },
        { status: 403 },
      );
    }

    // Generic RPC failure
    console.error("[admin-fill-pii] RPC error", {
      field_group,
      workspace_id: actorProfile.workspace_id,
      error: msg,
    });
    return NextResponse.json({ error: "Kunne ikke lagre opplysningene" }, { status: 500 });
  }

  // Emit telemetry — count only, NEVER field values (ADR-0077)
  void emit({
    event: "payroll.admin_filled_pii",
    workspace_id: nonEmpty(actorProfile.workspace_id, "workspace_id"),
    actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "profile", entity_id: target_profile_id },
      data: {
        // target_profile_id lives in entity.entity_id — not duplicated per registry shape
        field_group,
        field_count: Object.keys(values).length,
        high_pii_acknowledged,
        // NOTE: field values intentionally excluded (ADR-0077)
      },
    },
  });

  return NextResponse.json({
    success: true,
    field_group,
    target_profile_id,
  });
}
