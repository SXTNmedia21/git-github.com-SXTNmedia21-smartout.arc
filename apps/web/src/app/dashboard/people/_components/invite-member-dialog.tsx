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
} from "lucide-react";
import { useState, useContext, useEffect, useCallback, useRef } from "react";
import Papa from "papaparse";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";
import { CsvMappingDialog } from "@/components/dashboard/wizard-steps/csv-column-mapper";
import type { Department } from "./types";

// ─── Types ──────────────────────────────────────────────────

type InviteMode = "single" | "csv";

type InviteType = "email" | "sms" | "link";

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

function validateRow(row: InviteRow, inviteType: InviteType = "email"): string[] {
  const errors: string[] = [];
  if (!row.firstName.trim()) errors.push("Fornavn mangler");
  if (!row.lastName.trim()) errors.push("Etternavn mangler");

  if (inviteType === "email") {
    if (!row.email.trim()) errors.push("E-post mangler");
    else if (!validateEmail(row.email.trim())) errors.push("Ugyldig e-post");
  } else if (inviteType === "sms") {
    if (!row.phone.trim()) errors.push("Telefonnummer mangler");
  }
  // "link" requires neither email nor phone

  return errors;
}

// ─── Component ──────────────────────────────────────────────

export function InviteMemberDialog({
  isOpen,
  onClose,
  departments,
  onRefresh,
}: InviteMemberDialogProps) {
  const { isDark, workspaceData, profileId } = useContext(DashboardContext);
  const [mode, setMode] = useState<InviteMode>("single");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single mode state
  const [singleRow, setSingleRow] = useState<InviteRow>(createEmptyRow);
  const [inviteType, setInviteType] = useState<InviteType>("email");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // CSV mode state
  const [csvRows, setCsvRows] = useState<InviteRow[]>([]);
  const [csvMappingOpen, setCsvMappingOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Record<string, string>[]>([]);
  const [csvRawData, setCsvRawData] = useState<Record<string, string>[]>([]);
  const [csvTotalCount, setCsvTotalCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setMode("single");
      setInviteType("email");
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

    // Reset input so same file can be re-selected
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
        row.errors = validateRow(row);
        return row;
      });

      setCsvRows(rows);
      setCsvMappingOpen(false);
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
    const effectiveInviteType = mode === "single" ? inviteType : "email";

    // Validate
    const validated = rows.map((r) => ({ ...r, errors: validateRow(r, effectiveInviteType) }));
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

      // Resolve inviter profile for telemetry
      const { data: inviterProfile } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("workspace_id", workspaceData.workspace_id)
        .eq("user_id", profileId ?? "")
        .single();

      let response;

      if (mode === "single") {
        // Single mode: use the Edge Function's single invite path (supports email/sms/link)
        const r = rows[0]!;
        response = await supabase.functions.invoke("create-invitation", {
          body: {
            workspace_id: workspaceData.workspace_id,
            invite_type: effectiveInviteType,
            email: effectiveInviteType === "email" ? r.email.trim() : undefined,
            phone: effectiveInviteType === "sms" ? r.phone.trim() : undefined,
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
        // CSV batch mode: always email, uses the Edge Function's batch path
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

      void emit({
        event: "button clicked",
        workspace_id: workspaceData.workspace_id,
        actor_id: inviterProfile?.profile_id ?? profileId ?? "",
        properties: {
          trackingId: mode === "csv" ? "bulk-invite-csv" : `single-invite-${effectiveInviteType}`,
          context: `invited ${rows.length} members via ${effectiveInviteType}`,
        },
      });

      // For link invites, display the copyable invite URL instead of closing
      if (effectiveInviteType === "link" && response.data) {
        const responseData = response.data as { token?: string };
        if (responseData.token) {
          const inviteUrl = `${window.location.origin}/invite/${responseData.token}`;
          setGeneratedLink(inviteUrl);
          toast.success("Invitasjonslenke opprettet");
          onRefresh();
          return;
        }
      }

      toast.success(
        rows.length === 1 ? "Invitasjon opprettet" : `${rows.length} invitasjoner opprettet`,
      );
      onRefresh();
      onClose();
    } catch (error: unknown) {
      console.error("Failed to create invitations:", error);
      toast.error(error instanceof Error ? error.message : "Kunne ikke opprette invitasjoner");
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, inviteType, singleRow, csvRows, workspaceData, profileId, onRefresh, onClose]);

  if (!isOpen || !workspaceData) return null;

  const validCsvCount = csvRows.filter((r) => r.errors.length === 0).length;

  return (
    <>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
          "bg-black/50"
        } animate-in fade-in backdrop-blur-sm duration-200`}
      >
        <div
          className={`animate-in zoom-in-95 flex w-full flex-col overflow-hidden rounded-2xl border shadow-2xl duration-200 ${
            mode === "csv" && csvRows.length > 0 ? "max-w-2xl" : "max-w-md"
          } ${"border-border bg-card"}`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between border-b px-6 py-5 ${
              "border-border bg-muted"
            }`}
          >
            <div>
              <h2
                className={`text-lg leading-tight font-bold ${
                  "text-foreground"
                }`}
              >
                Legg til ansatte
              </h2>
              <p className={`text-sm ${"text-muted-foreground"}`}>
                Inviter til {workspaceData.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`rounded-full p-2 transition-colors ${
                "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mode toggle */}
          <div className="px-6 pt-5">
            <div
              className={`flex rounded-lg border p-1 ${
                "border-border bg-muted"
              }`}
            >
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
                  mode === "single"
                    ? isDark
                      ? "bg-secondary text-foreground shadow-sm"
                      : "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserPlus className="h-4 w-4" /> Enkelt
              </button>
              <button
                type="button"
                onClick={() => setMode("csv")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
                  mode === "csv"
                    ? isDark
                      ? "bg-secondary text-foreground shadow-sm"
                      : "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" /> CSV-import
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            {generatedLink ? (
              <GeneratedLinkView
                link={generatedLink}
                isDark={isDark}
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
                isDark={isDark}
                inviteType={inviteType}
                onInviteTypeChange={setInviteType}
              />
            ) : (
              <CsvImportView
                rows={csvRows}
                departments={departments}
                isDark={isDark}
                onUploadClick={() => fileInputRef.current?.click()}
                onRemoveRow={removeCsvRow}
              />
            )}
          </div>

          {/* Footer */}
          <div
            className={`flex items-center justify-between border-t px-6 py-4 ${
              "border-border bg-muted"
            }`}
          >
            <div>
              {mode === "csv" && csvRows.length > 0 && (
                <span className={`text-xs ${"text-muted-foreground"}`}>
                  {validCsvCount} av {csvRows.length} gyldige
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {generatedLink ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                >
                  Lukk
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                    disabled={isSubmitting}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      isSubmitting ||
                      (mode === "single" &&
                        !singleRow.firstName &&
                        inviteType !== "link" &&
                        !singleRow.email &&
                        !singleRow.phone) ||
                      (mode === "csv" && csvRows.length === 0)
                    }
                    className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : inviteType === "link" && mode === "single" ? (
                      <Link2 className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isSubmitting
                      ? "Sender..."
                      : inviteType === "link" && mode === "single"
                        ? "Opprett lenke"
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
        isDark={isDark}
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
  isDark,
  inviteType,
  onInviteTypeChange,
}: {
  row: InviteRow;
  onChange: (row: InviteRow) => void;
  departments: Department[];
  isDark: boolean;
  inviteType: InviteType;
  onInviteTypeChange: (type: InviteType) => void;
}) {
  const update = (field: Partial<InviteRow>) => onChange({ ...row, ...field });

  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${
    "border-border bg-background text-foreground placeholder:text-muted-foreground"
  }`;

  const labelClass = `text-xs font-semibold tracking-wider uppercase ${
    "text-muted-foreground"
  }`;

  const selectClass = `w-full appearance-none rounded-lg px-3 py-2.5 text-sm focus:border-orange-500/50 focus:outline-none ${
    "border-border bg-background text-foreground"
  }`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass}>Fornavn</label>
          <input
            type="text"
            value={row.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            placeholder="Kari"
            className={inputClass}
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

      {/* Invite type selector */}
      <div className="space-y-1.5">
        <label className={labelClass}>Invitasjonsmetode</label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { type: "email" as const, label: "E-post", icon: Mail },
              { type: "sms" as const, label: "SMS", icon: Phone },
              { type: "link" as const, label: "Lenke", icon: Link2 },
            ] as const
          ).map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => onInviteTypeChange(type)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                inviteType === type
                  ? "bg-orange-500 text-white"
                  : "border border-border bg-background text-muted-foreground hover:border-border/70"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact field — conditional on invite type */}
      {inviteType === "email" && (
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

      {inviteType === "sms" && (
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

      {inviteType === "link" && (
        <div
          className={`rounded-lg border border-dashed px-4 py-3 text-sm ${
            "border-border bg-muted text-muted-foreground"
          }`}
        >
          En delbar invitasjonslenke vil bli generert som du kan kopiere og sende.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={`flex items-center gap-1.5 ${labelClass}`}>
            <Building2 className="h-3.5 w-3.5" /> Avdeling
          </label>
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
        </div>
        <div className="space-y-1.5">
          <label className={`flex items-center gap-1.5 ${labelClass}`}>
            <Briefcase className="h-3.5 w-3.5" /> Rolle
          </label>
          <select
            value={row.role}
            onChange={(e) => update({ role: e.target.value as InviteRow["role"] })}
            className={selectClass}
          >
            <option value="employee">Ansatt</option>
            <option value="manager">Leder</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </div>

      {/* Employment type toggle */}
      <div className="space-y-1.5">
        <label className={labelClass}>Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(["employee", "guest"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => update({ inviteEmploymentType: type })}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                row.inviteEmploymentType === type
                  ? "bg-orange-500 text-white"
                  : "border border-border bg-background text-muted-foreground hover:border-border/70"
              }`}
            >
              {type === "employee" ? "Ansatt" : "Gjest"}
            </button>
          ))}
        </div>
      </div>

      {/* Employment fields — only for employee type */}
      {row.inviteEmploymentType === "employee" && (
        <div className="space-y-3 rounded-lg border border-dashed border-border/30 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Stillingstype</label>
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
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Lønnstype</label>
              <select
                value={row.salaryType}
                onChange={(e) => update({ salaryType: e.target.value })}
                className={selectClass}
              >
                <option value="">Velg...</option>
                <option value="hourly">Timelønn</option>
                <option value="monthly">Månedslønn</option>
              </select>
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

      {row.errors.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
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
  isDark,
  onUploadClick,
  onRemoveRow,
}: {
  rows: InviteRow[];
  departments: Department[];
  isDark: boolean;
  onUploadClick: () => void;
  onRemoveRow: (id: string) => void;
}) {
  const deptMap = new Map(departments.map((d) => [d.department_id, d.name]));

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div
          className={`rounded-2xl border-2 border-dashed p-6 ${
            "border-border"
          }`}
        >
          <Upload className={`h-8 w-8 ${isDark ? "text-muted-foreground" : "text-foreground"}`} />
        </div>
        <div className="text-center">
          <p className={`text-sm font-medium ${"text-foreground"}`}>
            Last opp CSV-fil med ansatte
          </p>
          <p className={`mt-1 text-xs ${"text-muted-foreground"}`}>
            Obligatoriske kolonner: fornavn, etternavn, e-post
          </p>
        </div>
        <button
          type="button"
          onClick={onUploadClick}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-400"
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
          <Users className={`h-4 w-4 ${"text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${"text-foreground"}`}>
            {rows.length} rader importert
          </span>
          {errorCount > 0 && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
              {errorCount} feil
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onUploadClick}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <Upload className="h-3 w-3" />
          Ny fil
        </button>
      </div>

      <div
        className={`overflow-hidden rounded-xl border ${
          "border-border"
        }`}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className={"bg-muted text-muted-foreground"}>
              <th className="px-3 py-2 text-left font-semibold">Navn</th>
              <th className="px-3 py-2 text-left font-semibold">E-post</th>
              <th className="px-3 py-2 text-left font-semibold">Avdeling</th>
              <th className="px-3 py-2 text-left font-semibold">Rolle</th>
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hasError = row.errors.length > 0;
              return (
                <tr
                  key={row.id}
                  className={`border-t ${
                    hasError
                      ? isDark
                        ? "border-red-500/20 bg-red-950/10"
                        : "border-red-200 bg-red-50/50"
                      : "border-border"
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className={"text-foreground"}>
                      {row.firstName} {row.lastName}
                    </span>
                    {hasError && (
                      <p className="mt-0.5 text-[10px] text-red-400">{row.errors.join(", ")}</p>
                    )}
                  </td>
                  <td className={`px-3 py-2 ${"text-muted-foreground"}`}>
                    {row.email}
                  </td>
                  <td className={`px-3 py-2 ${"text-muted-foreground"}`}>
                    {deptMap.get(row.departmentId) ?? "—"}
                  </td>
                  <td className={`px-3 py-2 ${"text-muted-foreground"}`}>
                    {row.role === "admin" ? "Admin" : row.role === "manager" ? "Leder" : "Ansatt"}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.id)}
                      className={`rounded p-1 transition-colors ${
                        "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
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
  isDark,
  copied,
  onCopy,
}: {
  link: string;
  isDark: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div
        className={`rounded-2xl p-4 ${
          isDark ? "bg-orange-500/10" : "bg-orange-50"
        }`}
      >
        <Link2 className="h-8 w-8 text-orange-500" />
      </div>

      <div className="text-center">
        <p className={`text-sm font-medium ${"text-foreground"}`}>
          Invitasjonslenke klar
        </p>
        <p className={`mt-1 text-xs ${"text-muted-foreground"}`}>
          Del denne lenken med den du vil invitere
        </p>
      </div>

      <div
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 ${
          "border-border bg-muted"
        }`}
      >
        <input
          readOnly
          value={link}
          className={`flex-1 bg-transparent text-xs font-mono outline-none ${
            "text-foreground"
          }`}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          onClick={onCopy}
          className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            copied
              ? "bg-green-500/10 text-green-500"
              : "bg-secondary text-foreground hover:bg-accent"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" /> Kopiert
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Kopier
            </>
          )}
        </button>
      </div>
    </div>
  );
}
