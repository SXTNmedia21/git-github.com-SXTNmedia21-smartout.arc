"use client";

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
  const initials = call.callerName.slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card animate-in zoom-in-95 fade-in flex w-80 flex-col items-center gap-6 rounded-2xl border p-8 shadow-2xl">
        <Avatar className="h-20 w-20">
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>

        <div className="text-center">
          <h3 className="text-lg font-semibold">{call.callerName}</h3>
          <p className="text-muted-foreground text-sm">Ringer deg...</p>
        </div>

        <div className="flex gap-6">
          <Button
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={onReject}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            className="h-14 w-14 rounded-full bg-green-500 text-white hover:bg-green-600"
            onClick={onAccept}
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
