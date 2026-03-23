"use client";

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pdfViewerContentSchema, type PdfViewerContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = {
  content: PdfViewerContent;
  onChange: (content: PdfViewerContent) => void;
  websiteId: string;
};

export default function PdfViewerEditor({ content, onChange }: Props) {
  const form = useForm<PdfViewerContent>({
    resolver: zodResolver(pdfViewerContentSchema) as Resolver<PdfViewerContent>,
    defaultValues: content,
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  return (
    <form className="space-y-6 p-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Overskrift</Label>
          <Input {...form.register("heading")} />
        </div>
        <div className="col-span-2">
          <Label>PDF-fil (asset-ID)</Label>
          <Input
            {...form.register("pdfAssetId")}
            placeholder="Last opp PDF via filopplasting (kommer i B2)"
            disabled
            className="text-muted-foreground"
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
