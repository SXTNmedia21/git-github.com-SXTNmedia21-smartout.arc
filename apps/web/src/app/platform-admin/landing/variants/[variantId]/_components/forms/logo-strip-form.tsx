// ============================================
// logo-strip-form.tsx — Edit form for logo_strip blocks
// Fields: heading, logos list (name + image MediaPicker)
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { MediaPicker } from "../media-picker";

type LogoItem = {
  image: { media_id: string; alt: string } | undefined;
  name: string;
};

type LogoStripContent = {
  heading: string;
  logos: LogoItem[];
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): LogoStripContent {
  const c = (content ?? {}) as Partial<LogoStripContent>;
  return {
    heading: c.heading ?? "",
    logos: (c.logos as LogoItem[]) ?? [],
  };
}

export function LogoStripForm({ content, onChange }: Props) {
  const [state, setState] = useState<LogoStripContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<LogoStripContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  function updateLogo(index: number, patch: Partial<LogoItem>) {
    const logos = state.logos.map((logo, i) => (i === index ? { ...logo, ...patch } : logo));
    update({ logos });
  }

  function addLogo() {
    update({ logos: [...state.logos, { image: undefined, name: "" }] });
  }

  function removeLogo(index: number) {
    update({ logos: state.logos.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Overskrift</Label>
        <Input
          value={state.heading}
          onChange={(e) => update({ heading: e.target.value })}
          placeholder="Seksjonsoverskrift"
          className="h-9"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-xs">Logoer</Label>
        {state.logos.map((logo, i) => (
          <div key={i} className="bg-muted/50 space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-medium uppercase">
                Logo {i + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => removeLogo(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Navn</Label>
              <Input
                value={logo.name}
                onChange={(e) => updateLogo(i, { name: e.target.value })}
                placeholder="Bedriftsnavn"
                className="h-8 text-xs"
              />
            </div>
            <MediaPicker
              value={logo.image}
              onChange={(image) => updateLogo(i, { image })}
              label="Logobilde"
            />
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addLogo}>
          <Plus className="mr-1 h-3 w-3" />
          Legg til logo
        </Button>
      </div>
    </div>
  );
}
