// ============================================
// stats-form.tsx — Edit form for stats blocks
// Fields: heading, items list (value + label + suffix)
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

type StatItem = {
  value: string;
  label: string;
  suffix: string;
};

type StatsContent = {
  heading: string;
  items: StatItem[];
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): StatsContent {
  const c = (content ?? {}) as Partial<StatsContent>;
  return {
    heading: c.heading ?? "",
    items: c.items ?? [],
  };
}

export function StatsForm({ content, onChange }: Props) {
  const [state, setState] = useState<StatsContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<StatsContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  function updateItem(index: number, patch: Partial<StatItem>) {
    const items = state.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    update({ items });
  }

  function addItem() {
    update({
      items: [...state.items, { value: "", label: "", suffix: "" }],
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
        <Label className="text-xs">Statistikker</Label>
        {state.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <Input
              value={item.value}
              onChange={(e) => updateItem(i, { value: e.target.value })}
              placeholder="Verdi (f.eks. 95)"
              className="h-8 w-24 text-xs"
            />
            <Input
              value={item.suffix}
              onChange={(e) => updateItem(i, { suffix: e.target.value })}
              placeholder="Suffiks (f.eks. %)"
              className="h-8 w-16 text-xs"
            />
            <Input
              value={item.label}
              onChange={(e) => updateItem(i, { label: e.target.value })}
              placeholder="Etikett"
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
          Legg til statistikk
        </Button>
      </div>
    </div>
  );
}
