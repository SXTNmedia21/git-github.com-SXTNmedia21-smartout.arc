"use client";

import { useState } from "react";
import {
  Loader2,
  Send,
  FlaskConical,
  Mail,
  MessageSquare,
  Bell,
  BellRing,
  Clock,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AudienceSelector,
  type AudienceFilter,
} from "@/components/platform-admin/audience-selector";
import { TypeToConfirm } from "@/components/platform-admin/type-to-confirm";
import { ConfirmationDialog } from "@/components/platform-admin/confirmation-dialog";

type CommunicationChannel = "email" | "sms" | "push" | "in_app";

type ComposeEmailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAudience?: AudienceFilter;
  workspaceId?: string;
  workspaceName?: string;
};

const templates = [
  { value: "platform-announcement", label: "Platform Announcement", classification: "Broadcast" },
  {
    value: "workspace-notification",
    label: "Workspace Notification",
    classification: "Transactional",
  },
  { value: "trial-reminder", label: "Trial Reminder", classification: "Transactional" },
  { value: "payment-reminder", label: "Payment Reminder", classification: "Transactional" },
  { value: "contract-reminder", label: "Contract Reminder", classification: "Transactional" },
] as const;

type Template = (typeof templates)[number]["value"];

const channelConfig: Array<{
  value: CommunicationChannel;
  label: string;
  icon: typeof Mail;
  description: string;
}> = [
  { value: "email", label: "Email", icon: Mail, description: "SendGrid" },
  { value: "sms", label: "SMS", icon: MessageSquare, description: "Twilio" },
  { value: "push", label: "Push", icon: Bell, description: "Expo" },
  { value: "in_app", label: "In-App", icon: BellRing, description: "Notification bell" },
];

