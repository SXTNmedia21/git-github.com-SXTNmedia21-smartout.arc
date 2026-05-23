// ============================================
// day-control/BroadcastFooter.tsx
// Footer broadcast bar with push/SMS actions and dialog.
// ============================================
"use client";

import { useState } from "react";
import { Megaphone, MessageCircle, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDaySession } from "./use-day-session";

export function BroadcastFooter({ dateId }: { dateId: string | null }) {
  const { snapshot } = useDaySession();
  const [broadcastType, setBroadcastType] = useState<"push" | "sms" | null>(null);

  const staffCount = dateId ? (snapshot?.summary.staffCount ?? 0) : 0;

  return (
    <>
      <div className="border-border bg-card shrink-0 border-t px-5 py-3">
        <div className="flex items-center gap-3">
          <Megaphone className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
          {/* Section label — Nordic Split section-label recipe */}
          <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Kringkast ({staffCount})
          </span>
          <div className="flex-1" />
          {/* Chip-pill buttons — Manager Timeline .chip recipe */}
          <button
            onClick={() => setBroadcastType("push")}
            className="border-border text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-full border bg-transparent px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Send Push-melding til alle pa vakt"
          >
            {/* text-blue-400 is an icon-tint with no semantic equivalent — kept as TODO */}
            <MessageCircle className="h-3.5 w-3.5 text-blue-400" aria-hidden /> Push
          </button>
          <button
            onClick={() => setBroadcastType("sms")}
            className="border-border text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-full border bg-transparent px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Send SMS til alle pa vakt"
          >
            {/* text-orange-400 is an icon-tint with no semantic equivalent — kept as TODO */}
            <Mail className="h-3.5 w-3.5 text-orange-400" aria-hidden /> SMS
          </button>
        </div>
      </div>

      {broadcastType && dateId && (
        <BroadcastMessageDialog
          type={broadcastType}
          dateId={dateId}
          staffCount={staffCount}
          open={!!broadcastType}
          onOpenChange={(open) => {
            if (!open) setBroadcastType(null);
          }}
        />
      )}
    </>
  );
}

// ── Broadcast Dialog ─────────────────────────────────────────

function BroadcastMessageDialog({
  type,
  dateId,
  staffCount,
  open,
  onOpenChange,
}: {
  type: "push" | "sms";
  dateId: string;
  staffCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [includeDaginfo, setIncludeDaginfo] = useState(false);

  function handleSend() {
    if (type === "sms") {
      window.dispatchEvent(
        new CustomEvent("smartout:schedule-sms-compose", {
          detail: {
            dateId,
            customMessage: message.trim(),
            includeDaginfo,
          },
        }),
      );
      toast.success(`SMS-utkast åpnet for ${staffCount} ansatte`);
    } else {
      toast.warning("Push utsending er ikke aktiv i denne versjonen. Bruk SMS eller dagsinfo.");
    }
    setMessage("");
    setIncludeDaginfo(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "push" ? (
              <MessageCircle className="text-info h-5 w-5" />
            ) : (
              <Mail className="text-accent h-5 w-5" />
            )}
            Send {type === "push" ? "Push-melding" : "SMS"}
          </DialogTitle>
          <DialogDescription>
            Til {staffCount} {staffCount === 1 ? "ansatt" : "ansatte"} pa vakt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <textarea
            placeholder="Skriv melding..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="border-input focus-visible:ring-ring h-24 w-full resize-none rounded-lg border bg-transparent p-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
          />

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={includeDaginfo}
              onChange={(e) => setIncludeDaginfo(e.target.checked)}
              className="border-input h-4 w-4 rounded accent-orange-500"
            />
            <span className="text-muted-foreground text-sm">Pakk med daginfo</span>
          </label>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSend}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Send {type === "push" ? "Push" : "SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
