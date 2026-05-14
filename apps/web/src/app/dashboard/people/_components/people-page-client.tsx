"use client";

import { useState, useContext, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { useRouter, usePathname } from "next/navigation";
import { Users, Star, ShieldCheck } from "lucide-react";
import { KpiAccentTile } from "@smartout/ui";
import { PeopleDataTable } from "./people-data-table";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { fetchWorkspacePeople } from "@smartout/utils";
import { PEOPLE_TAB_DEFS } from "@/app/dashboard/_lib/people-tabs";
import type { Employee, Department, ProfileRole } from "./types";

type MetricFilter = "all" | "active" | "readiness";

export type PeoplePageInitialData = {
  employees: Employee[];
  departments: Department[];
  invitations: Employee[];
  currentUserRole: ProfileRole;
};

/**
 * PeoplePageClient — client surface for /dashboard/people.
 *
 * Initial data is fetched server-side by `page.tsx` (per ADR-0115 RSC
 * migration pattern) and passed in as `initialData`. The client may
 * still re-fetch via `fetchData` for manual refresh; the table already
 * exposes a refresh callback wired here.
 *
 * No `useEffect`-on-mount fetch — the server handed us hydrated data;
 * a workspace switch causes a full server re-render with fresh data.
 */
export function PeoplePageClient({ initialData }: { initialData: PeoplePageInitialData }) {
  const [isCompact, setIsCompact] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MetricFilter>("all");
  const { isDark, workspaceData, profileId } = useContext(DashboardContext);
  const router = useRouter();
  const pathname = usePathname();

  const [employees, setEmployees] = useState<Employee[]>(initialData.employees);
  const [departments, setDepartments] = useState<Department[]>(initialData.departments);
  const [invitations, setInvitations] = useState<Employee[]>(initialData.invitations);
  const [loading, setLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<ProfileRole>(initialData.currentUserRole);

  const fetchData = useCallback(async () => {
    if (!workspaceData?.workspace_id) return;
    setLoading(true);
    const supabase = createClient();

    const result = await fetchWorkspacePeople(supabase, workspaceData.workspace_id);

    const currentProfile = profileId
      ? result.profiles.find((p) => p.profile_id === profileId)
      : undefined;
    if (currentProfile) {
      setCurrentUserRole(currentProfile.role as ProfileRole);
    }

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

  void isDark; // accent palette handles dark-mode internally

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {/* Page header — H1 + description sentence + quick counts */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Ansatte
          </h1>
          <p className="text-muted-foreground mt-1 text-sm leading-snug">
            Administrer teamet ditt — inviter, endre roller og avdelinger, send kontrakter og følg
            beredskapsgrad for alle ansatte.
          </p>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span>
              <span className="text-foreground font-mono font-semibold tabular-nums">
                {employees.length}
              </span>{" "}
              i workspace
            </span>
            <span aria-hidden className="opacity-50">
              ·
            </span>
            <span>
              <span className="text-foreground font-mono font-semibold tabular-nums">
                {activeCount}
              </span>{" "}
              aktive
            </span>
          </div>
        </div>
      </div>

      {/* Page tab nav — same pill-row as Oversikt */}
      <PageTabNav
        tabs={PEOPLE_TAB_DEFS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
        active={pathname ?? "/dashboard/people"}
        onChange={(href) => router.push(href)}
        ariaLabel="Ansatte-seksjoner"
      />

      {/* KPI strip — compact KpiAccentTile. AnimatePresence crossfade to avoid
          Tailwind duration-based collapse which doesn't use motion tokens. */}
      <AnimatePresence mode="wait">
        {!isCompact && (
          <motion.div
            key="kpi-strip"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", ...motionTokens.spring }}
            style={{ overflow: "hidden" }}
          >
            <KpiAccentTile
              compact
              title="Ansatte"
              icon={Users}
              accent="orange"
              primary={{ label: "Totalt", value: employees.length }}
              secondary={{ label: "Avdelinger", value: departments.length }}
              onClick={() => handleCardClick("all")}
            />
            <KpiAccentTile
              compact
              title="Aktive"
              icon={Star}
              accent="emerald"
              primary={{ label: "Aktive", value: activeCount }}
              secondary={{
                label: "Inaktive",
                value: employees.filter((e) => e.status === "inactive").length,
              }}
              onClick={() => handleCardClick("active")}
            />
            <KpiAccentTile
              compact
              title="Beredskap"
              icon={ShieldCheck}
              accent="blue"
              primary={{ label: "Snitt", value: `${avgReadiness}`, unit: "%" }}
              secondary={{
                label: "Trainees",
                value: employees.filter((e) => e.status === "trainee").length,
              }}
              onClick={() => handleCardClick("readiness")}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
