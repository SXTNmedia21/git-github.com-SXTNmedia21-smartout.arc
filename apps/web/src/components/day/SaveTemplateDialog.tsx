"use client";

/**
 * SaveTemplateDialog — modal for saving the current Dagslinjen canvas as a
 * named timeline template.
 *
 * Auto-detects scope (type + id) from the active ScopeFilterPill state.
 * Shows a preview of the items that will be saved (passed in by parent).
 * Calls useSaveTemplate mutation on submit.
 *
 * Name collision 409: highlights the name field + shows inline error message.
 *
 * ADR-0151: workspace_id + created_by are NOT sent in the body — BFF derives
 * them server-side from the session JWT.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Save flow
 * ADR ref:  ADR-0334
 */

import { useState } from "react";
import { Save, Users, Building, MapPin, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSaveTemplate } from "@/app/dashboard/_hooks/timeline-template";
import type { TimelineTemplateItemT, ScopeTypeT } from "@smartout/types";

// ── Scope chip helper ──────────────────────────────────────────────────────────

const SCOPE_META: Record<ScopeTypeT, { label: string; Icon: typeof Users; colorClass: string }> = {
  team: {
    label: "Team",
    Icon: Users,
    colorClass:
      "bg-[oklch(0.90_0.04_250)] text-[oklch(0.35_0.14_250)] border-[oklch(0.80_0.08_250)]",
  },
  department: {
    label: "Avdeling",
    Icon: Building,
    colorClass:
      "bg-[oklch(0.90_0.04_145)] text-[oklch(0.30_0.14_145)] border-[oklch(0.78_0.10_145)]",
  },
  location: {
    label: "Lokasjon",
    Icon: MapPin,
    colorClass: "bg-[oklch(0.90_0.04_55)] text-[oklch(0.30_0.10_55)] border-[oklch(0.82_0.08_55)]",
  },
  shift: {
    label: "Vakt",
    Icon: Clock,
    colorClass: "bg-muted text-muted-foreground border-border",
  },
};

const KIND_LABELS: Record<string, string> = {
  schedule_shift: "Vakt",
  session_hook: "Hook",
  session_task: "Oppgave",
  session_note: "Notat",
  deviation: "Avvik",
  free_form: "Fri tekst",
};

// ── Types ──────────────────────────────────────────────────────────────────────

export type SaveTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Active scope from ScopeFilterPill. */
  scopeType: ScopeTypeT;
  scopeId: string;
  /** Human-readable scope name for preview (e.g. "Servitørteam Lørdag"). */
  scopeName?: string;
  /** Items currently on the canvas that will be saved. */
  items: TimelineTemplateItemT[];
};

// ── Item count summary ────────────────────────────────────────────────────────

function countByKind(items: TimelineTemplateItemT[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.kind] = (counts[item.kind] ?? 0) + 1;
  }
  return counts;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SaveTemplateDialog({
  open,
  onOpenChange,
  workspaceId,
  scopeType,
  scopeId,
  scopeName,
  items,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const saveMutation = useSaveTemplate();
  const scopeMeta = SCOPE_META[scopeType];
  const ScopeIcon = scopeMeta.Icon;
  const kindCounts = countByKind(items);
  const hasItems = items.length > 0;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setNotes("");
      setNameError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Navn er påkrevd");
      return;
    }
    if (trimmedName.length > 80) {
      setNameError("Maks 80 tegn");
      return;
    }
    if (!hasItems) {
      setNameError("Legg til minst ett element på tidslinjen først");
      return;
    }

    setNameError(null);

    await saveMutation.mutateAsync(
      {
        name: trimmedName,
        scope_type: scopeType,
        scope_id: scopeId,
        items_json: items,
        notes: notes.trim() || null,
        workspaceId,
      },
      {
        onSuccess: () => {
          handleOpenChange(false);
        },
        onError: (err) => {
          // HTTP 409 from BFF = name collision
          if (
            err.message.toLowerCase().includes("409") ||
            err.message.toLowerCase().includes("navn")
          ) {
            setNameError("Navn finnes allerede for dette omfanget");
          }
        },
      },
    );
  }

  const isPending = saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-labelledby="save-template-title">
        <DialogHeader>
          <DialogTitle id="save-template-title" className="flex items-center gap-2">
            <Save className="text-muted-foreground h-4 w-4" aria-hidden />
            Lagre tidslinje
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-4">
          {/* Scope info */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${scopeMeta.colorClass}`}
            >
              <ScopeIcon className="h-3 w-3" aria-hidden />
              {scopeMeta.label}
              {scopeName ? `: ${scopeName}` : ""}
            </span>
            <span className="text-muted-foreground text-xs">
              {items.length} element{items.length !== 1 ? "er" : ""}
            </span>
          </div>

          {/* Name field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name" className="text-sm font-medium">
              Navn <span aria-hidden>*</span>
            </Label>
            <Input
              id="template-name"
              autoFocus
              placeholder="t.eks. Lørdag middag – Servitørteam"
              value={name}
              maxLength={80}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              aria-describedby={nameError ? "template-name-error" : undefined}
              className={nameError ? "border-destructive focus-visible:ring-destructive" : ""}
              disabled={isPending}
            />
            {nameError && (
              <p id="template-name-error" className="text-destructive text-xs" role="alert">
                {nameError}
              </p>
            )}
            <p className="text-muted-foreground text-xs">{name.length}/80 tegn</p>
          </div>

          {/* Notes (optional) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-notes" className="text-sm font-medium">
              Notater <span className="text-muted-foreground font-normal">(valgfritt)</span>
            </Label>
            <Textarea
              id="template-notes"
              placeholder="Kontekst, spesialtilpasninger…"
              value={notes}
              maxLength={280}
              rows={2}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              className="resize-none"
            />
            <p className="text-muted-foreground text-xs">{notes.length}/280 tegn</p>
          </div>

          {/* Preview */}
          {hasItems ? (
            <div className="border-border bg-muted/50 rounded-md border px-3 py-2.5">
              <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
                Elementer som lagres
              </p>
              <ul className="space-y-1">
                {Object.entries(kindCounts).map(([kind, count]) => (
                  <li key={kind} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{KIND_LABELS[kind] ?? kind}</span>
                    <span className="text-muted-foreground font-mono text-xs">{count}×</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="border-border bg-muted/50 rounded-md border px-3 py-3 text-center">
              <p className="text-muted-foreground text-xs">
                Ingen elementer på tidslinjen ennå.
                <br />
                Legg til elementer via tidslinjestripe, og lagre deretter.
              </p>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isPending || !hasItems}>
              {isPending ? "Lagrer…" : "Lagre tidslinje"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
