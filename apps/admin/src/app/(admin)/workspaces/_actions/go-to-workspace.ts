"use server";

/**
 * go-to-workspace.ts — Server Action for godmode workspace join + redirect
 *
 * ADR-0410: Godmode platform admin can auto-join any workspace as an admin
 * profile (idempotent) and be redirected to {slug}.smartout.ai/dashboard.
 *
 * Flow:
 *   1. Call fn_godmode_join_workspace(p_workspace_id) RPC — asserts is_godmode
 *      server-side, inserts profile if needed, writes activity_trail.
 *   2. Resolve workspace slug from public.workspace.
 *   3. Redirect to https://{slug}.smartout.ai/dashboard.
 *
 * Security: the RPC is SECURITY DEFINER and asserts is_godmode=true on the
 * caller's user_identity row — non-godmode users get an exception, not a
 * profile insert.
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

// fn_godmode_join_workspace is a new SECURITY DEFINER RPC added in migration
// 20260625130000. It will appear in database.types.ts after the next typegen
// run (`npx supabase gen types typescript --local`). Until then, we call it via
// a typed helper to avoid `any`. Returns uuid (profile_id).
async function callGodmodeJoinRpc(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<{ data: string | null; error: { message: string } | null }> {
  // fn_godmode_join_workspace is a new SECURITY DEFINER RPC not yet in database.types.ts.
  // Cast through unknown to avoid TS type mismatch on the untyped RPC builder result.
  const result = await (supabase.rpc("fn_godmode_join_workspace", {
    p_workspace_id: workspaceId,
  }) as unknown as Promise<{ data: string | null; error: { message: string } | null }>);
  return result;
}

/**
 * Server Action: join a workspace as godmode admin and redirect to its dashboard.
 *
 * Called from the "Gå til" button in the WorkspaceCard row.
 * Throws redirect() on success, throws on RPC error.
 */
export async function goToWorkspaceAction(workspaceId: string): Promise<void> {
  const supabase = await createClient();

  // Call the SECURITY DEFINER RPC — fails loudly if caller is not godmode.
  // Typed via callGodmodeJoinRpc helper; database.types.ts will include
  // fn_godmode_join_workspace after next typegen run.
  const { error: rpcError } = await callGodmodeJoinRpc(supabase, workspaceId);

  if (rpcError) {
    // Surface error as a thrown string (Next.js Server Action convention).
    // The client component catches this and can show a toast.
    throw new Error(rpcError.message);
  }

  // Resolve the workspace slug for the redirect URL.
  const { data: workspace, error: slugError } = await supabase
    .from("workspace")
    .select("slug")
    .eq("workspace_id", workspaceId)
    .single();

  if (slugError || !workspace?.slug) {
    throw new Error("Fant ikke workspace-slug — kontakt support");
  }

  // Redirect to the workspace dashboard on its subdomain.
  redirect(`https://${workspace.slug}.smartout.ai/dashboard`);
}
