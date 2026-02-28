"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignatureRole } from "./signature-field";

const ROLE_STYLES: Record<SignatureRole, { border: string; bg: string; icon: string }> = {
  sender: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    icon: "text-blue-400",
  },
  recipient: {
    border: "border-violet-500/30",
    bg: "bg-violet-500/5",
    icon: "text-violet-400",
  },
};

export function SignatureFieldView({ node }: NodeViewProps) {
  const { role, label, required } = node.attrs as {
    role: SignatureRole;
    label: string;
    required: boolean;
  };

  const style = ROLE_STYLES[role] || ROLE_STYLES.recipient;

  return (
    <NodeViewWrapper className="my-3">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border-2 border-dashed p-4",
          style.border,
          style.bg,
        )}
        contentEditable={false}
      >
        <PenLine className={cn("h-5 w-5", style.icon)} />
        <div className="flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs capitalize">
            {role === "sender" ? "Leverandør" : "Kunde"}
            {required && " — Obligatorisk"}
          </p>
        </div>
        <div className="border-border h-12 w-48 rounded border bg-transparent" />
      </div>
    </NodeViewWrapper>
  );
}
