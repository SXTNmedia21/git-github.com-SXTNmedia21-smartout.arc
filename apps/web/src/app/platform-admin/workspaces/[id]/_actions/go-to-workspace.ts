"use server";

// go-to-workspace.ts — Server Action for godmode workspace auto-join + redirect
//
// Mirrors apps/admin/src/app/(admin)/workspaces/_actions/go-to-workspace.ts.
// ADR-0410: godmode platform admin auto-joins any workspace as admin profile
// (idempotent) and is redirected to {slug}.smartout.ai/dashboard.
//
// Security: fn_godmode_join_workspace is SECURITY DEFINER and asserts
// is_godmode=true on the caller's user_identity row — non-godmode callers
// raise an exception, no profile insert. Audit row written in same txn.

import { createClient } from "@smartout/supabase/server";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

// fn_godmode_join_workspace is the SECURITY DEFINER RPC added in migration
// 20260626000000. It will appear in database.types.ts after the next typegen
// run. Until then, we call it through a typed helper to avoid `any`.
async function callGodmodeJoinRpc(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<{ data: string | null; error: { message: string } | null }> {
  const result = await (supabase.rpc("fn_godmode_join_workspace", {
    p_workspace_id: workspaceId,
  }) as unknown as Promise<{ data: string | null; error: { message: string } | null }>);
  return result;
}

export async function goToWorkspaceAction(workspaceId: string): Promise<void> {
  const supabase = await createClient();

  const { error: rpcError } = await callGodmodeJoinRpc(supabase, workspaceId);
  if (rpcError) {
    throw new Error(rpcError.message);
  }

  const { data: workspace, error: slugError } = await supabase
    .from("workspace")
    .select("slug")
    .eq("workspace_id", workspaceId)
    .single();

  if (slugError || !workspace?.slug) {
    throw new Error("Fant ikke workspace-slug — kontakt support");
  }

  redirect(`https://${workspace.slug}.smartout.ai/dashboard`);
}
