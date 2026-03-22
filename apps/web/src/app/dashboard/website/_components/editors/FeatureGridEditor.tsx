"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { featureGridContentSchema, type FeatureGridContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, GripVertical, Plus } from "lucide-react";

type Props = {
  content: FeatureGridContent;
  onChange: (content: FeatureGridContent) => void;
  websiteId: string;
};

export default function FeatureGridEditor({ content, onChange }: Props) {
  const form = useForm<FeatureGridContent>({
    resolver: zodResolver(featureGridContentSchema) as Resolver<FeatureGridContent>,
    defaultValues: content,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
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
          <Label>Undertittel</Label>
          <Input {...form.register("subheading")} />
        </div>
        <div>
          <Label>Kolonner</Label>
          <Select
            value={form.watch("columns")}
            onValueChange={(v) =>
              form.setValue("columns", v as "2" | "3" | "4", { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 kolonner</SelectItem>
              <SelectItem value="3">3 kolonner</SelectItem>
              <SelectItem value="4">4 kolonner</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Funksjoner</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="border-border space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              {/* Drag handle placeholder — dnd comes in B2 */}
              <GripVertical className="text-muted-foreground h-4 w-4 shrink-0 cursor-grab" />
              <span className="text-muted-foreground text-sm font-medium">
                Funksjon {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ikon (navn)</Label>
                <Input {...form.register(`items.${index}.icon`)} placeholder="star" />
              </div>
              <div>
                <Label>Tittel</Label>
                <Input {...form.register(`items.${index}.title`)} />
              </div>
              <div className="col-span-2">
                <Label>Beskrivelse</Label>
                <Textarea {...form.register(`items.${index}.description`)} rows={2} />
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ icon: "", title: "", description: "" })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Legg til funksjon
        </Button>
      </div>
    </form>
  );
}
