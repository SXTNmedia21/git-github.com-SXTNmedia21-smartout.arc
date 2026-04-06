"use client";

import {
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Phone,
  Mail,
  Home,
  CreditCard,
  ShieldAlert,
  FileSignature,
  MessageSquare,
  History,
  Wallet,
  Loader2,
  Copy,
  XCircle,
  KeyRound,
  UserX,
} from "lucide-react";
import { useState, useEffect, useContext } from "react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

import { cancelInvitation } from "../_actions/people-actions";
import type { Employee, Department } from "./types";

interface EmployeeProfileCardProps {
  employee: Employee | null;
  departments: Department[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function EmployeeProfileCard({
  employee,
  departments,
  isOpen,
  onClose,
  onRefresh,
}: EmployeeProfileCardProps) {
  const { workspaceData } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<"overview" | "competence" | "hr" | "settings">(
    "overview",
  );
  const [editRole, setEditRole] = useState(employee?.role ?? "");
  const [editDeptId, setEditDeptId] = useState(employee?.departmentId ?? "");
  const [editStatus, setEditStatus] = useState(employee?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [editingHr, setEditingHr] = useState(false);
  const [hrAddress, setHrAddress] = useState("");
  const [hrPersonalNumber, setHrPersonalNumber] = useState("");
  const [hrBankAccount, setHrBankAccount] = useState("");
  const [hrEmergencyName, setHrEmergencyName] = useState("");
  const [hrEmergencyPhone, setHrEmergencyPhone] = useState("");
  const [protocols, setProtocols] = useState<
    Array<{
      assignment_id: string;
      status: string;
      protocol: { name: string } | null;
    }>
  >([]);
  const [loadingProtocols, setLoadingProtocols] = useState(false);
  const [teams, setTeams] = useState<Array<{ team_id: string; name: string; team_type: string }>>(
    [],
  );

  async function fetchProtocols() {
    if (!employee?.profileId) return;
    setLoadingProtocols(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("protocol_assignment")
      .select("assignment_id, status, protocol:protocol_id(name)")
      .eq("profile_id", employee.profileId);
    setProtocols(
      (data ?? []).map((d) => ({
        assignment_id: d.assignment_id,
        status: d.status,
        protocol: d.protocol as { name: string } | null,
      })),
    );
    setLoadingProtocols(false);
  }

  async function fetchTeams() {
    if (!employee?.profileId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("team_member")
      .select("team:team_id(team_id, name, team_type)")
      .eq("profile_id", employee.profileId);
    setTeams(
      (data ?? [])
        .map((d) => d.team as { team_id: string; name: string; team_type: string } | null)
        .filter(Boolean) as Array<{ team_id: string; name: string; team_type: string }>,
    );
  }

  useEffect(() => {
    if (employee) {
      setEditRole(employee.role.toLowerCase());
      setEditDeptId(employee.departmentId ?? "");
      setEditStatus(employee.status);
      setHrAddress(employee.address ?? "");
      setHrPersonalNumber(employee.personalNumber ?? "");
      setHrBankAccount(employee.bankAccount ?? "");
      setHrEmergencyName(employee.emergencyContactName ?? "");
      setHrEmergencyPhone(employee.emergencyContactPhone ?? "");
      setEditingHr(false);
      setActiveTab("overview");
      fetchProtocols();
      fetchTeams();
    }
  }, [employee]);

  async function handleSettingsSave() {
    if (!employee?.profileId) return;
    setSaving(true);
    const supabase = createClient();

    const updates: Record<string, unknown> = {};
    if (editRole !== employee.role.toLowerCase()) updates.role = editRole;
    if (editDeptId !== (employee.departmentId ?? "")) updates.department_id = editDeptId || null;
    if (editStatus !== employee.status) {
      updates.status = editStatus;
      if (editStatus === "offboarding" || editStatus === "inactive") updates.is_active = false;
      else updates.is_active = true;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("profile")
        .update(updates)
        .eq("profile_id", employee.profileId);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Profil oppdatert");
        onRefresh();
      }
    }
    setSaving(false);
  }

  async function handleHrSave() {
    if (!employee?.profileId) return;
    setSaving(true);
    const supabase = createClient();

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
      .eq("profile_id", employee.profileId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Personlig info oppdatert");
      setEditingHr(false);
      onRefresh();
    }
    setSaving(false);
  }

  async function handleCancelInvite() {
    if (!employee?.id) return;
    setSaving(true);
    try {
      await cancelInvitation(employee.id);
      toast.success("Invitasjon avbrutt");
      onRefresh();
      onClose();
    } catch {
      toast.error("Kunne ikke avbryte invitasjonen");
    }
    setSaving(false);
  }

  async function handleResetPassword() {
    if (!employee?.email) {
      toast.error("Ingen e-post registrert");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(employee.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error("Kunne ikke sende tilbakestilling");
    } else {
      toast.success(`Tilbakestillingslenke sendt til ${employee.email}`);
    }
    setSaving(false);
  }

  async function handleDeactivate() {
    if (!employee?.profileId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profile")
      .update({ status: "inactive", is_active: false })
      .eq("profile_id", employee.profileId);

    if (error) {
      toast.error("Kunne ikke deaktivere konto");
    } else {
      toast.success(`${employee.name || "Bruker"} er deaktivert`);
      onRefresh();
      onClose();
    }
    setSaving(false);
  }

  if (!isOpen || !employee) return null;

  const isInvited = employee.status === "invited";

  return (
    <>
      <div
        className="animate-in fade-in fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="border-border bg-background animate-in slide-in-from-right-8 fixed inset-y-2 right-2 z-50 flex w-full max-w-md transform flex-col overflow-hidden rounded-2xl border shadow-2xl transition-transform duration-300">
        {/* Header */}
        <div className="border-border/50 from-muted to-card relative h-32 border-b bg-gradient-to-br">
          <button
            onClick={onClose}
            className="bg-background/50 text-muted-foreground hover:bg-background/80 hover:text-foreground border-border/50 absolute top-4 right-4 rounded-full border p-2 shadow-sm backdrop-blur-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute -bottom-10 left-6 flex items-end gap-4">
            <div className="border-background bg-muted text-muted-foreground relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 text-2xl font-bold shadow-xl">
              {employee.avatar ? (
                // eslint-disable-next-line -- suppress no-img-element
                <img
                  src={employee.avatar}
                  alt={employee.name || ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="relative z-10">{(employee.name || "?").charAt(0)}</span>
              )}
              {employee.status === "active" && (
                <div className="border-background absolute right-1 bottom-1 z-20 h-3 w-3 rounded-full border-2 bg-emerald-500" />
              )}
            </div>

            <div className="mb-2">
              <h2 className="text-foreground text-xl leading-tight font-bold">
                {employee.name || "Uten navn"}
              </h2>
              <p className="text-sm font-medium text-orange-400">{employee.role}</p>
            </div>
          </div>
        </div>

        {/* Top-level Metrics */}
        <div className="px-6 pt-14 pb-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
              <span className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase">
                Klar
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-lg font-bold ${(employee.readinessScore ?? 0) === 100 ? "text-emerald-400" : (employee.readinessScore ?? 0) > 70 ? "text-orange-400" : "text-rose-400"}`}
                >
                  {employee.readinessScore ?? 0}%
                </span>
              </div>
            </div>
            <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
              {isInvited ? (
                <>
                  <span className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase">
                    Invitasjon
                  </span>
                  <span
                    className={`text-sm font-bold ${employee.inviteStatus === "expired" ? "text-rose-400" : "text-orange-400"}`}
                  >
                    {employee.inviteStatus === "expired" ? "Utløpt" : "Venter"}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase">
                    Timer
                  </span>
                  <span className="text-foreground text-lg font-bold">—</span>
                </>
              )}
            </div>
            <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
              <span className="text-muted-foreground mb-1 text-xs font-semibold tracking-widest uppercase">
                Avd
              </span>
              <span className="text-foreground w-full truncate px-1 text-sm font-bold">
                {employee.department || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="no-scrollbar border-border overflow-x-auto border-b px-6">
          <div className="flex min-w-max gap-6">
            {(
              [
                { key: "overview" as const, label: "Oversikt" },
                {
                  key: "competence" as const,
                  label: "Kompetanse",
                  dot: (employee.readinessScore ?? 0) < 100 && !isInvited,
                },
                { key: "hr" as const, label: "HR & Logg" },
                ...(!isInvited
                  ? [{ key: "settings" as const, label: "Innstillinger", dot: false }]
                  : []),
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 pb-3 text-sm font-semibold transition-colors ${activeTab === tab.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
                {"dot" in tab && tab.dot && (
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                )}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-orange-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <div className="animate-in fade-in zoom-in-95 space-y-6 duration-200">
              {/* Contact info */}
              <div className="border-border/50 bg-muted/30 space-y-3 rounded-xl border p-4">
                {employee.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="text-muted-foreground h-4 w-4" />
                    <a
                      href={`mailto:${employee.email}`}
                      className="text-foreground hover:text-foreground transition-colors"
                    >
                      {employee.email}
                    </a>
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="text-muted-foreground h-4 w-4" />
                    <a href={`tel:${employee.phone}`} className="text-foreground transition-colors">
                      {employee.phone}
                    </a>
                  </div>
                )}
                {!employee.email && !employee.phone && (
                  <p className="text-muted-foreground text-sm">Ingen kontaktinfo registrert</p>
                )}
              </div>

              {/* Teams */}
              {teams.length > 0 && (
                <div>
                  <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
                    Team
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {teams.map((t) => (
                      <span
                        key={t.team_id}
                        className="border-border bg-card text-foreground rounded-lg border px-2.5 py-1 text-xs font-medium"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Invite details (for invited employees) */}
              {isInvited && (
                <div>
                  <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
                    Invitasjonsdetaljer
                  </h3>
                  <div className="space-y-2">
                    {employee.inviteType && (
                      <div className="text-foreground flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Sendt via</span>
                        <span className="font-medium capitalize">{employee.inviteType}</span>
                      </div>
                    )}
                    {employee.inviteExpiresAt && (
                      <div className="text-foreground flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Utløper</span>
                        <span className="font-medium">
                          {new Date(employee.inviteExpiresAt).toLocaleDateString("nb-NO")}
                        </span>
                      </div>
                    )}
                    <div className="text-foreground flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <span
                        className={`font-medium ${employee.inviteStatus === "expired" ? "text-rose-400" : "text-orange-400"}`}
                      >
                        {employee.inviteStatus === "expired" ? "Utløpt" : "Venter på svar"}
                      </span>
                    </div>
                    {employee.inviteToken && (
                      <div className="mt-3">
                        <span className="text-muted-foreground mb-1.5 block text-xs">
                          Invitasjonslenke
                        </span>
                        <div className="border-border bg-muted flex items-center gap-2 rounded-lg border px-3 py-2">
                          <input
                            readOnly
                            value={`${typeof window !== "undefined" ? window.location.origin : ""}/invite/${employee.inviteToken}`}
                            className="text-foreground flex-1 truncate bg-transparent font-mono text-[11px] outline-none"
                            onFocus={(e) => e.target.select()}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(
                                `${window.location.origin}/invite/${employee.inviteToken}`,
                              );
                              toast.success("Lenke kopiert");
                            }}
                            className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cancel invite button */}
                  <button
                    onClick={handleCancelInvite}
                    disabled={saving}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 py-2.5 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Avbryt invitasjon
                  </button>
                </div>
              )}

              {/* Activity (for non-invited) */}
              {!isInvited && (
                <div>
                  <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
                    Nylig aktivitet
                  </h3>
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    Ingen aktivitet registrert ennå
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "competence" && (
            <div className="animate-in fade-in zoom-in-95 space-y-6 duration-200">
              {(employee.readinessScore ?? 0) < 100 && !isInvited && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  <div>
                    <h4 className="mb-1 text-sm font-bold text-rose-400">Manglende krav</h4>
                    <p className="mb-3 text-xs leading-relaxed text-rose-500/80">
                      Ansatt har uferdig opplæring for {employee.department || "sin avdeling"}.
                    </p>
                    <button className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-600">
                      Send påminnelse
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-muted-foreground mb-3 flex items-center justify-between text-xs font-bold tracking-widest uppercase">
                  <span>Tildelte protokoller</span>
                  {protocols.length > 0 && (
                    <span className="text-muted-foreground font-medium">
                      {protocols.filter((p) => p.status === "completed").length}/{protocols.length}{" "}
                      fullført
                    </span>
                  )}
                </h3>

                {loadingProtocols ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                  </div>
                ) : protocols.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    Ingen protokoller tildelt
                  </p>
                ) : (
                  <div className="space-y-2">
                    {protocols.map((p) => (
                      <div
                        key={p.assignment_id}
                        className="group border-border bg-card hover:border-border flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors"
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
                            <p className="text-foreground text-sm font-bold">
                              {p.protocol?.name ?? "Ukjent protokoll"}
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
                                ? "Fullført"
                                : p.status === "expired"
                                  ? "Utløpt"
                                  : "Venter"}
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
          )}

          {activeTab === "hr" && (
            <div className="animate-in fade-in zoom-in-95 space-y-6 duration-200">
              {/* Contract Status */}
              <div>
                <h3 className="text-muted-foreground mb-3 text-xs font-bold tracking-widest uppercase">
                  Arbeidsavtale
                </h3>
                <div
                  className={`flex items-center justify-between rounded-xl border p-4 ${employee.hasContract ? "border-emerald-500/20 bg-emerald-500/10" : "border-border bg-card"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${employee.hasContract ? "bg-emerald-500/20 text-emerald-500" : "bg-secondary text-muted-foreground"}`}
                    >
                      <FileSignature className="h-4 w-4" />
                    </div>
                    <div>
                      <p
                        className={`text-sm font-bold ${employee.hasContract ? "text-emerald-500" : "text-foreground"}`}
                      >
                        {employee.hasContract ? "Aktiv kontrakt" : "Ingen kontrakt"}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wider uppercase">
                        {employee.hasContract ? "Signert og gyldig" : "Handling kreves"}
                      </p>
                    </div>
                  </div>
                  {!employee.hasContract && (
                    <button className="bg-foreground text-background hover:bg-foreground/80 rounded-lg px-3 py-1.5 text-xs font-bold transition-all">
                      Opprett
                    </button>
                  )}
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    Personlig informasjon
                  </h3>
                  {!editingHr && (
                    <button
                      onClick={() => setEditingHr(true)}
                      className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                    >
                      Rediger
                    </button>
                  )}
                </div>

                {!editingHr ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                        <Home className="h-3 w-3" /> Adresse
                      </span>
                      <span className="text-foreground text-sm">
                        {employee.address || "Ikke oppgitt"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                        <CreditCard className="h-3 w-3" /> Personnummer
                      </span>
                      <span className="text-foreground text-sm">
                        {employee.personalNumber || "Ikke oppgitt"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                        <Wallet className="h-3 w-3" /> Kontonummer
                      </span>
                      <span className="text-foreground font-mono text-sm">
                        {employee.bankAccount || "Ikke oppgitt"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-col gap-1 rounded-lg border border-rose-500/10 bg-rose-500/5 p-3">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-500/80">
                        <ShieldAlert className="h-3 w-3 text-rose-500" /> Nødkontakt
                      </span>
                      <span className="text-foreground text-sm">
                        {employee.emergencyContactName || "Ikke oppgitt"}
                        {employee.emergencyContactPhone
                          ? ` • ${employee.emergencyContactPhone}`
                          : ""}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const hrInputClass =
                        "w-full rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none border-border bg-card text-foreground placeholder:text-muted-foreground";
                      return (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                              <Home className="h-3 w-3" /> Adresse
                            </label>
                            <input
                              type="text"
                              value={hrAddress}
                              onChange={(e) => setHrAddress(e.target.value)}
                              placeholder="Gate, Postnr, By"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                              <CreditCard className="h-3 w-3" /> Personnummer
                            </label>
                            <input
                              type="text"
                              value={hrPersonalNumber}
                              onChange={(e) => setHrPersonalNumber(e.target.value)}
                              placeholder="12345678901"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                              <Wallet className="h-3 w-3" /> Kontonummer
                            </label>
                            <input
                              type="text"
                              value={hrBankAccount}
                              onChange={(e) => setHrBankAccount(e.target.value)}
                              placeholder="1234.56.78901"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                              <ShieldAlert className="h-3 w-3" /> Nødkontakt navn
                            </label>
                            <input
                              type="text"
                              value={hrEmergencyName}
                              onChange={(e) => setHrEmergencyName(e.target.value)}
                              placeholder="Fullt navn"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                              <Phone className="h-3 w-3" /> Nødkontakt telefon
                            </label>
                            <input
                              type="text"
                              value={hrEmergencyPhone}
                              onChange={(e) => setHrEmergencyPhone(e.target.value)}
                              placeholder="+47 123 45 678"
                              className={hrInputClass}
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleHrSave}
                              disabled={saving}
                              className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
                            >
                              {saving ? "Lagrer..." : "Lagre"}
                            </button>
                            <button
                              onClick={() => {
                                setHrAddress(employee.address ?? "");
                                setHrPersonalNumber(employee.personalNumber ?? "");
                                setHrBankAccount(employee.bankAccount ?? "");
                                setHrEmergencyName(employee.emergencyContactName ?? "");
                                setHrEmergencyPhone(employee.emergencyContactPhone ?? "");
                                setEditingHr(false);
                              }}
                              disabled={saving}
                              className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
                            >
                              Avbryt
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Communication Log */}
              <div>
                <h3 className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase">
                  <History className="h-4 w-4" /> Kommunikasjonslogg
                </h3>
                <p className="text-muted-foreground text-sm">
                  Ingen kommunikasjon registrert ennå.
                </p>
              </div>
            </div>
          )}

          {activeTab === "settings" && !isInvited && (
            <div className="animate-in fade-in zoom-in-95 space-y-6 duration-200">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Primæravdeling
                  </label>
                  <select
                    value={editDeptId}
                    onChange={(e) => setEditDeptId(e.target.value)}
                    className="border-border bg-card text-foreground w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none"
                  >
                    <option value="">Ingen avdeling</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Systemrolle
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="border-border bg-card text-foreground w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none"
                  >
                    <option value="employee">Ansatt</option>
                    <option value="manager">Leder</option>
                    <option value="admin">Administrator</option>
                    <option value="owner">Eier</option>
                  </select>
                  <p className="text-muted-foreground pt-1 text-xs">
                    Bestemmer hva brukeren kan se og gjøre i systemet.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as typeof editStatus)}
                    className="border-border bg-card text-foreground w-full appearance-none rounded-lg border px-3 py-2 text-sm focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none"
                  >
                    <option value="active">Aktiv</option>
                    <option value="trainee">Opplæring</option>
                    <option value="inactive">Inaktiv</option>
                    <option value="offboarding">Avslutning</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleSettingsSave}
                disabled={saving}
                className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "Lagrer..." : "Lagre endringer"}
              </button>

              <div className="border-border space-y-3 border-t pt-4">
                <button
                  onClick={handleResetPassword}
                  disabled={saving}
                  className="border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  Tilbakestill passord
                </button>
                <button
                  onClick={handleDeactivate}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 py-2.5 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/20 hover:text-rose-400 disabled:opacity-50"
                >
                  <UserX className="h-4 w-4" />
                  Deaktiver konto
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
