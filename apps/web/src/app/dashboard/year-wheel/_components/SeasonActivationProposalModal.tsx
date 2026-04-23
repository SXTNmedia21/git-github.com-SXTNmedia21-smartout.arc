"use client";

/**
 * SeasonActivationProposalModal — preview + confirmation gate for
 * atomic season activation per ADR-0200 §UI Contract.
 *
 * Replaces the legacy `window.confirm()` in
 * `packages/year-wheel/src/hooks/use-seasons.ts:174-183` with a
 * shadcn Dialog. Reads the preview via `useSeasonActivationPreview`,
 * renders the 6-state matrix (preview-loading | preview-ready |
 * preview-noop | pending | error | success), and delegates the
 * mutation itself to the `activateSeasonAction` Server Action.
 *
 * Wiring into the season-detail page is M1.10 scope — this commit
 * only delivers the component. The consumer provides `seasonId`
 * (null when closed), `seasonName`, the modal open/close state,
 * and an `onActivated` callback that receives the Server Action's
 * success payload so the parent can owns toast + query invalidation.
 *
 * Spring physics are the Nordic Split strict-canonical values
 * locked by ADR-0200 §UI Contract: stiffness=35, damping=22,
 * mass=2.2. `useReducedMotion()` collapses to a 10ms opacity fade
 * so assistive-tech users get no motion surprises.
 *
 * Telemetry: emits `season activation_preview` once per open, only
 * after the preview query resolves. No emit on close/error paths —
 * those are the Server Action's concern (`season activation_failed`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { AlertTriangle, Info, Loader2 } from "lucide-react";

import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { useSeasonActivationPreview } from "@smartout/year-wheel/hooks";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useContext } from "react";
import {
  activateSeasonAction,
  type ActivateSeasonResult,
} from "@/app/dashboard/_actions/activate-season-action";
import { cn } from "@/lib/utils";

// ── Props ─────────────────────────────────────────────────────────
export type SeasonActivationProposalModalProps = {
  /** The season being activated. `null` when the modal is closed. */
  seasonId: string | null;
  /** Display name used in the modal heading. Parent owns copy. */
  seasonName: string;
  /** Controlled open state. */
  open: boolean;
  /** Controlled open-state setter (Dialog standard). */
  onOpenChange: (open: boolean) => void;
  /**
   * Fires with the successful Server Action payload. The parent is
   * responsible for toast + TanStack Query invalidation — this modal
   * closes immediately on success (no in-modal success state).
   */
  onActivated: (result: { departments_affected: number; rows_generated: number }) => void;
};

// ── Internal state model ──────────────────────────────────────────
// Matches ADR-0200 §UI Contract "State matrix (6 states, not 4)".
// `success` is transient — handled by closing the modal, never rendered.
type ModalState =
  | { kind: "preview-loading" }
  | { kind: "preview-ready" }
  | { kind: "preview-noop" }
  | { kind: "pending" }
  | { kind: "error"; recoverable: boolean; messageKey: string };

type ActivationErrorCode = Extract<ActivateSeasonResult, { ok: false }>["error"];

// Terminal errors hide Confirm; recoverable errors keep Confirm
// visible as "Prøv igjen". Matches ADR-0200 §UI Contract → Error
// rendering → recoverability table.
function errorKeyFor(code: ActivationErrorCode): {
  messageKey: string;
  recoverable: boolean;
} {
  switch (code) {
    case "insufficient_authority":
    case "unauthenticated":
      return { messageKey: "seasonActivation.error.authority", recoverable: false };
    case "season_not_found":
      return { messageKey: "seasonActivation.error.alreadyActive", recoverable: false };
    case "missing_budget":
      return { messageKey: "seasonActivation.error.missingBudget", recoverable: true };
    case "missing_day_factors":
      return { messageKey: "seasonActivation.error.missingDayFactors", recoverable: true };
    case "missing_hour_factors":
      return { messageKey: "seasonActivation.error.missingHourFactors", recoverable: true };
    case "rpc_error":
    default:
      return { messageKey: "seasonActivation.error.generic", recoverable: true };
  }
}

