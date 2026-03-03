"use client";

import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { EntityDetailLayout } from "../../organization/_components/EntityDetailLayout";

/* ───────── types ───────── */

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

/* ───────── helpers ───────── */

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "Active" },
  trainee: { bg: "bg-orange-500/10", text: "text-orange-500", label: "Trainee" },
  inactive: { bg: "bg-zinc-500/10", text: "text-zinc-400", label: "Inactive" },
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
  const { isDark, workspaceData } = useContext(DashboardContext);
  const supabase = createClient();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [protocols, setProtocols] = useState<ProtocolAssignment[]>([]);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
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
          `profile_id, display_name, job_title, role, status, avatar_url,
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
      const p = profileRes.data as unknown as ProfileRow;
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

  useEffect(() => {
    fetchProfile();
    fetchProtocols();
    fetchTeams();
  }, [fetchProfile, fetchProtocols, fetchTeams]);

  async function handleSettingsSave() {
    if (!profile) return;
    setSaving(true);

    const updates: Record<string, unknown> = {};
    if (editRole !== profile.role.toLowerCase()) updates.role = editRole;
    if (editDeptId !== (profile.department_id ?? "")) updates.department_id = editDeptId || null;
    if (editStatus !== profile.status) {
      updates.status = editStatus;
      if (editStatus === "offboarding" || editStatus === "inactive") updates.is_active = false;
      else updates.is_active = true;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("profile")
        .update(updates)
        .eq("profile_id", profile.profile_id);
      if (error) toast.error(error.message);
      else {
        toast.success("Profile updated");
        fetchProfile();
      }
    }
    setSaving(false);
  }

  async function handleHrSave() {
    if (!profile) return;
    setSaving(true);

    const addressParts = hrAddress.split(",").map((s) => s.trim());
    const { error } = await supabase
      .from("profile")
      .update({
        address_line_1: addressParts[0] || null,
        postal_code: addressParts[1] || null,
        city: addressParts[2] || null,
        personal_number: hrPersonalNumber || null,
        bank_account: hrBankAccount || null,
      })
      .eq("profile_id", profile.profile_id);

    if (error) toast.error(error.message);
    else {
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
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className={isDark ? "text-zinc-400" : "text-zinc-600"}>Profile not found</p>
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

  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
    isDark
      ? "border-zinc-800 bg-zinc-900 text-white placeholder:text-zinc-600"
      : "border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400"
  }`;

  const selectClass = `w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
    isDark ? "border-zinc-800 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50 text-zinc-900"
  }`;

  const sectionCard = `rounded-xl border p-4 ${
    isDark ? "border-zinc-800/50 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50"
  }`;

  /* ───────── tab: overview ───────── */

  const overviewTab = (
    <div className="space-y-6">
      {/* Contact */}
      <div className={sectionCard}>
        <h3
          className={`mb-3 text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          Contact
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
            <a
              href={`mailto:${email}`}
              className={`transition-colors ${isDark ? "text-zinc-300 hover:text-white" : "text-zinc-600 hover:text-zinc-900"}`}
            >
              {email || "No email"}
            </a>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
            <span className={isDark ? "text-zinc-300" : "text-zinc-600"}>
              {phone || "No phone"}
            </span>
          </div>
          {addressStr && (
            <div className="flex items-center gap-3 text-sm">
              <Home className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <span className={isDark ? "text-zinc-300" : "text-zinc-600"}>{addressStr}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Readiness" value={`${readinessScore}%`} isDark={isDark} />
        <StatCard
          label="Protocols"
          value={`${completedProtocols}/${protocols.length}`}
          isDark={isDark}
        />
        <StatCard label="Teams" value={String(teams.length)} isDark={isDark} />
      </div>

      {/* Teams */}
      {teams.length > 0 && (
        <div>
          <h3
            className={`mb-3 text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            Teams
          </h3>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => (
              <button
                key={t.team_id}
                onClick={() => router.push(`/dashboard/organization/teams/${t.team_id}`)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isDark
                    ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-white"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity (placeholder — same as employee-profile-card) */}
      <div>
        <h3
          className={`mb-3 text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          Recent Activity
        </h3>
        <div
          className={`relative flex flex-col space-y-3 before:absolute before:inset-y-2 before:left-3 before:w-px ${isDark ? "before:bg-zinc-800" : "before:bg-zinc-200"}`}
        >
          <ActivityItem
            icon={<Clock className="h-3 w-3" />}
            color="emerald"
            title={
              <>
                Clocked in for{" "}
                <span className={`font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                  Opening Shift
                </span>
              </>
            }
            time="Today, 07:58"
            isDark={isDark}
          />
          <ActivityItem
            icon={<CheckCircle2 className="h-3 w-3" />}
            color="orange"
            title={
              <>
                Completed{" "}
                <span className={`font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                  Temperature Check Routine
                </span>
              </>
            }
            time="Today, 11:30"
            isDark={isDark}
          />
          <ActivityItem
            icon={<FileText className="h-3 w-3" />}
            color="zinc"
            title={
              <>
                Signed{" "}
                <span className={`font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                  Fire Safety Protocol
                </span>
              </>
            }
            time="Yesterday, 14:12"
            isDark={isDark}
          />
        </div>
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
        <h3
          className={`mb-3 flex items-center justify-between text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          <span>Assigned Protocols</span>
          {protocols.length > 0 && (
            <span className={`font-medium ${isDark ? "text-zinc-600" : "text-zinc-500"}`}>
              {completedProtocols}/{protocols.length} Completed
            </span>
          )}
        </h3>

        {loadingProtocols ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : protocols.length === 0 ? (
          <p className={`py-4 text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            No protocols assigned
          </p>
        ) : (
          <div className="space-y-2">
            {protocols.map((p) => (
              <div
                key={p.assignment_id}
                className={`group flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                  isDark
                    ? "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                    : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
                }`}
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
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${isDark ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400"}`}
                    >
                      <Clock className="h-4 w-4" />
                    </div>
                  )}
                  <div>
                    <p
                      className={`text-sm font-bold transition-colors ${isDark ? "text-zinc-200 group-hover:text-white" : "text-zinc-700 group-hover:text-zinc-900"}`}
                    >
                      {p.protocol?.name ?? "Unknown Protocol"}
                    </p>
                    <p
                      className={`mt-0.5 text-[10px] tracking-wider uppercase ${
                        p.status === "completed"
                          ? "text-emerald-500"
                          : p.status === "expired"
                            ? "text-rose-500"
                            : isDark
                              ? "text-zinc-500"
                              : "text-zinc-400"
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
                <ChevronRight
                  className={`h-4 w-4 transition-colors ${isDark ? "text-zinc-600 group-hover:text-zinc-400" : "text-zinc-400 group-hover:text-zinc-600"}`}
                />
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
      {/* Contract Status */}
      <div>
        <h3
          className={`mb-3 text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          Employment Contract
        </h3>
        <div
          className={`flex items-center justify-between rounded-xl border p-4 ${
            isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-200 text-zinc-500"}`}
            >
              <FileSignature className="h-4 w-4" />
            </div>
            <div>
              <p className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                No Contract Found
              </p>
              <p
                className={`mt-0.5 text-[10px] tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
              >
                Action required
              </p>
            </div>
          </div>
          <button
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              isDark
                ? "bg-white text-black hover:bg-zinc-200"
                : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            Create
          </button>
        </div>
      </div>

      {/* Personal Information */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3
            className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            Personal Information
          </h3>
          {!editingHr && (
            <button
              onClick={() => setEditingHr(true)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                isDark
                  ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
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
              isDark={isDark}
            />
            <InfoField
              icon={<CreditCard className="h-3 w-3" />}
              label="Personal Number (SSN)"
              value={profile.personal_number || "Not provided"}
              isDark={isDark}
            />
            <InfoField
              icon={<Wallet className="h-3 w-3" />}
              label="Bank Account"
              value={profile.bank_account || "Not provided"}
              isDark={isDark}
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
              <span className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-800"}`}>
                {profile.user_identity?.emergency_contact_name || "Not provided"} &bull;{" "}
                {profile.user_identity?.emergency_contact_phone || ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
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
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
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
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
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
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
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
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
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
                className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${
                  isDark
                    ? "border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Communication Log */}
      <div>
        <h3
          className={`mb-3 flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          <History className="h-4 w-4" /> Communication Log
        </h3>
        <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          No communications found for this user.
        </p>
      </div>
    </div>
  );

  /* ───────── tab: settings ───────── */

  const settingsTab = (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label
            className={`text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
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

        <div className="space-y-1.5">
          <label
            className={`text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
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
          <p className={`pt-1 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Defines what this user can see and do in the system.
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            className={`text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            Status
          </label>
          <select
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
            className={selectClass}
          >
            <option value="active">Active</option>
            <option value="trainee">Trainee</option>
            <option value="inactive">Inactive</option>
            <option value="offboarding">Offboarding</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleSettingsSave}
        disabled={saving}
        className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      <div
        className={`space-y-3 border-t pt-4 ${isDark ? "border-zinc-800/50" : "border-zinc-200"}`}
      >
        <button
          className={`w-full rounded-lg border py-2.5 text-sm font-medium transition-colors ${
            isDark
              ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
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
    <EntityDetailLayout
      breadcrumbs={[
        { label: "People", href: "/dashboard/people" },
        { label: profile.display_name },
      ]}
      name={profile.display_name}
      icon={
        <div
          className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-lg font-bold ${
            isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"
          }`}
        >
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
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {ROLE_LABELS[profile.role.toLowerCase()] ?? profile.role}
          </span>
          {profile.department?.name && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {profile.department.name}
            </span>
          )}
        </div>
      }
      tabs={[
        { value: "overview", label: "Overview", content: overviewTab },
        { value: "competence", label: "Competence", content: competenceTab },
        { value: "hr", label: "HR & Logs", content: hrTab },
        { value: "settings", label: "Settings", content: settingsTab },
      ]}
    />
  );
}

/* ───────── sub-components ───────── */

function StatCard({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center ${
        isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"
      }`}
    >
      <span className="mb-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        {label}
      </span>
      <span className={`text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
        {value}
      </span>
    </div>
  );
}

function InfoField({
  icon,
  label,
  value,
  isDark,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isDark: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
        {icon} {label}
      </span>
      <span
        className={`text-sm ${mono ? "font-mono" : ""} ${isDark ? "text-zinc-300" : "text-zinc-800"}`}
      >
        {value}
      </span>
    </div>
  );
}

function ActivityItem({
  icon,
  color,
  title,
  time,
  isDark,
}: {
  icon: React.ReactNode;
  color: "emerald" | "orange" | "zinc";
  title: React.ReactNode;
  time: string;
  isDark: boolean;
}) {
  const colorMap = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-500",
    zinc: isDark
      ? "border-zinc-700 bg-zinc-800 text-zinc-400"
      : "border-zinc-300 bg-zinc-200 text-zinc-500",
  };

  return (
    <div className="relative flex gap-4">
      <div
        className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${colorMap[color]}`}
      >
        {icon}
      </div>
      <div>
        <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>{title}</p>
        <span className="text-xs text-zinc-500">{time}</span>
      </div>
    </div>
  );
}
