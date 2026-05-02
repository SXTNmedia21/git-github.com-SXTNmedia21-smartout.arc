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
          "rounded-full transition-[box-shadow,outline] duration-200",
          isSpeaking && `${ringSize} ring-offset-background ring-komm-call-active ring-offset-2`,
        )}
      >
        {children}
      </div>
      {isSpeaking && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
          <span className="bg-komm-call-active/75 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="bg-komm-call-active relative inline-flex h-3 w-3 rounded-full" />
        </span>
      )}
    </div>
  );
}
