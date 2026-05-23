"use client";

/**
 * InlineConfirmCard — HITL UI primitive for Botsson mutation confirmations.
 *
 * Renders an inline confirm/edit/cancel card inside a BotssonChat message stream when
 * a show_proposal_card client-tool call arrives. The card presents a structured draft
 * with three affordances: Bekreft (confirm), Endre (edit), Avbryt (cancel).
 *
 * Architecture B per ADR-0398: the descriptor is produced by the LLM calling the
 * show_proposal_card client-tool AFTER a capability tool returns {phase:"draft"}.
 * The onResolve callback posts the InlineConfirmCardResult back to the BFF roundtrip
 * protocol (ADR-0327), resuming the LLM with the user's decision.
 *
 * Visual contract:
 *   - Nordic Split tokens verbatim — bg-card, border-border, text-foreground,
 *     text-muted-foreground, bg-muted, text-destructive, focus-visible:ring-ring.
 *     NEVER hardcoded colors, oklch() literals, or zinc-* classes.
 *   - Motion: spring stiffness=35 / damping=22 / mass=2.2 (Task Manager signature,
 *     NOT Framer default 300/24). useReducedMotion fallback: 150ms opacity-fade.
 *   - Card radius: var(--r-card) = 16px (Task Manager signature).
 *
 * Accessibility:
 *   - role="region" + aria-label on card root.
 *   - ALL buttons have focus-visible ring (ghost buttons highest regression risk).
 *   - Tab order: Bekreft → Endre → Avbryt (happy-path-first, NOT Stripe anti-pattern).
 *   - ESC on card root triggers cancel (parity with help-takeover-kit pattern).
 *   - Live region (role=status aria-live=polite) is NOT here — deferred to T4
 *     BotssonChat container-level per ADR-0398 §Accessibility.
 *
 * Edit flow (Phase 1 stub):
 *   BIR spawn-under-card is deferred to Phase 3 per ADR-0398 §Phase Sequencing.
 *   Clicking Endre renders a placeholder and resolves immediately with action:"edit".
 *
 * Symbol note: ProposalCard is BANNED — already used in ChangeProposalsPanel +
 * ProposedPlanClient (ADR-0398 §Naming). Use InlineConfirmCard everywhere.
 *
 * Package note: @smartout/ui does NOT depend on @smartout/ai (no runtime dep). Types are
 * duplicated here exactly as BIR does for botsson-input-request.tsx. Duplication is
 * intentional and minimal — these are stable wire-format types. If they drift, both
 * sides break loudly. If @smartout/ai is ever added as a dep, remove local types
 * and import from "@smartout/ai/primitives/inline-confirm-card" instead.
 *
 * References: ADR-0078, ADR-0133, ADR-0151, ADR-0327, ADR-0398, ADR-0399, L-0331.
 */

import { useState, useCallback, type KeyboardEvent } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Megaphone, MessageSquare, CalendarCheck, Pencil, Loader2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "../lib/utils";

// ── Types mirror @smartout/ai/primitives/inline-confirm-card ─────────────────
// We DON'T import from @smartout/ai because that would create a runtime
// dependency from @smartout/ui → @smartout/ai (which doesn't currently exist). Instead
// we duplicate the type shape here. Duplication is intentional and minimal — these are
// stable wire-format types that change rarely. If they drift, both sides break loudly.

export type ICCSurface = "announcement" | "message" | "shift_approve";

export type ICCPreviewMetadataItem = {
  label: string;
  value: string;
};

export type ICCPreview = {
  title: string;
  body_excerpt?: string;
  recipient_count?: number;
  affected_entity?: string;
  metadata: ICCPreviewMetadataItem[];
};

export type ICCConfirmAction = {
  id: "confirm";
  label: string;
  variant: "primary";
};

export type ICCEditAction = {
  id: "edit";
  label: string;
  variant: "ghost";
  editable_fields: string[];
};

export type ICCCancelAction = {
  id: "cancel";
  label: string;
  variant: "destructive";
};

export type ICCAction = ICCConfirmAction | ICCEditAction | ICCCancelAction;

export type InlineConfirmCardDescriptor = {
  type: "inline_confirm_card";
  proposal_id: string;
  surface: ICCSurface;
  draft: Record<string, unknown>;
  preview: ICCPreview;
  actions: ICCAction[];
  voice_prompt?: string;
  recipient_preview_available?: boolean;
  channel_constraint?: ("chat" | "voice")[];
  platforms?: ("web" | "mobile")[];
};

export type InlineConfirmCardResult = {
  proposal_id: string;
  action: "confirm" | "edit" | "cancel";
  patch?: Partial<Record<string, unknown>>;
};

// ── Local state machine ──────────────────────────────────────────────────────
// "idle"      — initial render, all buttons enabled
// "loading"   — set on any button click, all buttons disabled, spinner on clicked button
// "resolved"  — onResolve succeeded for action=confirm or edit
// "cancelled" — onResolve succeeded for action=cancel
// "error"     — onResolve threw; buttons re-enabled for retry
type Mode = "idle" | "loading" | "resolved" | "cancelled" | "error";

