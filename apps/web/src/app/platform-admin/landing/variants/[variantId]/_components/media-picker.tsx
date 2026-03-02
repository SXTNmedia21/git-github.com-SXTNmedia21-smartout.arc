// ============================================
// media-picker.tsx — Media reference picker (MVP placeholder)
// For MVP: shows a text input for media_id with a note about
// future Supabase Storage upload support.
//
// Connected to: forms/* (used in hero, image-section, logo-strip forms)
// ============================================

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Image, X } from "lucide-react";

type MediaPickerProps = {
  value: { media_id: string; alt: string } | undefined;
  onChange: (value: { media_id: string; alt: string } | undefined) => void;
  label?: string;
};

export function MediaPicker({ value, onChange, label = "Bilde" }: MediaPickerProps) {
  const hasValue = value && value.media_id;

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {hasValue ? (
        <div className="flex items-center gap-2">
          <div className="bg-muted flex h-10 flex-1 items-center gap-2 rounded-md border px-3">
            <Image className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="truncate text-xs">{value.media_id}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 shrink-0 p-0"
            onClick={() => onChange(undefined)}
            title="Fjern bilde"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            placeholder="media_id (UUID)"
            className="h-9 text-xs"
            onChange={(e) => {
              if (e.target.value.trim()) {
                onChange({ media_id: e.target.value.trim(), alt: "" });
              }
            }}
          />
          <p className="text-muted-foreground text-[10px]">
            Filopplasting kommer snart. Lim inn media-ID for naa.
          </p>
        </div>
      )}
      {hasValue && (
        <Input
          placeholder="Alt-tekst"
          value={value.alt}
          onChange={(e) => onChange({ media_id: value.media_id, alt: e.target.value })}
          className="h-8 text-xs"
        />
      )}
    </div>
  );
}
