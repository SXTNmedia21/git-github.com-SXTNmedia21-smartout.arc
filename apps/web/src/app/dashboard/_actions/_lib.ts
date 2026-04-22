// Pure helpers used by Server Actions in this directory. This file MUST
// NOT carry a `"use server"` directive: synchronous exports are legal
// here, whereas inside a Server Action module they are rejected by
// Next.js 16 / React 19 (Server Actions must be async).
//
// Moved out of `_shared.ts` so that file can keep the "use server"
// directive for the async helpers (resolveCurrentProfile, gateAction).

/**
 * Normalised return shape from `gate_action()` RPC. Matches the pattern
 * established in `apps/web/src/app/api/observer-requests/route.ts`.
 */
export type GateResult = {
  allow: boolean;
  reason: string | null;
  downgrade_to: string | null;
  min_role_required: string | null;
  channel_allowed: boolean;
  four_eyes_required: boolean;
  approvers_needed: number;
};

/**
 * Checks whether the caller's role satisfies the minimum required role for
 * an action. Roles follow the hierarchy `employee < manager < admin < owner`.
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

export function normalizeGate(data: unknown): GateResult {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    allow: row.allow === true,
    reason: (row.reason as string | null) ?? null,
    downgrade_to: (row.downgrade_to as string | null) ?? null,
    min_role_required: (row.min_role_required as string | null) ?? null,
    channel_allowed: row.channel_allowed !== false,
    four_eyes_required: row.four_eyes_required === true,
    approvers_needed: Number(row.approvers_needed ?? 0),
  };
}