// Which button triggered the loading state (drives spinner placement)
type LoadingButton = "confirm" | "edit" | "cancel" | null;

// ── Surface → icon map (Lucide only, no emojis) ───────────────────────────────
const SURFACE_ICON: Record<ICCSurface, React.ComponentType<{ className?: string }>> = {
  announcement: Megaphone,
  message: MessageSquare,
  shift_approve: CalendarCheck,
};

// ── Spring motion config (ADR-0398 §Visual & Motion Contract) ────────────────
// stiffness=35 / damping=22 / mass=2.2 — Task Manager signature, NOT Framer default.
const SPRING_CONFIG = { type: "spring", stiffness: 35, damping: 22, mass: 2.2 } as const;
const REDUCED_CONFIG = { duration: 0.15 } as const;

// ── Props ─────────────────────────────────────────────────────────────────────
export type InlineConfirmCardProps = {
  descriptor: InlineConfirmCardDescriptor;
  onResolve: (result: InlineConfirmCardResult) => Promise<void>;
  className?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────
export function InlineConfirmCard({ descriptor, onResolve, className }: InlineConfirmCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>("idle");
  const [loadingButton, setLoadingButton] = useState<LoadingButton>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // One-shot ring class — applied on resolution, cleared after 300ms to settled state
  const [ringClass, setRingClass] = useState<string>("");

  const { proposal_id, surface, preview, actions } = descriptor;

  // ── Icon selection ────────────────────────────────────────────────────────
  const SurfaceIcon = SURFACE_ICON[surface];

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (action: "confirm" | "edit" | "cancel") => {
      if (mode !== "idle" && mode !== "error") return;

      setMode("loading");
      setLoadingButton(action);
      setErrorMessage(null);

      try {
        const result: InlineConfirmCardResult = {
          proposal_id,
          action,
          // Edit Phase 1 stub: resolves immediately with empty patch.
          // Full BIR spawn-under-card deferred to Phase 3 per ADR-0398 §Phase Sequencing.
          patch: action === "edit" ? {} : undefined,
        };

        await onResolve(result);

        if (action === "confirm" || action === "edit") {
          // resolved: ring-2 ring-green-500/40 one-shot 300ms, then settle
          setRingClass("ring-2 ring-green-500/40");
          setMode("resolved");
        } else {
          // cancelled: ring-2 ring-destructive/40 one-shot 300ms, then settle
          setRingClass("ring-2 ring-destructive/40");
          setMode("cancelled");
        }

        // Ring is a one-shot 300ms flash — clear after timeout so card settles permanently
        setTimeout(() => setRingClass(""), 300);
      } catch (err) {
        console.error("[InlineConfirmCard] onResolve failed:", err);
        setErrorMessage("Noe gikk galt. Prøv igjen.");
        setMode("error");
      } finally {
        setLoadingButton(null);
      }
    },
    [mode, onResolve, proposal_id],
  );

  // ── ESC handler (parity with help-takeover-kit pattern) ──────────────────
  // ESC anywhere in the card triggers cancel — only from idle/error, not from loading
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && (mode === "idle" || mode === "error")) {
        void handleAction("cancel");
      }
    },
    [mode, handleAction],
  );

  // ── Derived booleans ──────────────────────────────────────────────────────
  const isSettled = mode === "resolved" || mode === "cancelled";
  const isLoading = mode === "loading";
  const isError = mode === "error";

  // ── Action slot lookup: read descriptor.actions in order ──────────────────
  // DO NOT hardcode 3 buttons — render only what the descriptor provides.
  const confirmAction = actions.find((a): a is ICCConfirmAction => a.id === "confirm");
  const editAction = actions.find((a): a is ICCEditAction => a.id === "edit");
  const cancelAction = actions.find((a): a is ICCCancelAction => a.id === "cancel");

  // ── Motion config ─────────────────────────────────────────────────────────
  const transition = shouldReduceMotion ? REDUCED_CONFIG : SPRING_CONFIG;

  return (
    <AnimatePresence>
      <motion.div
        key={proposal_id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={transition}
        // Resolved state: fade + subtle scale down
        // State transitions: transition-opacity + transition-transform (NEVER transition-all)
        className={cn(
          "bg-card border-border rounded-[var(--r-card)] border p-3 sm:p-4",
          "transition-opacity transition-transform",
          ringClass,
          mode === "resolved" && "scale-[0.98] opacity-50",
          mode === "cancelled" && "scale-[0.97] opacity-40",
          className,
        )}
        // Accessibility: WCAG 2.1 AA — region landmark with descriptive label
        role="region"
        aria-label={`Forslag: ${preview.title}`}
        // ESC = cancel (idle/error mode only)
        onKeyDown={handleKeyDown}
        // Card must be focusable to receive keyboard events (tabIndex=-1: programmatic only)
        tabIndex={-1}
        data-testid="inline-confirm-card"
        data-mode={mode}
      >
        {/* ── Header row ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* Surface icon — 16px, text-muted-foreground, top-left */}
          <SurfaceIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />

          {/* Title — text-sm font-semibold (NOT font-heading per ADR-0398) */}
          <span className="text-foreground flex-1 text-sm leading-snug font-semibold">
            {preview.title}
          </span>

          {/* "FORSLAG" badge — top-right of card header, mono uppercase chip */}
          <span
            className="bg-muted text-muted-foreground shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[9px] tracking-[0.15em] uppercase"
            aria-hidden="true"
          >
            FORSLAG
          </span>
        </div>

        {/* ── Body excerpt ──────────────────────────────────────────────────── */}
        {preview.body_excerpt ? (
          <p className="text-muted-foreground mt-2 line-clamp-3 text-sm">{preview.body_excerpt}</p>
        ) : null}

        {/* ── Metadata chips row ────────────────────────────────────────────── */}
        {preview.metadata.length > 0 || preview.recipient_count != null ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {preview.metadata.map((item: ICCPreviewMetadataItem) => (
              <span
                key={`${item.label}-${item.value}`}
                className="bg-muted text-muted-foreground rounded-sm px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase"
              >
                {item.label}: {item.value}
              </span>
            ))}

            {/* Recipient count chip — interactive only if recipient_preview_available */}
            {preview.recipient_count != null ? (
              descriptor.recipient_preview_available ? (
                // Interactive chip: 44×44 min touch target on mobile (ADR-0398 §Accessibility)
                <button
                  type="button"
                  className={cn(
                    "bg-muted text-muted-foreground rounded-sm px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase",
                    "min-h-[44px] sm:min-h-0",
                    "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
                    "hover:bg-muted/80 cursor-pointer",
                  )}
                  aria-label={`Vis ${preview.recipient_count} mottakere`}
                >
                  {preview.recipient_count} mottakere
                </button>
              ) : (
                <span className="bg-muted text-muted-foreground rounded-sm px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase">
                  {preview.recipient_count} mottakere
                </span>
              )
            ) : null}
          </div>
        ) : null}

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="border-border/50 mt-3 border-t" aria-hidden="true" />

        {/* ── Edit Phase 1 stub ─────────────────────────────────────────────
            Full BIR spawn-under-card deferred to Phase 3 per ADR-0398 §Phase Sequencing.
            Placeholder visible briefly while loading=edit before onResolve settles.     */}
        <AnimatePresence>
          {isLoading && loadingButton === "edit" ? (
            <motion.p
              key="edit-stub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={REDUCED_CONFIG}
              className="text-muted-foreground mt-2 text-xs italic"
            >
              Endring kommer i Phase 3
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* ── Error message ─────────────────────────────────────────────────
            Shown below the button row when onResolve throws.
            Buttons remain clickable (mode="error") for user retry.              */}
        {isError && errorMessage ? (
          <p className="text-destructive mt-2 text-xs" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {/* ── Action row ────────────────────────────────────────────────────
            Rendered from descriptor.actions in order. DO NOT hardcode 3 buttons.
            Tab order: Bekreft → Endre → Avbryt (happy-path-first per ADR-0398).
            All buttons: type="button" (card is NOT inside a form).              */}
        <div className="flex gap-2 pt-3">
          {/* Confirm button — variant="default", no icon (label is sufficient) */}
          {confirmAction ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isLoading || isSettled}
              onClick={() => void handleAction("confirm")}
              data-testid="inline-confirm-card-confirm"
              className="focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {isLoading && loadingButton === "confirm" ? (
                shouldReduceMotion ? (
                  <span className="text-xs">…</span>
                ) : (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )
              ) : (
                confirmAction.label
              )}
            </Button>
          ) : null}

          {/* Edit button — ghost + Pencil 14px. Only rendered if edit action present. */}
          {editAction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isLoading || isSettled}
              onClick={() => void handleAction("edit")}
              data-testid="inline-confirm-card-edit"
              className="focus-visible:ring-ring focus-visible:ring-offset-background gap-1.5 focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              {isLoading && loadingButton === "edit" ? (
                shouldReduceMotion ? (
                  <span className="text-xs">…</span>
                ) : (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )
              ) : (
                <>
                  <Pencil className="size-[14px]" aria-hidden="true" />
                  {editAction.label}
                </>
              )}
            </Button>
          ) : null}

          {/* Cancel button — ghost, text-destructive, NO icon (avoid tap-magnetizing) */}
          {cancelAction ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isLoading || isSettled}
              onClick={() => void handleAction("cancel")}
              data-testid="inline-confirm-card-cancel"
              className={cn(
                "text-destructive hover:text-destructive hover:bg-destructive/10",
                "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
              )}
            >
              {isLoading && loadingButton === "cancel" ? (
                shouldReduceMotion ? (
                  <span className="text-xs">…</span>
                ) : (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )
              ) : (
                cancelAction.label
              )}
            </Button>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
