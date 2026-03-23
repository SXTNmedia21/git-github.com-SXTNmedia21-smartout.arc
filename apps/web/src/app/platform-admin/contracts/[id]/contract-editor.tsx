"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Save,
  Lock,
  MoreHorizontal,
  ChevronRight,
  FileText,
  ScrollText,
  Download,
  Eye,
  Code2,
  Settings2,
  History,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ContractActionButtons } from "./action-buttons";
import { DocumentButtons } from "./document-buttons";

type PlaceholderDef = {
  key: string;
  label: string;
  source: string;
  default_value?: string;
  required: boolean;
};

type ContractEvent = {
  id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

type ContractReminder = {
  id: string;
  reminder_type: string;
  template_key: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string | null;
};

type ContractData = {
  contract_id: string;
  title: string;
  status: string;
  contract_type: string;
  contract_number: string | null;
  journey_type: string | null;
  sender_name: string | null;
  sender_email: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  resolved_html: string | null;
  resolved_values: Record<string, string>;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  expires_at: string | null;
  signing_url: string | null;
  signed_pdf_url: string | null;
  audit_log_url: string | null;
  document_url: string | null;
  docuseal_submission_id: string | null;
  workspace: { name: string; slug: string } | null;
  template: { name: string; contract_type: string; content_html: string | null } | null;
};

type Attachment = {
  id: string;
  title: string;
  content_html: string;
};

type FileAttachment = {
  attachment_id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  display_order: number;
  created_at: string;
};

type Props = {
  contract: ContractData;
  placeholders: PlaceholderDef[];
  templateHtml: string;
  attachments: Attachment[];
  contentCss: string;
  events: ContractEvent[];
  reminders: ContractReminder[];
  fileAttachments: FileAttachment[];
};

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  sent: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  viewed: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  signed: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  active: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  expired: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  cancelled: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  declined: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  terminated: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
  voided: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
};

const statusLabel: Record<string, string> = {
  draft: "Utkast",
  sent: "Sendt",
  viewed: "Sett",
  signed: "Signert",
  active: "Aktiv",
  expired: "Utlopt",
  cancelled: "Avbrutt",
  declined: "Avvist",
  terminated: "Terminert",
  voided: "Annullert",
};

