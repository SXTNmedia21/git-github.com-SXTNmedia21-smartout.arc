"use client";

import { cn } from "@/lib/utils";

type Props = {
  isSpeaking: boolean;
  size?: "sm" | "md";
  children: React.ReactNode;
};

export function ActiveSpeakerIndicator({ isSpeaking, size = "md", children }: Props) {
  const ringSize = size === "sm" ? "ring-2" : "ring-[3px]";

  return (
    <div className="relative inline-flex">
      <div
        className={cn(
          "rounded-full transition-all duration-200",
          isSpeaking && `${ringSize} ring-offset-background ring-green-500 ring-offset-2`,
        )}
      >
        {children}
      </div>
      {isSpeaking && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
        </span>
      )}
    </div>
  );
}
