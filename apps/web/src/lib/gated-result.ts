/**
 * gated-result.ts
 *
 * Uniform consumer-side handler for Server Actions that wrap the
 * `gatedInsert/Update/Delete` helpers shipped in ADR-0091 WP2.
 *
 * Every gated Server Action returns a three-branch result:
 *
 *   { ok: true }                             — applied, write went through
 *   { ok: true, pendingProposal: <uuid> }    — a change_proposal was created;
 *                                              UI must surface "needs approval"
 *   { ok: false, error: <reason> }           — gate blocked OR non-gate error
 *
 * A plain `try { await action(); toast.success() } catch {}` around such an
 * action is a user-facing bug — blocked writes resolve successfully (no throw)
 * and the proposal branch silently looks identical to the applied branch.
 *
 * `handleGatedResult` centralizes the three-branch dispatch so every consumer
 * gets the same UX (success / info / error toast + callback), and future
 * mechanical migrations (20+ call sites per the pilot plan) can mirror the
 * same pattern instead of reintroducing the bug each time.
 */

import { toast } from "sonner";

export type GatedActionResult =
  | { ok: true; pendingProposal?: string }
  | { ok: false; error: string };

type GatedHandlers = {
  /** Called when the gate let the write through (`{ ok: true }` with no proposal). */
  onApplied?: () => void;
  /** Called when the gate proposed a change (`{ ok: true, pendingProposal }`). */
  onProposed?: (proposalId: string) => void;
  /** Called when the gate blocked the write or a non-gate error surfaced. */
  onDenied?: (error: string) => void;
};

type HandleGatedResultOptions = GatedHandlers & {
  /** Toast message shown on the applied branch. */
  appliedMessage: string;
  /**
   * Toast message shown on the proposed branch. Defaults to the generic
   * Norwegian copy used across the dashboard: "Krever godkjenning".
   */
  proposedMessage?: string;
  /**
   * Optional transform for the denied-branch toast. Receives the raw
   * `result.error` string; if omitted, the error is shown verbatim.
   */
  deniedMessage?: (error: string) => string;
};

/**
 * Dispatch a `GatedActionResult` into the correct toast + callback branch.
 *
 * Consumers MUST call this (or manually destructure the three-branch shape)
 * instead of wrapping Server Actions in `try/catch`. Blocked writes do NOT
 * throw — they return `{ ok: false }` — and the proposal branch MUST NOT
 * render a success toast.
 */
export function handleGatedResult(
  result: GatedActionResult,
  options: HandleGatedResultOptions,
): void {
  if (!result.ok) {
    const message = options.deniedMessage?.(result.error) ?? result.error;
    toast.error(message);
    options.onDenied?.(result.error);
    return;
  }

  if (result.pendingProposal) {
    const message = options.proposedMessage ?? "Krever godkjenning";
    toast.info(message, { description: "Endringen er sendt til godkjenning" });
    options.onProposed?.(result.pendingProposal);
    return;
  }

  toast.success(options.appliedMessage);
  options.onApplied?.();
}
