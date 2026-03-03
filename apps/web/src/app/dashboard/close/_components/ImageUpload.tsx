"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUploadSettlementImage } from "../_hooks/useCloseOut";

type SettlementSourceType = "pos" | "terminal" | "z_report" | "cash_count" | "other";

type UploadedImage = {
  id: string;
  sourceType: SettlementSourceType;
  fileName: string;
  status: "uploading" | "processing" | "done" | "error";
  confidence?: number;
  error?: string;
};

type ImageUploadProps = {
  reconciliationId: string;
  profileId: string;
  onImagesReady: (ready: boolean) => void;
};

const SOURCE_LABELS: Record<SettlementSourceType, string> = {
  pos: "POS-rapport",
  terminal: "Terminal-oppgjør",
  z_report: "Z-rapport",
  cash_count: "Kontanttelling",
  other: "Annet",
};

export function ImageUpload({ reconciliationId, profileId, onImagesReady }: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [activeSourceType, setActiveSourceType] = useState<SettlementSourceType>("pos");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadSettlementImage();

  const hasPos = images.some((img) => img.sourceType === "pos" && img.status === "done");
  const hasTerminal = images.some((img) => img.sourceType === "terminal" && img.status === "done");

  const checkReady = useCallback(
    (imgs: UploadedImage[]) => {
      const p = imgs.some((img) => img.sourceType === "pos" && img.status === "done");
      const t = imgs.some((img) => img.sourceType === "terminal" && img.status === "done");
      onImagesReady(p && t);
    },
    [onImagesReady],
  );

  async function handleFileSelect(file: File) {
    const tempId = `temp-${Date.now()}`;
    const newImage: UploadedImage = {
      id: tempId,
      sourceType: activeSourceType,
      fileName: file.name,
      status: "uploading",
    };

    setImages((prev) => {
      const next = [...prev, newImage];
      return next;
    });

    try {
      const result = await uploadMutation.mutateAsync({
        reconciliationId,
        file,
        sourceType: activeSourceType,
        profileId,
      });

      setImages((prev) => {
        const next = prev.map((img) =>
          img.id === tempId ? { ...img, id: result.image_id, status: "done" as const } : img,
        );
        checkReady(next);
        return next;
      });
    } catch (err) {
      setImages((prev) => {
        const next = prev.map((img) =>
          img.id === tempId
            ? {
                ...img,
                status: "error" as const,
                error: err instanceof Error ? err.message : "Opplasting feilet",
              }
            : img,
        );
        checkReady(next);
        return next;
      });
    }
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const next = prev.filter((img) => img.id !== id);
      checkReady(next);
      return next;
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Oppgjørsbilder</CardTitle>
        <p className="text-muted-foreground text-xs">
          Last opp POS-rapport og terminal-oppgjør (minimum 2 bilder)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source type selector */}
        <div className="flex flex-wrap gap-2">
          {(Object.entries(SOURCE_LABELS) as [SettlementSourceType, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveSourceType(key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeSourceType === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {/* Required indicators */}
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            {hasPos ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertCircle className="text-destructive h-4 w-4" />
            )}
            <span className="text-xs">POS-rapport</span>
          </div>
          <div className="flex items-center gap-1.5">
            {hasTerminal ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertCircle className="text-destructive h-4 w-4" />
            )}
            <span className="text-xs">Terminal-oppgjør</span>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-muted-foreground/20 hover:border-muted-foreground/40 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors"
        >
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Velg fil
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.capture = "environment";
                  fileInputRef.current.click();
                }
              }}
            >
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              Ta bilde
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">Dra og slipp, eller velg fil / ta bilde</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
        />

        {/* Uploaded images list */}
        {images.length > 0 && (
          <div className="space-y-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="bg-muted/30 flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{img.fileName}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {SOURCE_LABELS[img.sourceType]}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {img.status === "uploading" && (
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                  )}
                  {img.status === "processing" && (
                    <Loader2 className="text-primary h-4 w-4 animate-spin" />
                  )}
                  {img.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {img.status === "error" && <AlertCircle className="text-destructive h-4 w-4" />}
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="hover:bg-muted rounded p-1"
                  >
                    <X className="text-muted-foreground h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
