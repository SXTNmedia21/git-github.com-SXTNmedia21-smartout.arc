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
  Users,
  Clock,
  BookOpen,
  DollarSign,
  Briefcase,
  ShieldCheck,
  FileSearch,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { invokeEdgeFunction } from "@/lib/supabase-edge-invoke";
import { emit, nonEmpty } from "@smartout/telemetry";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { DocumentExtractionResult } from "./wizard-state";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useDocumentDropTools } from "./tools/document-drop-tools";
import { useTranslation } from "@smartout/i18n";

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

/** Count how many data items were extracted */
function countExtractions(result: DocumentExtractionResult): number {
  let count = 0;
  if (result.policies?.length) count += result.policies.length;
  if (result.employees?.length) count += result.employees.length;
  if (result.shiftPatterns?.length) count += result.shiftPatterns.length;
  if (result.payroll) count += 1;
  if (result.employmentTerms) count += 1;
  if (result.handbookSections?.length) count += result.handbookSections.length;
  return count;
}

/** Build summary lines from extraction result */
function buildSummaryLines(
  result: DocumentExtractionResult,
): { icon: React.ReactNode; text: string }[] {
  const lines: { icon: React.ReactNode; text: string }[] = [];
  if (result.policies?.length) {
    lines.push({
      icon: <ShieldCheck className="h-4 w-4" />,
      text: `${result.policies.length} retningslinje${result.policies.length !== 1 ? "r" : ""}`,
    });
  }
  if (result.employees?.length) {
    lines.push({
      icon: <Users className="h-4 w-4" />,
      text: `${result.employees.length} ansatt${result.employees.length !== 1 ? "e" : ""}`,
    });
  }
  if (result.shiftPatterns?.length) {
    lines.push({
      icon: <Clock className="h-4 w-4" />,
      text: `${result.shiftPatterns.length} vaktm\u00f8nstre`,
    });
  }
  if (result.payroll) {
    lines.push({ icon: <DollarSign className="h-4 w-4" />, text: "L\u00f8nn og tariff" });
  }
  if (result.employmentTerms) {
    lines.push({ icon: <Briefcase className="h-4 w-4" />, text: "Ansettelsesvilk\u00e5r" });
  }
  if (result.handbookSections?.length) {
    lines.push({
      icon: <BookOpen className="h-4 w-4" />,
      text: `${result.handbookSections.length} h\u00e5ndbokseksjon${result.handbookSections.length !== 1 ? "er" : ""}`,
    });
  }
  return lines;
}

// ─── Document Drawer ─────────────────────────────────────

