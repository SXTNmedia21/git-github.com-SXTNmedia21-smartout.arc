// ============================================
// version-status.ts — journey_version_status lifecycle rules (ADR-0172)
//
// Single source of truth for:
//   - enum value ordering
//   - allowed transitions per status
//   - human-readable labels (UI-only; i18n keys live on the card schema)
//
// Reads only. Server Actions import these to enforce transitions.
// UI components import for labels + allowed-action gating.
//
// Binding:
//   - ADR-0172 — enum lifecycle (6 values)
//   - ADR-0173 — capability model (publish_* capabilities gate ready_publish→published)
// ============================================

import type { Database } from "@smartout/supabase/database.types";

export type JourneyVersionStatus = Database["public"]["Enums"]["journey_version_status"];

/**
 * Ordered lifecycle. Used by UI to render progression and by transition
 * logic as the source of truth.
 */
export const JOURNEY_VERSION_STATUS_ORDER: readonly JourneyVersionStatus[] = [
  "draft",
  "ready_test",
  "testing",
  "ready_publish",
  "published",
  "archived",
] as const;

/**
 * Allowed transitions per source status. "archived" is reachable from any
 * non-terminal state (retire-in-place); "published" requires prior tests.
 *
 * Draft → ready_test       : admin marks spec test-ready
 * ready_test → testing     : a Playwright dev run starts (manual or automated)
 * testing → ready_publish  : tests pass, spec is publish-ready
 * testing → ready_test     : tests failed, back to authoring
 * ready_publish → published: a publish_mission / publish_guide capability invocation
 *                            (the Server Action invokes the capability then records
 *                            the transition)
 * * → archived             : retire. Read-only afterwards.
 */
export const ALLOWED_TRANSITIONS: Record<JourneyVersionStatus, readonly JourneyVersionStatus[]> = {
  draft: ["ready_test", "archived"],
  ready_test: ["testing", "draft", "archived"],
  testing: ["ready_publish", "ready_test", "archived"],
  ready_publish: ["published", "ready_test", "archived"],
  published: ["archived"],
  archived: [], // terminal
};

export function canTransition(from: JourneyVersionStatus, to: JourneyVersionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Human-readable label for a status. Token-friendly, not i18n-backed yet —
 * i18n lands with the store-listing card schema (ADR-0177).
 */
export const STATUS_LABEL: Record<JourneyVersionStatus, string> = {
  draft: "Draft",
  ready_test: "Ready for Test",
  testing: "Testing",
  ready_publish: "Ready to Publish",
  published: "Published",
  archived: "Archived",
};

/**
 * Short description rendered under the badge / in tooltips. Keeps the
 * list view information-dense without another column.
 */
export const STATUS_DESCRIPTION: Record<JourneyVersionStatus, string> = {
  draft: "Authored, not yet test-ready.",
  ready_test: "Gated into a dev run.",
  testing: "Playwright run in progress or failing.",
  ready_publish: "Passed tests, awaiting publish authority.",
  published: "Live as mission + user-guide.",
  archived: "Retired, read-only.",
};
