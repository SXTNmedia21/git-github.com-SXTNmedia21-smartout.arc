"use client";

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mapContentSchema, type MapContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = {
  content: MapContent;
  onChange: (content: MapContent) => void;
  websiteId: string;
};

export default function MapEditor({ content, onChange }: Props) {
  const form = useForm<MapContent>({
    resolver: zodResolver(mapContentSchema) as Resolver<MapContent>,
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
        <div>
          <Label>Breddegrad (latitude)</Label>
          <Input
            type="number"
            step="any"
            {...form.register("latitude", { valueAsNumber: true })}
            placeholder="59.9139"
          />
        </div>
        <div>
          <Label>Lengdegrad (longitude)</Label>
          <Input
            type="number"
            step="any"
            {...form.register("longitude", { valueAsNumber: true })}
            placeholder="10.7522"
          />
        </div>
        <div>
          <Label>Zoom-nivå (1–20)</Label>
          <Input
            type="number"
            min={1}
            max={20}
            {...form.register("zoom", { valueAsNumber: true })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium">Vis veibeskrivelse-link</span>
          <Controller
            control={form.control}
            name="showDirectionsLink"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </div>
    </form>
  );
}
