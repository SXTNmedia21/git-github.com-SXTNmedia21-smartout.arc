// ============================================
// day-control/BroadcastFooter.tsx
// Footer broadcast bar with push/SMS actions and dialog.
// ============================================
"use client";

import { useContext, useState } from "react";
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
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useDaySession } from "./use-day-session";

export function BroadcastFooter({ dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);
  const { snapshot } = useDaySession();
  const [broadcastType, setBroadcastType] = useState<"push" | "sms" | null>(null);

  const staffCount = dateId ? (snapshot?.summary.staffCount ?? 0) : 0;

  return (
    <>
      <div
        className={`shrink-0 border-t px-5 py-3 ${isDark ? "border-border bg-background" : "border-border bg-card"}`}
      >
        <div className="flex items-center gap-3">
          <Megaphone className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
            Kringkast ({staffCount})
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setBroadcastType("push")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all ${isDark ? "border-border bg-muted/30 text-foreground hover:bg-muted/60" : "border-border bg-muted text-foreground hover:bg-muted/80"}`}
          >
            <MessageCircle className="text-info h-3.5 w-3.5" /> Push
          </button>
          <button
            onClick={() => setBroadcastType("sms")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-all ${isDark ? "border-border bg-muted/30 text-foreground hover:bg-muted/60" : "border-border bg-muted text-foreground hover:bg-muted/80"}`}
          >
            <Mail className="text-accent h-3.5 w-3.5" /> SMS
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
