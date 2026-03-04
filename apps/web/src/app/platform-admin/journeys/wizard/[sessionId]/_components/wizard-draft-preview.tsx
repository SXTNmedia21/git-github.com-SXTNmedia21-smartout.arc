// ============================================
// wizard-draft-preview.tsx — Draft Journey Preview Sidebar
// Displays the current state of the draft journey being built
// by the wizard. Updates as the agent fills in fields.
// Connected to: DraftJourney type from @smartout/types
// ============================================

"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type DraftJourney = Record<string, unknown>;

type WizardDraftPreviewProps = {
  draft: DraftJourney;
};

/**
 * Sidebar panel showing the progressive draft journey state.
 * Empty fields show "Not yet defined" placeholders.
 * Updates in real-time as the agent calls save_draft.
 */
export function WizardDraftPreview({ draft }: WizardDraftPreviewProps) {
  const steps = (draft.steps as Array<{ title: string; action: string }>) ?? [];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <h3 className="text-foreground text-sm font-semibold">Draft Journey</h3>

        {/* Title */}
        <Field label="Title" value={draft.title as string} />

        {/* Classification badges */}
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">Classification</span>
          <div className="flex flex-wrap gap-1.5">
            <ClassBadge label="Module" value={draft.module as string} />
            <ClassBadge label="Actor" value={draft.actor as string} />
            <ClassBadge label="Platform" value={draft.platform as string} />
            <ClassBadge label="Priority" value={draft.priority as string} />
          </div>
        </div>

        {/* Tags */}
        {(draft.tags as string[])?.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Tags</span>
            <div className="flex flex-wrap gap-1">
              {(draft.tags as string[]).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Trigger */}
        <Field label="Trigger" value={draft.trigger_description as string} />

        {/* Steps */}
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs font-medium">Steps ({steps.length})</span>
          {steps.length === 0 ? (
            <p className="text-muted-foreground/60 text-xs italic">Not yet defined</p>
          ) : (
            <ol className="list-inside list-decimal space-y-1">
              {steps.map((step, i) => (
                <li key={i} className="text-foreground text-xs">
                  {step.title}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Testing */}
        <Field label="Test Assertion" value={draft.test_assertion as string} />

        {/* Preconditions */}
        {(draft.preconditions as string[])?.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Preconditions</span>
            <ul className="list-inside list-disc space-y-0.5">
              {(draft.preconditions as string[]).map((pre, i) => (
                <li key={i} className="text-foreground text-xs">
                  {pre}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Documentation */}
        <Field label="Doc Title" value={draft.doc_title as string} />
        <Field label="Success Outcome" value={draft.outcomes_success as string} />
        <Field label="Empty Outcome" value={draft.outcomes_empty as string} />
        <Field label="Error Outcome" value={draft.outcomes_error as string} />
      </div>
    </ScrollArea>
  );
}

/**
 * Simple label + value display. Shows placeholder if value is empty.
 */
function Field({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="space-y-0.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {value ? (
        <p className="text-foreground text-xs">{value}</p>
      ) : (
        <p className="text-muted-foreground/60 text-xs italic">Not yet defined</p>
      )}
    </div>
  );
}

/**
 * Classification badge showing label:value.
 */
function ClassBadge({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <Badge variant="secondary" className="text-xs">
      {label}: {value}
    </Badge>
  );
}
