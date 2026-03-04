// ============================================
// journey-edit-form.tsx — Journey Metadata Edit Form
// Allows editing journey metadata fields with form validation.
// Calls PATCH /api/platform-admin/journeys/[id] on save.
// Connected to: journey-detail-client.tsx (parent)
// ============================================

"use client";

import { useState } from "react";
import type {
  Journey,
  JourneyModule,
  JourneyActor,
  JourneyPlatform,
  JourneyPriority,
} from "@smartout/types";
import { MODULE_META, ACTOR_META, PRIORITY_META, PLATFORM_META } from "@/lib/journey/module-meta";
import { splitComma } from "@/lib/journey/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";

// ─── Types ──────────────────────────────────────────────

type JourneyEditFormProps = {
  journey: Journey;
  onSaved: (updated: Journey) => void;
  onCancel: () => void;
};

// ─── Helpers ────────────────────────────────────────────

/**
 * Compares old and new values and returns only the changed fields.
 * Used to send a minimal PATCH payload.
 */
function getChangedFields(
  original: Journey,
  fields: {
    title: string;
    module: JourneyModule;
    actor: JourneyActor;
    platform: JourneyPlatform;
    priority: JourneyPriority;
    tags: string[];
    trigger_description: string;
    preconditions: string[];
    test_assertion: string;
    doc_title: string;
    outcomes_success: string;
    outcomes_empty: string;
    outcomes_error: string;
  },
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};

  if (fields.title !== original.title) changes.title = fields.title;
  if (fields.module !== original.module) changes.module = fields.module;
  if (fields.actor !== original.actor) changes.actor = fields.actor;
  if (fields.platform !== original.platform) changes.platform = fields.platform;
  if (fields.priority !== original.priority) changes.priority = fields.priority;

  // Compare arrays by JSON serialization
  if (JSON.stringify(fields.tags) !== JSON.stringify(original.tags)) {
    changes.tags = fields.tags;
  }
  if (JSON.stringify(fields.preconditions) !== JSON.stringify(original.preconditions)) {
    changes.preconditions = fields.preconditions;
  }

  // Nullable strings: empty string becomes null
  const triggerVal = fields.trigger_description.trim() || null;
  if (triggerVal !== original.trigger_description) changes.trigger_description = triggerVal;

  const testVal = fields.test_assertion.trim() || null;
  if (testVal !== original.test_assertion) changes.test_assertion = testVal;

  const docVal = fields.doc_title.trim() || null;
  if (docVal !== original.doc_title) changes.doc_title = docVal;

  const successVal = fields.outcomes_success.trim() || null;
  if (successVal !== original.outcomes_success) changes.outcomes_success = successVal;

  const emptyVal = fields.outcomes_empty.trim() || null;
  if (emptyVal !== original.outcomes_empty) changes.outcomes_empty = emptyVal;

  const errorVal = fields.outcomes_error.trim() || null;
  if (errorVal !== original.outcomes_error) changes.outcomes_error = errorVal;

  return changes;
}

// ─── Module option keys ─────────────────────────────────

const MODULE_KEYS = Object.keys(MODULE_META) as JourneyModule[];
const ACTOR_KEYS = Object.keys(ACTOR_META) as JourneyActor[];
const PLATFORM_KEYS = Object.keys(PLATFORM_META) as JourneyPlatform[];
const PRIORITY_KEYS = Object.keys(PRIORITY_META) as JourneyPriority[];

// ─── Component ──────────────────────────────────────────

/**
 * Form component for editing journey metadata.
 * Sends only changed fields via PATCH to minimize server work.
 *
 * @param journey - Current journey data to populate form
 * @param onSaved - Callback with updated journey after successful save
 * @param onCancel - Callback when user cancels editing
 */
