"use client";

import { useTranslation } from "@smartout/i18n";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PTTState } from "@smartout/walkie-talkie";

type Props = {
  pttState: PTTState;
  onPressStart: () => void;
  onPressEnd: () => void;
};

export function PTTButton({ pttState, onPressStart, onPressEnd }: Props) {
  const { t } = useTranslation("komm");
  const isActive = pttState === "talking";
  const isConnected = pttState === "connected_muted" || pttState === "talking";
  const isDisabled = pttState === "idle" || pttState === "connecting";

  return (
    <button
      type="button"
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
      disabled={isDisabled}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
        "touch-none select-none",
        isActive && "scale-110 bg-green-500 text-white shadow-lg shadow-green-500/30",
        isConnected && !isActive && "bg-muted text-muted-foreground hover:bg-muted/80",
        isDisabled && "cursor-not-allowed opacity-40",
      )}
      title={isActive ? t("ptt.release_to_stop") : t("ptt.hold_to_talk")}
    >
      <Mic className={cn("h-4 w-4", isActive && "animate-pulse")} />
    </button>
  );
}
