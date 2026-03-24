"use client";

import { useState, useCallback, useRef, useContext, useEffect } from "react";
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Eye,
  Users,
  Clock,
  BookOpen,
  DollarSign,
  Briefcase,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileSearch,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { DocumentExtractionResult } from "./wizard-state";

// ─── Constants ────────────────────────────────────────────

const MAX_FILES = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".csv",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  storagePath: string;
  status: "uploading" | "uploaded" | "analyzed" | "error";
};

// ─── Helpers ──────────────────────────────────────────────

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
  return ACCEPTED_EXTENSIONS.includes(ext);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Extraction Summary Dialog ────────────────────────────

function ExtractionSummary({
  result,
  onClose,
  onUpdate,
}: {
  result: DocumentExtractionResult;
  onClose: () => void;
  onUpdate: (updated: DocumentExtractionResult) => void;
}) {
  type SectionItem = { label: string; detail: string; source: string; key: string; index: number };
  type Section = {
    key: keyof DocumentExtractionResult;
    icon: React.ReactNode;
    title: string;
    items: SectionItem[];
  };

  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const toggleExpand = (itemId: string) => {
    setExpandedItem((prev) => (prev === itemId ? null : itemId));
  };

  const sections: Section[] = [];

  if (result.policies?.length) {
    sections.push({
      key: "policies",
      icon: <ShieldCheck className="h-4 w-4" />,
      title: "Retningslinjer",
      items: result.policies.map((p, i) => ({
        label: p.name,
        detail: p.content,
        source: p.source,
        key: "policies",
        index: i,
      })),
    });
  }

  if (result.employees?.length) {
    sections.push({
      key: "employees",
      icon: <Users className="h-4 w-4" />,
      title: "Ansatte",
      items: result.employees.map((e, i) => ({
        label: `${e.firstName} ${e.lastName}${e.position ? ` — ${e.position}` : ""}`,
        detail: [
          e.email ? `E-post: ${e.email}` : "",
          e.phone ? `Telefon: ${e.phone}` : "",
          e.department ? `Avdeling: ${e.department}` : "",
          e.position ? `Stilling: ${e.position}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        source: e.source,
        key: "employees",
        index: i,
      })),
    });
  }

  if (result.shiftPatterns?.length) {
    sections.push({
      key: "shiftPatterns",
      icon: <Clock className="h-4 w-4" />,
      title: "Vaktmønstre",
      items: result.shiftPatterns.map((s, i) => ({
        label: `${s.name} (${s.startTime}–${s.endTime})`,
        detail: [
          `Start: ${s.startTime}`,
          `Slutt: ${s.endTime}`,
          s.department ? `Avdeling: ${s.department}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        source: s.source,
        key: "shiftPatterns",
        index: i,
      })),
    });
  }

  if (result.payroll) {
    const supplements = result.payroll.supplements
      ? Object.entries(result.payroll.supplements)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : "";
    sections.push({
      key: "payroll",
      icon: <DollarSign className="h-4 w-4" />,
      title: "Lønn og tariff",
      items: [
        {
          label: result.payroll.tariff ? `Tariff: ${result.payroll.tariff}` : "Tariffinfo funnet",
          detail: [
            result.payroll.tariff ? `Tariff: ${result.payroll.tariff}` : "",
            supplements ? `Tillegg:\n${supplements}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          source: result.payroll.source,
          key: "payroll",
          index: 0,
        },
      ],
    });
  }

  if (result.employmentTerms) {
    sections.push({
      key: "employmentTerms",
      icon: <Briefcase className="h-4 w-4" />,
      title: "Ansettelsesvilkår",
      items: [
        {
          label: [
            result.employmentTerms.noticePeriod
              ? `Oppsigelse: ${result.employmentTerms.noticePeriod}`
              : "",
            result.employmentTerms.probation ? `Prøvetid: ${result.employmentTerms.probation}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          detail: [
            result.employmentTerms.noticePeriod
              ? `Oppsigelsestid: ${result.employmentTerms.noticePeriod}`
              : "",
            result.employmentTerms.probation ? `Prøvetid: ${result.employmentTerms.probation}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          source: result.employmentTerms.source,
          key: "employmentTerms",
          index: 0,
        },
      ],
    });
  }

  if (result.handbookSections?.length) {
    sections.push({
      key: "handbookSections",
      icon: <BookOpen className="h-4 w-4" />,
      title: "Handbokseksjoner",
      items: result.handbookSections.map((h, i) => ({
        label: h.chapterKey.replace(/-/g, " "),
        detail: h.content,
        source: h.source,
        key: "handbookSections",
        index: i,
      })),
    });
  }

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  function handleRemoveItem(sectionKey: string, index: number) {
    const updated = { ...result };

    if (sectionKey === "policies" && updated.policies) {
      updated.policies = updated.policies.filter((_, i) => i !== index);
      if (updated.policies.length === 0) delete updated.policies;
    } else if (sectionKey === "employees" && updated.employees) {
      updated.employees = updated.employees.filter((_, i) => i !== index);
      if (updated.employees.length === 0) delete updated.employees;
    } else if (sectionKey === "shiftPatterns" && updated.shiftPatterns) {
      updated.shiftPatterns = updated.shiftPatterns.filter((_, i) => i !== index);
      if (updated.shiftPatterns.length === 0) delete updated.shiftPatterns;
    } else if (sectionKey === "handbookSections" && updated.handbookSections) {
      updated.handbookSections = updated.handbookSections.filter((_, i) => i !== index);
      if (updated.handbookSections.length === 0) delete updated.handbookSections;
    } else if (sectionKey === "payroll") {
      delete updated.payroll;
    } else if (sectionKey === "employmentTerms") {
      delete updated.employmentTerms;
    }

    onUpdate(updated);
  }

  function handleRemoveSection(sectionKey: string) {
    const updated = { ...result };
    delete updated[sectionKey as keyof DocumentExtractionResult];
    onUpdate(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`mx-4 w-full max-w-lg rounded-2xl border shadow-2xl ${"border-border bg-white"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-inherit px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-orange/10 flex h-9 w-9 items-center justify-center rounded-full">
              <Sparkles className="text-brand-orange h-5 w-5" />
            </div>
            <div>
              <h3 className={`text-base font-bold ${"text-foreground"}`}>Analysert data</h3>
              <p className={`text-xs ${"text-muted-foreground"}`}>
                {totalItems} elementer funnet i {sections.length} kategorier
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-2 transition-colors ${"text-muted-foreground hover:bg-accent"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {sections.length === 0 ? (
            <div className="space-y-3 py-2">
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${"border-warning bg-warning"}`}
              >
                <AlertCircle className={`h-5 w-5 shrink-0 ${"text-warning"}`} />
                <p className={`text-sm font-medium ${"text-warning"}`}>
                  Ingen relevant driftsdata funnet
                </p>
              </div>
              <p className={`text-sm leading-relaxed ${"text-muted-foreground"}`}>
                Dokumentene ser ikke ut til å inneholde informasjon vi kan bruke til å sette opp
                arbeidsplassen din. Vi leter etter:
              </p>
              <ul className={`space-y-1.5 pl-1 text-sm ${"text-muted-foreground"}`}>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="text-brand-orange h-3.5 w-3.5" /> Retningslinjer og
                  rutiner (HMS, hygiene, etc.)
                </li>
                <li className="flex items-center gap-2">
                  <Users className="text-brand-orange h-3.5 w-3.5" /> Ansattlister med navn, roller,
                  kontaktinfo
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="text-brand-orange h-3.5 w-3.5" /> Vaktmønstre og arbeidstider
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="text-brand-orange h-3.5 w-3.5" /> Tariffavtaler og
                  lønnstillegg
                </li>
                <li className="flex items-center gap-2">
                  <Briefcase className="text-brand-orange h-3.5 w-3.5" /> Ansettelsesvilkår
                  (oppsigelse, prøvetid)
                </li>
                <li className="flex items-center gap-2">
                  <BookOpen className="text-brand-orange h-3.5 w-3.5" /> Personalhandbok
                </li>
              </ul>
              <p className={`text-xs ${"text-muted-foreground"}`}>
                Prøv å laste opp personalhandbok, tariffavtale, arbeidsavtale-mal, eller
                ansattlister.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.key}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-brand-orange">{section.icon}</span>
                    <span className={`text-sm font-semibold ${"text-foreground"}`}>
                      {section.title}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${"bg-muted text-muted-foreground"}`}
                    >
                      {section.items.length}
                    </span>
                    {section.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(section.key)}
                        className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${"text-destructive hover:bg-red-50 hover:text-red-600"}`}
                      >
                        Fjern alle
                      </button>
                    )}
                  </div>
                  <ul className="space-y-1 pl-6">
                    {section.items.map((item) => {
                      const itemId = `${item.key}-${item.index}`;
                      const isExpanded = expandedItem === itemId;
                      return (
                        <li key={itemId} className="space-y-0">
                          <div
                            className={`group flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors ${"text-muted-foreground hover:bg-accent"}`}
                            onClick={() => toggleExpand(itemId)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="text-brand-orange h-3 w-3 shrink-0" />
                            ) : (
                              <ChevronDown className="text-muted-foreground h-3 w-3 shrink-0" />
                            )}
                            <span className="min-w-0 flex-1 font-medium">{item.label}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveItem(item.key, item.index);
                              }}
                              className={`shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${"text-destructive hover:bg-red-50 hover:text-red-600"}`}
                              title="Fjern dette elementet"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          {isExpanded && (
                            <div
                              className={`mt-1 ml-5 rounded-lg border px-3 py-2 text-xs ${"border-border bg-muted text-muted-foreground"}`}
                            >
                              <p className="leading-relaxed whitespace-pre-wrap">
                                {item.detail || "Ingen detaljer tilgjengelig."}
                              </p>
                              {item.source && (
                                <p
                                  className={`mt-2 flex items-center gap-1 text-[10px] ${"text-muted-foreground"}`}
                                >
                                  <FileSearch className="h-3 w-3" />
                                  Kilde: {item.source}
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-inherit px-6 py-4">
          <p className={`text-xs ${"text-muted-foreground"}`}>
            Fjern elementer som er utdaterte eller feil. Gjenværende data forhåndsutfylles i de
            neste stegene.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── DocumentDropStep ─────────────────────────────────────

export function DocumentDropStep({
  onExtractionComplete,
}: {
  onExtractionComplete: (result: DocumentExtractionResult) => void;
}) {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [extractionResult, setExtractionResult] = useState<DocumentExtractionResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // ── Load existing files from bucket on mount ──
  useEffect(() => {
    async function loadExisting() {
      const prefix = `${workspace.workspace_id}/setup-docs`;
      const { data } = await supabase.storage.from("setup-documents").list(prefix);
      if (!data?.length) return;

      const existing: UploadedFile[] = data.map((f) => ({
        id: f.id ?? f.name,
        name: f.name,
        size: f.metadata?.size ?? 0,
        storagePath: `${prefix}/${f.name}`,
        status: "uploaded" as const,
      }));

      setFiles((prev) => {
        const existingPaths = new Set(prev.map((f) => f.storagePath));
        const newFiles = existing.filter((f) => !existingPaths.has(f.storagePath));
        return newFiles.length > 0 ? [...prev, ...newFiles] : prev;
      });
    }

    loadExisting();
  }, [workspace.workspace_id, supabase.storage]);

  // ── Upload a single file to Storage ──

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile> => {
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${workspace.workspace_id}/setup-docs/${safeName}`;

      const entry: UploadedFile = {
        id,
        name: file.name,
        size: file.size,
        storagePath,
        status: "uploading",
      };

      setFiles((prev) => [...prev, entry]);

      const { error } = await supabase.storage
        .from("setup-documents")
        .upload(storagePath, file, { upsert: true });

      if (error) {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error" as const } : f)));
        return { ...entry, status: "error" };
      }

      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "uploaded" as const } : f)),
      );
      return { ...entry, status: "uploaded" };
    },
    [workspace.workspace_id, supabase.storage],
  );

  // ── Handle file selection ──

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);

      // Validate
      const valid: File[] = [];
      for (const file of incoming) {
        if (!isAcceptedFile(file)) {
          toast.error(`${file.name}: filtype ikke støttet`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name}: filen er over 10 MB`);
          continue;
        }
        valid.push(file);
      }

      if (files.length + valid.length > MAX_FILES) {
        toast.error(`Maks ${MAX_FILES} filer tillatt`);
        return;
      }

      // Reset analysis state when new files are added
      setAnalysisComplete(false);
      setExtractionResult(null);

      await Promise.all(valid.map(uploadFile));
    },
    [files.length, uploadFile],
  );

  // ── Remove file ──

  const handleRemove = useCallback(
    async (file: UploadedFile) => {
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (file.status === "uploaded" || file.status === "analyzed") {
        await supabase.storage.from("setup-documents").remove([file.storagePath]);
      }
      // Reset analysis if removing a file
      setAnalysisComplete(false);
      setExtractionResult(null);
    },
    [supabase.storage],
  );

  // ── Drag events ──

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  // ── Analyze documents ──

  const handleAnalyze = useCallback(async () => {
    const uploadedPaths = files
      .filter((f) => f.status === "uploaded" || f.status === "analyzed")
      .map((f) => f.storagePath);

    if (uploadedPaths.length === 0) {
      toast.error("Ingen filer å analysere");
      return;
    }

    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-setup-documents", {
        body: {
          workspace_id: workspace.workspace_id,
          storage_paths: uploadedPaths,
        },
      });

      if (error) throw error;

      // Edge function returns { result, files, errorCode? } — always 200
      const response = data as {
        result: DocumentExtractionResult;
        files: Array<{
          storagePath: string;
          fileName: string;
          status: "analyzed" | "failed";
          error?: string;
          characters?: number;
        }>;
        error?: string;
        errorCode?: string;
      };

      // Handle structured errors from Edge Function
      if (response.errorCode) {
        const errorMessages: Record<string, string> = {
          STORAGE_DOWNLOAD_FAILED: "Filene kunne ikke lastes ned. Last opp på nytt og prøv igjen.",
          SCRAPLING_AUTH_FAILED: "Dokumenttjenesten avviste forespørselen. Kontakt support.",
          SCRAPLING_EXTRACTION_FAILED:
            "Dokumenttjenesten er utilgjengelig. Prøv igjen om noen minutter.",
          AI_ANALYSIS_FAILED: "AI-analysen feilet. Prøv igjen.",
        };
        toast.error(errorMessages[response.errorCode] ?? response.error ?? "Analyse feilet");
        setIsAnalyzing(false);
        return;
      }

      const result = response.result ?? {};
      const fileStatuses = response.files ?? [];

      onExtractionComplete(result);
      setExtractionResult(result);
      setAnalysisComplete(true);

      // Mark files based on per-file extraction status from edge function
      setFiles((prev) =>
        prev.map((f) => {
          if (f.status !== "uploaded") return f;
          const match = fileStatuses.find((fs) => fs.storagePath === f.storagePath);
          if (match?.status === "analyzed") return { ...f, status: "analyzed" as const };
          if (match?.status === "failed") return { ...f, status: "error" as const };
          // No match = not sent or unknown — keep as uploaded
          return f;
        }),
      );

      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "setup-documents-analyzed",
          context: `${uploadedPaths.length} files`,
        },
      });

      const hasData = !!(
        result.policies?.length ||
        result.employees?.length ||
        result.shiftPatterns?.length ||
        result.payroll ||
        result.employmentTerms ||
        result.handbookSections?.length
      );

      const failedFiles = fileStatuses.filter((fs) => fs.status === "failed");
      if (failedFiles.length > 0) {
        toast.warning(
          `${failedFiles.length} fil(er) kunne ikke analyseres: ${failedFiles.map((f) => f.fileName).join(", ")}`,
        );
      }

      if (hasData) {
        const analyzedCount = fileStatuses.filter((fs) => fs.status === "analyzed").length;
        toast.success(`${analyzedCount} dokument(er) analysert — data funnet!`);
      } else {
        toast.warning("Analysert, men ingen relevant driftsdata funnet.");
      }
      setShowSummary(true);
    } catch {
      toast.error("Kunne ikke analysere dokumentene. Prøv igjen.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [files, workspace.workspace_id, profileId, supabase.functions, onExtractionComplete]);

  // ── Render ──

  const readyCount = files.filter((f) => f.status === "uploaded").length;
  const analyzedCount = files.filter((f) => f.status === "analyzed").length;
  const hasUnanalyzed = readyCount > 0;

  return (
    <div className="space-y-4">
      {/* Extraction summary dialog */}
      {showSummary && extractionResult && (
        <ExtractionSummary
          result={extractionResult}
          onClose={() => setShowSummary(false)}
          onUpdate={(updated) => {
            setExtractionResult(updated);
            onExtractionComplete(updated);
          }}
        />
      )}

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
          isDragging
            ? "border-brand-orange bg-brand-orange"
            : "border-border bg-muted hover:border-muted-foreground"
        }`}
      >
        <Upload
          className={`mb-3 h-8 w-8 ${isDragging ? "text-brand-orange" : "text-muted-foreground"}`}
        />
        <p className={`text-sm font-medium ${"text-muted-foreground"}`}>
          Dra og slipp dokumenter her, eller klikk for å velge
        </p>
        <p className={`mt-1 text-xs ${"text-muted-foreground"}`}>
          PDF, DOCX, XLSX, CSV, bilder, TXT &middot; Maks {MAX_FILES} filer,{" "}
          {MAX_FILE_SIZE / (1024 * 1024)} MB per fil
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${"bg-muted"}`}
            >
              {file.status === "uploading" && (
                <Loader2 className="text-brand-orange h-4 w-4 shrink-0 animate-spin" />
              )}
              {file.status === "uploaded" && <FileText className="text-success h-4 w-4 shrink-0" />}
              {file.status === "analyzed" && (
                <Sparkles className="text-brand-orange h-4 w-4 shrink-0" />
              )}
              {file.status === "error" && (
                <AlertCircle className="text-destructive h-4 w-4 shrink-0" />
              )}

              <span className={`min-w-0 flex-1 truncate text-sm ${"text-muted-foreground"}`}>
                {file.name}
              </span>

              {file.status === "analyzed" && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${"bg-brand-orange text-brand-orange"}`}
                >
                  Analysert
                </span>
              )}

              <span className={`shrink-0 text-xs ${"text-muted-foreground"}`}>
                {formatSize(file.size)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRemove(file);
                }}
                className={`shrink-0 rounded p-1 transition-colors ${"text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Analyze button */}
      {readyCount + analyzedCount > 0 && !isAnalyzing && (
        <button
          type="button"
          onClick={handleAnalyze}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            hasUnanalyzed
              ? "bg-brand-orange hover:bg-brand-orange/90 text-white"
              : "bg-muted-foreground text-muted hover:bg-muted-foreground/80"
          }`}
        >
          {hasUnanalyzed
            ? `Analyser ${readyCount + analyzedCount} ${readyCount + analyzedCount === 1 ? "fil" : "filer"}`
            : `Analyser på nytt (${analyzedCount} ${analyzedCount === 1 ? "fil" : "filer"})`}
        </button>
      )}

      {/* Analyzing spinner */}
      {isAnalyzing && (
        <div className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white opacity-70">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyserer...
        </div>
      )}

      {/* Analysis complete banner */}
      {analysisComplete &&
        !isAnalyzing &&
        extractionResult &&
        (() => {
          const hasData = !!(
            extractionResult.policies?.length ||
            extractionResult.employees?.length ||
            extractionResult.shiftPatterns?.length ||
            extractionResult.payroll ||
            extractionResult.employmentTerms ||
            extractionResult.handbookSections?.length
          );
          return (
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                hasData ? "border-success bg-success" : "border-warning bg-warning"
              }`}
            >
              <div className="flex items-center gap-3">
                {hasData ? (
                  <CheckCircle2 className="text-success h-5 w-5 shrink-0" />
                ) : (
                  <AlertCircle className={`h-5 w-5 shrink-0 ${"text-warning"}`} />
                )}
                <p className={`text-sm font-medium ${hasData ? "text-success" : "text-warning"}`}>
                  {hasData
                    ? "Dokumentene er analysert. Dataene er fylt inn i de neste stegene."
                    : "Analysert, men ingen relevant driftsdata funnet. Prøv andre dokumenter."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSummary(true)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  hasData
                    ? "bg-success text-success hover:bg-success/30"
                    : "bg-warning text-warning hover:bg-amber-200"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Se resultater
              </button>
            </div>
          );
        })()}

      {/* Skip hint */}
      <p className={`text-center text-xs ${"text-muted-foreground"}`}>
        Dette steget er valgfritt. Klikk &laquo;Neste&raquo; for å hoppe over.
      </p>
    </div>
  );
}
