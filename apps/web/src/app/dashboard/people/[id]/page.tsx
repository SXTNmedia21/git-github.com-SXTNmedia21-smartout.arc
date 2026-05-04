"use client";

/**
 * /dashboard/people/[id] — Employee detail page.
 *
 * Wave 5 WS0: ContractDispatchDrawer wired to "Lag kontrakt" action button
 * instead of navigating away to /dashboard/contracts. URL sync:
 * /dashboard/people/[id]?compose=open opens drawer on mount.
 * profile_id comes from URL context; workspaceId derived server-side (ADR-0151).
 */

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useContext, useCallback } from "react";
import {
  Phone,
  Mail,
  Home,
  CreditCard,
  ShieldAlert,
  FileSignature,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  ChevronRight,
  History,
  Wallet,
  Loader2,
  Calendar,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { VALID_TRANSITIONS } from "@smartout/utils";
import type { ProfileStatus } from "@smartout/utils";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { EntityDetailLayout } from "../../organization/_components/EntityDetailLayout";
import { addToTeam, removeFromTeam, updateProfileStatus } from "../_actions/people-actions";
import { HrTabSections } from "./complete-data/HrTabSections";
import { ContractDispatchDrawer } from "@/components/contracts/ContractDispatchDrawer";

/* ───────── types ───────── */

type ProfileRow = {
  profile_id: string;
  user_id: string;
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
  created_at: string | null;
  department: { name: string } | null;
  user_identity: {
    email: string;
    phone: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  } | null;
};

type DeptOption = { department_id: string; name: string };

type ProtocolAssignment = {
  assignment_id: string;
  status: string;
  protocol: { name: string } | null;
};

type TeamMembership = { team_id: string; name: string; team_type: string };

type ActivityEntry = {
  id: number;
  event: string;
  action_verb: string;
  category: string;
  entity_type: string;
  entity_label: string | null;
  created_at: string;
};

type ShiftEntry = {
  shift_id: string;
  start_time: string;
  end_time: string;
  status: string;
  department: { name: string } | null;
};

type WorkspaceTeam = { team_id: string; name: string };

/* ───────── helpers ───────── */

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Active" },
  trainee: { bg: "bg-orange-500/10", text: "text-orange-500", label: "Trainee" },
  inactive: { bg: "bg-muted", text: "text-muted-foreground", label: "Inactive" },
  offboarding: { bg: "bg-rose-500/10", text: "text-rose-500", label: "Offboarding" },
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  employee: "Employee",
};

/* ───────── page ───────── */

