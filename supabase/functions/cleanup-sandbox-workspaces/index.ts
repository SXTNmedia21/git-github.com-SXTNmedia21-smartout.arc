/**
 * cleanup-sandbox-workspaces — Cron-triggered cleanup of expired sandbox workspaces.
 *
 * Finds workspaces stuck in "sandbox" status past their verification_deadline,
 * deletes them (CASCADE handles engine tables), then deletes orphaned users with
 * no remaining workspaces. Auth via WATCHDOG_CRON_SECRET.
 *
 * Auth: verifyInternalAuth() — fail-closed on missing env (500), 401 on wrong secret.
 * ADR-0029.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";

Deno.serve(async (req) => {
  // Auth: fail-closed — 500 if env not configured, 401 if secret mismatch.
  // Env reads happen inside handler scope (not module scope) to prevent
  // "Bearer undefined" bypass when WATCHDOG_CRON_SECRET is unset.
  const authResult = verifyInternalAuth(req);
  if (!authResult.ok) return authResult.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Find expired sandbox workspaces
  const { data: expiredWorkspaces, error: findError } = await supabase
    .from("workspace")
    .select("workspace_id, created_at")
    .eq("status", "sandbox")
    .lt("verification_deadline", new Date().toISOString());

  if (findError) {
    console.error("Failed to find expired sandboxes:", findError);
    return new Response(JSON.stringify({ error: findError.message }), { status: 500 });
  }

  if (!expiredWorkspaces?.length) {
    return new Response(JSON.stringify({ cleaned: 0 }), { status: 200 });
  }

  let cleaned = 0;
  const errors: string[] = [];

  for (const ws of expiredWorkspaces) {
    try {
      // Get the user who owns this workspace before deleting it
      const { data: members } = await supabase
        .from("company_member")
        .select("user_id, company_id")
        .eq("workspace_id", ws.workspace_id);

      // Delete workspace (CASCADE handles engine tables)
      const { error: deleteError } = await supabase
        .from("workspace")
        .delete()
        .eq("workspace_id", ws.workspace_id);

      if (deleteError) throw deleteError;

      // Delete orphaned users — only those with no remaining workspaces
      for (const member of members ?? []) {
        const { count } = await supabase
          .from("company_member")
          .select("*", { count: "exact", head: true })
          .eq("user_id", member.user_id);

        if (count === 0) {
          // No other workspaces — safe to delete the auth user
          const { error: userDeleteError } = await supabase.auth.admin.deleteUser(member.user_id);
          if (userDeleteError) {
            console.warn(`Failed to delete user ${member.user_id}:`, userDeleteError);
          }
        }
      }

      cleaned++;
      console.log(`Cleaned sandbox workspace ${ws.workspace_id} (created ${ws.created_at})`);
    } catch (err) {
      const msg = `Failed to clean workspace ${ws.workspace_id}: ${err}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return new Response(
    JSON.stringify({ cleaned, errors: errors.length, total: expiredWorkspaces.length }),
    { status: errors.length > 0 ? 207 : 200 },
  );
});