// ── Component ─────────────────────────────────────────────────────
export function SeasonActivationProposalModal({
  seasonId,
  seasonName,
  open,
  onOpenChange,
  onActivated,
}: SeasonActivationProposalModalProps) {
  const { t } = useTranslation("year-wheel");
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Strict-canonical spring physics locked by ADR-0200 §UI Contract.
  // Reduced-motion collapses to a 10ms opacity fade — no transforms.
  const transition: Transition = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: "spring", stiffness: 35, damping: 22, mass: 2.2 };

  // Workspace + actor are resolved from the dashboard context. Preview
  // query is `enabled` on both being present; the emit below is gated
  // on the same pair so we never emit with an empty-string fallback.
  const workspace = useWorkspaceOptional();
  const workspaceId = workspace?.workspace.workspace_id ?? null;
  const { profileId } = useContext(DashboardContext);

  const previewQuery = useSeasonActivationPreview(
    open ? seasonId : null,
    open ? workspaceId : null,
  );

  // Tracks the in-flight mutation + any inline error. `pending` gates
  // Escape + Cancel so the user can't dismiss mid-mutation.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorState, setErrorState] = useState<{ recoverable: boolean; messageKey: string } | null>(
    null,
  );

  // ── Reset per-open state ────────────────────────────────────────
  // The parent owns `open`; when it flips false we clear local state
  // so the next open starts clean (no stale error banner).
  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setErrorState(null);
    }
  }, [open]);

  // ── Emit `season activation_preview` exactly once per open ──────
  // Only fires when preview resolves AND we have workspace + actor.
  // Deliberately keyed on `seasonId` so re-opening for a different
  // season emits again; same season re-open is already idempotent
  // because TanStack caches the preview.
  const [previewedSeasonId, setPreviewedSeasonId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    if (!seasonId) return;
    if (!workspaceId || !profileId) return;
    if (!previewQuery.data) return;
    if (previewedSeasonId === seasonId) return;

    const { departments, existingRows, rowsToGenerate } = previewQuery.data;
    void emit({
      event: "season activation_preview",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: { entity_type: "season", entity_id: seasonId },
        data: {
          departments_count: departments,
          existing_hours_rows: existingRows,
          would_generate: rowsToGenerate,
        },
      },
    });
    setPreviewedSeasonId(seasonId);
  }, [open, seasonId, workspaceId, profileId, previewQuery.data, previewedSeasonId]);

  // Reset the emit-guard when the modal closes so re-opens re-emit.
  useEffect(() => {
    if (!open) setPreviewedSeasonId(null);
  }, [open]);

  // ── Derived state ──────────────────────────────────────────────
  const modalState: ModalState = useMemo(() => {
    if (errorState) {
      return {
        kind: "error",
        recoverable: errorState.recoverable,
        messageKey: errorState.messageKey,
      };
    }
    if (isSubmitting) return { kind: "pending" };
    if (previewQuery.isPending || !previewQuery.data) return { kind: "preview-loading" };
    const { existingRows, rowsToGenerate } = previewQuery.data;
    if (existingRows > 0 && rowsToGenerate === 0) return { kind: "preview-noop" };
    return { kind: "preview-ready" };
  }, [errorState, isSubmitting, previewQuery.isPending, previewQuery.data]);

  // ── Confirm handler ────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!seasonId) return;
    setErrorState(null);
    setIsSubmitting(true);
    try {
      const result = await activateSeasonAction(seasonId);
      if (result.ok) {
        onActivated({
          departments_affected: result.departments_affected,
          rows_generated: result.rows_generated,
        });
        // Parent is authoritative for close — still defensively close
        // so a misbehaving parent can't strand the modal.
        onOpenChange(false);
        return;
      }
      const { messageKey, recoverable } = errorKeyFor(result.error);
      setErrorState({ messageKey, recoverable });
    } catch {
      // Network / unexpected — treat as recoverable rpc_error.
      setErrorState({
        messageKey: "seasonActivation.error.generic",
        recoverable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [seasonId, onActivated, onOpenChange]);

  // ── Open/close gating ──────────────────────────────────────────
  // `pending` MUST block all dismissal paths (Escape, overlay click,
  // Cancel). We clamp the setter rather than nulling it out so Radix
  // still invokes it — just treats the dismiss as a no-op.
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isSubmitting) return;
      onOpenChange(nextOpen);
    },
    [isSubmitting, onOpenChange],
  );

  // ── Render ─────────────────────────────────────────────────────
  const showConfirm =
    modalState.kind !== "preview-noop" && modalState.kind !== "error"
      ? true
      : modalState.kind === "error" && modalState.recoverable;

  const confirmDisabled =
    modalState.kind === "preview-loading" || modalState.kind === "pending" || !seasonId;

  const cancelDisabled = modalState.kind === "pending";

  const cancelLabel =
    modalState.kind === "preview-noop" || (modalState.kind === "error" && !modalState.recoverable)
      ? t("seasonActivation.close")
      : t("seasonActivation.cancel");

  const confirmLabel =
    modalState.kind === "pending"
      ? t("seasonActivation.pending")
      : modalState.kind === "error" && modalState.recoverable
        ? t("seasonActivation.retry")
        : t("seasonActivation.confirm");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg"
        // Escape is only allowed in non-pending states (matrix row 4).
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        // Overlay click respects the same rule as Escape.
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-heading">
            {t("seasonActivation.title", { seasonName })}
          </DialogTitle>
          <DialogDescription>{t("seasonActivation.description")}</DialogDescription>
        </DialogHeader>

        {/* ARIA live region — announces state transitions (loading,
            submitting, error) to assistive tech. `polite` so a stuck
            error doesn't interrupt a screen reader mid-sentence. */}
        <div role="status" aria-live="polite" className="sr-only">
          {modalState.kind === "preview-loading" && t("seasonActivation.aria.loadingPreview")}
          {modalState.kind === "pending" && t("seasonActivation.aria.pending")}
          {modalState.kind === "error" && t(modalState.messageKey)}
        </div>

        {/* Body: preview table / noop banner / error banner.
            Wrapped in motion.div so transitions between states use
            the locked canonical spring (or a reduced-motion fade). */}
        <motion.div
          key={modalState.kind}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="space-y-4"
        >
          {modalState.kind === "preview-loading" && (
            <div className="space-y-3" aria-hidden="true">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-10/12" />
            </div>
          )}

          {modalState.kind === "preview-ready" && previewQuery.data && (
            <PreviewSummary
              departments={previewQuery.data.departments}
              existingRows={previewQuery.data.existingRows}
              rowsToGenerate={previewQuery.data.rowsToGenerate}
              labelDepartments={t("seasonActivation.departmentsLabel")}
              labelRows={t("seasonActivation.rowsToGenerateLabel")}
              labelExisting={t("seasonActivation.existingRowsLabel")}
            />
          )}

          {modalState.kind === "preview-noop" && previewQuery.data && (
            <InlineBanner
              tone="info"
              title={t("seasonActivation.noop.title")}
              description={t("seasonActivation.noop.description")}
            />
          )}

          {modalState.kind === "pending" && (
            <div
              className="text-muted-foreground flex items-center gap-2 text-sm"
              aria-hidden="true"
            >
              <Loader2 className="animate-spin" />
              <span>{t("seasonActivation.pending")}</span>
            </div>
          )}

          {modalState.kind === "error" && (
            <InlineBanner tone="destructive" description={t(modalState.messageKey)} />
          )}
        </motion.div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={cancelDisabled}
            aria-disabled={cancelDisabled}
            // Touch target ≥ 44pt — ADR-0200 §Accessibility.
            className="min-h-[44px]"
            // Auto-focus Cancel — safer default for destructive-leaning
            // actions per the ADR's Accessibility section.
            autoFocus
          >
            {cancelLabel}
          </Button>
          {showConfirm && (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={confirmDisabled}
              aria-disabled={confirmDisabled}
              className="min-h-[44px]"
            >
              {modalState.kind === "pending" && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Subcomponents (file-local; no new exports to keep surface tight)

type PreviewSummaryProps = {
  departments: number;
  existingRows: number;
  rowsToGenerate: number;
  labelDepartments: string;
  labelRows: string;
  labelExisting: string;
};

function PreviewSummary({
  departments,
  existingRows,
  rowsToGenerate,
  labelDepartments,
  labelRows,
  labelExisting,
}: PreviewSummaryProps) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{labelDepartments}</dt>
      <dd className="text-foreground text-right font-mono">{departments}</dd>

      <dt className="text-muted-foreground">{labelRows}</dt>
      <dd className="text-foreground text-right font-mono">{rowsToGenerate}</dd>

      <dt className="text-muted-foreground">{labelExisting}</dt>
      <dd className="text-muted-foreground text-right font-mono">{existingRows}</dd>
    </dl>
  );
}

type InlineBannerProps = {
  tone: "info" | "destructive";
  title?: string;
  description: string;
};

function InlineBanner({ tone, title, description }: InlineBannerProps) {
  // No shadcn <Alert> primitive exists in this repo; we compose a
  // minimal banner from tokens so we stay inside the design system
  // (no hardcoded colors, no dark: overrides). Icon + text layout
  // mirrors shadcn's Alert for future consistency.
  const Icon = tone === "destructive" ? AlertTriangle : Info;
  return (
    <div
      // Destructive uses the token-driven destructive surface; info
      // uses the neutral muted surface. Both flip light/dark via CSS
      // variables — no per-scheme overrides.
      className={cn(
        "flex gap-3 rounded-md border p-3 text-sm",
        tone === "destructive"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-muted text-foreground",
      )}
      role={tone === "destructive" ? "alert" : undefined}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        <p className={title ? "text-muted-foreground" : undefined}>{description}</p>
      </div>
    </div>
  );
}
