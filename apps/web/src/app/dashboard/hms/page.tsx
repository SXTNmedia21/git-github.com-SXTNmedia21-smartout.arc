"use client";

import { LayoutDashboard } from "lucide-react";

// TODO: move to i18n
const STRINGS = {
  title: "Oversikt",
  description: "HMS-oversikt med status, varsler og handlinger. Implementeres i Task 3.",
} as const;

export default function HmsOversiktPage() {
  return (
    <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16">
      <LayoutDashboard className="text-muted-foreground mb-4 h-12 w-12" />
      <h2 className="text-foreground text-xl font-bold">{STRINGS.title}</h2>
      <p className="text-muted-foreground mt-2 text-sm">{STRINGS.description}</p>
    </div>
  );
}
