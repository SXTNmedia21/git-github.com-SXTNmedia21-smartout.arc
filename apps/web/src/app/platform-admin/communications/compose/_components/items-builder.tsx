"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ItemData = {
  image?: string;
  title: string;
  description?: string;
  benefits?: string[];
  link?: string;
};

type ItemsBuilderProps = {
  items: ItemData[];
  onChange: (items: ItemData[]) => void;
};

function emptyItem(): ItemData {
  return { title: "", description: "", benefits: [], link: "" };
}

export function ItemsBuilder({ items, onChange }: ItemsBuilderProps) {
  function updateItem(index: number, patch: Partial<ItemData>) {
    const next = [...items];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addBenefit(index: number) {
    const item = items[index]!;
    updateItem(index, { benefits: [...(item.benefits ?? []), ""] });
  }

  function updateBenefit(itemIndex: number, benefitIndex: number, value: string) {
    const item = items[itemIndex]!;
    const benefits = [...(item.benefits ?? [])];
    benefits[benefitIndex] = value;
    updateItem(itemIndex, { benefits });
  }

  function removeBenefit(itemIndex: number, benefitIndex: number) {
    const item = items[itemIndex]!;
    const benefits = (item.benefits ?? []).filter((_, i) => i !== benefitIndex);
    updateItem(itemIndex, { benefits });
  }

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={i} className="border-border bg-card space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-medium">Element {i + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive h-7 w-7"
              onClick={() => removeItem(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tittel *</Label>
              <Input
                value={item.title}
                onChange={(e) => updateItem(i, { title: e.target.value })}
                placeholder="Element-tittel"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bilde-URL</Label>
              <Input
                value={item.image ?? ""}
                onChange={(e) => updateItem(i, { image: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Beskrivelse</Label>
            <Textarea
              value={item.description ?? ""}
              onChange={(e) => updateItem(i, { description: e.target.value })}
              placeholder="Kort beskrivelse..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Fordeler</Label>
            {(item.benefits ?? []).map((b, bi) => (
              <div key={bi} className="flex items-center gap-2">
                <Input
                  value={b}
                  onChange={(e) => updateBenefit(i, bi, e.target.value)}
                  placeholder="Fordel..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeBenefit(i, bi)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addBenefit(i)}
              className="text-xs"
            >
              <Plus className="mr-1 h-3 w-3" />
              Legg til fordel
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Lenke</Label>
            <Input
              value={item.link ?? ""}
              onChange={(e) => updateItem(i, { link: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...items, emptyItem()])}
        className="w-full"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Legg til element
      </Button>
    </div>
  );
}
