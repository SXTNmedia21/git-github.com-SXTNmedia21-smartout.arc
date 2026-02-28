"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TemplateAttachment } from "@/app/platform-admin/contracts/templates/[id]/edit/save-action";

type AttachmentsPanelProps = {
  attachments: TemplateAttachment[];
  onUpload: (file: File) => Promise<void>;
  onRemove: (attachment: TemplateAttachment) => Promise<void>;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsPanel({ attachments, onUpload, onRemove }: AttachmentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Kun PDF-filer er tillatt");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Filen er for stor (maks 10 MB)");
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved opplasting");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove(attachment: TemplateAttachment) {
    setRemovingId(attachment.id);
    try {
      await onRemove(attachment);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Feil ved sletting");
    } finally {
      setRemovingId(null);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Vedlegg</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">PDF-filer som sendes med kontrakten</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
          >
            {isUploading ? (
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            ) : (
              <Upload className="text-muted-foreground h-6 w-6" />
            )}
            <p className="text-muted-foreground mt-2 text-xs">
              {isUploading ? "Laster opp..." : "Slipp PDF her eller klikk for a laste opp"}
            </p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">Maks 10 MB per fil</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Attachment list */}
          {attachments.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-xs">
              Ingen vedlegg lagt til enda.
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="bg-muted/50 flex items-center gap-3 rounded-md border p-3"
                >
                  <FileText className="text-muted-foreground h-8 w-8 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{att.file_name}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {formatFileSize(att.file_size)} ·{" "}
                      {new Date(att.uploaded_at).toLocaleDateString("nb-NO")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-7 w-7 shrink-0 p-0"
                    onClick={() => handleRemove(att)}
                    disabled={removingId === att.id}
                    title="Fjern vedlegg"
                  >
                    {removingId === att.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
