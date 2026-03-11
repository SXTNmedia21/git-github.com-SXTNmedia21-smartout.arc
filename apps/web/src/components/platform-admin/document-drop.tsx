"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Config ───────────────────────────────────────────────────────
const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (matches bucket policy)
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".jpg", ".jpeg", ".png", ".webp"];

// ── Types ────────────────────────────────────────────────────────
export type UploadedFile = {
  id: string;
  name: string;
  size: number;
  storagePath: string;
  status: "uploading" | "uploaded" | "analyzed" | "error";
};

export type ExtractionResult = Record<string, unknown>;

type DocumentDropProps = {
  /** Supabase storage bucket name */
  bucket: string;
  /** Storage path prefix (e.g. "{workspace_id}") */
  pathPrefix: string;
  /** Workspace ID (for analysis API) */
  workspaceId?: string;
  /** Existing files to show on mount */
  existingFiles?: Array<{ name: string; size?: number; createdAt: string }>;
  /** Called when files change (upload or remove) */
  onFilesChange?: (files: UploadedFile[]) => void;
  /** Called when analysis completes */
  onAnalysisComplete?: (result: ExtractionResult) => void;
  /** Enable the analyze button */
  enableAnalysis?: boolean;
  /** Max number of files */
  maxFiles?: number;
  /** Max file size in bytes */
  maxFileSize?: number;
};

// ── Helpers ──────────────────────────────────────────────────────
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

