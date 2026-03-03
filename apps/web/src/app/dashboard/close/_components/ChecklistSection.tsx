"use client";

import { useState } from "react";
import { Check, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  required: boolean;
};

const CLOSING_CHECKLIST: ChecklistItem[] = [
  {
    id: "cash_locked",
    label: "Kasse sikret",
    description: "Kontanter talt og låst i safe",
    required: true,
  },
  {
    id: "fridge_temp",
    label: "Kjøleskap kontrollert",
    description: "Temperaturer innenfor krav",
    required: true,
  },
  {
    id: "cleaning_done",
    label: "Rengjøring fullført",
    description: "Alle overflater, gulv og utstyr rengjort",
    required: true,
  },
  {
    id: "security_check",
    label: "Sikkerhetskontroll",
    description: "Vinduer, dører og alarmsystem sjekket",
    required: true,
  },
  {
    id: "waste_handled",
    label: "Avfall håndtert",
    description: "Søppel tømt og kildesortert",
    required: false,
  },
  {
    id: "handoff_notes",
    label: "Overleveringsnotater",
    description: "Viktig info til neste skift (valgfritt)",
    required: false,
  },
];

type ChecklistSectionProps = {
  onComplete: (complete: boolean, items: Record<string, boolean>) => void;
};

export function ChecklistSection({ onComplete }: ChecklistSectionProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const requiredItems = CLOSING_CHECKLIST.filter((item) => item.required);
  const allRequiredDone = requiredItems.every((item) => checked[item.id]);
  const completedCount = Object.values(checked).filter(Boolean).length;

  function toggle(id: string) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    const reqDone = requiredItems.every((item) => next[item.id]);
    onComplete(reqDone, next);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Stengesjekkliste</CardTitle>
          <span className="text-muted-foreground text-xs">
            {completedCount}/{CLOSING_CHECKLIST.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="bg-muted mt-2 h-1.5 w-full rounded-full">
          <div
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              allRequiredDone ? "bg-emerald-500" : "bg-primary",
            )}
            style={{
              width: `${(completedCount / CLOSING_CHECKLIST.length) * 100}%`,
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {CLOSING_CHECKLIST.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors",
              checked[item.id] ? "bg-emerald-500/10" : "hover:bg-muted/50",
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                checked[item.id]
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-muted-foreground/30",
              )}
            >
              {checked[item.id] ? (
                <Check className="h-3 w-3" />
              ) : (
                <Circle className="h-3 w-3 text-transparent" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    checked[item.id] && "text-muted-foreground line-through",
                  )}
                >
                  {item.label}
                </span>
                {item.required && (
                  <span className="text-destructive text-[10px] font-medium uppercase">
                    Obligatorisk
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">{item.description}</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
