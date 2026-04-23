/**
 * GET /api/botsson/recorder/break-glass/[envelope_id]
 *
 * ADR-0185 § Break-glass — godmode-only reveal of PII envelope content.
 *
 * Flow:
 *   1. Authenticate (cookie session)
 *   2. Verify caller is godmode (user_identity.is_godmode = true)
 *   3. Call decrypt_envelope RPC (SECURITY DEFINER, honours redact_after)
 *   4. Emit admin.pii_reveal to activity_trail with duration_ms=5000
 *      (the client UI MUST auto-redact after 5s — ADR-0185 § UI Safety)
 *   5. Return { raw, pii_class, auto_redact_in_ms }
 *
 * Audit contract: every successful reveal lands in activity_trail via
 * emit(admin.pii_reveal). An unsuccessful reveal (404/500) does NOT emit
 * so we don't inflate the audit log with fishing attempts — the BFF-level
 * 403 for non-godmode callers is enough signal.
 *
 * Envelope key handling: current_setting('app.envelope_key') set at the
 * database level per-environment. Key never touches application code.
 * See migration 20260515120600_decrypt_envelope_rpc.sql and secrets-protocol
 * (1Password: smartout_ai_prod/envelope_key).
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
type Params = { params: Promise<{ envelope_id: string }> };

// ADR-0185 § UI Safety — the client re-hides the raw value after 5 seconds.
const AUTO_REDACT_MS = 5000;

type DecryptedEnvelope = {
  raw: string;
  pii_class: string;
  workspace_id: string;
};

export async function GET(_request: Request, { params }: Params) {
  const { envelope_id: envelopeId } = await params;
  const supabase = await createClient();

  // 1. Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Godmode gate. PK on user_identity is user_id (NOT id).
  const { data: identity } = await supabase
    .from("user_identity")
    .select("user_id, is_godmode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!identity?.is_godmode) {
    return NextResponse.json({ error: "Godmode required" }, { status: 403 });
  }

  // 3. Decrypt via SECURITY DEFINER RPC. Honours agent_session_envelope.redact_after.
  // RPC typing lives in database.types.ts (regenerated after migration 20260515120600).
  const { data: rpcData, error: rpcError } = await supabase.rpc("decrypt_envelope", {
    p_envelope_id: envelopeId,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  // RPC returns TABLE(...) — PostgREST may surface as array or single row. Normalise.
  const envelope = Array.isArray(rpcData)
    ? (rpcData[0] as DecryptedEnvelope | undefined)
    : (rpcData as DecryptedEnvelope | null);

  if (!envelope) {
    return NextResponse.json({ error: "Envelope not found or expired" }, { status: 404 });
  }

  // 4. Resolve reveal-actor's profile (for activity_trail scoping). Godmode
  // caller may not have a profile in the envelope's workspace — use their
  // own workspace profile for audit attribution; if none exists, fall back
  // to user_id so the audit trail still has a non-empty actor_id (ADR-0152).
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // 5. Audit emit — MANDATORY. workspace_id is the envelope's workspace so
  // the reveal lands in the right workspace's audit partition.
  await emit({
    event: "admin.pii_reveal",
    workspace_id: nonEmpty(envelope.workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile?.profile_id ?? user.id, "actor_id"),
    properties: {
      entity: { entity_type: "agent_session", entity_id: envelopeId },
      data: {
        envelope_id: envelopeId,
        pii_class: envelope.pii_class,
        duration_ms: AUTO_REDACT_MS,
      },
    },
  });

  return NextResponse.json({
    raw: envelope.raw,
    pii_class: envelope.pii_class,
    auto_redact_in_ms: AUTO_REDACT_MS,
  });
}
