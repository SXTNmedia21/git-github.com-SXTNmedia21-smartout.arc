"use client";

import { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { Users, Star, ShieldCheck, Mail } from "lucide-react";
import { PeopleDataTable } from "./_components/people-data-table";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { fetchWorkspacePeople } from "@smartout/utils";
import type { Employee, Department, ProfileRole } from "./_components/types";

type MetricFilter = "all" | "active" | "readiness" | "invites";

export default function PeoplePage() {
  const [isCompact, setIsCompact] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MetricFilter>("all");
  const { isDark, workspaceData, profileId } = useContext(DashboardContext);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [invitations, setInvitations] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<ProfileRole>("employee");

  const fetchData = useCallback(async () => {
    if (!workspaceData?.workspace_id) return;
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchWorkspacePeople(supabase as any, workspaceData.workspace_id);

    // Determine current user's role
    const currentProfile = profileId
      ? result.profiles.find((p) => p.profile_id === profileId)
      : undefined;
    if (currentProfile) {
      setCurrentUserRole(currentProfile.role as ProfileRole);
    }

    // Map profiles to Employee type with real readiness and contract data
    const mapped: Employee[] = result.profiles.map((p) => {
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
    setEmployees(mapped);
    setDepartments(result.departments);

    // Map invitations — exclude readinessScore (undefined = N/A)
    const mappedInvites: Employee[] = result.invitations.map((inv) => {
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
    setInvitations(mappedInvites);
    setLoading(false);
  }, [workspaceData?.workspace_id, profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allPeople = useMemo(() => [...employees, ...invitations], [employees, invitations]);
  const activeCount = useMemo(
    () => employees.filter((e) => e.status === "active").length,
    [employees],
  );
  const avgReadiness = useMemo(() => {
    const withScores = employees.filter(
      (e) => e.readinessScore !== undefined && e.status !== "invited",
    );
    if (withScores.length === 0) return 0;
    return Math.round(
      withScores.reduce((sum, e) => sum + (e.readinessScore ?? 0), 0) / withScores.length,
    );
  }, [employees]);

  function handleCardClick(filter: MetricFilter) {
    setActiveFilter((prev) => (prev === filter ? "all" : filter));
  }

  const cardBase = (active: boolean) =>
    `group relative overflow-hidden rounded-2xl border p-5 transition-all cursor-pointer ${
      active ? "ring-2 ring-orange-500/50" : ""
    }`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:gap-6">
      {/* Overview Metric Cards */}
      <div
        className={`grid origin-top grid-cols-1 gap-4 transition-all duration-500 ease-in-out md:grid-cols-4 ${isCompact ? "mb-[-16px] h-0 overflow-hidden opacity-0 md:mb-[-24px]" : "mb-0 h-[104px] opacity-100 md:mb-2"}`}
      >
        {/* Total Staff */}
        <div
          onClick={() => handleCardClick("all")}
          className={`${cardBase(activeFilter === "all")} border-border/50 bg-background`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl transition-colors group-hover:bg-orange-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-border bg-secondary text-muted-foreground" : "border-orange-100 bg-orange-50 text-orange-600"}`}
            >
              <Users className="h-4 w-4" />
            </div>
            <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Total Staff
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span className="text-foreground text-3xl leading-none font-bold">
              {employees.length}
            </span>
          </div>
        </div>

        {/* Active Now */}
        <div
          onClick={() => handleCardClick("active")}
          className={`${cardBase(activeFilter === "active")} border-border/50 bg-background`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-colors group-hover:bg-emerald-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-border bg-secondary text-muted-foreground" : "border-emerald-100 bg-emerald-50 text-emerald-600"}`}
            >
              <Star className="h-4 w-4" />
            </div>
            <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Active Now
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span className="text-foreground text-3xl leading-none font-bold">{activeCount}</span>
            <span className="text-muted-foreground mb-0.5 text-sm font-medium">clocked in</span>
          </div>
        </div>

        {/* Avg Readiness */}
        <div
          onClick={() => handleCardClick("readiness")}
          className={`${cardBase(activeFilter === "readiness")} border-border/50 bg-background`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl transition-colors group-hover:bg-blue-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-border bg-secondary text-muted-foreground" : "border-blue-100 bg-blue-50 text-blue-600"}`}
            >
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Avg Readiness
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span className="text-foreground text-3xl leading-none font-bold">{avgReadiness}%</span>
            <span className="text-muted-foreground mb-0.5 text-sm font-medium">workspace</span>
          </div>
        </div>

        {/* Pending Invites */}
        <div
          onClick={() => handleCardClick("invites")}
          className={`${cardBase(activeFilter === "invites")} border-border/50 bg-background`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-rose-500/10 blur-2xl transition-colors group-hover:bg-rose-500/20" />
          <div className="relative z-10 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-rose-500">
                <Mail className="h-4 w-4" />
              </div>
              <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Pending Invites
              </h3>
            </div>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span className="text-3xl leading-none font-bold text-rose-400">
              {invitations.filter((i) => i.inviteStatus !== "expired").length}
            </span>
            <span className="text-muted-foreground mb-0.5 text-sm font-medium">
              awaiting signup
            </span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <PeopleDataTable
          employees={allPeople}
          departments={departments}
          activeFilter={activeFilter}
          loading={loading}
          onScrollChange={(isDown) => setIsCompact(isDown)}
          isCompact={isCompact}
          currentUserRole={currentUserRole}
          onRefresh={fetchData}
        />
      </div>
    </div>
  );
}
