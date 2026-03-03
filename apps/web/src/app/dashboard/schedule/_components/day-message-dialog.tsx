// ============================================
// day-message-dialog.tsx
// Dialog for creating a day message (daginfo).
// Day messages are scoped notifications visible to staff
// working on a specific day — audience, visibility, and
// alert level can be configured.
// Connected to: schedule-context.tsx (ADD_MESSAGE action)
// Connected to: day-context-menu.tsx (opens this dialog)
// ============================================
"use client";

import { useContext, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { DashboardContext } from "@/components/dashboard/DashboardShell";

import { useCreateDayMessage } from "../_hooks/use-day-content";
import { useWeekRange } from "../_hooks/use-week-range";

// ── Props ───────────────────────────────────────────────────

type DayMessageDialogProps = {
  dateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Dialog for creating a day message / day info item.
 * Fields: title, content, audience, visibility, is-alert toggle.
 * Dispatches ADD_MESSAGE on submit.
 *
 * @param dateId - The day this message belongs to
 * @param open - Controlled open state
 * @param onOpenChange - Callback when open state changes
 * @returns shadcn Dialog component
 */
export function DayMessageDialog({ dateId, open, onOpenChange }: DayMessageDialogProps) {
  const { weekStart } = useWeekRange();
  const createDayMessage = useCreateDayMessage(weekStart);
  const { profileId } = useContext(DashboardContext);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<string>("all");
  const [visibility, setVisibility] = useState<string>("all_day");
  const [isAlert, setIsAlert] = useState(false);

  /** Resets all form fields to defaults. */
  function resetForm() {
    setTitle("");
    setContent("");
    setAudience("all");
    setVisibility("all_day");
    setIsAlert(false);
  }

  /** Dispatches the ADD_MESSAGE action and closes the dialog. */
  function handleSubmit() {
    if (!title.trim()) return;

    createDayMessage.mutate({
      id: crypto.randomUUID(),
      dateId,
      title: title.trim(),
      content: content.trim(),
      audience: audience as "all" | "leaders" | string,
      visibility: visibility as "all_day" | "until_16" | "permanent",
      author: profileId ?? "",
      isAlert,
    });

    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="border-border relative overflow-hidden rounded-t-lg border-b px-6 pt-6 pb-4">
          <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
          <DialogHeader>
            <DialogTitle>Opprett daginfo</DialogTitle>
            <DialogDescription>
              Legg til en melding som vises for ansatte som jobber denne dagen.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-6 py-4">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="msg-title">Tittel</Label>
            <Input
              id="msg-title"
              placeholder="F.eks. Viktig beskjed"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Content */}
          <div className="grid gap-2">
            <Label htmlFor="msg-content">Innhold</Label>
            <Textarea
              id="msg-content"
              placeholder="Skriv meldingen her..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
          </div>

          {/* Audience */}
          <div className="grid gap-2">
            <Label>Mottakere</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger>
                <SelectValue placeholder="Velg mottakere" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="leaders">Ledere</SelectItem>
                <SelectItem value="Kjokken">Kjokken</SelectItem>
                <SelectItem value="Sal & Service">Sal &amp; Service</SelectItem>
                <SelectItem value="Drift">Drift</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Visibility */}
          <div className="grid gap-2">
            <Label>Synlighet</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue placeholder="Velg synlighet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_day">Hele dagen</SelectItem>
                <SelectItem value="until_16">Til 16:00</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alert toggle */}
          <div className="border-border flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="msg-alert">Merk som varsel</Label>
              <p className="text-muted-foreground text-xs">Varsler vises med uthevet styling</p>
            </div>
            <Switch id="msg-alert" checked={isAlert} onCheckedChange={setIsAlert} />
          </div>
        </div>

        <DialogFooter className="border-border border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            Opprett melding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
