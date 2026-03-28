"use client";

/**
 * Drawer tab showing profile summary: name, department, role, status, contract.
 * Read-only — no mutations.
 */

import { User } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useDrawerProfile } from "@/app/dashboard/_hooks/use-drawer-profile";
import { DrawerSection } from "../../shared/DrawerSection";
import { DrawerSkeleton } from "../../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../../shared/DrawerEmptyState";

const statusColors: Record<string, string> = {
  trainee: "bg-amber-500/10 text-amber-400",
  active: "bg-emerald-500/10 text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  offboarding: "bg-destructive/10 text-destructive",
};

export function ProfileSummaryTab({ entityId }: { entityId: string }) {
  const { t } = useTranslation("dashboard");
  const { data, isLoading } = useDrawerProfile(entityId);

  if (isLoading) return <DrawerSkeleton />;
  if (!data?.profile) return <DrawerEmptyState icon={User} message={t("entity_drawer.profile_not_found")} />;

  const { profile, contract } = data;
  const department = profile.department as { name: string } | null;

  return (
    <div className="space-y-4 p-4">
      {/* Name + avatar */}
      <div className="flex items-center gap-3">
        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
          {profile.display_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div>
          <div className="text-foreground text-sm font-bold">{profile.display_name}</div>
          {profile.job_title && (
            <div className="text-muted-foreground text-xs">{profile.job_title}</div>
          )}
        </div>
      </div>

      <DrawerSection label={t("entity_drawer.profile_status")}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusColors[profile.status] ?? "bg-muted text-muted-foreground"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${profile.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          {profile.status}
        </span>
      </DrawerSection>

      <DrawerSection label={t("entity_drawer.profile_role")}>
        <span className="text-foreground text-[13px] capitalize">{profile.role}</span>
      </DrawerSection>

      {department && (
        <DrawerSection label={t("entity_drawer.profile_department")}>
          <span className="text-foreground text-[13px]">{department.name}</span>
        </DrawerSection>
      )}

      {contract && (
        <DrawerSection label={t("entity_drawer.profile_contract")}>
          <span className="text-foreground text-[13px] capitalize">
            {contract.employment_category} — {contract.employment_percentage}%
          </span>
        </DrawerSection>
      )}
    </div>
  );
}
