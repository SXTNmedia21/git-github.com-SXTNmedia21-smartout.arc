// ============================================
// visitor-tag-dialog.tsx
// Dialog for manually tagging an anonymous landing visitor.
// Allows admins to set a human-readable label and optional notes
// so anonymous visitor IDs become recognizable.
//
// Connected to: session-detail.tsx (parent)
//               api/admin/tag-visitor/route.ts (save endpoint)
// ============================================

"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type VisitorTagDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitorId: string;
  currentLabel?: string | null;
  currentNotes?: string | null;
};

export function VisitorTagDialog({
  open,
  onOpenChange,
  visitorId,
  currentLabel,
  currentNotes,
}: VisitorTagDialogProps) {
  const [label, setLabel] = useState(currentLabel ?? "");
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [saving, setSaving] = useState(false);

  // Reset fields when dialog opens with new data
  useEffect(() => {
    if (open) {
      setLabel(currentLabel ?? "");
      setNotes(currentNotes ?? "");
    }
  }, [open, currentLabel, currentNotes]);

  async function handleSave() {
    if (!label.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/tag-visitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_id: visitorId,
          label: label.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tag Visitor</DialogTitle>
          <DialogDescription>
            Give this anonymous visitor a human-readable label so you can recognize them later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tag-label">Label</Label>
            <Input
              id="tag-label"
              placeholder="e.g., Johan, Restaurang Nemo"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tag-notes">Notes (optional)</Label>
            <Textarea
              id="tag-notes"
              placeholder="Any extra context about this visitor..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!label.trim() || saving}>
            {saving ? "Saving..." : "Save Tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
