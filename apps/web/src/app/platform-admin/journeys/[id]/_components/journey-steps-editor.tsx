// ============================================
// journey-steps-editor.tsx — Journey Step Editor
// Editable list of journey steps with add, edit, reorder, and delete.
// Calls PUT /api/platform-admin/journeys/[id]/steps on save.
// Connected to: journey-detail-client.tsx (parent)
// ============================================

"use client";

import { useState } from "react";
import type { JourneyStep } from "@smartout/types";
import { splitComma } from "@/lib/journey/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Loader2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────

type JourneyStepsEditorProps = {
  journeyId: string;
  initialSteps: JourneyStep[];
  onSaved: () => void;
  onCancel: () => void;
};

/**
 * Editable fields for a single step. Kept separate from the
 * full JourneyStep type since we only edit a subset of fields.
 */
type EditableStep = {
  id: string;
  title: string;
  action: string;
  expects: string;
  screen: string;
  component: string;
  data_reads: string;
  data_writes: string;
  notes: string;
  expanded: boolean;
};

// ─── Helpers ────────────────────────────────────────────

/**
 * Converts a JourneyStep from the API into the editable format.
 * Arrays are joined to comma-separated strings for text input.
 */
function toEditable(step: JourneyStep): EditableStep {
  return {
    id: step.journey_step_id,
    title: step.title,
    action: step.action,
    expects: step.expects ?? "",
    screen: step.screen ?? "",
    component: step.component ?? "",
    data_reads: step.data_reads.join(", "),
    data_writes: step.data_writes.join(", "),
    notes: step.notes ?? "",
    expanded: false,
  };
}

/**
 * Creates a blank step for the "Add Step" action.
 */
function createBlankStep(): EditableStep {
  return {
    id: crypto.randomUUID(),
    title: "",
    action: "",
    expects: "",
    screen: "",
    component: "",
    data_reads: "",
    data_writes: "",
    notes: "",
    expanded: true,
  };
}

// ─── Component ──────────────────────────────────────────

/**
 * Editable list of journey steps. Supports add, edit, reorder
 * (move up/down), and delete. Saves all steps at once via PUT.
 *
 * @param journeyId - The journey UUID to save steps for
 * @param initialSteps - Current steps to populate the editor
 * @param onSaved - Callback after successful save (parent refreshes data)
 * @param onCancel - Callback when user cancels editing
 */
export function JourneyStepsEditor({
  journeyId,
  initialSteps,
  onSaved,
  onCancel,
}: JourneyStepsEditorProps) {
  const [editableSteps, setEditableSteps] = useState<EditableStep[]>(initialSteps.map(toEditable));
  const [saving, setSaving] = useState(false);

  // ── Step manipulation ─────────────────────────────────

  function updateStep(index: number, field: keyof EditableStep, value: string | boolean) {
    setEditableSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
    );
  }

  function moveStep(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editableSteps.length) return;

    setEditableSteps((prev) => {
      const next = [...prev];
      const a = next[index];
      const b = next[targetIndex];
      if (!a || !b) return prev;
      next[index] = b;
      next[targetIndex] = a;
      return next;
    });
  }

  function removeStep(index: number) {
    setEditableSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    setEditableSteps((prev) => [...prev, createBlankStep()]);
  }

  function toggleExpanded(index: number) {
    setEditableSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, expanded: !step.expanded } : step)),
    );
  }

  // ── Save handler ──────────────────────────────────────

  async function handleSave() {
    // Validate required fields
    for (let i = 0; i < editableSteps.length; i++) {
      const step = editableSteps[i];
      if (!step) continue;
      if (!step.title.trim()) {
        toast.error(`Step ${i + 1}: Title is required`);
        return;
      }
      if (!step.action.trim()) {
        toast.error(`Step ${i + 1}: Action is required`);
        return;
      }
    }

    const payload = editableSteps.map((step, index) => ({
      step_order: index + 1,
      title: step.title.trim(),
      action: step.action.trim(),
      expects: step.expects.trim() || null,
      screen: step.screen.trim() || null,
      component: step.component.trim() || null,
      data_reads: splitComma(step.data_reads),
      data_writes: splitComma(step.data_writes),
      notes: step.notes.trim() || null,
    }));

    setSaving(true);
    try {
      const res = await fetch(`/api/platform-admin/journeys/${journeyId}/steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: payload }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save steps");
        return;
      }

      onSaved();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Edit Steps ({editableSteps.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Steps
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editableSteps.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No steps yet. Click &quot;Add Step&quot; below.
          </p>
        ) : (
          <div className="space-y-3">
            {editableSteps.map((step, index) => (
              <div key={step.id} className="bg-muted/30 space-y-3 rounded-lg border p-4">
                {/* Step header row */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="h-7 w-7 shrink-0 items-center justify-center p-0 text-xs font-semibold"
                  >
                    {index + 1}
                  </Badge>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(index)}
                    className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                  >
                    {step.expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <Input
                      value={step.title}
                      onChange={(e) => updateStep(index, "title", e.target.value)}
                      placeholder="Step title *"
                      className="h-8 text-sm font-medium"
                    />
                  </div>

                  {/* Reorder + delete controls */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveStep(index, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveStep(index, "down")}
                      disabled={index === editableSteps.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive h-7 w-7"
                      onClick={() => removeStep(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Action — always visible */}
                <div className="space-y-1.5 pl-[3.25rem]">
                  <Label className="text-xs">Action *</Label>
                  <Input
                    value={step.action}
                    onChange={(e) => updateStep(index, "action", e.target.value)}
                    placeholder="What the user does in this step"
                    className="h-8 text-sm"
                  />
                </div>

                {/* Expanded fields */}
                {step.expanded && (
                  <div className="space-y-3 pl-[3.25rem]">
                    <Separator />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Expects</Label>
                        <Input
                          value={step.expects}
                          onChange={(e) => updateStep(index, "expects", e.target.value)}
                          placeholder="Expected result"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Screen</Label>
                        <Input
                          value={step.screen}
                          onChange={(e) => updateStep(index, "screen", e.target.value)}
                          placeholder="e.g. /dashboard/settings"
                          className="h-8 font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Component</Label>
                        <Input
                          value={step.component}
                          onChange={(e) => updateStep(index, "component", e.target.value)}
                          placeholder="e.g. TeamMemberTable"
                          className="h-8 font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data Reads</Label>
                        <Input
                          value={step.data_reads}
                          onChange={(e) => updateStep(index, "data_reads", e.target.value)}
                          placeholder="table1, table2"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data Writes</Label>
                        <Input
                          value={step.data_writes}
                          onChange={(e) => updateStep(index, "data_writes", e.target.value)}
                          placeholder="table1, table2"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Notes</Label>
                      <Textarea
                        value={step.notes}
                        onChange={(e) => updateStep(index, "notes", e.target.value)}
                        placeholder="Additional notes for this step"
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add step button */}
        <Button variant="outline" size="sm" onClick={addStep} className="w-full">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Step
        </Button>
      </CardContent>
    </Card>
  );
}