// ── Extraction Result Viewer ─────────────────────────────────────
function ExtractionResultViewer({
  result,
  onClose,
}: {
  result: ExtractionResult;
  onClose: () => void;
}) {
  const sections = Object.entries(result).filter(
    ([, v]) => v && (Array.isArray(v) ? v.length > 0 : typeof v === "object"),
  );

  const sectionLabels: Record<string, string> = {
    policies: "Policies / Guidelines",
    employees: "Employees",
    shiftPatterns: "Shift Patterns",
    payroll: "Payroll / Tariff",
    employmentTerms: "Employment Terms",
    handbookSections: "Handbook Sections",
  };

  return (
    <div className="border-border bg-card space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <span className="text-sm font-semibold">Extraction Results</span>
          <Badge variant="secondary" className="text-xs">
            {sections.length} categories
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {sections.length === 0 ? (
        <p className="text-muted-foreground text-sm">No structured data found in the documents.</p>
      ) : (
        <div className="space-y-3">
          {sections.map(([key, value]) => (
            <div key={key} className="space-y-1">
              <p className="text-xs font-semibold">
                {sectionLabels[key] ?? key}
                {Array.isArray(value) && (
                  <span className="text-muted-foreground ml-1 font-normal">
                    ({value.length} items)
                  </span>
                )}
              </p>
              <pre className="bg-muted max-h-40 overflow-auto rounded p-2 text-xs">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────
export function DocumentDrop({
  bucket,
  pathPrefix,
  workspaceId,
  existingFiles,
  onFilesChange,
  onAnalysisComplete,
  enableAnalysis = false,
  maxFiles = MAX_FILES,
  maxFileSize = MAX_FILE_SIZE,
}: DocumentDropProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Seed with existing files from server
  const [files, setFiles] = useState<UploadedFile[]>(() =>
    (existingFiles ?? []).map((f) => ({
      id: f.name,
      name: f.name,
      size: f.size ?? 0,
      storagePath: `${pathPrefix}/${f.name}`,
      status: "uploaded" as const,
    })),
  );

  const updateFiles = useCallback((updater: (prev: UploadedFile[]) => UploadedFile[]) => {
    setFiles((prev) => {
      const next = updater(prev);
      onFilesChange?.(next);
      return next;
    });
  }, [onFilesChange]);

  // ── Upload ─────────────────────────────────────────────────
  const uploadFile = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${pathPrefix}/${safeName}`;

      const entry: UploadedFile = {
        id,
        name: file.name,
        size: file.size,
        storagePath,
        status: "uploading",
      };
      updateFiles((prev) => [...prev, entry]);

      const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, { upsert: true });

      if (error) {
        updateFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "error" as const } : f)),
        );
        toast.error(`Failed to upload ${file.name}`);
        return;
      }

      updateFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "uploaded" as const } : f)),
      );
    },
    [pathPrefix, bucket, supabase.storage, updateFiles],
  );

  // ── Handle files ───────────────────────────────────────────
  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const valid: File[] = [];

      for (const file of incoming) {
        if (!isAcceptedFile(file)) {
          toast.error(`${file.name}: file type not supported`);
          continue;
        }
        if (file.size > maxFileSize) {
          toast.error(`${file.name}: file exceeds ${maxFileSize / (1024 * 1024)} MB`);
          continue;
        }
        valid.push(file);
      }

      if (files.length + valid.length > maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Reset analysis state when new files added
      setExtractionResult(null);
      setShowResults(false);

      await Promise.all(valid.map(uploadFile));
    },
    [files.length, maxFiles, maxFileSize, uploadFile],
  );

  // ── Remove ─────────────────────────────────────────────────
  const handleRemove = useCallback(
    async (file: UploadedFile) => {
      updateFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (file.status === "uploaded" || file.status === "analyzed") {
        await supabase.storage.from(bucket).remove([file.storagePath]);
      }
      setExtractionResult(null);
      setShowResults(false);
    },
    [bucket, supabase.storage, updateFiles],
  );

  // ── Analyze ────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!workspaceId) return;

    const uploadedPaths = files
      .filter((f) => f.status === "uploaded" || f.status === "analyzed")
      .map((f) => f.storagePath);

    if (uploadedPaths.length === 0) {
      toast.error("No files to analyze");
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/platform-admin/workspaces/analyze-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          storagePaths: uploadedPaths,
          bucket,
        }),
      });

      const data = (await res.json()) as {
        result?: ExtractionResult;
        files?: Array<{
          storagePath: string;
          status: "analyzed" | "failed";
        }>;
        error?: string;
      };

      if (!res.ok) {
        toast.error(data.error ?? "Analysis failed");
        return;
      }

      const result = data.result ?? {};
      setExtractionResult(result);
      onAnalysisComplete?.(result);

      // Update file statuses based on response
      const fileStatuses = data.files ?? [];
      updateFiles((prev) =>
        prev.map((f) => {
          const match = fileStatuses.find((fs) => fs.storagePath === f.storagePath);
          if (match?.status === "analyzed") return { ...f, status: "analyzed" as const };
          if (match?.status === "failed") return { ...f, status: "error" as const };
          return f;
        }),
      );

      const hasData = Object.values(result).some(
        (v) => v && (Array.isArray(v) ? v.length > 0 : typeof v === "object"),
      );

      const failedCount = fileStatuses.filter((fs) => fs.status === "failed").length;
      if (failedCount > 0) {
        toast.warning(`${failedCount} file(s) could not be analyzed`);
      }

      if (hasData) {
        toast.success("Documents analyzed — data extracted!");
        setShowResults(true);
      } else {
        toast.warning("Analyzed, but no structured data found.");
        setShowResults(true);
      }
    } catch {
      toast.error("Failed to analyze documents");
    } finally {
      setIsAnalyzing(false);
    }
  }, [files, workspaceId, bucket, onAnalysisComplete, updateFiles]);

  // ── Drag events ────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  // ── Computed ───────────────────────────────────────────────
  const uploadedCount = files.filter(
    (f) => f.status === "uploaded" || f.status === "analyzed",
  ).length;
  const hasUnanalyzed = files.some((f) => f.status === "uploaded");

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30 hover:border-muted-foreground/40"
        }`}
      >
        <Upload
          className={`mb-2 h-6 w-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`}
        />
        <p className="text-muted-foreground text-sm font-medium">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          PDF, DOCX, XLSX, images &middot; Max {maxFiles} files, {maxFileSize / (1024 * 1024)} MB
          each
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
        <div className="space-y-1">
          {files.map((file) => (
            <div key={file.id} className="bg-muted/40 flex items-center gap-3 rounded-md px-3 py-2">
              {file.status === "uploading" && (
                <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
              )}
              {file.status === "uploaded" && (
                <FileText className="h-4 w-4 shrink-0 text-emerald-500" />
              )}
              {file.status === "analyzed" && <Sparkles className="text-primary h-4 w-4 shrink-0" />}
              {file.status === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}

              <span className="text-foreground min-w-0 flex-1 truncate text-sm">{file.name}</span>

              {file.status === "analyzed" && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Analyzed
                </Badge>
              )}

              <span className="text-muted-foreground shrink-0 text-xs">
                {formatSize(file.size)}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRemove(file);
                }}
                className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded p-1 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Analyze button */}
      {enableAnalysis && uploadedCount > 0 && !isAnalyzing && (
        <Button
          onClick={handleAnalyze}
          className="w-full gap-2"
          variant={hasUnanalyzed ? "default" : "secondary"}
        >
          <Sparkles className="h-4 w-4" />
          {hasUnanalyzed
            ? `Extract & Analyze ${uploadedCount} ${uploadedCount === 1 ? "file" : "files"}`
            : `Re-analyze ${uploadedCount} ${uploadedCount === 1 ? "file" : "files"}`}
        </Button>
      )}

      {/* Analyzing spinner */}
      {isAnalyzing && (
        <Button disabled className="w-full gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing documents...
        </Button>
      )}

      {/* Analysis complete banner */}
      {extractionResult && !isAnalyzing && !showResults && (
        <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">Analysis complete</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setShowResults(true)}
          >
            <Eye className="h-3.5 w-3.5" /> View Results
          </Button>
        </div>
      )}

      {/* Extraction results viewer */}
      {showResults && extractionResult && (
        <ExtractionResultViewer result={extractionResult} onClose={() => setShowResults(false)} />
      )}
    </div>
  );
}
