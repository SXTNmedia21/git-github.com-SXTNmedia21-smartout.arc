/**
 * welcome-wizard-constants.ts
 *
 * Plain module (NO "use server"). Holds shared value-constants for the
 * employee-onboarding-wizard Server Actions in welcome-wizard-actions.ts.
 *
 * WHY a separate file: Next.js RSC enforces that a "use server" module
 * may only export async functions. Exporting non-async `const` from
 * welcome-wizard-actions.ts breaks the bundler with:
 *
 *   "Only async functions are allowed to be exported in a 'use server' file."
 *
 * Caught by /verify runtime probe 2026-05-23 after T10 commit 9fc469754
 * shipped the constants inside the action file. Typecheck did not flag it
 * — the rule is bundler-enforced, not TS-enforced.
 *
 * V1 hardcodes the three document versions. ROADMAP: per-workspace
 * versioning catalog so admins can update consent text without code change.
 * When that lands, replace these constants with a lookup against a
 * `consent_document_version` table keyed by workspace + consent_type.
 */

export const HANDBOOK_DOCUMENT_VERSION = "handbook-v1";
export const GDPR_DOCUMENT_VERSION = "gdpr-v1";
export const TARIFF_DOCUMENT_VERSION = "tariff-v1";
