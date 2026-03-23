"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { textImageContentSchema, type TextImageContent } from "@smartout/website";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ImageUpload from "../ImageUpload";

type Props = {
  content: TextImageContent;
  onChange: (content: TextImageContent) => void;
  websiteId: string;
};

export default function TextImageEditor({ content, onChange, websiteId }: Props) {
  const form = useForm<TextImageContent>({
    resolver: zodResolver(textImageContentSchema) as Resolver<TextImageContent>,
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
          <Label>Brødtekst</Label>
          <Textarea {...form.register("body")} rows={6} />
        </div>
        <div>
          <Label>Bildeposisjon</Label>
          <Select
            value={form.watch("imagePosition")}
            onValueChange={(v) =>
              form.setValue("imagePosition", v as "left" | "right", { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Venstre</SelectItem>
              <SelectItem value="right">Høyre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Bilde-alt-tekst</Label>
          <Input {...form.register("imageAlt")} placeholder="Beskriv bildet..." />
        </div>
        <div>
          <Label>Knappetekst</Label>
          <Input {...form.register("buttonText")} />
        </div>
        <div>
          <Label>Knapp-URL</Label>
          <Input {...form.register("buttonUrl")} />
        </div>
        <div className="col-span-2">
          <Label>Bilde</Label>
          <ImageUpload
            assetId={form.watch("imageAssetId")}
            onAssetChange={(id) => form.setValue("imageAssetId", id, { shouldDirty: true })}
            websiteId={websiteId}
          />
        </div>
      </div>
    </form>
  );
}
