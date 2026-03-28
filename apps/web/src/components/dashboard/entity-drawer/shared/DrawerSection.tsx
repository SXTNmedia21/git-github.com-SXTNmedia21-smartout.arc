"use client";

import type { ReactNode } from "react";

type DrawerSectionProps = {
  label?: string;
  children: ReactNode;
  className?: string;
};

export function DrawerSection({ label, children, className }: DrawerSectionProps) {
  return (
    <div className={className}>
      {label && (
        <div className="text-muted-foreground/60 mb-1 text-[9px] font-bold tracking-wider uppercase">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}
