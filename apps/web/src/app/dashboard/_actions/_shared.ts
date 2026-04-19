"use server";

import { createClient } from "@smartout/supabase/server";

/**
 * Resolves the active profile for the currently-authenticated user.
 * Server-side re-derivation per ADR-0151 — never trust profile_id from the
 * request body.
 */
export async function resolveCurrentProfile(): Promise<{
  profileId: string;
  workspaceId: string;
  role: string | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!profile) return null;
  return {
    profileId: profile.profile_id,
    workspaceId: profile.workspace_id,
    role: profile.role ?? null,
  };
}

/**
 * Checks whether the caller's role satisfies the minimum required role for
 * an action. Roles follow the hierarchy `employee < manager < admin < owner`.
 * Uses engine_authority_config where present; otherwise falls back to a
 * conservative role check.
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
