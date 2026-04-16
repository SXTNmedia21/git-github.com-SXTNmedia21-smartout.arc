import { Suspense } from "react";
import { createClient } from "@smartout/supabase/server";
import { fetchWorkspacePeople } from "@smartout/utils";
import { resolveDashboardContext } from "../_data/resolve-page-context";
import { PeoplePageClient, type PeoplePageInitialData } from "./_components/people-page-client";
import PeopleLoading from "./loading";
import type { Employee, ProfileRole } from "./_components/types";

/**
 * /dashboard/people — Server Component shell.
 * Resolves workspace + profile, fetches initial people data, hands off to a
 * single client boundary. Per ADR-0115 RSC migration pattern.
 */
export default async function PeoplePage() {
  const { workspace, profileId } = await resolveDashboardContext();

  const supabase = await createClient();
  const result = await fetchWorkspacePeople(supabase, workspace.workspace_id);

  const currentProfile = result.profiles.find((p) => p.profile_id === profileId);
  const currentUserRole: ProfileRole = (currentProfile?.role as ProfileRole) ?? "employee";

  const employees: Employee[] = result.profiles.map((p) => {
    const dept = p.department;
    const ui = p.user_identity;
    const addressParts = [p.address_line_1, p.postal_code, p.city].filter(Boolean);

    return {
      id: p.profile_id,
      profileId: p.profile_id,
      name: p.display_name,
      email: ui?.email ?? "",
      role: p.job_title ?? p.role,
      department: dept?.name ?? "",
      departmentId: p.department_id,
      departments: p.departments ?? undefined,
      status: p.status as Employee["status"],
      avatar: p.avatar_url ?? undefined,
      phone: ui?.phone ?? undefined,
      address: addressParts.length > 0 ? addressParts.join(", ") : undefined,
      personalNumber: p.personal_number ?? undefined,
      bankAccount: p.bank_account ?? undefined,
      emergencyContactName: ui?.emergency_contact_name ?? undefined,
      emergencyContactPhone: ui?.emergency_contact_phone ?? undefined,
      readinessScore: result.readinessMap.get(p.profile_id),
      hasContract: result.contractProfileIds.has(p.profile_id),
    };
  });

  const invitations: Employee[] = result.invitations.map((inv) => {
    const isExpired = new Date(inv.expires_at) < new Date();
    return {
      id: inv.invitation_id,
      name: [inv.first_name, inv.last_name].filter(Boolean).join(" ") || inv.email || "Uten navn",
      email: inv.email,
      role: inv.role,
      department: "",
      departmentId: inv.department_ids?.[0] ?? null,
      status: "invited" as const,
      inviteStatus: isExpired ? ("expired" as const) : ("pending" as const),
      inviteToken: inv.token,
      inviteExpiresAt: inv.expires_at,
      inviteType: (inv.invite_type as Employee["inviteType"]) ?? undefined,
      hasContract: false,
    };
  });

  const initialData: PeoplePageInitialData = {
    employees,
    departments: result.departments,
    invitations,
    currentUserRole,
  };

  return (
    <Suspense fallback={<PeopleLoading />}>
      <PeoplePageClient initialData={initialData} />
    </Suspense>
  );
}
