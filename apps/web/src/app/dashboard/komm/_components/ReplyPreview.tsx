"use client";

import { useTranslation } from "@smartout/i18n";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  senderName: string;
  content: string;
  onCancel: () => void;
};

export function ReplyPreview({ senderName, content, onCancel }: Props) {
  const { t } = useTranslation("komm");
  return (
    <div className="border-primary bg-accent/50 flex items-center gap-2 border-l-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-primary text-xs font-medium">
          {t("message.reply_to", { name: senderName })}
        </p>
        <p className="text-muted-foreground truncate text-xs">{content.slice(0, 100)}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
