"use client";

import { useEffect } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { galleryContentSchema, type GalleryContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
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
  content: GalleryContent;
  onChange: (content: GalleryContent) => void;
  websiteId: string;
};

export default function GalleryEditor({ content, onChange, websiteId }: Props) {
  const form = useForm<GalleryContent>({
    resolver: zodResolver(galleryContentSchema) as Resolver<GalleryContent>,
    defaultValues: content,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "images",
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
              form.setValue("layout", v as "grid" | "masonry" | "carousel", {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">Rutenett</SelectItem>
              <SelectItem value="masonry">Masonry</SelectItem>
              <SelectItem value="carousel">Karusell</SelectItem>
            </SelectContent>
          </Select>
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
        <Label>Bilder</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="border-border space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <GripVertical className="text-muted-foreground h-4 w-4 shrink-0 cursor-grab" />
              <span className="text-muted-foreground text-sm font-medium">Bilde {index + 1}</span>
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
            <ImageUpload
              assetId={form.watch(`images.${index}.assetId`)}
              onAssetChange={(id) =>
                form.setValue(`images.${index}.assetId`, id ?? "", { shouldDirty: true })
              }
              websiteId={websiteId}
            />
            <div>
              <Label>Bildetekst</Label>
              <Input
                {...form.register(`images.${index}.caption`)}
                placeholder="Valgfri bildetekst..."
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ assetId: crypto.randomUUID(), caption: "" })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Legg til bilde
        </Button>
      </div>
    </form>
  );
}
