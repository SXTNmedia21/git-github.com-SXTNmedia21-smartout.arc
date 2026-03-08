"use client";

import { useState, useCallback, useRef, useContext } from "react";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
  status: "uploading" | "uploaded" | "error";
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

// ─── DocumentDropStep ─────────────────────────────────────

export function DocumentDropStep({
  isDark,
  onExtractionComplete,
}: {
  isDark: boolean;
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

  // ── Upload a single file to Storage ──

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile> => {
      const id = crypto.randomUUID();
      const ext = file.name.split(".").pop() ?? "bin";
      const storagePath = `${workspace.workspace_id}/setup-docs/${id}.${ext}`;

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
        .upload(storagePath, file, { upsert: false });

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

      await Promise.all(valid.map(uploadFile));
    },
    [files.length, uploadFile],
  );

  // ── Remove file ──

  const handleRemove = useCallback(
    async (file: UploadedFile) => {
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (file.status === "uploaded") {
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

  // ── Analyze documents ──

  const handleAnalyze = useCallback(async () => {
    const uploadedPaths = files.filter((f) => f.status === "uploaded").map((f) => f.storagePath);

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

      const result = data as DocumentExtractionResult;
      onExtractionComplete(result);
      setAnalysisComplete(true);

      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "setup-documents-analyzed",
          context: `${uploadedPaths.length} files`,
        },
      });

      toast.success("Dokumentene er analysert");
    } catch {
      toast.error("Kunne ikke analysere dokumentene. Prøv igjen.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [files, workspace.workspace_id, profileId, supabase.functions, onExtractionComplete]);

  // ── Render ──

  const uploadedCount = files.filter((f) => f.status === "uploaded").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
          isDragging
            ? isDark
              ? "border-orange-500 bg-orange-950/20"
              : "border-orange-400 bg-orange-50"
            : isDark
              ? "border-zinc-700 bg-zinc-900/30 hover:border-zinc-600"
              : "border-zinc-300 bg-zinc-50/50 hover:border-zinc-400"
        }`}
      >
        <Upload
          className={`mb-3 h-8 w-8 ${
            isDragging ? "text-orange-500" : isDark ? "text-zinc-600" : "text-zinc-400"
          }`}
        />
        <p className={`text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
          Dra og slipp dokumenter her, eller klikk for å velge
        </p>
        <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
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
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                isDark ? "bg-zinc-900/40" : "bg-zinc-50"
              }`}
            >
              {file.status === "uploading" && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-500" />
              )}
              {file.status === "uploaded" && (
                <FileText className="h-4 w-4 shrink-0 text-emerald-500" />
              )}
              {file.status === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}

              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  isDark ? "text-zinc-300" : "text-zinc-700"
                }`}
              >
                {file.name}
              </span>
              <span className={`shrink-0 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                {formatSize(file.size)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRemove(file);
                }}
                className={`shrink-0 rounded p-1 transition-colors ${
                  isDark
                    ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                }`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Analyze button */}
      {uploadedCount > 0 && !analysisComplete && (
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            isAnalyzing
              ? "cursor-not-allowed opacity-50"
              : "bg-orange-500 text-white hover:bg-orange-600"
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyserer {uploadedCount} {uploadedCount === 1 ? "fil" : "filer"}...
            </>
          ) : (
            `Analyser ${uploadedCount} ${uploadedCount === 1 ? "fil" : "filer"}`
          )}
        </button>
      )}

      {/* Analysis complete */}
      {analysisComplete && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            isDark ? "border-emerald-900 bg-emerald-950/30" : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <p className={`text-sm font-medium ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
            Dokumentene er analysert. Dataene er fylt inn i de neste stegene.
          </p>
        </div>
      )}

      {/* Skip hint */}
      <p className={`text-center text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
        Dette steget er valgfritt. Klikk &laquo;Neste&raquo; for å hoppe over.
      </p>
    </div>
  );
}
