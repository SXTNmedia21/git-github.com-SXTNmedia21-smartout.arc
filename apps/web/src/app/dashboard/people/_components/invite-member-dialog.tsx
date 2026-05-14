"use client";

import {
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
import { useState, useContext, useEffect, useCallback, useRef } from "react";
import Papa from "papaparse";
import { AnimatePresence, motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { toast } from "sonner";
import {
  clearDraft,
  createEmptyRow,
  createLocalStorageAdapter,
  isRowEmpty,
  loadDraft,
  saveDraft,
  submitBulkInvite,
  submitSingleInvite,
  validateRow,
  type InviteChannel,
  type InviteMode,
  type InviteRow,
} from "@smartout/invitations";
import { CsvMappingDialog } from "@/components/dashboard/wizard-steps/csv-column-mapper";
import { DialogHeader } from "@/components/dashboard/DialogHeader";
import { DialogFooter } from "@/components/dashboard/DialogFooter";
import type { Department } from "./types";

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  onRefresh: () => void;
}

const draftStorage = createLocalStorageAdapter();

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

  // Employee groups and contract templates
  const [employeeGroups, setEmployeeGroups] = useState<{ id: string; name: string }[]>([]);
  const [contractTemplates, setContractTemplates] = useState<
    { template_id: string; name: string }[]
  >([]);

  // CSV mode state
  const [csvRows, setCsvRows] = useState<InviteRow[]>([]);
  const [csvMappingOpen, setCsvMappingOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<Record<string, string>[]>([]);
  const [csvRawData, setCsvRawData] = useState<Record<string, string>[]>([]);
  const [csvTotalCount, setCsvTotalCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data when dialog opens
  useEffect(() => {
    if (!isOpen || !workspaceData?.workspace_id) return;
    const supabase = createClient();

    supabase
      .schema("payroll")
      .from("employee_group")
      .select("id, name")
      .eq("workspace_id", workspaceData.workspace_id)
      .order("name")
      .then(({ data }) => {
        if (data) setEmployeeGroups(data as { id: string; name: string }[]);
      });

    supabase
      .from("contract_template")
      .select("template_id, name")
      .eq("contract_type", "employee")
      .eq("is_active", true)
      .or(`workspace_id.eq.${workspaceData.workspace_id},is_system.eq.true`)
      .order("name")
      .then(({ data }) => {
        if (data) setContractTemplates(data as { template_id: string; name: string }[]);
      });
  }, [isOpen, workspaceData?.workspace_id]);

  // Clear only transient UI state on close — draft (singleRow, channels, csvRows, mode)
  // is intentionally preserved so accidental close never loses user input.
  useEffect(() => {
    if (!isOpen) {
      setGeneratedLink(null);
      setLinkCopied(false);
      setCsvMappingOpen(false);
    }
  }, [isOpen]);

  // Hydrate draft once workspace is known. Ref prevents overwriting
  // user input if workspace_id changes mid-session (rare but possible).
  const draftHydratedRef = useRef(false);
  useEffect(() => {
    if (draftHydratedRef.current) return;
    const workspaceId = workspaceData?.workspace_id;
    if (!workspaceId || !draftStorage) {
      draftHydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void loadDraft(draftStorage, workspaceId).then((draft) => {
      if (cancelled) return;
      if (draft) {
        setSingleRow({
          id: crypto.randomUUID(),
          errors: [],
          firstName: draft.row.firstName ?? "",
          lastName: draft.row.lastName ?? "",
          email: draft.row.email ?? "",
          phone: draft.row.phone ?? "",
          departmentId: draft.row.departmentId ?? "",
          role: draft.row.role ?? "employee",
          inviteEmploymentType: draft.row.inviteEmploymentType ?? "employee",
          employeeGroupId: draft.row.employeeGroupId ?? "",
          salary: draft.row.salary ?? "",
          startDate: draft.row.startDate ?? "",
          contractTemplateId: draft.row.contractTemplateId ?? "",
          extraData: draft.row.extraData ?? {},
        });
        setChannels(
          new Set(draft.channels.length ? draft.channels : (["link"] as InviteChannel[])),
        );
      }
      draftHydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceData?.workspace_id]);

  // Autosave draft whenever the single-invite form changes.
  useEffect(() => {
    const workspaceId = workspaceData?.workspace_id;
    if (!workspaceId || !draftStorage) return;
    if (!draftHydratedRef.current) return;
    if (isRowEmpty(singleRow) && channels.size === 1 && channels.has("link")) {
      void clearDraft(draftStorage, workspaceId);
      return;
    }
    void saveDraft(draftStorage, workspaceId, singleRow, channels);
  }, [singleRow, channels, workspaceData?.workspace_id]);

  const resetAfterSuccess = useCallback(() => {
    const workspaceId = workspaceData?.workspace_id;
    if (workspaceId && draftStorage) void clearDraft(draftStorage, workspaceId);
    setSingleRow(createEmptyRow());
    setChannels(new Set(["link"]));
    setCsvRows([]);
    setCsvHeaders([]);
    setCsvPreviewRows([]);
    setCsvRawData([]);
    setCsvTotalCount(0);
    setMode("single");
  }, [workspaceData?.workspace_id]);

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
            case "employeeGroupId":
              row.employeeGroupId = value;
              break;
            case "salary":
              row.salary = value;
              break;
            case "startDate":
              row.startDate = value;
              break;
            case "contractTemplateId":
              row.contractTemplateId = value;
              break;
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

    try {
      const channelLabel = Array.from(effectiveChannels).join("+");

      if (mode === "single") {
        const r = rows[0]!;
        const channelList = Array.from(effectiveChannels);
        const result = await submitSingleInvite({
          workspace_id: workspaceData.workspace_id,
          invite_type: "link",
          channels: channelList,
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
                  employee_group_id: r.employeeGroupId || undefined,
                  salary: r.salary ? Number(r.salary) : undefined,
                  start_date: r.startDate || undefined,
                  contract_template_id: r.contractTemplateId || undefined,
                }
              : undefined,
        });

        if (!result.ok) throw new Error(result.error);

        void emit({
          event: "button clicked",
          workspace_id: nonEmpty(workspaceData.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            trackingId: `single-invite-${channelLabel}`,
            context: `invited ${rows.length} members via ${channelLabel}`,
          },
        });

        if (result.data.token) {
          const inviteUrl = `${window.location.origin}/invite/${result.data.token}`;
          setGeneratedLink(inviteUrl);
          const parts: string[] = [];
          if (effectiveChannels.has("email")) parts.push("e-post");
          if (effectiveChannels.has("sms")) parts.push("SMS");
          parts.push("lenke");
          toast.success(`Invitasjon opprettet (${parts.join(" + ")})`);
          resetAfterSuccess();
          onRefresh();
          return;
        }

        const dispatched = (result.data.dispatched as number | undefined) ?? 0;
        const failed = (result.data.failed as number | undefined) ?? 0;
        if (failed > 0) {
          toast.warning(`${dispatched} invitasjoner sendt, ${failed} feilet`);
        } else {
          toast.success(dispatched === 1 ? "Invitasjon sendt" : `${dispatched} invitasjoner sendt`);
        }
        resetAfterSuccess();
        onRefresh();
        onClose();
        return;
      }

      // mode === "csv"
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
                employee_group_id: r.employeeGroupId || undefined,
                salary: r.salary ? Number(r.salary) : undefined,
                start_date: r.startDate || undefined,
                contract_template_id: r.contractTemplateId || undefined,
              }
            : undefined,
      }));

      const result = await submitBulkInvite({
        workspace_id: workspaceData.workspace_id,
        company_id: workspaceData.company_id,
        invites: inviteRecords,
        skip_dispatch: true,
      });

      if (!result.ok) throw new Error(result.error);

      void emit({
        event: "button clicked",
        workspace_id: nonEmpty(workspaceData.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          trackingId: "bulk-invite-csv",
          context: `invited ${rows.length} members via ${channelLabel}`,
        },
      });

      toast.success(`${rows.length} invitasjoner importert`);
      resetAfterSuccess();
      onRefresh();
      onClose();
    } catch (error: unknown) {
      console.error("Failed to create invitations:", error);
      toast.error(error instanceof Error ? error.message : "Kunne ikke opprette invitasjoner");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    mode,
    channels,
    singleRow,
    csvRows,
    workspaceData,
    profileId,
    onRefresh,
    onClose,
    resetAfterSuccess,
  ]);

  if (!workspaceData) return null;

  const validCsvCount = csvRows.filter((r) => r.errors.length === 0).length;
  const shellWidth = mode === "csv" && csvRows.length > 0 ? "max-w-2xl" : "max-w-md";

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="invite-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
            style={{
              background:
                "radial-gradient(circle at 50% 30%, oklch(0.18 0.04 55 / 0.55), oklch(0.08 0.02 50 / 0.78))",
              backdropFilter: "blur(8px)",
            }}
          >
            <motion.div
              key="invite-shell"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", ...motionTokens.spring }}
              className={`bg-background/80 ring-border/60 relative flex w-full flex-col overflow-hidden rounded-3xl shadow-[0_32px_120px_-24px_rgba(0,0,0,0.55)] ring-1 backdrop-blur-xl ${shellWidth}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(1 0 0 / 0.10) 0%, oklch(1 0 0 / 0.02) 35%, transparent 60%)",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -top-32 -right-24 h-64 w-64 rounded-full opacity-40 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, oklch(0.78 0.18 55 / 0.45), transparent 70%)",
                }}
              />
              <div className="relative flex flex-col">
                {/* Header */}
                <DialogHeader
                  title={mode === "csv" ? "CSV-import" : "Inviter ansatt"}
                  subtitle={
                    mode === "csv"
                      ? `${csvRows.length > 0 ? `${csvRows.length} rader lastet` : "Last opp en fil"}`
                      : workspaceData.name
                  }
                  icon={
                    mode === "single" ? (
                      <UserPlus className="text-brand-orange h-5 w-5" />
                    ) : undefined
                  }
                  onClose={onClose}
                  onBack={mode === "csv" ? () => setMode("single") : undefined}
                  backIcon={mode === "csv" ? <ArrowLeft className="h-5 w-5" /> : undefined}
                />

                {/* Content */}
                <div className="max-h-[60vh] overflow-y-auto px-7 pb-2">
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
                      employeeGroups={employeeGroups}
                      contractTemplates={contractTemplates}
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
                <DialogFooter
                  leftContent={
                    mode === "single" && !generatedLink ? (
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
                    ) : null
                  }
                  rightContent={
                    generatedLink ? (
                      <button
                        type="button"
                        onClick={onClose}
                        className="bg-brand-orange hover:bg-brand-orange/90 ring-brand-orange/30 text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-[0_8px_24px_-8px_oklch(0.78_0.18_55_/_0.55)] ring-1 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
                          className="bg-brand-orange hover:bg-brand-orange/90 ring-brand-orange/30 text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-[0_8px_24px_-8px_oklch(0.78_0.18_55_/_0.55)] ring-1 transition-all hover:scale-[1.02] hover:shadow-[0_12px_32px_-8px_oklch(0.78_0.18_55_/_0.65)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
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
                    )
                  }
                />
              </div>
            </motion.div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
  employeeGroups,
  contractTemplates,
  channels,
  onToggleChannel,
}: {
  row: InviteRow;
  onChange: (row: InviteRow) => void;
  departments: Department[];
  employeeGroups: { id: string; name: string }[];
  contractTemplates: { template_id: string; name: string }[];
  channels: Set<InviteChannel>;
  onToggleChannel: (ch: InviteChannel) => void;
}) {
  const update = (field: Partial<InviteRow>) => onChange({ ...row, ...field });
  const [showEmployment, setShowEmployment] = useState(false);

  const sectionMotion = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { type: "spring" as const, ...motionTokens.springSnappy },
  };

  return (
    <motion.div
      className="space-y-6"
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
      }}
    >
      {/* Name row */}
      <motion.div className="grid grid-cols-2 gap-3" variants={sectionMotion}>
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
      </motion.div>

      {/* Invite channels — multi-select, link always on */}
      <motion.div className="space-y-2" variants={sectionMotion}>
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
                    ? "bg-brand-orange/15 text-brand-orange ring-brand-orange/30 shadow-[0_0_24px_-4px_oklch(0.78_0.18_55_/_0.35)] ring-1"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border border"
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
      </motion.div>

      {/* Contact fields — shown when channel is active */}
      <AnimatePresence initial={false}>
        {channels.has("email") && (
          <motion.div
            key="email-field"
            className="space-y-1.5 overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", ...motionTokens.springSnappy }}
          >
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
          </motion.div>
        )}

        {channels.has("sms") && (
          <motion.div
            key="sms-field"
            className="space-y-1.5 overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", ...motionTokens.springSnappy }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Department + Role */}
      <motion.div className="grid grid-cols-2 gap-3" variants={sectionMotion}>
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
      </motion.div>

      {/* Employment type toggle */}
      <motion.div className="space-y-2" variants={sectionMotion}>
        <label className={labelClass}>Tilknytning</label>
        <div className="grid grid-cols-2 gap-2">
          {(["employee", "guest"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => update({ inviteEmploymentType: type })}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                row.inviteEmploymentType === type
                  ? "bg-brand-orange/15 text-brand-orange ring-brand-orange/30 shadow-[0_0_24px_-4px_oklch(0.78_0.18_55_/_0.35)] ring-1"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border border"
              }`}
            >
              {type === "employee" ? "Ansatt" : "Gjest"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Employment details — collapsible (de-boxed: indent + chevron only) */}
      {row.inviteEmploymentType === "employee" && (
        <motion.div className="space-y-3" variants={sectionMotion}>
          <button
            type="button"
            onClick={() => setShowEmployment(!showEmployment)}
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-xs font-semibold tracking-wider uppercase transition-colors"
          >
            <span>Ansettelsesprofil</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showEmployment ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {showEmployment && (
              <motion.div
                key="employment-body"
                className="border-brand-orange/20 space-y-3 overflow-hidden border-l-2 pl-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", ...motionTokens.springSnappy }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Ansattgruppe</label>
                    <div className="relative">
                      <select
                        value={row.employeeGroupId}
                        onChange={(e) => update({ employeeGroupId: e.target.value })}
                        className={selectClass}
                      >
                        <option value="">Velg...</option>
                        {employeeGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Lønn</label>
                    <input
                      type="number"
                      value={row.salary}
                      onChange={(e) => update({ salary: e.target.value })}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Startdato</label>
                    <input
                      type="date"
                      value={row.startDate}
                      onChange={(e) => update({ startDate: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Kontrakttemplate</label>
                    <div className="relative">
                      <select
                        value={row.contractTemplateId}
                        onChange={(e) => update({ contractTemplateId: e.target.value })}
                        className={selectClass}
                      >
                        <option value="">Velg...</option>
                        {contractTemplates.map((t) => (
                          <option key={t.template_id} value={t.template_id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {row.errors.length > 0 && (
        <motion.div
          variants={sectionMotion}
          className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{row.errors.join(", ")}</span>
        </motion.div>
      )}
    </motion.div>
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
        <div className="border-border bg-muted/50 rounded-2xl border-2 border-dashed p-6">
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
          className="bg-brand-orange hover:bg-brand-orange/90 ring-brand-orange/30 text-primary-foreground flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-[0_8px_24px_-8px_oklch(0.78_0.18_55_/_0.55)] ring-1 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
            <span className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-[10px] font-medium">
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
      <div className="bg-brand-orange/10 rounded-2xl p-4">
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
              ? "bg-success/10 text-success"
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
