"use client";

import {
  X,
  Mail,
  Building2,
  Briefcase,
  Plus,
  Loader2,
  Upload,
  FileSpreadsheet,
  UserPlus,
  Users,
  AlertCircle,
  Trash2,
  Phone,
  Link2,
  Copy,
  Check,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { useState, useContext, useEffect, useCallback, useRef, useMemo } from "react";
import Papa from "papaparse";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";
import { CsvMappingDialog } from "@/components/dashboard/wizard-steps/csv-column-mapper";
import type { Department } from "./types";

// ─── Types ──────────────────────────────────────────────────

type InviteMode = "single" | "csv";

type InviteChannel = "email" | "sms" | "link";

type InviteEmploymentType = "employee" | "guest";

type InviteRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  role: "employee" | "manager" | "admin";
  inviteEmploymentType: InviteEmploymentType;
  employmentCategory: string;
  salaryType: string;
  intendedWeeklyHours: string;
  startDate: string;
  payrollTemplateId: string;
  extraData: Record<string, string>;
  errors: string[];
};

type PayrollTemplate = {
  id: string;
  name: string;
  salary_type: string;
  employment_category: string | null;
  agreed_weekly_hours: number | null;
};

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  onRefresh: () => void;
}

// ─── Helpers ────────────────────────────────────────────────

