"use client";

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { menuFullContentSchema, type MenuFullContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";

type Props = {
  content: MenuFullContent;
  onChange: (content: MenuFullContent) => void;
  websiteId: string;
};

const displayToggles: { name: keyof MenuFullContent; label: string }[] = [
  { name: "showPrices", label: "Vis priser" },
  { name: "showDescriptions", label: "Vis beskrivelser" },
  { name: "showAllergens", label: "Vis allergener" },
  { name: "showDietaryTags", label: "Vis kostholdsmerker" },
  { name: "showImages", label: "Vis bilder" },
];

export default function MenuFullEditor({ content, onChange }: Props) {
  const form = useForm<MenuFullContent>({
    resolver: zodResolver(menuFullContentSchema) as Resolver<MenuFullContent>,
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
        <div>
          <Label>Layout</Label>
          <Select
            value={form.watch("layout")}
            onValueChange={(v) =>
              form.setValue("layout", v as "list" | "cards", { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">Liste</SelectItem>
              <SelectItem value="cards">Kort</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Vis innhold</Label>
        {displayToggles.map(({ name, label }) => (
          <div key={name} className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">{label}</span>
            <Controller
              control={form.control}
              name={name}
              render={({ field }) => (
                <Switch checked={field.value as boolean} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        ))}
      </div>
    </form>
  );
}
