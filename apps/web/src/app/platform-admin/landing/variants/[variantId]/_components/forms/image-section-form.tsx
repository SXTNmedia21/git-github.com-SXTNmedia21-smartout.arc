// ============================================
// image-section-form.tsx — Edit form for image_section blocks
// Fields: caption, max_width (sm/md/lg/full), image (MediaPicker)
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaPicker } from "../media-picker";

type ImageSectionContent = {
  image: { media_id: string; alt: string } | undefined;
  caption: string;
  max_width: "sm" | "md" | "lg" | "full";
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): ImageSectionContent {
  const c = (content ?? {}) as Partial<ImageSectionContent>;
  return {
    image: c.image as { media_id: string; alt: string } | undefined,
    caption: c.caption ?? "",
    max_width: c.max_width ?? "lg",
  };
}

export function ImageSectionForm({ content, onChange }: Props) {
  const [state, setState] = useState<ImageSectionContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<ImageSectionContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <MediaPicker value={state.image} onChange={(image) => update({ image })} label="Bilde" />

      <div className="space-y-1.5">
        <Label className="text-xs">Bildetekst</Label>
        <Input
          value={state.caption}
          onChange={(e) => update({ caption: e.target.value })}
          placeholder="Valgfri bildetekst"
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Maks bredde</Label>
        <Select
          value={state.max_width}
          onValueChange={(v) => update({ max_width: v as "sm" | "md" | "lg" | "full" })}
        >
          <SelectTrigger className="h-9 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Liten</SelectItem>
            <SelectItem value="md">Medium</SelectItem>
            <SelectItem value="lg">Stor</SelectItem>
            <SelectItem value="full">Full bredde</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