export function ComposeEmailSheet({
  open,
  onOpenChange,
  defaultAudience,
  workspaceId,
  workspaceName,
}: ComposeEmailSheetProps) {
  const [audience, setAudience] = useState<AudienceFilter | null>(defaultAudience ?? null);
  const [channels, setChannels] = useState<CommunicationChannel[]>(["email"]);
  const [template, setTemplate] = useState<Template | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [dryRunResult, setDryRunResult] = useState<{
    recipientCount: number;
    preview?: string;
  } | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [largeAudienceConfirmed, setLargeAudienceConfirmed] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "scheduled">("now");
  const [scheduledFor, setScheduledFor] = useState("");

  const classification = templates.find((t) => t.value === template)?.classification ?? null;
  const needsTypeConfirm = dryRunResult !== null && dryRunResult.recipientCount > 100;
  const hasEmail = channels.includes("email");
  const hasSms = channels.includes("sms");
  const hasPush = channels.includes("push");

  const canSend =
    subject.trim() !== "" &&
    channels.length > 0 &&
    audience !== null &&
    (!hasEmail || message.trim() !== "") &&
    (!hasSms || smsBody.trim() !== "") &&
    (!hasPush || pushTitle.trim() !== "") &&
    (!needsTypeConfirm || largeAudienceConfirmed);

  function toggleChannel(ch: CommunicationChannel) {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  }

  async function handleDryRun() {
    if (!audience) return;
    setIsDryRunning(true);
    setDryRunResult(null);
    setLargeAudienceConfirmed(false);

    try {
      const res = await fetch("/api/platform-admin/communications/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, template, subject, message }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Dry run failed" }));
        toast.error(err.error ?? "Dry run failed");
        return;
      }

      const data = await res.json();
      setDryRunResult({
        recipientCount: data.recipientCount,
        preview: data.preview,
      });
    } catch {
      toast.error("Network error during dry run");
    } finally {
      setIsDryRunning(false);
    }
  }

  async function handleSend() {
    setConfirmOpen(false);
    setIsSending(true);

    try {
      const res = await fetch("/api/platform-admin/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels,
          audience,
          template: hasEmail ? template || "platform-announcement" : undefined,
          subject,
          message: hasEmail ? message : undefined,
          smsBody: hasSms ? smsBody : undefined,
          pushTitle: hasPush ? pushTitle : undefined,
          pushBody: hasPush ? pushBody : undefined,
          actionUrl: actionUrl || undefined,
          inAppTitle: channels.includes("in_app") ? subject : undefined,
          inAppBody: channels.includes("in_app") ? message || smsBody || pushBody : undefined,
          scheduledFor:
            scheduleMode === "scheduled" && scheduledFor
              ? new Date(scheduledFor).toISOString()
              : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Send failed" }));
        toast.error(err.error ?? "Send failed");
        return;
      }

      const data = await res.json();

      if (data.scheduled) {
        toast.success(`Scheduled for ${new Date(data.scheduledFor).toLocaleString("no-NO")}`);
      } else {
        const totalSent = data.totalSent ?? 0;
        const channelSummary = (data.channels ?? [])
          .map((c: { channel: string; sentCount: number }) => `${c.channel}: ${c.sentCount}`)
          .join(", ");
        toast.success(`Sent ${totalSent} total (${channelSummary})`);
      }
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Network error during send");
    } finally {
      setIsSending(false);
    }
  }

  function resetForm() {
    setAudience(defaultAudience ?? null);
    setChannels(["email"]);
    setTemplate("");
    setSubject("");
    setMessage("");
    setSmsBody("");
    setPushTitle("");
    setPushBody("");
    setActionUrl("");
    setDryRunResult(null);
    setLargeAudienceConfirmed(false);
    setScheduleMode("now");
    setScheduledFor("");
  }

  const smsSegments = Math.ceil(Math.max(smsBody.length, 1) / 160);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-base">Compose Message</SheetTitle>
            <SheetDescription>
              {workspaceName ? `Sending to ${workspaceName}` : "Send platform communication"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 pt-4">
            {/* Channel selector */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-medium">Channels</Label>
              <div className="grid grid-cols-4 gap-2">
                {channelConfig.map((ch) => {
                  const Icon = ch.icon;
                  const selected = channels.includes(ch.value);
                  return (
                    <Button
                      key={ch.value}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className="h-auto flex-col gap-1 py-2.5"
                      onClick={() => toggleChannel(ch.value)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px]">{ch.label}</span>
                    </Button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-[10px]">
                {channels.length} channel{channels.length !== 1 ? "s" : ""} selected
              </p>
            </div>

            {/* Audience */}
            <AudienceSelector
              value={audience}
              onChange={(f) => {
                setAudience(f);
                setDryRunResult(null);
                setLargeAudienceConfirmed(false);
              }}
              workspaceId={workspaceId}
              showWorkspaceFilter={!workspaceId}
            />

            {/* Subject (shared across channels) */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">Subject / Title</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Message subject"
                className="h-8 text-sm"
              />
            </div>

            {/* Email-specific */}
            {hasEmail && (
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs font-medium">
                    Email Template
                  </Label>
                  <Select value={template} onValueChange={(v) => setTemplate(v as Template)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {classification && (
                    <Badge variant="outline" className="text-muted-foreground text-[10px]">
                      {classification}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs font-medium">Email Body</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your email in markdown..."
                    className="min-h-[120px] text-sm"
                  />
                </div>
              </div>
            )}

            {/* SMS-specific */}
            {hasSms && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-xs font-medium">SMS Body</Label>
                  <span
                    className={`text-xs ${smsBody.length > 160 ? "text-orange-500" : "text-muted-foreground"}`}
                  >
                    {smsBody.length}/160 ({smsSegments} segment{smsSegments !== 1 ? "s" : ""})
                  </span>
                </div>
                <Textarea
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value.slice(0, 1600))}
                  placeholder="SMS message (plain text)..."
                  className="min-h-[80px] text-sm"
                  maxLength={1600}
                />
              </div>
            )}

            {/* Push-specific */}
            {hasPush && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-xs font-medium">Push Title</Label>
                  <span
                    className={`text-xs ${pushTitle.length > 50 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {pushTitle.length}/50
                  </span>
                </div>
                <Input
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value.slice(0, 50))}
                  placeholder="Push notification title"
                  className="h-8 text-sm"
                  maxLength={50}
                />
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-xs font-medium">Push Body</Label>
                  <span
                    className={`text-xs ${pushBody.length > 200 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {pushBody.length}/200
                  </span>
                </div>
                <Textarea
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value.slice(0, 200))}
                  placeholder="Push notification body..."
                  className="min-h-[60px] text-sm"
                  maxLength={200}
                />
              </div>
            )}

            {/* Action URL (shared for push/in-app) */}
            {(hasPush || channels.includes("in_app")) && (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">Action URL</Label>
                <Input
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="/dashboard/..."
                  className="h-8 text-sm"
                />
              </div>
            )}

            {/* Scheduling */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-medium">Delivery</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={scheduleMode === "now" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setScheduleMode("now")}
                >
                  <Send className="h-3 w-3" />
                  Send now
                </Button>
                <Button
                  type="button"
                  variant={scheduleMode === "scheduled" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setScheduleMode("scheduled")}
                >
                  <CalendarClock className="h-3 w-3" />
                  Schedule
                </Button>
              </div>
              {scheduleMode === "scheduled" && (
                <div className="space-y-1.5">
                  <Input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="h-8 text-sm"
                  />
                  {scheduledFor && (
                    <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                      <Clock className="h-3 w-3" />
                      Will send{" "}
                      {new Date(scheduledFor).toLocaleString("no-NO", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDryRun}
                disabled={!audience || isDryRunning}
              >
                {isDryRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <FlaskConical className="h-3 w-3" />
                )}
                Dry Run
              </Button>
            </div>

            {/* Dry run result */}
            {dryRunResult && (
              <div className="bg-muted/50 rounded-md border p-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Recipients:</span>{" "}
                  <span className="font-medium">{dryRunResult.recipientCount}</span>
                </p>
                {dryRunResult.preview && (
                  <p className="text-muted-foreground mt-1 text-xs">{dryRunResult.preview}</p>
                )}
              </div>
            )}

            {/* Type to confirm for large audiences */}
            {needsTypeConfirm && !largeAudienceConfirmed && (
              <TypeToConfirm
                expectedValue={dryRunResult!.recipientCount}
                label={`This will send to ${dryRunResult!.recipientCount} recipients across ${channels.length} channel(s). Type the number to confirm.`}
                onConfirmed={() => setLargeAudienceConfirmed(true)}
              />
            )}

            {/* Send */}
            <div className="mt-auto border-t pt-4">
              <Button
                className="w-full"
                disabled={!canSend || isSending || (scheduleMode === "scheduled" && !scheduledFor)}
                onClick={() => setConfirmOpen(true)}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : scheduleMode === "scheduled" ? (
                  <CalendarClock className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {scheduleMode === "scheduled" ? "Schedule" : "Send"} via {channels.length} channel
                {channels.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={scheduleMode === "scheduled" ? "Schedule message?" : "Send message?"}
        description={
          scheduleMode === "scheduled"
            ? `This will schedule "${subject}" for ${scheduledFor ? new Date(scheduledFor).toLocaleString("no-NO") : "later"} to ${dryRunResult?.recipientCount ?? "the selected"} recipients via ${channels.join(", ")}.`
            : `This will send "${subject}" to ${dryRunResult?.recipientCount ?? "the selected"} recipients via ${channels.join(", ")}. This action cannot be undone.`
        }
        confirmLabel={scheduleMode === "scheduled" ? "Schedule" : "Send"}
        onConfirm={handleSend}
      />
    </>
  );
}