function DocumentDrawer({
  open,
  onOpenChange,
  files,
  extractionResult,
  onRemoveFile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: UploadedFile[];
  extractionResult: DocumentExtractionResult | null;
  onRemoveFile: (file: UploadedFile) => void;
}) {
  const extractionCount = extractionResult ? countExtractions(extractionResult) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Dokumenter ({files.length})</SheetTitle>
          <SheetDescription>
            {extractionCount > 0
              ? `${extractionCount} dataelementer funnet og fylt inn i de neste stegene.`
              : "Last opp dokumenter for \u00e5 forh\u00e5ndsutfylle de neste stegene."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className="border-border bg-card flex items-start gap-3 rounded-xl border px-4 py-3"
            >
              <div className="mt-0.5 shrink-0">
                {file.status === "uploading" && (
                  <Loader2 className="text-brand-orange h-5 w-5 animate-spin" />
                )}
                {file.status === "uploaded" && (
                  <FileText className="text-muted-foreground h-5 w-5" />
                )}
                {file.status === "analyzed" && <Sparkles className="text-brand-orange h-5 w-5" />}
                {file.status === "error" && <AlertCircle className="text-destructive h-5 w-5" />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">{file.name}</p>
                <p className="text-muted-foreground text-xs">
                  {formatSize(file.size)}
                  {file.status === "analyzed" && " \u2014 analysert"}
                  {file.status === "uploading" && " \u2014 laster opp..."}
                  {file.status === "error" && " \u2014 feilet"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRemoveFile(file)}
                className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-lg p-1.5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {files.length === 0 && (
            <div className="border-border rounded-xl border border-dashed px-4 py-8 text-center">
              <p className="text-muted-foreground text-sm">
                Ingen dokumenter lastet opp enn\u00e5.
              </p>
            </div>
          )}

          {/* Extraction summary inside drawer */}
          {extractionResult && extractionCount > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Funnet data
              </p>
              {buildSummaryLines(extractionResult).map((line) => (
                <div
                  key={line.text}
                  className="text-muted-foreground flex items-center gap-2.5 px-1 text-sm"
                >
                  <span className="text-brand-orange">{line.icon}</span>
                  {line.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
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
  const { t } = useTranslation("dashboard");

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<DocumentExtractionResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // ── Analyze documents ──
  const analyzeDocuments = useCallback(
    async (currentFiles: UploadedFile[]) => {
      const uploadedPaths = currentFiles
        .filter((f) => f.status === "uploaded" || f.status === "analyzed")
        .map((f) => f.storagePath);

      if (uploadedPaths.length === 0) return;

      setIsAnalyzing(true);

      try {
        const { data, error } = await invokeEdgeFunction(supabase, "analyze-setup-documents", {
          body: {
            workspace_id: workspace.workspace_id,
            storage_paths: uploadedPaths,
          },
        });

        if (error) throw error;

        const response = data as {
          result: DocumentExtractionResult;
          files: Array<{
            storagePath: string;
            fileName: string;
            status: "analyzed" | "failed";
            error?: string;
          }>;
          error?: string;
          errorCode?: string;
        };

        if (response.errorCode) {
          const errorMessages: Record<string, string> = {
            STORAGE_DOWNLOAD_FAILED:
              "Filene kunne ikke lastes ned. Last opp p\u00e5 nytt og pr\u00f8v igjen.",
            SCRAPLING_AUTH_FAILED: "Dokumenttjenesten avviste foresp\u00f8rselen. Kontakt support.",
            SCRAPLING_EXTRACTION_FAILED:
              "Dokumenttjenesten er utilgjengelig. Pr\u00f8v igjen om noen minutter.",
            AI_ANALYSIS_FAILED: "AI-analysen feilet. Pr\u00f8v igjen.",
          };
          toast.error(errorMessages[response.errorCode] ?? response.error ?? "Analyse feilet");
          return;
        }

        const result = response.result ?? {};
        const fileStatuses = response.files ?? [];

        onExtractionComplete(result);
        setExtractionResult(result);

        setFiles((prev) =>
          prev.map((f) => {
            if (f.status !== "uploaded") return f;
            const match = fileStatuses.find((fs) => fs.storagePath === f.storagePath);
            if (match?.status === "analyzed") return { ...f, status: "analyzed" as const };
            if (match?.status === "failed") return { ...f, status: "error" as const };
            return f;
          }),
        );

        void emit({
          event: "button clicked",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            trackingId: "setup-documents-analyzed",
            context: `${uploadedPaths.length} files`,
          },
        });

        const failedFiles = fileStatuses.filter((fs) => fs.status === "failed");
        if (failedFiles.length > 0) {
          toast.warning(
            `${failedFiles.length} fil(er) kunne ikke analyseres: ${failedFiles.map((f) => f.fileName).join(", ")}`,
          );
        }

        const hasData = countExtractions(result) > 0;
        if (hasData) {
          const analyzedFileCount = fileStatuses.filter((fs) => fs.status === "analyzed").length;
          toast.success(`${analyzedFileCount} dokument(er) analysert \u2014 data funnet!`);
        } else {
          toast.warning("Analysert, men ingen relevant driftsdata funnet.");
        }
      } catch {
        toast.error("Kunne ikke analysere dokumentene. Pr\u00f8v igjen.");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [workspace.workspace_id, profileId, supabase.functions, onExtractionComplete],
  );

  // ── Handle file selection — upload then analyze immediately ──
  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);

      const valid: File[] = [];
      for (const file of incoming) {
        if (!isAcceptedFile(file)) {
          toast.error(`${file.name}: filtype ikke st\u00f8ttet`);
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

      // Upload all files
      const uploaded = await Promise.all(valid.map(uploadFile));
      const successfulUploads = uploaded.filter((f) => f.status === "uploaded");

      // Analyze immediately after upload
      if (successfulUploads.length > 0) {
        // Get the latest file state including new uploads
        setFiles((prev) => {
          const allFiles = prev;
          void analyzeDocuments(allFiles);
          return prev;
        });
      }
    },
    [files.length, uploadFile, analyzeDocuments],
  );

  // ── Remove file ──
  const handleRemove = useCallback(
    async (file: UploadedFile) => {
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (file.status === "uploaded" || file.status === "analyzed") {
        await supabase.storage.from("setup-documents").remove([file.storagePath]);
      }
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

  // ── Derived ──
  const docCount = files.length;
  const summaryLines = extractionResult ? buildSummaryLines(extractionResult) : [];

  const documentDropTools = useDocumentDropTools(docCount, isAnalyzing, extractionResult);
  useRegisterTools("wizard-setup-document-drop", documentDropTools);

  return (
    <div className="space-y-6">
      {/* Document drawer */}
      <DocumentDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        files={files}
        extractionResult={extractionResult}
        onRemoveFile={handleRemove}
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors ${
          isDragging
            ? "border-brand-orange bg-brand-orange/5"
            : "border-border bg-muted hover:border-muted-foreground"
        }`}
      >
        <Upload
          className={`mb-4 h-10 w-10 ${isDragging ? "text-brand-orange" : "text-muted-foreground"}`}
        />
        <p className="text-foreground text-base font-medium">
          {t("setup.document_drop.drop_here")}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">{t("setup.document_drop.or_click")}</p>
        <p className="text-muted-foreground mt-3 text-xs">
          {t("setup.document_drop.hint", {
            max_files: MAX_FILES,
            max_mb: MAX_FILE_SIZE / (1024 * 1024),
          })}
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

      {/* Document count + drawer trigger */}
      {docCount > 0 && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="border-border bg-card hover:bg-accent flex w-full items-center gap-3 rounded-xl border px-5 py-4 text-left transition-colors"
        >
          <FolderOpen className="text-brand-orange h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-semibold">
              {docCount} dokument{docCount !== 1 ? "er" : ""} lastet opp
            </p>
            {isAnalyzing && (
              <p className="text-brand-orange flex items-center gap-1.5 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyserer...
              </p>
            )}
            {!isAnalyzing && summaryLines.length > 0 && (
              <p className="text-muted-foreground text-sm">
                {summaryLines.map((l) => l.text).join(", ")}
              </p>
            )}
          </div>
          <span className="text-muted-foreground text-sm font-medium">Se dokumenter &rarr;</span>
        </button>
      )}

      {/* Extraction summary cards */}
      {!isAnalyzing && summaryLines.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {summaryLines.map((line) => (
            <div
              key={line.text}
              className="border-border bg-card/50 flex items-center gap-2.5 rounded-xl border px-4 py-3"
            >
              <span className="text-brand-orange shrink-0">{line.icon}</span>
              <span className="text-foreground text-sm font-medium">{line.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Skip hint */}
      <p className="text-muted-foreground text-center text-xs">
        Dette steget er valgfritt. Klikk &laquo;Neste&raquo; for \u00e5 hoppe over.
      </p>
    </div>
  );
}
