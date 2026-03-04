"use client";

import { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { Users, Star, ShieldCheck, Mail } from "lucide-react";
import { PeopleDataTable } from "./_components/people-data-table";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import type { Employee, Department, ProfileRole } from "./_components/types";

type MetricFilter = "all" | "active" | "readiness" | "invites";

type ProfileRow = {
  profile_id: string;
  display_name: string;
  job_title: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  department_id: string | null;
  address_line_1: string | null;
  postal_code: string | null;
  city: string | null;
  personal_number: string | null;
  bank_account: string | null;
  is_active: boolean;
  department: { name: string } | null;
  user_identity: {
    email: string;
    phone: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  } | null;
};

type InvitationRow = {
  invitation_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  department_ids: string[] | null;
  status: string;
  token: string;
  expires_at: string;
};

export default function PeoplePage() {
  const [isCompact, setIsCompact] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MetricFilter>("all");
  const { isDark, workspaceData } = useContext(DashboardContext);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [invitations, setInvitations] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<ProfileRole>("employee");

  const fetchData = useCallback(async () => {
    if (!workspaceData?.workspace_id) return;
    const supabase = createClient();

    const [profilesRes, deptsRes, invitesRes, currentUserRes] = await Promise.all([
      supabase
        .from("profile")
        .select(
          `profile_id, display_name, job_title, role, status, avatar_url,
           department_id, address_line_1, postal_code, city,
           personal_number, bank_account, is_active,
           department:department_id(name),
           user_identity:user_id(email, phone, emergency_contact_name, emergency_contact_phone)`,
        )
        .eq("workspace_id", workspaceData.workspace_id)
        .returns<ProfileRow[]>(),
      supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceData.workspace_id)
        .order("sort_order"),
      supabase
        .from("invitation")
        .select(
          "invitation_id, email, first_name, last_name, role, department_ids, status, token, expires_at",
        )
        .eq("workspace_id", workspaceData.workspace_id)
        .eq("status", "pending")
        .returns<InvitationRow[]>(),
      supabase.auth.getUser(),
    ]);

    // Resolve current user's role in this workspace
    if (currentUserRes.data?.user) {
      const { data: myProfile } = await supabase
        .from("profile")
        .select("role")
        .eq("workspace_id", workspaceData.workspace_id)
        .eq("user_id", currentUserRes.data.user.id)
        .returns<{ role: ProfileRole }[]>()
        .single();
      if (myProfile) {
        setCurrentUserRole(myProfile.role);
      }
    }

    if (profilesRes.data) {
      const mapped: Employee[] = profilesRes.data.map((p) => {
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
          status: p.status as Employee["status"],
          avatar: p.avatar_url ?? undefined,
          phone: ui?.phone ?? undefined,
          address: addressParts.length > 0 ? addressParts.join(", ") : undefined,
          personalNumber: p.personal_number ?? undefined,
          bankAccount: p.bank_account ?? undefined,
          emergencyContactName: ui?.emergency_contact_name ?? undefined,
          emergencyContactPhone: ui?.emergency_contact_phone ?? undefined,
          hasContract: false,
        };
      });
      setEmployees(mapped);
    }

    if (deptsRes.data) {
      setDepartments(deptsRes.data);
    }

    if (invitesRes.data) {
      const mappedInvites: Employee[] = invitesRes.data.map((inv) => {
        const isExpired = new Date(inv.expires_at) < new Date();
        return {
          id: inv.invitation_id,
          name: [inv.first_name, inv.last_name].filter(Boolean).join(" ") || inv.email,
          email: inv.email,
          role: inv.role,
          department: "",
          departmentId: inv.department_ids?.[0] ?? null,
          status: "invited" as const,
          inviteStatus: isExpired ? ("expired" as const) : ("pending" as const),
          inviteToken: inv.token,
          readinessScore: 0,
          hasContract: false,
        };
      });
      setInvitations(mappedInvites);
    }

    setLoading(false);
  }, [workspaceData?.workspace_id]);

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
          className={`${cardBase(activeFilter === "all")} ${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"}`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl transition-colors group-hover:bg-orange-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400" : "border-orange-100 bg-orange-50 text-orange-600"}`}
            >
              <Users className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Total Staff
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              {employees.length}
            </span>
          </div>
        </div>

        {/* Active Now */}
        <div
          onClick={() => handleCardClick("active")}
          className={`${cardBase(activeFilter === "active")} ${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"}`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-colors group-hover:bg-emerald-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400" : "border-emerald-100 bg-emerald-50 text-emerald-600"}`}
            >
              <Star className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Active Now
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              {activeCount}
            </span>
            <span
              className={`mb-0.5 text-sm font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              clocked in
            </span>
          </div>
        </div>

        {/* Avg Readiness */}
        <div
          onClick={() => handleCardClick("readiness")}
          className={`${cardBase(activeFilter === "readiness")} ${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"}`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl transition-colors group-hover:bg-blue-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400" : "border-blue-100 bg-blue-50 text-blue-600"}`}
            >
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Avg Readiness
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              {avgReadiness}%
            </span>
            <span
              className={`mb-0.5 text-sm font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              workspace
            </span>
          </div>
        </div>

        {/* Pending Invites */}
        <div
          onClick={() => handleCardClick("invites")}
          className={`${cardBase(activeFilter === "invites")} ${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white hover:border-zinc-300"}`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-rose-500/10 blur-2xl transition-colors group-hover:bg-rose-500/20" />
          <div className="relative z-10 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-rose-500">
                <Mail className="h-4 w-4" />
              </div>
              <h3
                className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
              >
                Pending Invites
              </h3>
            </div>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span className="text-3xl leading-none font-bold text-rose-400">
              {invitations.length}
            </span>
            <span
              className={`mb-0.5 text-sm font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
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
