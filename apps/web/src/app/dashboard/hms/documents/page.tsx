"use client";

import { FileText } from "lucide-react";

// TODO: move to i18n
const STRINGS = {
  title: "Dokumenter",
  description: "Policyer, protokoller og prosedyrer. Implementeres i Task 4.",
} as const;

export default function DocumentsPage() {
  return (
    <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16">
      <FileText className="text-muted-foreground mb-4 h-12 w-12" />
      <h2 className="text-foreground text-xl font-bold">{STRINGS.title}</h2>
      <p className="text-muted-foreground mt-2 text-sm">{STRINGS.description}</p>
    </div>
  );
}
