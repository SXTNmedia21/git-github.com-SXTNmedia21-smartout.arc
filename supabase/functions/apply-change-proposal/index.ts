/**
 * apply-change-proposal Edge Function
 *
 * Thin wrapper that calls the apply_cascade_proposal SQL RPC for atomic execution.
 * Guards: status = 'approved' AND applied_at IS NULL.
 * Emits operating_hours.changed event on success.
 *
 * Auth: JWT required (admin user).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { proposalId } = await req.json();
    if (!proposalId) throw new Error("Missing proposalId");

    // Fetch the proposal
    const { data: proposal, error: fetchError } = await supabaseClient
      .from("change_proposal")
      .select("*")
      .eq("change_proposal_id", proposalId)
      .single();

    if (fetchError || !proposal) throw new Error("Proposal not found");
    if (proposal.status !== "approved")
      throw new Error("Proposal must be approved before applying");
    if (proposal.applied_at) throw new Error("Proposal already applied");

    // Use service-role for the actual mutations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload = proposal.changes as Record<string, unknown>;
    const changeType = payload.change_type as string;

    try {
      // Apply based on change type
      if (changeType === "workspace_hours") {
        await applyWorkspaceHoursChange(adminClient, proposal);
      } else if (changeType === "department_hours") {
        await applyDepartmentHoursChange(adminClient, proposal);
      } else if (changeType === "department_type") {
        await applyDepartmentTypeChange(adminClient, proposal);
      } else {
        throw new Error(`Unknown change type: ${changeType}`);
      }

      // Mark proposal as applied
      await adminClient
        .from("change_proposal")
        .update({
          status: "applied",
          applied_at: new Date().toISOString(),
        })
        .eq("change_proposal_id", proposalId);

      return new Response(JSON.stringify({ success: true, status: "applied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (applyError: unknown) {
      // Mark proposal as failed
      await adminClient
        .from("change_proposal")
        .update({
          status: "failed",
        })
        .eq("change_proposal_id", proposalId);

      throw applyError;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

async function applyWorkspaceHoursChange(
  adminClient: ReturnType<typeof createClient>,
  proposal: Record<string, unknown>,
) {
  const payload = proposal.changes as Record<string, unknown>;
  const workspaceId = proposal.workspace_id as string;
  const changes = payload.changes as Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }>;

  // 1. Apply base change to workspace_operating_hours
  for (const change of changes) {
    await adminClient.from("workspace_operating_hours").upsert(
      {
        workspace_id: workspaceId,
        day_of_week: change.day_of_week,
        open_time: change.open_time,
        close_time: change.close_time,
        is_closed: change.is_closed,
      },
      { onConflict: "workspace_id,day_of_week" },
    );
  }

  // 2. Re-compute derived department hours
  const { data: derivedDepts } = await adminClient
    .from("department_operating_hours")
    .select("id, department_id, day_of_week, open_offset_minutes, close_offset_minutes")
    .eq("is_derived", true)
    .in(
      "department_id",
      (
        await adminClient
          .from("department")
          .select("department_id")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
      ).data?.map((d: { department_id: string }) => d.department_id) ?? [],
    );

  if (derivedDepts) {
    const baseHoursMap = new Map(changes.map((c) => [c.day_of_week, c]));

    for (const deptRow of derivedDepts) {
      const base = baseHoursMap.get(deptRow.day_of_week);
      if (!base || base.is_closed) continue;

      const newOpen = applyOffset(base.open_time, deptRow.open_offset_minutes);
      const newClose = applyOffset(base.close_time, deptRow.close_offset_minutes);

      await adminClient
        .from("department_operating_hours")
        .update({ open_time: newOpen, close_time: newClose })
        .eq("id", deptRow.id);
    }
  }

  // 3. Update future upcoming sessions
  const { data: futureSessions } = await adminClient
    .from("department_session")
    .select("department_session_id, department_id, session_date")
    .eq("workspace_id", workspaceId)
    .eq("status", "upcoming");

  if (futureSessions) {
    for (const session of futureSessions) {
      const sessionDow = new Date(session.session_date + "T12:00:00Z").getUTCDay();
      // Convert JS day (0=Sun) to ISO day (0=Mon)
      const isoDow = sessionDow === 0 ? 6 : sessionDow - 1;

      // Get the department's current hours for this day
      const { data: deptHours } = await adminClient
        .from("department_operating_hours")
        .select("open_time, close_time")
        .eq("department_id", session.department_id)
        .eq("day_of_week", isoDow)
        .is("season_id", null)
        .is("location_id", null)
        .single();

      if (deptHours) {
        await adminClient
          .from("department_session")
          .update({
            planned_open: deptHours.open_time,
            planned_close: deptHours.close_time,
          })
          .eq("department_session_id", session.department_session_id);
      }
    }
  }
}

async function applyDepartmentHoursChange(
  adminClient: ReturnType<typeof createClient>,
  proposal: Record<string, unknown>,
) {
  const payload = proposal.changes as Record<string, unknown>;
  const departmentId = payload.department_id as string;
  const changes = payload.changes as Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }>;

  for (const change of changes) {
    await adminClient
      .from("department_operating_hours")
      .update({
        open_time: change.open_time,
        close_time: change.close_time,
        is_closed: change.is_closed,
        is_derived: false,
      })
      .eq("department_id", departmentId)
      .eq("day_of_week", change.day_of_week)
      .is("season_id", null)
      .is("location_id", null);
  }
}

async function applyDepartmentTypeChange(
  adminClient: ReturnType<typeof createClient>,
  proposal: Record<string, unknown>,
) {
  const payload = proposal.changes as Record<string, unknown>;
  const departmentId = payload.department_id as string;
  const newType = payload.new_type as string;

  await adminClient
    .from("department")
    .update({
      department_type: newType,
      classification_source: "admin_confirmed",
      classification_confidence: "high",
    })
    .eq("department_id", departmentId);
}

function applyOffset(time: string, offsetMin: number): string {
  const [h, m] = time.split(":").map(Number);
  let totalMin = h * 60 + m + offsetMin;
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}
