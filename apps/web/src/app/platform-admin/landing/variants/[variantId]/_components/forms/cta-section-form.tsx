// ============================================
// cta-section-form.tsx — Edit form for cta_section blocks
// Fields: heading, subheading, background (dark/accent/gradient), buttons list
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

type ButtonItem = {
  label: string;
  href: string;
  style: "primary" | "outline" | "ghost";
};

type CtaSectionContent = {
  heading: string;
  subheading: string;
  buttons: ButtonItem[];
  background: "dark" | "accent" | "gradient";
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): CtaSectionContent {
  const c = (content ?? {}) as Partial<CtaSectionContent>;
  return {
    heading: c.heading ?? "",
    subheading: c.subheading ?? "",
    buttons: c.buttons ?? [],
    background: c.background ?? "dark",
  };
}

export function CtaSectionForm({ content, onChange }: Props) {
  const [state, setState] = useState<CtaSectionContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<CtaSectionContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  function updateButton(index: number, patch: Partial<ButtonItem>) {
    const buttons = state.buttons.map((b, i) => (i === index ? { ...b, ...patch } : b));
    update({ buttons });
  }

  function addButton() {
    update({
      buttons: [...state.buttons, { label: "", href: "", style: "primary" }],
    });
  }

  function removeButton(index: number) {
    update({ buttons: state.buttons.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Overskrift</Label>
        <Input
          value={state.heading}
          onChange={(e) => update({ heading: e.target.value })}
          placeholder="CTA-overskrift"
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Underoverskrift</Label>
        <Textarea
          value={state.subheading}
          onChange={(e) => update({ subheading: e.target.value })}
          placeholder="Beskrivende tekst"
          rows={2}
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Bakgrunn</Label>
        <Select
          value={state.background}
          onValueChange={(v) => update({ background: v as "dark" | "accent" | "gradient" })}
        >
          <SelectTrigger className="h-9 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Moerk</SelectItem>
            <SelectItem value="accent">Aksentfarge</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Knapper</Label>
        {state.buttons.map((btn, i) => (
          <div key={i} className="flex items-start gap-2">
            <Input
              value={btn.label}
              onChange={(e) => updateButton(i, { label: e.target.value })}
              placeholder="Tekst"
              className="h-8 flex-1 text-xs"
            />
            <Input
              value={btn.href}
              onChange={(e) => updateButton(i, { href: e.target.value })}
              placeholder="/lenke"
              className="h-8 flex-1 text-xs"
            />
            <Select
              value={btn.style}
              onValueChange={(v) =>
                updateButton(i, {
                  style: v as "primary" | "outline" | "ghost",
                })
              }
            >
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="outline">Outline</SelectItem>
                <SelectItem value="ghost">Ghost</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              onClick={() => removeButton(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addButton}>
          <Plus className="mr-1 h-3 w-3" />
          Legg til knapp
        </Button>
      </div>
    </div>
  );
}
