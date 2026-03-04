// ============================================
// faq-form.tsx — Edit form for faq blocks
// Fields: heading, items list (question + answer)
// ============================================

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqContent = {
  heading: string;
  items: FaqItem[];
};

type Props = {
  content: unknown;
  onChange: (content: unknown) => void;
};

function defaults(content: unknown): FaqContent {
  const c = (content ?? {}) as Partial<FaqContent>;
  return {
    heading: c.heading ?? "",
    items: c.items ?? [],
  };
}

export function FaqForm({ content, onChange }: Props) {
  const [state, setState] = useState<FaqContent>(() => defaults(content));

  useEffect(() => {
    setState(defaults(content));
  }, [content]);

  function update(patch: Partial<FaqContent>) {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  }

  function updateItem(index: number, patch: Partial<FaqItem>) {
    const items = state.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    update({ items });
  }

  function addItem() {
    update({ items: [...state.items, { question: "", answer: "" }] });
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
          placeholder="FAQ-overskrift"
          className="h-9"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-xs">Spoersmaal og svar</Label>
        {state.items.map((item, i) => (
          <div key={i} className="bg-muted/50 space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] font-medium uppercase">
                Spoersmaal {i + 1}
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
            <div className="space-y-1">
              <Label className="text-[10px]">Spoersmaal</Label>
              <Input
                value={item.question}
                onChange={(e) => updateItem(i, { question: e.target.value })}
                placeholder="Spoersmaal"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Svar</Label>
              <Textarea
                value={item.answer}
                onChange={(e) => updateItem(i, { answer: e.target.value })}
                placeholder="Svar"
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
          <Plus className="mr-1 h-3 w-3" />
          Legg til spoersmaal
        </Button>
      </div>
    </div>
  );
}
