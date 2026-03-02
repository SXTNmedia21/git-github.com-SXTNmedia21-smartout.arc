// ============================================
// send-message-dialog.tsx
// "Send melding til dagen" dialog with channel selection
// (SMS, Push, Email), audience picker, and message composer.
// Connected to: broadcast-dialog.tsx (extends that pattern)
// Connected to: schedule-types.ts (Shift type for employee count)
// ============================================
"use client";

import { useState, useMemo } from "react";
import { Send, MessageSquare, Bell, Mail, Users, Shield, UserCheck } from "lucide-react";
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

type Channel = "sms" | "push" | "email";
type Audience = "all" | "leaders" | "specific";

type SendMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateId: string;
  dateLabel: string;
  shifts: Shift[];
  employees: ScheduleEmployee[];
};

/**
 * Full-featured "Send melding" dialog.
 * Step 1: Pick channels (SMS, Push, Email)
 * Step 2: Pick audience (Alle på vakt, Ledere, Spesifikke ansatte)
 * Step 3: Write message
 * Step 4: Send (mock)
 */
export function SendMessageDialog({
  open,
  onOpenChange,
  dateId,
  dateLabel,
  shifts,
  employees,
}: SendMessageDialogProps) {
  const [channels, setChannels] = useState<Set<Channel>>(new Set(["push"]));
  const [audience, setAudience] = useState<Audience>("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

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

  function toggleChannel(ch: Channel) {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) {
        next.delete(ch);
      } else {
        next.add(ch);
      }
      return next;
    });
  }

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

  function resetForm() {
    setChannels(new Set(["push"]));
    setAudience("all");
    setSelectedEmployeeIds(new Set());
    setMessage("");
  }

  function handleSend() {
    const channelLabels = Array.from(channels)
      .map((ch) => (ch === "sms" ? "SMS" : ch === "push" ? "Push" : "E-post"))
      .join(", ");
    toast.success(`Melding sendt via ${channelLabels} til ${recipientCount} mottakere`);
    resetForm();
    onOpenChange(false);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send melding
          </DialogTitle>
          <DialogDescription>Send melding til ansatte på vakt {dateLabel}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Channel selection */}
          <div className="grid gap-2">
            <Label className="text-xs font-bold tracking-wider uppercase">Kanaler</Label>
            <div className="flex gap-2">
              <ChannelToggle
                icon={<Bell className="h-3.5 w-3.5" />}
                label="Push"
                checked={channels.has("push")}
                onToggle={() => toggleChannel("push")}
              />
              <ChannelToggle
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="SMS"
                checked={channels.has("sms")}
                onToggle={() => toggleChannel("sms")}
              />
              <ChannelToggle
                icon={<Mail className="h-3.5 w-3.5" />}
                label="E-post"
                checked={channels.has("email")}
                onToggle={() => toggleChannel("email")}
              />
            </div>
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

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSend} disabled={!canSend}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Send til {recipientCount} {recipientCount === 1 ? "mottaker" : "mottakere"}
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
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
        checked
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted/50"
      }`}
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
