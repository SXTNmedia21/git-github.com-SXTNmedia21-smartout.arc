"use client";

import type { LucideIcon } from "lucide-react";

type DrawerEmptyStateProps = {
  icon: LucideIcon;
  message: string;
};

export function DrawerEmptyState({ icon: Icon, message }: DrawerEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12">
      <Icon className="text-muted-foreground/40 h-8 w-8" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
