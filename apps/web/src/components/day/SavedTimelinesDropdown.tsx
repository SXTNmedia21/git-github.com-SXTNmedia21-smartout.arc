"use client";

/**
 * SavedTimelinesDropdown — lists saved timeline templates for the active scope.
 *
 * Trigger button: "Lagrede tidslinjer" + count badge.
 * Open state: list of templates (name, item count, scope chip, ⋯ menu).
 * Each row click → opens ApplyTemplateDialog.
 * ⋯ menu → "Arkiver" (calls useArchiveTemplate + confirm AlertDialog).
 * Header "Lagre tidslinje" button → opens SaveTemplateDialog.
 * Empty state: "Ingen lagrede tidslinjer for dette omfanget" + "Lagre nåværende tidslinje" CTA.
 *
 * Only shown when scope_type is not "all" — templates are scoped.
 *
 * Spec ref: docs/superpowers/specs/2026-05-16-timeline-templates-design.md §Build
 * ADR ref:  ADR-0334
 */

import { useState } from "react";
import {
  AlignLeft,
  Archive,
  ChevronDown,
  MapPin,
  MoreVertical,
  Save,
  Users,
  Building,
  Clock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTimelineTemplates, useArchiveTemplate } from "@/app/dashboard/_hooks/timeline-template";
import type { TimelineTemplateRow, ScopeTypeT } from "@smartout/types";
import { ApplyTemplateDialog } from "@/components/day/ApplyTemplateDialog";
import { SaveTemplateDialog } from "@/components/day/SaveTemplateDialog";
import type { TimelineTemplateItemT } from "@smartout/types";
import { cn } from "@smartout/ui";

// ── Scope meta ────────────────────────────────────────────────────────────────

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

// ── Types ──────────────────────────────────────────────────────────────────────

export type SavedTimelinesDropdownProps = {
  workspaceId: string;
  scopeType: ScopeTypeT | null;
  scopeId: string | null;
  scopeName?: string;
  /** ISO date currently viewed — passed to ApplyTemplateDialog. */
  dateISO: string;
  departmentId: string | null;
  sessionId: string | null;
  /** Canvas items (used when opening SaveTemplateDialog). */
  canvasItems: TimelineTemplateItemT[];
};

// ── Template row component ─────────────────────────────────────────────────────

