"use client";

import { AlertTriangle } from "lucide-react";

// TODO: move to i18n
const STRINGS = {
  title: "Avvik",
  description: "Avvikshandtering og oppfolging. Kommer i Phase 2.",
} as const;

export default function DeviationsPage() {
  return (
    <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16">
      <AlertTriangle className="text-muted-foreground mb-4 h-12 w-12" />
      <h2 className="text-foreground text-xl font-bold">{STRINGS.title}</h2>
      <p className="text-muted-foreground mt-2 text-sm">{STRINGS.description}</p>
    </div>
  );
}
