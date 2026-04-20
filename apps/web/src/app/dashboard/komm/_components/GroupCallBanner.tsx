"use client";

import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import { Phone, Users } from "lucide-react";

type Props = {
  participantCount: number;
  onJoin: () => void;
};

export function GroupCallBanner({ participantCount, onJoin }: Props) {
  const { t } = useTranslation("komm");
  return (
    <div className="bg-komm-call-active/10 flex items-center gap-3 border-b px-4 py-2">
      <div className="text-komm-call-active flex items-center gap-1.5">
        <Phone className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">
          {t("call.in_call", { count: participantCount })}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-komm-call-active/30 text-komm-call-active hover:bg-komm-call-active/10 ml-auto h-7 gap-1.5 text-xs"
        onClick={onJoin}
      >
        <Users className="h-3 w-3" />
        {t("call.join")}
      </Button>
    </div>
  );
}
