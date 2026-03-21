/**
 * validate_proposal_freshness — Cascade Phase B Pure Function #4
 *
 * Compares a proposal's input_state_hash against the current state hash.
 * If stale, the proposal must be regenerated before apply.
 *
 * Spec: Section 3 Phase B, Function #6
 */

import type { ChangeProposalRow, FreshnessResult } from "./types";

/**
 * Deep-sort all object keys recursively for deterministic serialization.
 * Arrays preserve order (element order is semantically meaningful).
 * This ensures identical logical state always produces identical JSON
 * regardless of object construction order at any nesting depth.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Compute a deterministic SHA-256 hash of workspace state.
 * Deep-canonicalizes all nested keys before hashing.
 * This is the foundation contract — staleness detection
 * and audit trails depend on this hash being SHA-256.
 */
export async function computeStateHash(state: unknown): Promise<string> {
  const canonical = canonicalize(state);
  const json = JSON.stringify(canonical);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "sha256:" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function validateProposalFreshness(
  proposal: ChangeProposalRow,
  currentStateHash: string,
): FreshnessResult {
  if (!proposal.inputStateHash) {
    return {
      fresh: false,
      staleFields: ["input_state_hash_missing"],
    };
  }

  if (proposal.inputStateHash !== currentStateHash) {
    return {
      fresh: false,
      staleFields: ["state_changed_since_preview"],
    };
  }

  return {
    fresh: true,
    staleFields: [],
  };
}
