"use client";

// Standard Button with pending state: spinner replaces icon, label swaps, disabled while mutating.

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

// Mirrors the props shape of the shadcn Button component.
type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

type Props = ButtonProps & {
  isPending: boolean;
  pendingLabel?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
};

export function MutationButton({ isPending, pendingLabel, icon: Icon, children, ...rest }: Props) {
  return (
    <Button disabled={isPending || rest.disabled} {...rest}>
      {isPending ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : Icon ? (
        <Icon className="mr-2 size-4" />
      ) : null}
      {isPending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
