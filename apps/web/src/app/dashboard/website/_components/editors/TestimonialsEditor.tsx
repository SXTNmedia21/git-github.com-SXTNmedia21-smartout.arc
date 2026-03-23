"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { testimonialsContentSchema, type TestimonialsContent } from "@smartout/website";
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
import ImageUpload from "../ImageUpload";

type Props = {
  content: TestimonialsContent;
  onChange: (content: TestimonialsContent) => void;
  websiteId: string;
};

export default function TestimonialsEditor({ content, onChange, websiteId }: Props) {
  const form = useForm<TestimonialsContent>({
    resolver: zodResolver(testimonialsContentSchema) as Resolver<TestimonialsContent>,
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
        <div>
          <Label>Layout</Label>
          <Select
            value={form.watch("layout")}
            onValueChange={(v) =>
              form.setValue("layout", v as "cards" | "carousel" | "list", {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cards">Kort</SelectItem>
              <SelectItem value="carousel">Karusell</SelectItem>
              <SelectItem value="list">Liste</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Anmeldelser</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="border-border space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <GripVertical className="text-muted-foreground h-4 w-4 shrink-0 cursor-grab" />
              <span className="text-muted-foreground text-sm font-medium">
                Anmeldelse {index + 1}
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
              <div className="col-span-2">
                <Label>Sitat</Label>
                <Textarea {...form.register(`items.${index}.quote`)} rows={3} />
              </div>
              <div>
                <Label>Navn</Label>
                <Input {...form.register(`items.${index}.author`)} />
              </div>
              <div>
                <Label>Rolle / Tittel</Label>
                <Input {...form.register(`items.${index}.role`)} />
              </div>
              <div>
                <Label>Vurdering (1–5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  {...form.register(`items.${index}.rating`, { valueAsNumber: true })}
                />
              </div>
              <div className="col-span-2">
                <Label>Bilde</Label>
                <ImageUpload
                  assetId={form.watch(`items.${index}.imageAssetId`)}
                  onAssetChange={(id) =>
                    form.setValue(`items.${index}.imageAssetId`, id, { shouldDirty: true })
                  }
                  websiteId={websiteId}
                />
              </div>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({ quote: "", author: "", role: "", rating: undefined, imageAssetId: undefined })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Legg til anmeldelse
        </Button>
      </div>
    </form>
  );
}