function createEmptyRow(): InviteRow {
  return {
    id: crypto.randomUUID(),
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    departmentId: "",
    role: "employee",
    inviteEmploymentType: "employee",
    employmentCategory: "",
    salaryType: "",
    intendedWeeklyHours: "",
    startDate: "",
    payrollTemplateId: "",
    extraData: {},
    errors: [],
  };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRow(row: InviteRow, channels: Set<InviteChannel>): string[] {
  const errors: string[] = [];
  if (!row.firstName.trim()) errors.push("Fornavn mangler");
  if (!row.lastName.trim()) errors.push("Etternavn mangler");

  if (channels.has("email")) {
    if (!row.email.trim()) errors.push("E-post mangler");
    else if (!validateEmail(row.email.trim())) errors.push("Ugyldig e-post");
  }
  if (channels.has("sms")) {
    if (!row.phone.trim()) errors.push("Telefonnummer mangler");
  }

  return errors;
}

// ─── Shared styles ──────────────────────────────────────────

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-brand-orange/50 focus:ring-2 focus:ring-brand-orange/20 focus:outline-none";

const selectClass =
  "w-full appearance-none rounded-xl border border-border bg-background px-3 py-2.5 pr-8 text-sm text-foreground transition-all focus:border-brand-orange/50 focus:ring-2 focus:ring-brand-orange/20 focus:outline-none";

const labelClass = "text-xs font-semibold tracking-wider uppercase text-muted-foreground";

// ─── Component ──────────────────────────────────────────────

export function InviteMemberDialog({
  isOpen,
  onClose,
  departments,
  onRefresh,
}: InviteMemberDialogProps) {
  const { workspaceData, profileId } = useContext(DashboardContext);
  const [mode, setMode] = useState<InviteMode>("single");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single mode state
  const [singleRow, setSingleRow] = useState<InviteRow>(createEmptyRow);
  const [channels, setChannels] = useState<Set<InviteChannel>>(new Set(["link"]));
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const toggleChannel = useCallback((ch: InviteChannel) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (ch === "link") return next; // link is always on
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }, []);

  // Payroll templates
  const [templates, setTemplates] = useState<PayrollTemplate[]>([]);

  // CSV mode state
  const [csvRows, setCsvRows] = useState<InviteRow[]>([]);
  const [csvMappingOpen, setCsvMappingOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Record<string, string>[]>([]);
  const [csvRawData, setCsvRawData] = useState<Record<string, string>[]>([]);
  const [csvTotalCount, setCsvTotalCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch payroll templates when dialog opens
  useEffect(() => {
    if (!isOpen || !workspaceData?.workspace_id) return;
    const supabase = createClient();
    supabase
      .from("payroll_profile_template")
      .select("id, name, salary_type, employment_category, agreed_weekly_hours")
      .eq("workspace_id", workspaceData.workspace_id)
      .order("name")
      .then(({ data }) => {
        if (data) setTemplates(data as PayrollTemplate[]);
      });
  }, [isOpen, workspaceData?.workspace_id]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setMode("single");
      setChannels(new Set(["link"]));
      setGeneratedLink(null);
      setLinkCopied(false);
      setSingleRow(createEmptyRow());
      setCsvRows([]);
      setCsvHeaders([]);
      setCsvPreviewRows([]);
      setCsvRawData([]);
      setCsvTotalCount(0);
    }
  }, [isOpen]);

  // ── CSV file handling ──

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (!results.data.length || !results.meta.fields?.length) {
          toast.error("Ingen data funnet i filen");
          return;
        }
        setCsvHeaders(results.meta.fields);
        setCsvRawData(results.data);
        setCsvPreviewRows(results.data.slice(0, 3));
        setCsvTotalCount(results.data.length);
        setCsvMappingOpen(true);
      },
      error: () => {
        toast.error("Kunne ikke lese filen. Sjekk at det er en gyldig CSV-fil.");
      },
    });

    e.target.value = "";
  }, []);

  const handleMappingConfirm = useCallback(
    (mapping: Record<string, string>) => {
      const deptNameToId = new Map(departments.map((d) => [d.name.toLowerCase(), d.department_id]));

      const rows: InviteRow[] = csvRawData.map((raw) => {
        const row: InviteRow = createEmptyRow();
        const extra: Record<string, string> = {};

        for (const [csvHeader, fieldKey] of Object.entries(mapping)) {
          if (fieldKey === "_skip" || !raw[csvHeader]) continue;
          const value = raw[csvHeader].trim();

          switch (fieldKey) {
            case "firstName":
              row.firstName = value;
              break;
            case "lastName":
              row.lastName = value;
              break;
            case "email":
              row.email = value;
              break;
            case "phone":
              row.phone = value;
              break;
            case "departmentId": {
              const deptId = deptNameToId.get(value.toLowerCase());
              if (deptId) row.departmentId = deptId;
              break;
            }
            default:
              extra[fieldKey] = value;
          }
        }

        row.extraData = extra;
        row.errors = validateRow(row, new Set<InviteChannel>(["email"]));
        return row;
      });

      setCsvRows(rows);
      setCsvMappingOpen(false);
      setMode("csv");
    },
    [csvRawData, departments],
  );

  const removeCsvRow = useCallback((id: string) => {
    setCsvRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Submit ──

  const handleSubmit = useCallback(async () => {
    if (!workspaceData) return;

    const rows = mode === "single" ? [singleRow] : csvRows;
    const effectiveChannels = mode === "single" ? channels : new Set<InviteChannel>(["email"]);

    // Validate
    const validated = rows.map((r) => ({ ...r, errors: validateRow(r, effectiveChannels) }));
    const hasErrors = validated.some((r) => r.errors.length > 0);

    if (mode === "single") {
      setSingleRow(validated[0]!);
    } else {
      setCsvRows(validated);
    }

    if (hasErrors) {
      toast.error("Rett opp feil før du sender invitasjoner");
      return;
    }

    if (rows.length === 0) {
      toast.error("Legg til minst én person");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Ikke autentisert");

      let response;

      if (mode === "single") {
        const r = rows[0]!;
        const channelList = Array.from(effectiveChannels);
        response = await supabase.functions.invoke("create-invitation", {
          body: {
            workspace_id: workspaceData.workspace_id,
            invite_type: "link", // primary type stored on row
            channels: channelList, // all channels to dispatch
            email: channelList.includes("email") ? r.email.trim() : undefined,
            phone: channelList.includes("sms") ? r.phone.trim() : undefined,
            role: r.role,
            first_name: r.firstName.trim(),
            last_name: r.lastName.trim(),
            department_ids: r.departmentId ? [r.departmentId] : [],
            invite_employment_type: r.inviteEmploymentType,
            metadata:
              r.inviteEmploymentType === "employee"
                ? {
                    employment_category: r.employmentCategory || undefined,
                    salary_type: r.salaryType || undefined,
                    intended_weekly_hours: r.intendedWeeklyHours
                      ? Number(r.intendedWeeklyHours)
                      : undefined,
                    start_date: r.startDate || undefined,
                    payroll_template_id: r.payrollTemplateId || undefined,
                  }
                : undefined,
          },
        });
      } else {
        const inviteRecords = rows.map((r) => ({
          email: r.email.trim(),
          first_name: r.firstName.trim(),
          last_name: r.lastName.trim(),
          role: r.role,
          department_ids: r.departmentId ? [r.departmentId] : [],
          invite_employment_type: r.inviteEmploymentType,
          metadata:
            r.inviteEmploymentType === "employee"
              ? {
                  employment_category: r.employmentCategory || undefined,
                  salary_type: r.salaryType || undefined,
                  intended_weekly_hours: r.intendedWeeklyHours
                    ? Number(r.intendedWeeklyHours)
                    : undefined,
                  start_date: r.startDate || undefined,
                  payroll_template_id: r.payrollTemplateId || undefined,
                }
              : undefined,
        }));

        response = await supabase.functions.invoke("create-invitation", {
          body: {
            workspace_id: workspaceData.workspace_id,
            company_id: workspaceData.company_id,
            invites: inviteRecords,
          },
        });
      }

      if (response.error) {
        throw new Error(response.error.message);
      }

      const channelLabel = Array.from(effectiveChannels).join("+");
      void emit({
        event: "button clicked",
        workspace_id: workspaceData.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: mode === "csv" ? "bulk-invite-csv" : `single-invite-${channelLabel}`,
          context: `invited ${rows.length} members via ${channelLabel}`,
        },
      });

      if (mode === "single" && response.data) {
        // Always show the invite link after single invite
        const responseData = response.data as { token?: string };
        if (responseData.token) {
          const inviteUrl = `${window.location.origin}/invite/${responseData.token}`;
          setGeneratedLink(inviteUrl);
          const parts: string[] = [];
          if (effectiveChannels.has("email")) parts.push("e-post");
          if (effectiveChannels.has("sms")) parts.push("SMS");
          parts.push("lenke");
          toast.success(`Invitasjon opprettet (${parts.join(" + ")})`);
          onRefresh();
          return;
        }
      }

      toast.success(rows.length === 1 ? "Invitasjon sendt" : `${rows.length} invitasjoner sendt`);
      onRefresh();
      onClose();
    } catch (error: unknown) {
      console.error("Failed to create invitations:", error);
      toast.error(error instanceof Error ? error.message : "Kunne ikke opprette invitasjoner");
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, channels, singleRow, csvRows, workspaceData, profileId, onRefresh, onClose]);

  if (!isOpen || !workspaceData) return null;

  const validCsvCount = csvRows.filter((r) => r.errors.length === 0).length;

  return (
    <>
      <div
        className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={`animate-in zoom-in-95 border-border bg-card flex w-full flex-col overflow-hidden rounded-2xl border shadow-2xl duration-200 ${
            mode === "csv" && csvRows.length > 0 ? "max-w-2xl" : "max-w-md"
          }`}
        >
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b px-6 py-5">
            <div className="flex items-center gap-3">
              {mode === "csv" ? (
                <button
                  type="button"
                  onClick={() => setMode("single")}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-xl p-2.5 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <div className={`bg-brand-orange/10 rounded-xl p-2.5`}>
                  <UserPlus className="text-brand-orange h-5 w-5" />
                </div>
              )}
              <div>
                <h2 className="text-foreground text-lg leading-tight font-bold">
                  {mode === "csv" ? "CSV-import" : "Inviter ansatt"}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {mode === "csv"
                    ? `${csvRows.length > 0 ? `${csvRows.length} rader lastet` : "Last opp en fil"}`
                    : workspaceData.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full p-2 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {generatedLink ? (
              <GeneratedLinkView
                link={generatedLink}
                copied={linkCopied}
                onCopy={() => {
                  void navigator.clipboard.writeText(generatedLink);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                }}
              />
            ) : mode === "single" ? (
              <SingleInviteForm
                row={singleRow}
                onChange={setSingleRow}
                departments={departments}
                templates={templates}
                channels={channels}
                onToggleChannel={toggleChannel}
              />
            ) : (
              <CsvImportView
                rows={csvRows}
                departments={departments}
                onUploadClick={() => fileInputRef.current?.click()}
                onRemoveRow={removeCsvRow}
              />
            )}
          </div>

          {/* Footer */}
          <div className="border-border bg-muted/50 flex items-center justify-between border-t px-6 py-4">
            <div>
              {mode === "single" && !generatedLink ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Importer CSV
                </button>
              ) : mode === "csv" && csvRows.length > 0 ? (
                <span className="text-muted-foreground text-xs">
                  {validCsvCount} av {csvRows.length} gyldige
                </span>
              ) : null}
            </div>
            <div className="flex gap-3">
              {generatedLink ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-brand-orange hover:bg-brand-orange/90 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
                >
                  Lukk
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                    disabled={isSubmitting}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      isSubmitting ||
                      (mode === "single" && !singleRow.firstName) ||
                      (mode === "single" && channels.has("email") && !singleRow.email) ||
                      (mode === "single" && channels.has("sms") && !singleRow.phone) ||
                      (mode === "csv" && csvRows.length === 0)
                    }
                    className="bg-brand-orange hover:bg-brand-orange/90 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isSubmitting
                      ? "Sender..."
                      : mode === "csv" && csvRows.length > 1
                        ? `Send ${csvRows.length} invitasjoner`
                        : "Send invitasjon"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Hidden file input for CSV */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* CSV Column Mapping Dialog */}
      <CsvMappingDialog
        open={csvMappingOpen}
        onOpenChange={setCsvMappingOpen}
        csvHeaders={csvHeaders}
        csvPreviewRows={csvPreviewRows}
        totalRowCount={csvTotalCount}
        onConfirm={handleMappingConfirm}
      />
    </>
  );
}

