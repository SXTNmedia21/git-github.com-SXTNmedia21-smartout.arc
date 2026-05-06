"use client";

// DropdownMenuItem with local pending state: keeps menu open during async onMutate, swaps icon+label.

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type Props = {
  icon: LucideIcon;
  label: string;
  pendingLabel: string;
  onMutate: () => Promise<void>;
  destructive?: boolean;
  "data-testid"?: string;
};

export function MutationDropdownMenuItem({
  icon: Icon,
  label,
  pendingLabel,
  onMutate,
  destructive = false,
  "data-testid": testId,
}: Props) {
  const [pending, setPending] = useState(false);

  return (
    <DropdownMenuItem
      data-testid={testId}
      disabled={pending}
      // e.preventDefault() keeps the dropdown open while the async work runs;
      // without it Radix closes the menu immediately on select.
      onSelect={async (e) => {
        e.preventDefault();
        setPending(true);
        try {
          await onMutate();
        } finally {
          setPending(false);
        }
      }}
      className={cn(destructive && "text-destructive focus:text-destructive")}
    >
      {pending ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Icon className="mr-2 size-4" />
      )}
      {pending ? pendingLabel : label}
    </DropdownMenuItem>
  );
}
