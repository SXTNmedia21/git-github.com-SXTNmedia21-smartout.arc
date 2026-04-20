/**
 * /dashboard/komm/desks — Spec §1 Server Component.
 *
 * Renders the Helpdesk desks admin surface. Gate: workspace company owner
 * or admin. Non-admins are redirected to /dashboard/komm so the UI never
 * advertises an edit path they can't use.
 *
 * Data flow:
 *   1. Resolve (user → profile → workspace → company) and check admin role.
 *   2. Fetch desks (channel_type='desk', non-archived) with responsible
 *      profile join.
 *   3. Fetch eligible reps (role ∈ {manager, admin, owner}, is_active).
 *   4. Aggregate open-ticket counts via engine_state grouped by desk.
 *   5. Hand off to DesksClient — client-side state drives CRUD.
 */

import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { DesksClient } from "./_components/DesksClient";
import type { DeskSummary } from "./_components/DeskCard";
import type { ResponsibleRep } from "./_components/ResponsibleRepCombobox";

export const dynamic = "force-dynamic";

type ProfileLite = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
};

export default async function DesksPage() {
  const supabase = await createClient();

  // ── Auth: resolve user → profile → workspace → company. ──────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) redirect("/dashboard");

  const { data: workspace } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", profile.workspace_id)
    .single();

  if (!workspace?.company_id) redirect("/dashboard");

  const { data: companyMember } = await supabase
    .from("company_member")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", workspace.company_id)
    .maybeSingle();

  const canManage = companyMember?.role === "owner" || companyMember?.role === "admin";

  // Redirect non-admins out — desks are admin-only territory per Spec §1.
  if (!canManage) redirect("/dashboard/komm");

  // ── Fetch desks. ─────────────────────────────────────────────────────
  const { data: deskRows } = await supabase
    .from("channel")
    .select(
      `
      id,
      name,
      description,
      responsible_profile_id,
      updated_at,
      responsible:profile!channel_responsible_profile_id_fkey(profile_id, display_name, avatar_url)
    `,
    )
    .eq("workspace_id", profile.workspace_id)
    .eq("channel_type", "desk")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  // ── Fetch open-ticket counts per desk. ───────────────────────────────
  // One query, group client-side. Desks in Phase 1 are few (~20 max), so
  // the N+1 risk is minimal and the grouping keeps RLS straightforward.
  const { data: openTickets } = await supabase
    .from("engine_state")
    .select("context")
    .eq("workspace_id", profile.workspace_id)
    .eq("process_id", "helpdesk_query_lifecycle")
    .in("status", ["waiting", "active"]);

  const openCountByDesk = new Map<string, number>();
  for (const row of openTickets ?? []) {
    const deskId = (row.context as { desk_channel_id?: string } | null)?.desk_channel_id;
    if (!deskId) continue;
    openCountByDesk.set(deskId, (openCountByDesk.get(deskId) ?? 0) + 1);
  }

  const desks: DeskSummary[] = (deskRows ?? []).map((row) => {
    // Supabase returns nested relations as arrays for 1:1 FKs when the
    // relation is nullable; normalize to the single responsible profile.
    const responsibleArr = Array.isArray(row.responsible) ? row.responsible : [row.responsible];
    const responsible = responsibleArr[0];
    return {
      id: row.id,
      name: row.name ?? "Skranke",
      description: row.description,
      responsible: responsible
        ? {
            profile_id: responsible.profile_id,
            display_name: responsible.display_name ?? "ukjent",
            avatar_url: responsible.avatar_url,
          }
        : null,
      open_count: openCountByDesk.get(row.id) ?? 0,
      last_active_at: row.updated_at ?? null,
    };
  });

  // ── Fetch eligible reps (manager/admin/owner, active). ───────────────
  const { data: repRows } = await supabase
    .from("profile")
    .select("profile_id, display_name, avatar_url, role")
    .eq("workspace_id", profile.workspace_id)
    .eq("is_active", true)
    .in("role", ["manager", "admin", "owner"])
    .order("display_name", { ascending: true });

  const reps: ResponsibleRep[] = ((repRows ?? []) as ProfileLite[]).map((r) => ({
    profile_id: r.profile_id,
    display_name: r.display_name ?? "ukjent",
    avatar_url: r.avatar_url,
    role: r.role,
  }));

  return (
    <DesksClient
      desks={desks}
      reps={reps}
      canManage={canManage}
      currentProfileId={profile.profile_id}
    />
  );
}
