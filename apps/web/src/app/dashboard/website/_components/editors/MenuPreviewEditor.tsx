"use client";

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuPreviewContentSchema, type MenuPreviewContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";

type Props = {
  content: MenuPreviewContent;
  onChange: (content: MenuPreviewContent) => void;
  websiteId: string;
};

export default function MenuPreviewEditor({ content, onChange }: Props) {
  const form = useForm<MenuPreviewContent>({
    resolver: zodResolver(menuPreviewContentSchema) as Resolver<MenuPreviewContent>,
    defaultValues: content,
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
  }, [JSON.stringify(values)]);

  return (
    <form className="space-y-6 p-6">
      {/* System bridge info banner */}
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-400">
        <Info className="h-4 w-4 shrink-0" />
        Denne seksjonen kobles til Smartout-data i en fremtidig oppdatering
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Overskrift</Label>
          <Input {...form.register("heading")} />
        </div>
        <div className="col-span-2">
          <Label>Introduksjonstekst</Label>
          <Textarea {...form.register("body")} rows={3} />
        </div>
        <div>
          <Label>Maks antall retter per meny</Label>
          <Input
            type="number"
            min={1}
            max={20}
            {...form.register("maxItemsPerMenu", { valueAsNumber: true })}
          />
        </div>
        <div>
          <Label>Lenketekst til full meny</Label>
          <Input {...form.register("linkText")} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">Vis priser</span>
          <Controller
            control={form.control}
            name="showPrices"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">Lenk til full meny</span>
          <Controller
            control={form.control}
            name="linkToFullMenu"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </div>
    </form>
  );
}
