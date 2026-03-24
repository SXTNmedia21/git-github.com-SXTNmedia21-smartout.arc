"use client";

import { Button } from "@/components/ui/button";
import { Phone, Users } from "lucide-react";

type Props = {
  participantCount: number;
  onJoin: () => void;
};

export function GroupCallBanner({ participantCount, onJoin }: Props) {
  return (
    <div className="flex items-center gap-3 border-b bg-green-500/10 px-4 py-2">
      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
        <Phone className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">{participantCount} i samtale</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto h-7 gap-1.5 border-green-500/30 text-xs text-green-600 hover:bg-green-500/10 dark:text-green-400"
        onClick={onJoin}
      >
        <Users className="h-3 w-3" />
        Bli med
      </Button>
    </div>
  );
}
