"use client";

import { useState } from "react";
import { Loader2, Send, FlaskConical } from "lucide-react";
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

export function ComposeEmailSheet({
  open,
  onOpenChange,
  defaultAudience,
  workspaceId,
  workspaceName,
}: ComposeEmailSheetProps) {
  const [audience, setAudience] = useState<AudienceFilter | null>(defaultAudience ?? null);
  const [template, setTemplate] = useState<Template | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [dryRunResult, setDryRunResult] = useState<{
    recipientCount: number;
    preview?: string;
  } | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [largeAudienceConfirmed, setLargeAudienceConfirmed] = useState(false);

  const classification = templates.find((t) => t.value === template)?.classification ?? null;

  const needsTypeConfirm = dryRunResult !== null && dryRunResult.recipientCount > 100;

  const canSend =
    subject.trim() !== "" &&
    message.trim() !== "" &&
    audience !== null &&
    (!needsTypeConfirm || largeAudienceConfirmed);

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
        body: JSON.stringify({ audience, template, subject, message }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Send failed" }));
        toast.error(err.error ?? "Send failed");
        return;
      }

      const data = await res.json();
      toast.success(`Sent to ${data.recipientCount} recipients`);
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
    setTemplate("");
    setSubject("");
    setMessage("");
    setDryRunResult(null);
    setLargeAudienceConfirmed(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-base">Compose Email</SheetTitle>
            <SheetDescription>
              {workspaceName ? `Sending to ${workspaceName}` : "Send platform communication"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 pt-4">
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

            {/* Template */}
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-medium">Template</label>
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

            {/* Subject */}
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-medium">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line"
                className="h-8 text-sm"
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-medium">Message</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message in markdown..."
                className="min-h-[160px] text-sm"
              />
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
                label={`This will send to ${dryRunResult!.recipientCount} recipients. Type the number to confirm.`}
                onConfirmed={() => setLargeAudienceConfirmed(true)}
              />
            )}

            {/* Send */}
            <div className="mt-auto border-t pt-4">
              <Button
                className="w-full"
                disabled={!canSend || isSending}
                onClick={() => setConfirmOpen(true)}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send email?"
        description={`This will send "${subject}" to ${dryRunResult?.recipientCount ?? "the selected"} recipients. This action cannot be undone.`}
        confirmLabel="Send"
        onConfirm={handleSend}
      />
    </>
  );
}
