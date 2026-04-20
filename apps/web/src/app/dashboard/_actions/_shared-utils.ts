/**
 * Sync helpers shared across Server Actions.
 *
 * Kept in a separate file (no "use server") because Next.js 16 requires every
 * exported function in a "use server" module to be async. These helpers are
 * pure and sync — splitting is cleaner than forcing async on work that has no
 * I/O.
 */

/**
 * Checks whether the caller's role satisfies the minimum required role for
 * an action. Roles follow the hierarchy `employee < manager < admin < owner`.
 *
 * TODO(ADR-0156 follow-up): `engine_authority_config` currently stores
 * `level` (autonomous/confirm/suggest/read_only/disabled) per capability but
 * does NOT store `min_role`. When the schema adds `min_role`, update this
 * function to read from the authority row. For now, role is enforced here.
 */
export function hasMinimumRole(
  actorRole: string | null,
  minimumRole: "employee" | "manager" | "admin" | "owner",
): boolean {
  const rank: Record<string, number> = {
    employee: 1,
    manager: 2,
    admin: 3,
    owner: 4,
  };
  const actor = rank[actorRole ?? ""] ?? 0;
  const required = rank[minimumRole] ?? 99;
  return actor >= required;
}

/**
 * PII guardrail — fail-fast check for Norwegian PII patterns in free-text
 * broadcast content. Per ADR-0077: agent-composed or human-drafted
 * communications must not include personnummer, bank accounts, or physical
 * addresses in broadcast channels.
 */
const PERSONNUMMER_RE = /\b\d{6}[-\s]?\d{5}\b/;
const BANK_ACCOUNT_RE = /\b\d{4}[.\s]?\d{2}[.\s]?\d{5}\b/;

export function detectPii(content: string): string | null {
  if (PERSONNUMMER_RE.test(content)) return "personnummer";
  if (BANK_ACCOUNT_RE.test(content)) return "bankkontonummer";
  return null;
}