export function JourneyEditForm({ journey, onSaved, onCancel }: JourneyEditFormProps) {
  // ── Field state ───────────────────────────────────────
  const [title, setTitle] = useState(journey.title);
  const [module, setModule] = useState<JourneyModule>(journey.module);
  const [actor, setActor] = useState<JourneyActor>(journey.actor);
  const [platform, setPlatform] = useState<JourneyPlatform>(journey.platform);
  const [priority, setPriority] = useState<JourneyPriority>(journey.priority);
  const [tagsInput, setTagsInput] = useState(journey.tags.join(", "));
  const [triggerDescription, setTriggerDescription] = useState(journey.trigger_description ?? "");
  const [preconditionsInput, setPreconditionsInput] = useState(journey.preconditions.join(", "));
  const [testAssertion, setTestAssertion] = useState(journey.test_assertion ?? "");
  const [docTitle, setDocTitle] = useState(journey.doc_title ?? "");
  const [outcomesSuccess, setOutcomesSuccess] = useState(journey.outcomes_success ?? "");
  const [outcomesEmpty, setOutcomesEmpty] = useState(journey.outcomes_empty ?? "");
  const [outcomesError, setOutcomesError] = useState(journey.outcomes_error ?? "");

  const [saving, setSaving] = useState(false);

  // ── Submit handler ────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const fields = {
      title: title.trim(),
      module,
      actor,
      platform,
      priority,
      tags: splitComma(tagsInput),
      trigger_description: triggerDescription,
      preconditions: splitComma(preconditionsInput),
      test_assertion: testAssertion,
      doc_title: docTitle,
      outcomes_success: outcomesSuccess,
      outcomes_empty: outcomesEmpty,
      outcomes_error: outcomesError,
    };

    const changes = getChangedFields(journey, fields);

    if (Object.keys(changes).length === 0) {
      toast.info("No changes to save");
      onCancel();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/platform-admin/journeys/${journey.journey_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update journey");
        return;
      }

      const data = await res.json();
      onSaved(data.journey);
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
          <CardTitle className="text-sm font-medium">Edit Journey {journey.code}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Journey title"
              required
            />
          </div>

          {/* Enum selects — 2-column grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-module">Module</Label>
              <Select value={module} onValueChange={(v) => setModule(v as JourneyModule)}>
                <SelectTrigger id="edit-module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {MODULE_META[key].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-actor">Actor</Label>
              <Select value={actor} onValueChange={(v) => setActor(v as JourneyActor)}>
                <SelectTrigger id="edit-actor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTOR_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {ACTOR_META[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-platform">Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as JourneyPlatform)}>
                <SelectTrigger id="edit-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {PLATFORM_META[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as JourneyPriority)}>
                <SelectTrigger id="edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {PRIORITY_META[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="edit-tags">Tags</Label>
            <Input
              id="edit-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
            <p className="text-muted-foreground text-xs">Comma-separated values</p>
          </div>

          <Separator />

          {/* Trigger description */}
          <div className="space-y-2">
            <Label htmlFor="edit-trigger">Trigger Description</Label>
            <Textarea
              id="edit-trigger"
              value={triggerDescription}
              onChange={(e) => setTriggerDescription(e.target.value)}
              placeholder="What triggers this journey?"
              rows={2}
            />
          </div>

          {/* Preconditions */}
          <div className="space-y-2">
            <Label htmlFor="edit-preconditions">Preconditions</Label>
            <Input
              id="edit-preconditions"
              value={preconditionsInput}
              onChange={(e) => setPreconditionsInput(e.target.value)}
              placeholder="condition1, condition2"
            />
            <p className="text-muted-foreground text-xs">Comma-separated values</p>
          </div>

          {/* Test assertion */}
          <div className="space-y-2">
            <Label htmlFor="edit-test-assertion">Test Assertion</Label>
            <Textarea
              id="edit-test-assertion"
              value={testAssertion}
              onChange={(e) => setTestAssertion(e.target.value)}
              placeholder="Expected test assertion"
              rows={2}
            />
          </div>

          {/* Doc title */}
          <div className="space-y-2">
            <Label htmlFor="edit-doc-title">Documentation Title</Label>
            <Input
              id="edit-doc-title"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="Title for documentation output"
            />
          </div>

          <Separator />

          {/* Outcomes */}
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Outcomes
            </p>
            <div className="space-y-2">
              <Label htmlFor="edit-outcome-success">Success Outcome</Label>
              <Textarea
                id="edit-outcome-success"
                value={outcomesSuccess}
                onChange={(e) => setOutcomesSuccess(e.target.value)}
                placeholder="What happens on success?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-outcome-empty">Empty State</Label>
              <Textarea
                id="edit-outcome-empty"
                value={outcomesEmpty}
                onChange={(e) => setOutcomesEmpty(e.target.value)}
                placeholder="What happens when empty?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-outcome-error">Error State</Label>
              <Textarea
                id="edit-outcome-error"
                value={outcomesError}
                onChange={(e) => setOutcomesError(e.target.value)}
                placeholder="What happens on error?"
                rows={2}
              />
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