export default function ProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark, workspaceData } = useContext(DashboardContext);
  const supabase = createClient();

  // WS0: ContractDispatchDrawer state — open when ?compose=open is in URL.
  const [contractDrawerOpen, setContractDrawerOpen] = useState(
    searchParams.get("compose") === "open",
  );

  // Sync drawer close → strip compose param from URL.
  function handleContractDrawerChange(open: boolean) {
    setContractDrawerOpen(open);
    if (!open) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("compose");
      router.replace(`?${next.toString()}`, { scroll: false });
    }
  }

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [protocols, setProtocols] = useState<ProtocolAssignment[]>([]);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [fullActivity, setFullActivity] = useState<ActivityEntry[]>([]);
  const [activityPage, setActivityPage] = useState(0);
  const [hasMoreActivity, setHasMoreActivity] = useState(false);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);
  const [workspaceTeams, setWorkspaceTeams] = useState<WorkspaceTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProtocols, setLoadingProtocols] = useState(false);

  // Settings form state
  const [editRole, setEditRole] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);

  // HR form state
  const [editingHr, setEditingHr] = useState(false);
  const [hrAddress, setHrAddress] = useState("");
  const [hrPersonalNumber, setHrPersonalNumber] = useState("");
  const [hrBankAccount, setHrBankAccount] = useState("");
  const [hrEmergencyName, setHrEmergencyName] = useState("");
  const [hrEmergencyPhone, setHrEmergencyPhone] = useState("");

  const fetchProfile = useCallback(async () => {
    if (!workspaceData?.workspace_id || !id) return;

    const [profileRes, deptsRes] = await Promise.all([
      supabase
        .from("profile")
        .select(
          `profile_id, user_id, display_name, job_title, role, status, avatar_url,
           department_id, address_line_1, postal_code, city,
           personal_number, bank_account, is_active, created_at,
           department:department_id(name),
           user_identity:user_id(email, phone, emergency_contact_name, emergency_contact_phone)`,
        )
        .eq("profile_id", id)
        .single(),
      supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceData.workspace_id)
        .order("sort_order"),
    ]);

    if (profileRes.data) {
      const p = profileRes.data as unknown as ProfileRow; // SAFETY: Supabase join returns union type; runtime shape matches the cast
      setProfile(p);
      setEditRole(p.role.toLowerCase());
      setEditDeptId(p.department_id ?? "");
      setEditStatus(p.status);
      const addressParts = [p.address_line_1, p.postal_code, p.city].filter(Boolean);
      setHrAddress(addressParts.join(", "));
      setHrPersonalNumber(p.personal_number ?? "");
      setHrBankAccount(p.bank_account ?? "");
      setHrEmergencyName(p.user_identity?.emergency_contact_name ?? "");
      setHrEmergencyPhone(p.user_identity?.emergency_contact_phone ?? "");
    }
    if (deptsRes.data) setDepartments(deptsRes.data);
    setLoading(false);
  }, [workspaceData?.workspace_id, id]);

  const fetchProtocols = useCallback(async () => {
    if (!id) return;
    setLoadingProtocols(true);
    const { data } = await supabase
      .from("protocol_assignment")
      .select("assignment_id, status, protocol:protocol_id(name)")
      .eq("profile_id", id);
    setProtocols(
      (data ?? []).map((d) => ({
        assignment_id: d.assignment_id,
        status: d.status,
        protocol: d.protocol as { name: string } | null,
      })),
    );
    setLoadingProtocols(false);
  }, [id]);

  const fetchTeams = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("team_member")
      .select("team:team_id(team_id, name, team_type)")
      .eq("profile_id", id);
    setTeams(
      (data ?? []).map((d) => d.team as TeamMembership | null).filter(Boolean) as TeamMembership[],
    );
  }, [id]);

  const fetchActivity = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("activity_trail")
      .select("id, event, action_verb, category, entity_type, entity_label, created_at")
      .eq("actor_id", id)
      .order("created_at", { ascending: false })
      .limit(5);
    setActivity((data as ActivityEntry[]) ?? []);
  }, [id]);

  const ACTIVITY_PAGE_SIZE = 20;

  const fetchShifts = useCallback(async () => {
    if (!id) return;
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const { data } = await supabase
      .from("schedule_shift")
      .select("schedule_shift_id, start_time, end_time, status, department:department_id(name)")
      .eq("profile_id", id)
      .gte("start_time", new Date(now - weekMs).toISOString())
      .lte("start_time", new Date(now + weekMs).toISOString())
      .order("start_time");

    // Map id to shift_id for UI
    const mappedShifts = (data ?? []).map(
      (row: { schedule_shift_id?: string; [key: string]: unknown }) => ({
        ...row,
        shift_id: row.schedule_shift_id,
      }),
    );
    setShifts((mappedShifts as unknown as ShiftEntry[]) ?? []); // SAFETY: Supabase join returns union type; runtime shape matches the cast
  }, [id]);

  const fetchFullActivity = useCallback(
    async (page: number) => {
      if (!id) return;
      setLoadingMoreActivity(true);
      const end = (page + 1) * ACTIVITY_PAGE_SIZE - 1;
      const { data } = await supabase
        .from("activity_trail")
        .select("id, event, action_verb, category, entity_type, entity_label, created_at")
        .eq("actor_id", id)
        .order("created_at", { ascending: false })
        .range(0, end);
      const items = (data as ActivityEntry[]) ?? [];
      setFullActivity(items);
      setHasMoreActivity(items.length > page * ACTIVITY_PAGE_SIZE + ACTIVITY_PAGE_SIZE - 1);
      setLoadingMoreActivity(false);
    },
    [id],
  );

  const fetchWorkspaceTeams = useCallback(async () => {
    if (!workspaceData?.workspace_id) return;
    const { data } = await supabase
      .from("team")
      .select("team_id, name")
      .eq("workspace_id", workspaceData.workspace_id)
      .order("name");
    setWorkspaceTeams((data as WorkspaceTeam[]) ?? []);
  }, [workspaceData?.workspace_id]);

  useEffect(() => {
    fetchProfile();
    fetchProtocols();
    fetchTeams();
    fetchActivity();
    fetchShifts();
    fetchFullActivity(0);
    fetchWorkspaceTeams();
  }, [
    fetchProfile,
    fetchProtocols,
    fetchTeams,
    fetchActivity,
    fetchShifts,
    fetchFullActivity,
    fetchWorkspaceTeams,
  ]);

  async function handleSettingsSave() {
    if (!profile || !workspaceData?.workspace_id) return;
    setSaving(true);

    try {
      // Handle status change via server action with transition validation
      if (editStatus !== profile.status) {
        await updateProfileStatus(
          profile.profile_id,
          workspaceData.workspace_id,
          profile.status as ProfileStatus,
          editStatus as ProfileStatus,
        );
      }

      // Handle role/department changes via direct update
      const updates: Record<string, unknown> = {};
      if (editRole !== profile.role.toLowerCase()) updates.role = editRole;
      if (editDeptId !== (profile.department_id ?? "")) updates.department_id = editDeptId || null;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("profile")
          .update(updates)
          .eq("profile_id", profile.profile_id);
        if (error) throw new Error(error.message);
      }

      toast.success("Profile updated");
      fetchProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    }
    setSaving(false);
  }

  async function handleAddToTeam(teamId: string) {
    if (!profile) return;
    try {
      await addToTeam(profile.profile_id, teamId);
      toast.success("Added to team");
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add to team");
    }
  }

  async function handleRemoveFromTeam(teamId: string) {
    if (!profile) return;
    try {
      await removeFromTeam(profile.profile_id, teamId);
      toast.success("Removed from team");
      fetchTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove from team");
    }
  }

  async function handleHrSave() {
    if (!profile) return;
    setSaving(true);

    const addressParts = hrAddress.split(",").map((s) => s.trim());

    // Update profile fields (address, personal number, bank account)
    const { error: profileError } = await supabase
      .from("profile")
      .update({
        address_line_1: addressParts[0] || null,
        postal_code: addressParts[1] || null,
        city: addressParts[2] || null,
        personal_number: hrPersonalNumber || null,
        bank_account: hrBankAccount || null,
      })
      .eq("profile_id", profile.profile_id);

    if (profileError) {
      toast.error(profileError.message);
      setSaving(false);
      return;
    }

    // Update emergency contact on user_identity (separate table)
    const { error: identityError } = await supabase
      .from("user_identity")
      .update({
        emergency_contact_name: hrEmergencyName || null,
        emergency_contact_phone: hrEmergencyPhone || null,
      })
      .eq("user_id", profile.user_id);

    if (identityError) {
      toast.error(identityError.message);
    } else {
      toast.success("Personal info updated");
      setEditingHr(false);
      fetchProfile();
    }
    setSaving(false);
  }

  /* ───────── loading / not found ───────── */

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-muted-foreground">Profile not found</p>
        <button
          onClick={() => router.push("/dashboard/people")}
          className="text-sm text-orange-500 hover:underline"
        >
          Back to People
        </button>
      </div>
    );
  }

  /* ───────── derived ───────── */

  const email = profile.user_identity?.email ?? "";
  const phone = profile.user_identity?.phone ?? "";
  const statusCfg = STATUS_COLORS[profile.status] ?? {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    label: "Active",
  };
  const addressParts = [profile.address_line_1, profile.postal_code, profile.city].filter(Boolean);
  const addressStr = addressParts.join(", ");
  const completedProtocols = protocols.filter((p) => p.status === "completed").length;
  const readinessScore =
    protocols.length > 0 ? Math.round((completedProtocols / protocols.length) * 100) : 0;

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none";

  const selectClass =
    "w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none";

  const sectionCard = "rounded-xl border border-border bg-card p-4";

  /* ───────── tab: overview ───────── */

  const overviewTab = (
    <div className="space-y-6">
      {/* Contact */}
      <div className={sectionCard}>
        <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
          Contact
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="text-muted-foreground h-4 w-4" />
            <a
              href={`mailto:${email}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {email || "No email"}
            </a>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground">{phone || "No phone"}</span>
          </div>
          {addressStr && (
            <div className="flex items-center gap-3 text-sm">
              <Home className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">{addressStr}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Readiness" value={`${readinessScore}%`} />
        <StatCard label="Protocols" value={`${completedProtocols}/${protocols.length}`} />
        <StatCard label="Teams" value={String(teams.length)} />
      </div>

      {/* Teams */}
      {teams.length > 0 && (
        <div>
          <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
            Teams
          </h3>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button
                key={t.team_id}
                onClick={() => router.push(`/dashboard/organization/teams/${t.team_id}`)}
                className="border-border bg-card text-foreground hover:bg-accent rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
          Recent Activity
        </h3>
        {activity.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No activity recorded yet</p>
        ) : (
          <div className="before:bg-border relative flex flex-col space-y-3 before:absolute before:inset-y-2 before:left-3 before:w-px">
            {activity.map((a) => (
              <ActivityItem
                key={a.id}
                icon={<History className="h-3 w-3" />}
                color={
                  a.category === "training"
                    ? "emerald"
                    : a.category === "schedule"
                      ? "orange"
                      : "zinc"
                }
                title={
                  <>
                    {a.action_verb}{" "}
                    {a.entity_label && (
                      <span className="text-foreground font-medium">{a.entity_label}</span>
                    )}
                  </>
                }
                time={new Date(a.created_at).toLocaleString("nb-NO", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* ───────── tab: competence ───────── */

  const competenceTab = (
    <div className="space-y-6">
      {readinessScore < 100 && profile.status !== "trainee" && protocols.length > 0 && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 ${
            isDark ? "border-rose-500/20 bg-rose-500/10" : "border-rose-200 bg-rose-50"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <h4 className={`mb-1 text-sm font-bold ${isDark ? "text-rose-400" : "text-rose-600"}`}>
              Missing Requirements
            </h4>
            <p
              className={`mb-3 text-xs leading-relaxed ${isDark ? "text-rose-500/80" : "text-rose-600/70"}`}
            >
              Employee has pending protocols required for{" "}
              {profile.department?.name ?? "their department"}. They cannot perform all duties until
              finished.
            </p>
            <button
              className={`rounded-md px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors ${
                isDark ? "bg-rose-500 hover:bg-rose-600" : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              Send Reminder
            </button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-muted-foreground mb-3 flex items-center justify-between text-xs font-bold tracking-widest uppercase">
          <span>Assigned Protocols</span>
          {protocols.length > 0 && (
            <span className="text-muted-foreground font-medium">
              {completedProtocols}/{protocols.length} Completed
            </span>
          )}
        </h3>

        {loadingProtocols ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : protocols.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No protocols assigned</p>
        ) : (
          <div className="space-y-2">
            {protocols.map((p) => (
              <div
                key={p.assignment_id}
                className="group border-border bg-card hover:bg-accent flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {p.status === "completed" ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  ) : p.status === "expired" ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="bg-secondary text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full">
                      <Clock className="h-4 w-4" />
                    </div>
                  )}
                  <div>
                    <p className="text-foreground text-sm font-bold transition-colors">
                      {p.protocol?.name ?? "Unknown Protocol"}
                    </p>
                    <p
                      className={`mt-0.5 text-[10px] tracking-wider uppercase ${
                        p.status === "completed"
                          ? "text-emerald-500"
                          : p.status === "expired"
                            ? "text-rose-500"
                            : "text-muted-foreground"
                      }`}
                    >
                      {p.status === "completed"
                        ? "Completed"
                        : p.status === "expired"
                          ? "Expired"
                          : "Pending"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /* ───────── tab: hr & logs ───────── */

  const hrTab = (
    <div className="space-y-6">
      {/* Ansettelse / Lønnsprofil / Tipsregel — Wave 4 authoring sections */}
      {profile && workspaceData && (
        <HrTabSections
          profileId={profile.profile_id}
          workspaceId={workspaceData.workspace_id}
          departments={departments}
        />
      )}

      {/* Personal Information */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Personal Information
          </h3>
          {!editingHr && (
            <button
              onClick={() => setEditingHr(true)}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {!editingHr ? (
          <div className="space-y-3">
            <InfoField
              icon={<Home className="h-3 w-3" />}
              label="Address"
              value={addressStr || "Not provided"}
            />
            <InfoField
              icon={<CreditCard className="h-3 w-3" />}
              label="Personal Number (SSN)"
              value={profile.personal_number || "Not provided"}
            />
            <InfoField
              icon={<Wallet className="h-3 w-3" />}
              label="Bank Account"
              value={profile.bank_account || "Not provided"}
              mono
            />
            <div
              className={`mt-2 flex flex-col gap-1 rounded-lg border p-3 ${
                isDark ? "border-rose-500/10 bg-rose-500/5" : "border-rose-200 bg-rose-50"
              }`}
            >
              <span
                className={`flex items-center gap-1.5 text-xs font-semibold ${isDark ? "text-rose-500/80" : "text-rose-600/80"}`}
              >
                <ShieldAlert className="h-3 w-3 text-rose-500" /> Emergency Contact
              </span>
              <span className="text-foreground text-sm">
                {profile.user_identity?.emergency_contact_name || "Not provided"} &bull;{" "}
                {profile.user_identity?.emergency_contact_phone || ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                <Home className="h-3 w-3" /> Address
              </label>
              <input
                type="text"
                value={hrAddress}
                onChange={(e) => setHrAddress(e.target.value)}
                placeholder="Street, Postal code, City"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                <CreditCard className="h-3 w-3" /> Personal Number (SSN)
              </label>
              <input
                type="text"
                value={hrPersonalNumber}
                onChange={(e) => setHrPersonalNumber(e.target.value)}
                placeholder="12345678901"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                <Wallet className="h-3 w-3" /> Bank Account
              </label>
              <input
                type="text"
                value={hrBankAccount}
                onChange={(e) => setHrBankAccount(e.target.value)}
                placeholder="1234.56.78901"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                <ShieldAlert className="h-3 w-3" /> Emergency Contact Name
              </label>
              <input
                type="text"
                value={hrEmergencyName}
                onChange={(e) => setHrEmergencyName(e.target.value)}
                placeholder="Full name"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                <Phone className="h-3 w-3" /> Emergency Contact Phone
              </label>
              <input
                type="text"
                value={hrEmergencyPhone}
                onChange={(e) => setHrEmergencyPhone(e.target.value)}
                placeholder="+47 123 45 678"
                className={inputClass}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleHrSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  const parts = [profile.address_line_1, profile.postal_code, profile.city].filter(
                    Boolean,
                  );
                  setHrAddress(parts.join(", "));
                  setHrPersonalNumber(profile.personal_number ?? "");
                  setHrBankAccount(profile.bank_account ?? "");
                  setHrEmergencyName(profile.user_identity?.emergency_contact_name ?? "");
                  setHrEmergencyPhone(profile.user_identity?.emergency_contact_phone ?? "");
                  setEditingHr(false);
                }}
                disabled={saving}
                className="border-border text-muted-foreground hover:bg-accent hover:text-foreground flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Communication Log */}
      <div>
        <h3 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase">
          <History className="h-4 w-4" /> Communication Log
        </h3>
        <p className="text-muted-foreground text-sm">No communications found for this user.</p>
      </div>
    </div>
  );

  /* ───────── tab: schedule ───────── */

  const groupedShifts = shifts.reduce<Record<string, ShiftEntry[]>>((acc, s) => {
    const dateKey = new Date(s.start_time).toLocaleDateString("nb-NO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(s);
    return acc;
  }, {});

  const scheduleTab = (
    <div className="space-y-4">
      {shifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <Calendar className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground text-sm">No shifts scheduled</p>
        </div>
      ) : (
        Object.entries(groupedShifts).map(([date, dateShifts]) => (
          <div key={date}>
            <h4 className="text-muted-foreground mb-2 text-xs font-bold tracking-widest uppercase">
              {date}
            </h4>
            <div className="space-y-1.5">
              {dateShifts.map((s) => {
                const start = new Date(s.start_time);
                const end = new Date(s.end_time);
                const fmt = (d: Date) =>
                  d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
                const isPast = end.getTime() < Date.now();
                return (
                  <div
                    key={s.shift_id}
                    className={`border-border bg-card flex items-center justify-between rounded-lg border p-3 ${isPast ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="text-muted-foreground h-4 w-4" />
                      <span className="text-foreground text-sm font-medium">
                        {fmt(start)} – {fmt(end)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.department?.name && (
                        <span className="text-muted-foreground text-xs">{s.department.name}</span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          s.status === "confirmed"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : s.status === "cancelled"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );

  /* ───────── tab: activity ───────── */

  const activityTab = (
    <div className="space-y-4">
      {fullActivity.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <History className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground text-sm">No activity recorded yet</p>
        </div>
      ) : (
        <>
          <div className="before:bg-border relative flex flex-col space-y-3 before:absolute before:inset-y-2 before:left-3 before:w-px">
            {fullActivity.map((a) => (
              <ActivityItem
                key={a.id}
                icon={<History className="h-3 w-3" />}
                color={
                  a.category === "training"
                    ? "emerald"
                    : a.category === "schedule"
                      ? "orange"
                      : "zinc"
                }
                title={
                  <>
                    {a.action_verb}{" "}
                    {a.entity_label && (
                      <span className="text-foreground font-medium">{a.entity_label}</span>
                    )}
                  </>
                }
                time={new Date(a.created_at).toLocaleString("nb-NO", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            ))}
          </div>
          {hasMoreActivity && (
            <button
              onClick={() => {
                const nextPage = activityPage + 1;
                setActivityPage(nextPage);
                fetchFullActivity(nextPage);
              }}
              disabled={loadingMoreActivity}
              className="border-border text-muted-foreground hover:bg-accent hover:text-foreground w-full rounded-lg border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loadingMoreActivity ? "Loading..." : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );

  /* ───────── tab: settings ───────── */

  const settingsTab = (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Primary Department
          </label>
          <select
            value={editDeptId}
            onChange={(e) => setEditDeptId(e.target.value)}
            className={selectClass}
          >
            <option value="">No department</option>
            {departments.map((dept) => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* Team Management */}
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Teams
          </label>
          {teams.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-1">
              {teams.map((t) => (
                <span
                  key={t.team_id}
                  className="border-border bg-card text-foreground inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium"
                >
                  {t.name}
                  <button
                    onClick={() => handleRemoveFromTeam(t.team_id)}
                    className="hover:bg-accent hover:text-foreground ml-0.5 rounded p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {(() => {
            const assignedIds = new Set(teams.map((t) => t.team_id));
            const available = workspaceTeams.filter((t) => !assignedIds.has(t.team_id));
            if (available.length === 0) return null;
            return (
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddToTeam(e.target.value);
                    e.target.value = "";
                  }
                }}
                className={selectClass}
              >
                <option value="" disabled>
                  Add to team...
                </option>
                {available.map((t) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.name}
                  </option>
                ))}
              </select>
            );
          })()}
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            System Role
          </label>
          <select
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            className={selectClass}
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          <p className="text-muted-foreground pt-1 text-xs">
            Defines what this user can see and do in the system.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Status
          </label>
          {(() => {
            const currentStatus = profile.status as ProfileStatus;
            const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
            const STATUS_LABELS: Record<string, string> = {
              active: "Active",
              trainee: "Trainee",
              inactive: "Inactive",
              offboarding: "Offboarding",
            };
            return (
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className={selectClass}
              >
                {(["active", "trainee", "inactive", "offboarding"] as ProfileStatus[]).map((s) => (
                  <option key={s} value={s} disabled={!allowed.includes(s) && s !== currentStatus}>
                    {STATUS_LABELS[s]}
                    {!allowed.includes(s) && s !== currentStatus ? " (not allowed)" : ""}
                  </option>
                ))}
              </select>
            );
          })()}
        </div>
      </div>

      <button
        onClick={handleSettingsSave}
        disabled={saving}
        className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      <div className="border-border space-y-3 border-t pt-4">
        <button className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground w-full rounded-lg border py-2.5 text-sm font-medium transition-colors">
          Reset Password
        </button>
        <button
          className={`w-full rounded-lg border py-2.5 text-sm font-medium transition-colors ${
            isDark
              ? "border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:text-rose-400"
              : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
          }`}
        >
          Deactivate Account
        </button>
      </div>
    </div>
  );

  /* ───────── render ───────── */

  return (
    <>
      <EntityDetailLayout
        breadcrumbs={[
          { label: "People", href: "/dashboard/people" },
          { label: profile.display_name },
        ]}
        name={profile.display_name}
        icon={
          <div className="bg-secondary text-foreground flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-lg font-bold">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="h-full w-full object-cover"
              />
            ) : (
              profile.display_name.charAt(0)
            )}
          </div>
        }
        badges={
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
            >
              {statusCfg.label}
            </span>
            <span className="bg-secondary text-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {ROLE_LABELS[profile.role.toLowerCase()] ?? profile.role}
            </span>
            {profile.department?.name && (
              <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                {profile.department.name}
              </span>
            )}
          </div>
        }
        // WS0: Dispatch drawer opens inline — no navigation away from people-page.
        // URL: ?compose=open is set for deep-link support; workspaceId derived server-side (ADR-0151).
        actions={
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams.toString());
              next.set("compose", "open");
              router.replace(`?${next.toString()}`, { scroll: false });
              setContractDrawerOpen(true);
            }}
            className="border-border text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <FileSignature className="h-3.5 w-3.5" />
            Send kontrakt
          </button>
        }
        tabs={[
          { value: "overview", label: "Overview", content: overviewTab },
          { value: "schedule", label: "Schedule", content: scheduleTab },
          { value: "competence", label: "Competence", content: competenceTab },
          { value: "activity", label: "Activity", content: activityTab },
          { value: "hr", label: "HR & Logs", content: hrTab },
          { value: "settings", label: "Settings", content: settingsTab },
        ]}
      />

      {/* WS0: ContractDispatchDrawer — inline, profile context from URL, workspace from JWT (ADR-0151) */}
      <ContractDispatchDrawer
        open={contractDrawerOpen}
        onOpenChange={handleContractDrawerChange}
        targetProfileId={profile.profile_id}
        targetProfileName={profile.display_name}
      />
    </>
  );
}

/* ───────── sub-components ───────── */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
      <span className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase">
        {label}
      </span>
      <span className="text-foreground text-lg font-bold">{value}</span>
    </div>
  );
}

function InfoField({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
        {icon} {label}
      </span>
      <span className={`text-foreground text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function ActivityItem({
  icon,
  color,
  title,
  time,
}: {
  icon: React.ReactNode;
  color: "emerald" | "orange" | "zinc";
  title: React.ReactNode;
  time: string;
}) {
  const colorMap = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-500",
    zinc: "border-border bg-secondary text-muted-foreground",
  };

  return (
    <div className="relative flex gap-4">
      <div
        className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${colorMap[color]}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-muted-foreground text-sm">{title}</p>
        <span className="text-muted-foreground text-xs">{time}</span>
      </div>
    </div>
  );
}
