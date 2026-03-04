"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  senderName: string;
  onCancel: () => void;
};

export function ReplyPreview({ senderName, onCancel }: Props) {
  return (
    <div className="border-border bg-muted/50 flex items-center justify-between border-t px-4 py-2">
      <span className="text-muted-foreground text-xs">
        Svarer <span className="text-primary font-medium">{senderName}</span>
        ...
      </span>
      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onCancel}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
