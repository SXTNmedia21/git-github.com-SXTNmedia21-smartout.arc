// ============================================
// send-message-dialog.tsx
// "Send melding til dagen" dialog with channel selection
// (SMS, Push, Email), audience picker, and message composer.
// Connected to: broadcast-dialog.tsx (extends that pattern)
// Connected to: schedule-types.ts (Shift type for employee count)
// ============================================
"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, MessageSquare, Users, Shield, UserCheck } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import type { Shift } from "./schedule-types";
import type { ScheduleEmployee } from "../_hooks/use-employees";

// ── Types ───────────────────────────────────────────────────

type Channel = "sms";
type Audience = "all" | "leaders" | "specific";

type SendMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  dateId: string;
  dateLabel: string;
  initialMessage?: string;
  shifts: Shift[];
  employees: ScheduleEmployee[];
  onSent?: (message: string, audience: Audience, recipients: number) => void;
};

/**
 * Full-featured "Send melding" dialog.
 * Step 1: Confirm channel (SMS only for this endpoint)
 * Step 2: Pick audience (Alle på vakt, Ledere, Spesifikke ansatte)
 * Step 3: Write message
 * Step 4: Send
 */
export function SendMessageDialog({
  open,
  onOpenChange,
  workspaceId,
  dateId,
  dateLabel,
  initialMessage,
  shifts,
  employees,
  onSent,
}: SendMessageDialogProps) {
  const [channels, setChannels] = useState<Set<Channel>>(new Set(["sms"]));
  const [audience, setAudience] = useState<Audience>("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Employees working on this day
  const dayEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of shifts) {
      if (s.dateId === dateId && s.employeeId) {
        ids.add(s.employeeId);
      }
    }
    return ids;
  }, [shifts, dateId]);

  const dayEmployees = useMemo(
    () => employees.filter((e) => dayEmployeeIds.has(e.id)),
    [employees, dayEmployeeIds],
  );

  const leaderEmployees = useMemo(
    () =>
      dayEmployees.filter((e) => e.role === "manager" || e.role === "admin" || e.role === "owner"),
    [dayEmployees],
  );

  const recipientCount = useMemo(() => {
    if (audience === "all") return dayEmployees.length;
    if (audience === "leaders") return leaderEmployees.length;
    return selectedEmployeeIds.size;
  }, [audience, dayEmployees.length, leaderEmployees.length, selectedEmployeeIds.size]);

  function toggleEmployee(id: string) {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    setMessage(initialMessage ?? "");
    setChannels(new Set(["sms"]));
    setAudience("all");
    setSelectedEmployeeIds(new Set());
  }, [open, initialMessage]);

  function resetForm() {
    setChannels(new Set(["sms"]));
    setAudience("all");
    setSelectedEmployeeIds(new Set());
    setMessage("");
    setIsSending(false);
  }

  async function handleSend() {
    if (!canSend || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch("/api/schedule/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          dateId,
          message,
          channels: Array.from(channels),
          audience,
          selectedEmployeeIds:
            audience === "specific" ? Array.from(selectedEmployeeIds) : undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        sms?: { sent: number; failed: number; skippedNoPhone: number };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Kunne ikke sende melding");
      }

      const smsResult = payload.sms;
      if (smsResult && channels.has("sms")) {
        toast.success(
          `Melding sendt via SMS. ${smsResult.sent} sendt, ${smsResult.failed} feilet, ${smsResult.skippedNoPhone} uten nummer.`,
        );
      } else {
        toast.success(`Melding sendt via SMS til ${recipientCount} mottakere`);
      }

      onSent?.(message, audience, recipientCount);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunne ikke sende melding");
    } finally {
      setIsSending(false);
    }
  }

  const canSend = channels.size > 0 && message.trim().length > 0 && recipientCount > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="border-border relative overflow-hidden rounded-t-lg border-b px-6 pt-6 pb-4">
          <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <MessageSquare className="h-4 w-4" />
              </div>
              Send melding
            </DialogTitle>
            <DialogDescription className="text-xs">
              Til ansatte på vakt {dateLabel}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-5 px-6 py-4">
          {/* Channel selection */}
          <div className="grid gap-2">
            <Label className="text-xs font-bold tracking-wider uppercase">Kanaler</Label>
            <div className="flex gap-2">
              <ChannelToggle
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="SMS"
                checked={channels.has("sms")}
                onToggle={() => undefined}
                disabled
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Kun SMS er tilgjengelig for sending akkurat na.
            </p>
          </div>

          {/* Audience selection */}
          <div className="grid gap-2">
            <Label className="text-xs font-bold tracking-wider uppercase">Mottakere</Label>
            <div className="grid gap-1.5">
              <AudienceOption
                icon={<Users className="h-4 w-4" />}
                label="Alle på vakt"
                count={dayEmployees.length}
                selected={audience === "all"}
                onClick={() => setAudience("all")}
              />
              <AudienceOption
                icon={<Shield className="h-4 w-4" />}
                label="Ledere"
                count={leaderEmployees.length}
                selected={audience === "leaders"}
                onClick={() => setAudience("leaders")}
              />
              <AudienceOption
                icon={<UserCheck className="h-4 w-4" />}
                label="Spesifikke ansatte"
                count={selectedEmployeeIds.size}
                selected={audience === "specific"}
                onClick={() => setAudience("specific")}
              />
            </div>
          </div>

          {/* Employee picker for "specific" audience */}
          {audience === "specific" && (
            <div className="grid gap-2">
              <Label className="text-muted-foreground text-xs">Velg ansatte</Label>
              <div className="border-border max-h-[160px] space-y-1 overflow-y-auto rounded-lg border p-2">
                {dayEmployees.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-center text-xs">
                    Ingen ansatte på vakt denne dagen
                  </p>
                ) : (
                  dayEmployees.map((emp) => (
                    <label
                      key={emp.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5"
                    >
                      <Checkbox
                        checked={selectedEmployeeIds.has(emp.id)}
                        onCheckedChange={() => toggleEmployee(emp.id)}
                      />
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[8px] font-black ${emp.avatarColor}`}
                      >
                        {emp.initials}
                      </div>
                      <span className="text-foreground text-xs font-medium">{emp.name}</span>
                      <span className="text-muted-foreground ml-auto text-[10px]">{emp.role}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Message */}
          <div className="grid gap-2">
            <Label
              htmlFor="send-msg-content"
              className="text-xs font-bold tracking-wider uppercase"
            >
              Melding
            </Label>
            <Textarea
              id="send-msg-content"
              placeholder="Skriv meldingen her..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="border-border flex-row gap-2 border-t px-6 py-4 sm:justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!canSend || isSending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {isSending ? "Sender..." : `Send til ${recipientCount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Channel toggle chip ─────────────────────────────────────

function ChannelToggle({
  icon,
  label,
  checked,
  onToggle,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
        checked
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted/50"
      } ${disabled ? "cursor-default" : ""}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Audience option row ─────────────────────────────────────

function AudienceOption({
  icon,
  label,
  count,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
        selected ? "border-primary/30 bg-primary/10" : "border-border hover:bg-muted/50"
      }`}
    >
      <span className={selected ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      <span
        className={`text-xs font-medium ${selected ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <span className="text-muted-foreground ml-auto text-[10px]">{count}</span>
    </button>
  );
}