function formatDateTime(date: string | null): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleString("no-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDateShort(date: string | null): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("no-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ContractEditor({
  contract,
  placeholders,
  templateHtml,
  attachments,
  contentCss,
  events,
  reminders,
  fileAttachments,
}: Props) {
  const router = useRouter();
  const isDraft = contract.status === "draft";

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of placeholders) {
      initial[p.key] = contract.resolved_values?.[p.key] ?? p.default_value ?? "";
    }
    return initial;
  });

  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [editedHtml, setEditedHtml] = useState(() => contract.resolved_html ?? templateHtml);
  const [dataOpen, setDataOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>(fileAttachments);
  const [uploading, setUploading] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/platform-admin/contracts/${contract.contract_id}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload feilet");
      }
      const { data } = await res.json();
      setUploadedFiles((prev) => [...prev, data]);
      toast.success("Fil lastet opp");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    try {
      const res = await fetch(
        `/api/platform-admin/contracts/${contract.contract_id}/attachments/${attachmentId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Sletting feilet");
      }
      setUploadedFiles((prev) => prev.filter((f) => f.attachment_id !== attachmentId));
      toast.success("Fil slettet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    }
  }

  const updateValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const previewHtml = useMemo(() => {
    let html: string;
    if (showPlaceholders) {
      html = templateHtml;
      for (const p of placeholders) {
        const val = values[p.key];
        if (val) {
          html = html.replace(new RegExp(escapeRegex(val), "g"), `{{${p.key}}}`);
        }
      }
    } else {
      html = editedHtml;
      for (const [key, value] of Object.entries(values)) {
        html = html.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "g"), value);
      }
    }
    // Strip inline SVG logos from contract HTML (they belong in PDF, not in editor)
    html = html.replace(/<svg[^>]*class="logo-mark"[^>]*>[\s\S]*?<\/svg>/gi, "");
    return html;
  }, [showPlaceholders, templateHtml, editedHtml, values, placeholders]);

  async function handleSave() {
    setSaving(true);
    try {
      let resolved = editedHtml;
      for (const [key, value] of Object.entries(values)) {
        resolved = resolved.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, "g"), value);
      }

      const res = await fetch(`/api/platform-admin/contracts/${contract.contract_id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolved_html: resolved,
          resolved_values: values,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Kunne ikke lagre");
      }

      toast.success("Kontrakt lagret");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setSaving(false);
    }
  }

  const groupedPlaceholders = useMemo(() => {
    const groups: Record<string, PlaceholderDef[]> = {};
    for (const p of placeholders) {
      const group = sourceLabel(p.source);
      if (!groups[group]) groups[group] = [];
      groups[group].push(p);
    }
    return groups;
  }, [placeholders]);

  const style = statusStyles[contract.status] ?? {
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    dot: "bg-zinc-400",
  };
  const hasDocuments = !!(
    contract.signed_pdf_url ||
    contract.audit_log_url ||
    contract.document_url
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="mx-auto max-w-4xl space-y-4">
        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          <Link href="/platform-admin/contracts" className="mt-1">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-lg leading-tight font-semibold">{contract.title}</h1>
              <Badge
                variant="outline"
                className={`${style.bg} ${style.text} shrink-0 border-transparent text-[11px] font-medium`}
              >
                <span className={`${style.dot} mr-1.5 inline-block h-1.5 w-1.5 rounded-full`} />
                {statusLabel[contract.status] ?? contract.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {contract.contract_number ?? contract.contract_id.slice(0, 8)}
              {contract.workspace && <> &middot; {contract.workspace.name}</>}
              {contract.recipient_name && <> &middot; {contract.recipient_name}</>}
              {contract.recipient_email && (
                <span className="ml-1 opacity-60">{contract.recipient_email}</span>
              )}
            </p>
          </div>

          {/* Primary actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            {isDraft && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Lagrer..." : "Lagre"}
              </Button>
            )}

            <ContractActionButtons contractId={contract.contract_id} status={contract.status} />

            {/* Overflow menu for documents + extras */}
            {(hasDocuments || contract.docuseal_submission_id) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {contract.signed_pdf_url && (
                    <DropdownMenuItem asChild>
                      <a href={contract.signed_pdf_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="mr-2 h-4 w-4" />
                        Last ned signert PDF
                      </a>
                    </DropdownMenuItem>
                  )}
                  {contract.audit_log_url && (
                    <DropdownMenuItem asChild>
                      <a href={contract.audit_log_url} target="_blank" rel="noopener noreferrer">
                        <ScrollText className="mr-2 h-4 w-4" />
                        Last ned audit log
                      </a>
                    </DropdownMenuItem>
                  )}
                  {contract.document_url && contract.document_url !== contract.signed_pdf_url && (
                    <DropdownMenuItem asChild>
                      <a href={contract.document_url} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Last ned dokument
                      </a>
                    </DropdownMenuItem>
                  )}
                  {contract.docuseal_submission_id && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <DocumentButtons
                          contractId={contract.contract_id}
                          hasAuditLog={!!contract.audit_log_url}
                          hasDocuments={!!contract.signed_pdf_url}
                          docusealSubmissionId={contract.docuseal_submission_id}
                        />
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ── Key dates strip ── */}
        <div className="bg-muted/40 flex items-center gap-6 rounded-lg px-4 py-2 text-xs">
          <DatePill label="Opprettet" value={contract.created_at} />
          {contract.sent_at && <DatePill label="Sendt" value={contract.sent_at} />}
          {contract.viewed_at && <DatePill label="Sett" value={contract.viewed_at} />}
          {contract.signed_at && <DatePill label="Signert" value={contract.signed_at} />}
          {contract.declined_at && <DatePill label="Avvist" value={contract.declined_at} />}
          {!contract.signed_at && contract.expires_at && (
            <DatePill label="Utloper" value={contract.expires_at} />
          )}
        </div>

        {/* ── Placeholder data (collapsible) ── */}
        {placeholders.length > 0 && (
          <Collapsible open={dataOpen} onOpenChange={setDataOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="border-border hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors"
              >
                <Settings2 className="text-muted-foreground h-4 w-4" />
                <span className="flex-1">Kontraktsdata</span>
                {!isDraft && <Lock className="text-muted-foreground h-3.5 w-3.5" />}
                <span className="text-muted-foreground text-xs">{placeholders.length} felt</span>
                <ChevronRight
                  className={`text-muted-foreground h-4 w-4 transition-transform ${
                    dataOpen ? "rotate-90" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-border space-y-5 rounded-b-lg border border-t-0 px-4 pt-3 pb-4">
                {Object.entries(groupedPlaceholders).map(([group, phs]) => (
                  <div key={group}>
                    <h4 className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-widest uppercase">
                      {group}
                    </h4>
                    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                      {phs.map((p) => (
                        <div key={p.key} className="group">
                          <Label
                            htmlFor={p.key}
                            className="text-muted-foreground mb-0.5 block text-xs"
                          >
                            {p.label}
                            {p.required && <span className="ml-0.5 text-red-400">*</span>}
                          </Label>
                          <Input
                            id={p.key}
                            value={values[p.key] ?? ""}
                            onChange={(e) => updateValue(p.key, e.target.value)}
                            disabled={!isDraft}
                            placeholder={p.default_value || p.key}
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ── Contract text (the main content) ── */}
        <div className="border-border overflow-hidden rounded-lg border">
          {/* Toolbar */}
          <div className="border-border bg-muted/30 flex items-center justify-between border-b px-4 py-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              Kontraktstekst
              {!isDraft && <Lock className="text-muted-foreground h-3.5 w-3.5" />}
            </span>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Eye className="text-muted-foreground h-3.5 w-3.5" />
                    <Switch
                      id="placeholder-toggle"
                      checked={showPlaceholders}
                      onCheckedChange={setShowPlaceholders}
                      className="scale-90"
                    />
                    <Code2 className="text-muted-foreground h-3.5 w-3.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {showPlaceholders ? "Viser variabelnavn" : "Viser utfylt tekst"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Contract body */}
          <div className="max-w-none px-8 py-6" style={{ minHeight: "500px" }}>
            {contentCss && (
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                /* Override template CSS colors for dark mode readability */
                .contract-header h1 { color: #f1f1f1 !important; }
                .contract-subtitle { color: #a1a1aa !important; }
                .party-card { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.1) !important; }
                .party-label { color: #a1a1aa !important; }
                .party-card.customer .party-label { color: #FF6B35 !important; }
                .party-row { color: #d4d4d8 !important; }
                .party-row .label { color: #71717a !important; }
                .party-row .value { color: #f4f4f5 !important; }
                .section-title { color: #f1f1f1 !important; }
                .price-row { color: #d4d4d8 !important; }
                .price-row strong { color: #f4f4f5 !important; }
                .price-note { color: #71717a !important; }
                .special-terms { background: rgba(255,107,53,0.08) !important; }
                .special-terms p { color: #d4d4d8 !important; }
                .special-terms strong { color: #f4f4f5 !important; }
                .legal-section h3 { color: #f1f1f1 !important; }
                .legal-section .legal-subtitle { color: #a1a1aa !important; }
                .legal-section h4 { color: #e4e4e7 !important; }
                .legal-section p, .legal-section li { color: #a1a1aa !important; }
                .vedlegg-table th { background: rgba(255,255,255,0.06) !important; color: #d4d4d8 !important; border-color: rgba(255,255,255,0.1) !important; }
                .vedlegg-table td { color: #a1a1aa !important; border-color: rgba(255,255,255,0.08) !important; }
                .sig-block { border-color: rgba(255,255,255,0.1) !important; }
                .sig-block .sig-label { color: #a1a1aa !important; }
                .sig-block .sig-info { color: #d4d4d8 !important; }
                .consent-row { color: #f1f1f1 !important; }
                .confidential-notice { color: #71717a !important; border-color: rgba(255,255,255,0.08) !important; }
                [data-type="placeholder-field"] { color: #FF6B35 !important; font-weight: 600; }
                .contract-page { border-color: #FF6B35 !important; }
                ${contentCss}
              `,
                }}
              />
            )}
            {isDraft && !showPlaceholders ? (
              <div
                contentEditable
                suppressContentEditableWarning
                className="outline-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                onBlur={(e) => {
                  setEditedHtml(e.currentTarget.innerHTML);
                }}
              />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            )}
          </div>

          {showPlaceholders && (
            <div className="bg-muted/30 border-border border-t px-4 py-1.5">
              <p className="text-muted-foreground text-[11px]">
                Variabler vises som{" "}
                <code className="text-foreground/70 rounded bg-zinc-800/50 px-1 py-0.5 text-[10px]">
                  {"{{variabel}}"}
                </code>
                . Sla av for a se utfylt tekst.
              </p>
            </div>
          )}
        </div>

        {/* ── Attachments (Vedlegg) ── */}
        {attachments.length > 0 && (
          <div className="space-y-3">
            {attachments.map((att) => (
              <Collapsible key={att.id}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="border-border hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors"
                  >
                    <FileText className="text-muted-foreground h-4 w-4" />
                    <span className="flex-1">{att.title}</span>
                    <ChevronRight className="text-muted-foreground h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-border rounded-b-lg border border-t-0">
                    <div
                      className="prose prose-sm prose-invert max-w-none px-8 py-6"
                      dangerouslySetInnerHTML={{ __html: att.content_html }}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Per-contract file attachments */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="border-border hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors"
            >
              <FileText className="text-muted-foreground h-4 w-4" />
              <span className="flex-1">Bilagor</span>
              <span className="text-muted-foreground text-xs">{uploadedFiles.length}</span>
              <ChevronRight className="text-muted-foreground h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-border space-y-2 rounded-b-lg border border-t-0 px-4 py-3">
              {isDraft && (
                <label className="border-border hover:bg-muted/30 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm transition-colors">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <span className="text-muted-foreground">Laster opp...</span>
                  ) : (
                    <span className="text-muted-foreground">Klikk for å laste opp fil</span>
                  )}
                </label>
              )}
              {uploadedFiles.map((f) => (
                <div key={f.attachment_id} className="flex items-center gap-3 text-sm">
                  <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{f.filename}</span>
                  <span className="text-muted-foreground text-xs">
                    {f.file_size ? `${(f.file_size / 1024).toFixed(0)} KB` : ""}
                  </span>
                  {isDraft && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDeleteAttachment(f.attachment_id)}
                    >
                      <span className="text-xs text-red-400">✕</span>
                    </Button>
                  )}
                </div>
              ))}
              {uploadedFiles.length === 0 && !isDraft && (
                <p className="text-muted-foreground text-xs">Ingen bilagor</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Timeline + Reminders (collapsible, bottom) ── */}
        <div className="flex gap-3">
          {events.length > 0 && (
            <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen} className="flex-1">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="border-border hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors"
                >
                  <History className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground flex-1 font-medium">Hendelseslogg</span>
                  <span className="text-muted-foreground/70 text-xs">{events.length}</span>
                  <ChevronRight
                    className={`text-muted-foreground h-4 w-4 transition-transform ${
                      timelineOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-border space-y-0 rounded-b-lg border border-t-0">
                  {events.map((event, i) => (
                    <div
                      key={event.id}
                      className={`flex items-center gap-3 px-4 py-2 text-sm ${
                        i < events.length - 1 ? "border-border border-b" : ""
                      }`}
                    >
                      <span className="text-muted-foreground w-5 text-center text-xs">
                        {eventIcon(event.event_type)}
                      </span>
                      <span className="flex-1 capitalize">
                        {event.event_type.replace("_", " ")}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDateShort(event.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {reminders.length > 0 && (
            <Collapsible className="flex-1">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="border-border hover:bg-muted/50 flex w-full items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors"
                >
                  <Bell className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground flex-1 font-medium">Paminnelser</span>
                  <span className="text-muted-foreground/70 text-xs">{reminders.length}</span>
                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-border space-y-0 rounded-b-lg border border-t-0">
                  {reminders.map((r, i) => (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between px-4 py-2 text-sm ${
                        i < reminders.length - 1 ? "border-border border-b" : ""
                      }`}
                    >
                      <span className="capitalize">{r.reminder_type}</span>
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <span>{formatDateShort(r.scheduled_at)}</span>
                        {r.sent_at && (
                          <Badge
                            variant="outline"
                            className="h-4 border-emerald-500/20 px-1.5 text-[10px] text-emerald-400"
                          >
                            sendt
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function DatePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="text-foreground font-medium">{formatDateShort(value)}</span>
    </div>
  );
}

function eventIcon(type: string): string {
  const icons: Record<string, string> = {
    created: "\u270E",
    sent: "\u2197",
    viewed: "\u25C9",
    signed: "\u2713",
    declined: "\u2717",
    cancelled: "\u2014",
    expired: "\u25F7",
    reminder_sent: "\u266A",
  };
  return icons[type] ?? "\u2022";
}

function sourceLabel(source: string): string {
  switch (source) {
    case "workspace":
      return "Arbeidssted";
    case "workspace.company":
      return "Firma";
    case "constant":
      return "Smartout";
    case "auto":
      return "Automatisk";
    case "manual":
      return "Manuell";
    default:
      return source;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
