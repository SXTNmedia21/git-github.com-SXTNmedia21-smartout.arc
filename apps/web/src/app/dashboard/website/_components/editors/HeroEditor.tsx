"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { heroContentSchema, type HeroContent } from "@smartout/website";
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
  content: HeroContent;
  onChange: (content: HeroContent) => void;
  websiteId: string;
};

export default function HeroEditor({ content, onChange, websiteId }: Props) {
  const form = useForm<HeroContent>({
    resolver: zodResolver(heroContentSchema) as Resolver<HeroContent>,
    defaultValues: content,
  });

  const values = form.watch();

  useEffect(() => {
    onChange(values);
    // Propagate every form change to parent — onChange is stable from SectionForm
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
          <Textarea {...form.register("subheading")} rows={3} />
        </div>
        <div>
          <Label>Knappetekst</Label>
          <Input {...form.register("buttonText")} />
        </div>
        <div>
          <Label>Knapp-URL</Label>
          <Input {...form.register("buttonUrl")} />
        </div>
        <div>
          <Label>Bildeposisjon</Label>
          <Select
            value={form.watch("imagePosition")}
            onValueChange={(v) =>
              form.setValue("imagePosition", v as "right" | "below", {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="right">Høyre</SelectItem>
              <SelectItem value="below">Under</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Justering</Label>
          <Select
            value={form.watch("alignment")}
            onValueChange={(v) =>
              form.setValue("alignment", v as "left" | "center", {
                shouldDirty: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Venstre</SelectItem>
              <SelectItem value="center">Sentrert</SelectItem>
            </SelectContent>
          </Select>
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