function TemplateRow({
  tpl,
  dateISO,
  onApply,
  onArchive,
}: {
  tpl: TimelineTemplateRow;
  dateISO: string;
  onApply: (tpl: TimelineTemplateRow) => void;
  onArchive: (tpl: TimelineTemplateRow) => void;
}) {
  const scopeMeta = SCOPE_META[tpl.scope_type];
  const ScopeIcon = scopeMeta.Icon;
  const itemCount = Array.isArray(tpl.items_json) ? (tpl.items_json as unknown[]).length : 0;

  // Format next day label for button
  const applyLabel = `Bruk på ${new Date(`${dateISO}T12:00:00Z`).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Oslo",
  })}`;

  return (
    <div
      className="border-border hover:bg-muted/60 flex items-start gap-2 border-b px-3 py-2.5 transition-colors last:border-b-0"
      role="option"
      aria-selected={false}
      aria-label={tpl.name}
    >
      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-[13px] font-medium">{tpl.name}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium",
              scopeMeta.colorClass,
            )}
          >
            <ScopeIcon className="h-2.5 w-2.5" aria-hidden />
            {scopeMeta.label}
          </span>
          <span className="text-muted-foreground text-[11px]">{itemCount} elementer</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onApply(tpl)}
          className="border-border bg-background text-foreground hover:bg-muted h-7 rounded border px-2 text-[11px] font-medium whitespace-nowrap transition-colors"
          aria-label={`${applyLabel} (${tpl.name})`}
        >
          {applyLabel}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex h-7 w-7 items-center justify-center rounded border transition-colors focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Flere valg"
              aria-haspopup="menu"
            >
              <MoreVertical className="h-3.5 w-3.5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={() => onArchive(tpl)}
              className="text-destructive focus:text-destructive flex items-center gap-2 text-sm"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden />
              Arkiver
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SavedTimelinesDropdown({
  workspaceId,
  scopeType,
  scopeId,
  scopeName,
  dateISO,
  departmentId,
  sessionId,
  canvasItems,
}: SavedTimelinesDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<TimelineTemplateRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TimelineTemplateRow | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const templates = useTimelineTemplates({
    workspaceId,
    scopeType,
    scopeId,
  });

  const archiveMutation = useArchiveTemplate();
  const count = templates.data?.length ?? 0;

  function handleApply(tpl: TimelineTemplateRow) {
    setDropdownOpen(false);
    setApplyTarget(tpl);
  }

  function handleArchiveConfirm() {
    if (!archiveTarget || !scopeType || !scopeId) return;
    void archiveMutation.mutateAsync({
      templateId: archiveTarget.id,
      workspaceId,
      scopeType,
      scopeId,
    });
    setArchiveTarget(null);
  }

  function handleSave() {
    setDropdownOpen(false);
    setSaveDialogOpen(true);
  }

  // If no scope is selected, render a minimal disabled state — templates are scope-bound.
  const hasScope = !!scopeType && !!scopeId;

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring flex h-8 items-center gap-1.5 rounded border px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-label="Lagrede tidslinjer"
            data-testid="saved-timelines-trigger"
          >
            <AlignLeft className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
            <span>
              Lagrede tidslinjer
              {count > 0 && (
                <span className="bg-muted text-muted-foreground ml-1.5 rounded-full px-1.5 py-px font-mono text-[10px]">
                  {count}
                </span>
              )}
            </span>
            <ChevronDown className="text-muted-foreground h-3 w-3" aria-hidden />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-80 p-0"
          role="listbox"
          aria-label="Lagrede tidslinjer"
          data-testid="saved-timelines-panel"
        >
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
            <span className="text-foreground text-[13px] font-semibold">Lagrede tidslinjer</span>
            <button
              type="button"
              onClick={handleSave}
              className="border-primary text-primary hover:bg-primary/10 flex items-center gap-1.5 rounded border px-2 py-1 text-[12px] font-medium transition-colors"
              aria-label="Lagre tidslinje"
              disabled={!hasScope}
            >
              <Save className="h-3 w-3" aria-hidden />
              Lagre tidslinje
            </button>
          </div>

          {/* Body */}
          {!hasScope ? (
            <div className="px-3 py-4 text-center">
              <p className="text-muted-foreground text-xs">
                Velg et scope (Avdeling, Team, Lokasjon eller Vakt) for å se lagrede tidslinjer.
              </p>
            </div>
          ) : templates.isLoading ? (
            <div className="px-3 py-4 text-center">
              <p className="text-muted-foreground text-xs">Laster…</p>
            </div>
          ) : !templates.data?.length ? (
            <div className="flex flex-col gap-2 px-3 py-4">
              <p className="text-muted-foreground text-center text-xs">
                Ingen lagrede tidslinjer for dette omfanget
              </p>
              <button
                type="button"
                onClick={handleSave}
                className="border-border text-muted-foreground hover:border-primary hover:text-primary flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs transition-colors"
              >
                <Save className="h-3.5 w-3.5" aria-hidden />
                Lagre nåværende tidslinje
              </button>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {templates.data.map((tpl) => (
                <TemplateRow
                  key={tpl.id}
                  tpl={tpl}
                  dateISO={dateISO}
                  onApply={handleApply}
                  onArchive={(t) => setArchiveTarget(t)}
                />
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ApplyTemplateDialog — mounts outside dropdown to avoid portal nesting */}
      <ApplyTemplateDialog
        open={!!applyTarget}
        onOpenChange={(o) => {
          if (!o) setApplyTarget(null);
        }}
        template={applyTarget}
        targetDate={dateISO}
        workspaceId={workspaceId}
        departmentId={departmentId}
        sessionId={sessionId}
      />

      {/* SaveTemplateDialog */}
      {hasScope && (
        <SaveTemplateDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          workspaceId={workspaceId}
          scopeType={scopeType!}
          scopeId={scopeId!}
          scopeName={scopeName}
          items={canvasItems}
        />
      )}

      {/* Archive confirmation */}
      <AlertDialog
        open={!!archiveTarget}
        onOpenChange={(o) => {
          if (!o) setArchiveTarget(null);
        }}
      >
        <AlertDialogContent aria-labelledby="archive-confirm-title">
          <AlertDialogHeader>
            <AlertDialogTitle id="archive-confirm-title">Arkiver mal</AlertDialogTitle>
            <AlertDialogDescription>
              Arkiver &quot;{archiveTarget?.name}&quot;? Malen kan ikke gjenopprettes via UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiveMutation.isPending ? "Arkiverer…" : "Arkiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
