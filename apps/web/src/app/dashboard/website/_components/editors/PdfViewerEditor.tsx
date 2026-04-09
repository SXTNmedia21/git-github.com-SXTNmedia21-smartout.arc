"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pdfViewerContentSchema, type PdfViewerContent, LIMITS } from "@smartout/website";
import { FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { uploadWebsiteAsset } from "../../_actions/asset-actions";

type Props = {
  content: PdfViewerContent;
  onChange: (content: PdfViewerContent) => void;
  websiteId: string;
};

export default function PdfViewerEditor({ content, onChange, websiteId }: Props) {
  const form = useForm<PdfViewerContent>({
    resolver: zodResolver(pdfViewerContentSchema) as Resolver<PdfViewerContent>,
    defaultValues: content,
  });

  const values = form.watch();
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > LIMITS.maxPdfUploadBytes) {
      toast.error(`Filen er for stor. Maks ${LIMITS.maxPdfUploadBytes / 1024 / 1024} MB.`);
      return;
    }

    if (file.type !== "application/pdf") {
      toast.error("Kun PDF-filer er tillatt.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("altText", "PDF document");

      const result = await uploadWebsiteAsset(websiteId, formData);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      form.setValue("pdfAssetId", result.assetId);
      toast.success("PDF lastet opp");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Opplasting feilet");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const currentAssetId = form.watch("pdfAssetId");

  return (
    <form className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Overskrift</Label>
          <Input {...form.register("heading")} />
        </div>
        <div className="col-span-2">
          <Label>PDF-fil</Label>
          {currentAssetId ? (
            <div className="mt-1 flex items-center gap-2 rounded-lg border p-3">
              <FileUp className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="flex-1 truncate font-mono text-sm">{currentAssetId}</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileRef.current?.click()}
                  className="hover:bg-accent inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Bytt"}
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("pdfAssetId", undefined)}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex items-center rounded-md border px-2 py-1 text-xs transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileRef.current?.click()}
              className="text-muted-foreground hover:text-foreground mt-1 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed py-6 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Laster opp...</span>
                </>
              ) : (
                <>
                  <FileUp className="h-6 w-6" />
                  <span className="text-sm">Last opp PDF</span>
                  <span className="text-xs">Maks {LIMITS.maxPdfUploadBytes / 1024 / 1024} MB</span>
                </>
              )}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handlePdfUpload}
          />
        </div>
        <div>
          <Label>Nedlastingsknapp — tekst</Label>
          <Input {...form.register("downloadButtonText")} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">Vis nedlastingsknapp</span>
          <Controller
            control={form.control}
            name="showDownloadButton"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </div>
    </form>
  );
}
