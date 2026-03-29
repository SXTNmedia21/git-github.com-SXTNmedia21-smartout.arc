"use client";

import { useTranslation } from "@smartout/i18n";
import type { MessageWithSender } from "../_hooks/channel-types";
import { Info, ArrowRightLeft, Bell, FileText, Megaphone, Clock } from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: typeof Info; labelKey: string }> = {
  system: { icon: Info, labelKey: "system_message.system" },
  brief: { icon: FileText, labelKey: "system_message.briefing" },
  handoff: { icon: ArrowRightLeft, labelKey: "system_message.handover" },
  announcement: { icon: Megaphone, labelKey: "system_message.announcement" },
  reminder: { icon: Clock, labelKey: "system_message.reminder" },
  summary: { icon: Bell, labelKey: "system_message.summary" },
};

type Props = {
  message: MessageWithSender;
};

export function SystemMessage({ message }: Props) {
  const { t } = useTranslation("komm");
  const config = (TYPE_CONFIG[message.message_type] ?? TYPE_CONFIG.system)!;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-2 px-4 py-2">
      <div className="bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground text-xs font-medium uppercase">
            {t(config.labelKey)}
          </span>
          <span className="text-muted-foreground text-[10px]">
            {new Date(message.created_at).toLocaleTimeString("nb-NO", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">{message.content}</p>
      </div>
    </div>
  );
}
