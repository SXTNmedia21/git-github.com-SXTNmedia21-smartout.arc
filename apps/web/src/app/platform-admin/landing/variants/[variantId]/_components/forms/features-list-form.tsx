// ============================================
// features-list-form.tsx — Edit form for features_list blocks
// Fields: heading, items list (icon + title + description)
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { IconPicker } from "../icon-picker";

type FeatureItem = {
  icon: string;
  title: string;
  description: string;
};

type FeaturesListContent = {
  heading: string;
  items: FeatureItem[];
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): FeaturesListContent {
  const c = (content ?? {}) as Partial<FeaturesListContent>;
  return {
    heading: c.heading ?? "",
    items: c.items ?? [],
  };
}

export function FeaturesListForm({ content, onChange }: Props) {
  const [state, setState] = useState<FeaturesListContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<FeaturesListContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  function updateItem(index: number, patch: Partial<FeatureItem>) {
    const items = state.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    update({ items });
  }

  function addItem() {
    update({
      items: [...state.items, { icon: "zap", title: "", description: "" }],
    });
  }

  function removeItem(index: number) {
    update({ items: state.items.filter((_, i) => i !== index) });
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
        <Label className="text-xs">Elementer</Label>
        {state.items.map((item, i) => (
          <div key={i} className="bg-muted/50 space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-medium uppercase">
                Element {i + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => removeItem(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Ikon</Label>
                <IconPicker value={item.icon} onChange={(icon) => updateItem(i, { icon })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Tittel</Label>
                <Input
                  value={item.title}
                  onChange={(e) => updateItem(i, { title: e.target.value })}
                  placeholder="Tittel"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Beskrivelse</Label>
              <Textarea
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                placeholder="Beskrivelse"
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
          <Plus className="mr-1 h-3 w-3" />
          Legg til element
        </Button>
      </div>
    </div>
  );
}
