"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { IncomingCall } from "@smartout/walkie-talkie";

type Props = {
  call: IncomingCall;
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallOverlay({ call, onAccept, onReject }: Props) {
  const { t } = useTranslation("komm");
  const initials = call.callerName.slice(0, 2).toUpperCase();
  const acceptRef = useRef<HTMLButtonElement>(null);

  // #11: Focus management + keyboard shortcuts
  useEffect(() => {
    acceptRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onAccept();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onReject();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAccept, onReject]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
    >
      <div className="bg-card animate-in zoom-in-95 fade-in flex w-80 flex-col items-center gap-6 rounded-2xl border p-8 shadow-2xl">
        <Avatar className="h-20 w-20">
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>

        <div className="text-center">
          <h3 id="incoming-call-title" className="text-lg font-semibold">
            {call.callerName}
          </h3>
          <p className="text-muted-foreground text-sm">{t("incoming_call.ringing")}</p>
        </div>

        <div className="flex gap-6">
          <Button
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={onReject}
            aria-label={t("incoming_call.reject_aria")}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            ref={acceptRef}
            size="icon"
            className="h-14 w-14 rounded-full bg-green-500 text-white hover:bg-green-600"
            onClick={onAccept}
            aria-label={t("incoming_call.accept_aria")}
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
