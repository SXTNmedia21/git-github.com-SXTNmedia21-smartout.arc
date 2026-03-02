// ============================================
// features-icons-form.tsx — Edit form for features_icons blocks
// Fields: heading, items list (icon + label)
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { IconPicker } from "../icon-picker";

type IconItem = {
  icon: string;
  label: string;
};

type FeaturesIconsContent = {
  heading: string;
  items: IconItem[];
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): FeaturesIconsContent {
  const c = (content ?? {}) as Partial<FeaturesIconsContent>;
  return {
    heading: c.heading ?? "",
    items: c.items ?? [],
  };
}

export function FeaturesIconsForm({ content, onChange }: Props) {
  const [state, setState] = useState<FeaturesIconsContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<FeaturesIconsContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  function updateItem(index: number, patch: Partial<IconItem>) {
    const items = state.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    update({ items });
  }

  function addItem() {
    update({ items: [...state.items, { icon: "zap", label: "" }] });
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
        <Label className="text-xs">Ikoner</Label>
        {state.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-36">
              <IconPicker value={item.icon} onChange={(icon) => updateItem(i, { icon })} />
            </div>
            <Input
              value={item.label}
              onChange={(e) => updateItem(i, { label: e.target.value })}
              placeholder="Kort etikett"
              className="h-8 flex-1 text-xs"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              onClick={() => removeItem(i)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
          <Plus className="mr-1 h-3 w-3" />
          Legg til ikon
        </Button>
      </div>
    </div>
  );
}