// ─── Single Invite Form ─────────────────────────────────────

function SingleInviteForm({
  row,
  onChange,
  departments,
  templates,
  channels,
  onToggleChannel,
}: {
  row: InviteRow;
  onChange: (row: InviteRow) => void;
  departments: Department[];
  templates: PayrollTemplate[];
  channels: Set<InviteChannel>;
  onToggleChannel: (ch: InviteChannel) => void;
}) {
  const update = (field: Partial<InviteRow>) => onChange({ ...row, ...field });
  const [showEmployment, setShowEmployment] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === row.payrollTemplateId),
    [templates, row.payrollTemplateId],
  );

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        onChange({
          ...row,
          payrollTemplateId: templateId,
          salaryType: template.salary_type === "monthly" ? "monthly" : "hourly",
          employmentCategory: template.employment_category ?? "",
          intendedWeeklyHours: template.agreed_weekly_hours?.toString() ?? "",
        });
      } else {
        update({ payrollTemplateId: "" });
      }
    },
    [templates, row, onChange],
  );

  return (
    <div className="space-y-5">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>Fornavn</label>
          <input
            type="text"
            value={row.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            placeholder="Kari"
            className={inputClass}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Etternavn</label>
          <input
            type="text"
            value={row.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
            placeholder="Nordmann"
            className={inputClass}
          />
        </div>
      </div>

      {/* Invite channels — multi-select, link always on */}
      <div className="space-y-2">
        <label className={labelClass}>Send invitasjon via</label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { ch: "link" as const, label: "Lenke", icon: Link2, locked: true },
              { ch: "email" as const, label: "E-post", icon: Mail, locked: false },
              { ch: "sms" as const, label: "SMS", icon: Phone, locked: false },
            ] as const
          ).map(({ ch, label, icon: Icon, locked }) => {
            const isActive = channels.has(ch);
            return (
              <button
                key={ch}
                type="button"
                onClick={() => !locked && onToggleChannel(ch)}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-brand-orange/10 text-brand-orange ring-brand-orange/30 ring-1"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/70 border"
                } ${locked ? "cursor-default" : "cursor-pointer"}`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "" : "opacity-60"}`} />
                {label}
                {isActive && (
                  <div
                    className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${locked ? "bg-brand-orange/50" : "bg-brand-orange"}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contact fields — shown when channel is active */}
      {channels.has("email") && (
        <div className="space-y-1.5">
          <label className={`flex items-center gap-1.5 ${labelClass}`}>
            <Mail className="h-3.5 w-3.5" /> E-post
          </label>
          <input
            type="email"
            value={row.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="kari@example.com"
            className={inputClass}
          />
        </div>
      )}

      {channels.has("sms") && (
        <div className="space-y-1.5">
          <label className={`flex items-center gap-1.5 ${labelClass}`}>
            <Phone className="h-3.5 w-3.5" /> Telefon
          </label>
          <input
            type="tel"
            value={row.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="+47 900 00 000"
            className={inputClass}
          />
        </div>
      )}

      {/* Department + Role */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={`flex items-center gap-1.5 ${labelClass}`}>
            <Building2 className="h-3.5 w-3.5" /> Avdeling
          </label>
          <div className="relative">
            <select
              value={row.departmentId}
              onChange={(e) => update({ departmentId: e.target.value })}
              className={selectClass}
            >
              <option value="">Ingen avdeling</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.name}
                </option>
              ))}
            </select>
            <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className={`flex items-center gap-1.5 ${labelClass}`}>
            <Briefcase className="h-3.5 w-3.5" /> Rolle
          </label>
          <div className="relative">
            <select
              value={row.role}
              onChange={(e) => update({ role: e.target.value as InviteRow["role"] })}
              className={selectClass}
            >
              <option value="employee">Ansatt</option>
              <option value="manager">Leder</option>
              <option value="admin">Administrator</option>
            </select>
            <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Employment type toggle */}
      <div className="space-y-2">
        <label className={labelClass}>Tilknytning</label>
        <div className="grid grid-cols-2 gap-2">
          {(["employee", "guest"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => update({ inviteEmploymentType: type })}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                row.inviteEmploymentType === type
                  ? "bg-brand-orange/10 text-brand-orange ring-brand-orange/30 ring-1"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/70 border"
              }`}
            >
              {type === "employee" ? "Ansatt" : "Gjest"}
            </button>
          ))}
        </div>
      </div>

      {/* Employment details — collapsible */}
      {row.inviteEmploymentType === "employee" && (
        <div className="border-border bg-muted/30 overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => setShowEmployment(!showEmployment)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-4 py-3 text-xs font-semibold tracking-wider uppercase transition-colors"
          >
            <span>
              Ansettelsesprofil
              {selectedTemplate && (
                <span className="text-brand-orange ml-2 font-medium tracking-normal normal-case">
                  — {selectedTemplate.name}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showEmployment ? "rotate-180" : ""}`}
            />
          </button>
          {showEmployment && (
            <div className="border-border space-y-3 border-t px-4 pt-3 pb-4">
              {/* Template picker */}
              {templates.length > 0 && (
                <div className="space-y-1.5">
                  <label className={labelClass}>Velg mal</label>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((t) => {
                      const isSelected = row.payrollTemplateId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleTemplateSelect(isSelected ? "" : t.id)}
                          className={`flex flex-col items-start rounded-xl px-3 py-2.5 text-left transition-all ${
                            isSelected
                              ? "bg-brand-orange/10 text-brand-orange ring-brand-orange/30 ring-1"
                              : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/70 border"
                          }`}
                        >
                          <span className="text-sm font-medium">{t.name}</span>
                          <span
                            className={`text-[11px] ${isSelected ? "opacity-70" : "opacity-50"}`}
                          >
                            {t.salary_type === "monthly" ? "Månedslønn" : "Timelønn"}
                            {t.agreed_weekly_hours ? ` \u00B7 ${t.agreed_weekly_hours}t/uke` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Manual override fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Stillingstype</label>
                  <div className="relative">
                    <select
                      value={row.employmentCategory}
                      onChange={(e) => update({ employmentCategory: e.target.value })}
                      className={selectClass}
                    >
                      <option value="">Velg...</option>
                      <option value="fast">Fast</option>
                      <option value="deltid">Deltid</option>
                      <option value="tilkalling">Tilkalling</option>
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Lønnstype</label>
                  <div className="relative">
                    <select
                      value={row.salaryType}
                      onChange={(e) => update({ salaryType: e.target.value })}
                      className={selectClass}
                    >
                      <option value="">Velg...</option>
                      <option value="hourly">Timelønn</option>
                      <option value="monthly">Månedslønn</option>
                    </select>
                    <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Timer/uke</label>
                  <input
                    type="number"
                    value={row.intendedWeeklyHours}
                    onChange={(e) => update({ intendedWeeklyHours: e.target.value })}
                    placeholder="37.5"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Startdato</label>
                  <input
                    type="date"
                    value={row.startDate}
                    onChange={(e) => update({ startDate: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {row.errors.length > 0 && (
        <div
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-xs ${"bg-destructive text-destructive"}`}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{row.errors.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

// ─── CSV Import View ────────────────────────────────────────

function CsvImportView({
  rows,
  departments,
  onUploadClick,
  onRemoveRow,
}: {
  rows: InviteRow[];
  departments: Department[];
  onUploadClick: () => void;
  onRemoveRow: (id: string) => void;
}) {
  const deptMap = new Map(departments.map((d) => [d.department_id, d.name]));

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className={`border-border rounded-2xl border-2 border-dashed p-6 ${"bg-muted/50"}`}>
          <Upload className="text-muted-foreground h-8 w-8" />
        </div>
        <div className="text-center">
          <p className="text-foreground text-sm font-medium">Last opp CSV-fil med ansatte</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Obligatoriske kolonner: fornavn, etternavn, e-post
          </p>
        </div>
        <button
          type="button"
          onClick={onUploadClick}
          className="bg-brand-orange hover:bg-brand-orange/90 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          <Upload className="h-4 w-4" />
          Velg fil
        </button>
      </div>
    );
  }

  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="text-muted-foreground h-4 w-4" />
          <span className="text-foreground text-sm font-medium">{rows.length} rader importert</span>
          {errorCount > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${"bg-destructive text-destructive"}`}
            >
              {errorCount} feil
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onUploadClick}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          <Upload className="h-3 w-3" />
          Ny fil
        </button>
      </div>

      <div className="border-border overflow-hidden rounded-xl border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-semibold">Navn</th>
              <th className="px-3 py-2.5 text-left font-semibold">E-post</th>
              <th className="px-3 py-2.5 text-left font-semibold">Avdeling</th>
              <th className="px-3 py-2.5 text-left font-semibold">Rolle</th>
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hasError = row.errors.length > 0;
              return (
                <tr
                  key={row.id}
                  className={`border-t ${
                    hasError ? "border-destructive bg-destructive/50" : "border-border"
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className="text-foreground">
                      {row.firstName} {row.lastName}
                    </span>
                    {hasError && (
                      <p className="text-destructive mt-0.5 text-[10px]">{row.errors.join(", ")}</p>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{row.email}</td>
                  <td className="text-muted-foreground px-3 py-2">
                    {deptMap.get(row.departmentId) ?? "\u2014"}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">
                    {row.role === "admin" ? "Admin" : row.role === "manager" ? "Leder" : "Ansatt"}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.id)}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-1 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Generated Link View ────────────────────────────────────

function GeneratedLinkView({
  link,
  copied,
  onCopy,
}: {
  link: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className={`bg-brand-orange/10 rounded-2xl p-4`}>
        <Link2 className="text-brand-orange h-8 w-8" />
      </div>

      <div className="text-center">
        <p className="text-foreground text-base font-semibold">Invitasjonslenke klar</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Del denne lenken med den du vil invitere
        </p>
      </div>

      <div className="border-border bg-muted flex w-full items-center gap-2 rounded-xl border px-4 py-3">
        <input
          readOnly
          value={link}
          className="text-foreground flex-1 bg-transparent font-mono text-xs outline-none"
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          onClick={onCopy}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
            copied
              ? "bg-green-500/10 text-green-500"
              : "bg-background text-foreground hover:bg-accent border-border border"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Kopiert
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Kopier
            </>
          )}
        </button>
      </div>
    </div>
  );
}
