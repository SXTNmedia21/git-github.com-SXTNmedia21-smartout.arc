"use client";

/**
 * CallLeaderButton — Opens the shift thread chat tab to contact the shift leader.
 *
 * V1 implementation: no LiveKit voice yet. Clicking switches the active tab to
 * the Chat tab with the shift thread selected. In V2, this will initiate a
 * WalkieTalkie voice call to all leaders on duty.
 */

import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

type CallLeaderButtonProps = {
  onSwitchToChat: () => void;
};

export function CallLeaderButton({ onSwitchToChat }: CallLeaderButtonProps) {
  return (
    <Button
      variant="outline"
      className="border-border/50 bg-card/50 hover:bg-card/80 flex h-auto flex-col items-center gap-2 rounded-2xl px-4 py-4 backdrop-blur-sm transition-colors"
      onClick={onSwitchToChat}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
        <Phone className="h-5 w-5 text-blue-400" />
      </div>
      <span className="text-muted-foreground text-xs">Ring leder</span>
    </Button>
  );
}
