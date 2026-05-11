/**
 * audience-resolver.ts — Server-side audience resolution for announcement targeting.
 *
 * WHY THIS FILE EXISTS: The browser-side `use-audience-resolver.ts` hook is a
 * TanStack Query hook marked `"use client"`. It cannot be imported server-side
 * (Node / Supabase Admin client context). This file ports the 5 audience-kind
 * branches using `SupabaseClient` (service-role) so the `publish_announcement`
 * capability tool can resolve profile IDs without touching the browser hook.
 *
 * Council 2026-05-11 B7: port, not import. ~80 LOC duplication is acceptable
 * per ADR-0173 capability boundary rules.
 *
 * PII boundary (Council B5): resolved `profileIds` are kept inside the tool layer.
 * The tool MUST NOT return raw IDs to the agent — only `count` and `label`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AudienceKind = "all" | "on_duty" | "department" | "role" | "individuals";

export type AudienceInput =
  | { kind: "all" }
  | { kind: "on_duty" }
  | { kind: "department"; departmentIds: string[] }
  | { kind: "role"; roles: string[] }
  | { kind: "individuals"; profileIds: string[] };

export type AudienceResolved = {
  profileIds: string[];
  count: number;
  label: string;
};

/**
 * Resolve an audience intent to a list of profile IDs + human-readable label.
 *
 * Uses the service-role Supabase client (ctx.supabaseAdmin) so RLS is bypassed
 * intentionally — the tool layer is responsible for enforcing authority via
 * callGateAction before calling this.
 *
 * Mirrors `use-audience-resolver.ts` query logic (Wave A, commit `3854f3513`).
 */
export async function resolveAudience(
  supabase: SupabaseClient,
  workspaceId: string,
  input: AudienceInput,
): Promise<AudienceResolved> {
  if (input.kind === "all") {
    const { data, error } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active");
    if (error) throw new Error(`resolveAudience(all) failed: ${error.message}`);
    const ids = (data ?? []).map((p: { profile_id: string }) => p.profile_id);
    return { profileIds: ids, count: ids.length, label: `Alle (${ids.length})` };
  }

  if (input.kind === "on_duty") {
    // SAFETY: timesheet schema FK joins to public.profile fail in PostgREST,
    // so we query time_entry rows then dedupe profile_ids in JS.
    // Mirrors the canonical pattern from use-broadcast-recipients.ts:37-58.
    const { data, error } = await supabase
      .schema("timesheet")
      .from("time_entry")
      .select("profile_id")
      .is("punch_out", null)
      .limit(500);
    if (error) throw new Error(`resolveAudience(on_duty) failed: ${error.message}`);
    const ids = Array.from(
      new Set((data ?? []).map((e: { profile_id: string }) => e.profile_id).filter(Boolean)),
    );
    return { profileIds: ids, count: ids.length, label: `På vakt (${ids.length})` };
  }

  if (input.kind === "department") {
    if (input.departmentIds.length === 0) {
      return { profileIds: [], count: 0, label: "Avdeling (0)" };
    }
    const { data, error } = await supabase
      .from("profile")
      .select("profile_id, department_id, department(name)")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .in("department_id", input.departmentIds);
    if (error) throw new Error(`resolveAudience(department) failed: ${error.message}`);
    const ids = (data ?? []).map((p: { profile_id: string }) => p.profile_id);
    const deptNames = Array.from(
      new Set(
        (data ?? [])
          .map(
            (p: {
              profile_id: string;
              department_id: string | null;
              department: { name: string }[] | null;
            }) => (Array.isArray(p.department) ? p.department[0]?.name : undefined),
          )
          .filter((n): n is string => Boolean(n)),
      ),
    );
    const label =
      deptNames.length > 0
        ? `${deptNames.join(" · ")} (${ids.length})`
        : `Avdeling (${ids.length})`;
    return { profileIds: ids, count: ids.length, label };
  }

  if (input.kind === "role") {
    if (input.roles.length === 0) {
      return { profileIds: [], count: 0, label: "Rolle (0)" };
    }
    // Cast to enum union — schema uses ProfileRole enum. Caller supplies role
    // strings from the domain model; the cast avoids narrowing the public API.
    type ProfileRole = "admin" | "manager" | "employee" | "owner" | "system";
    const { data, error } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .in("role", input.roles as ProfileRole[]);
    if (error) throw new Error(`resolveAudience(role) failed: ${error.message}`);
    const ids = (data ?? []).map((p: { profile_id: string }) => p.profile_id);
    return {
      profileIds: ids,
      count: ids.length,
      label: `Rolle: ${input.roles.join(" · ")} (${ids.length})`,
    };
  }

  // kind === "individuals" — no DB call, just deduplicate
  const deduped = Array.from(new Set(input.profileIds));
  return { profileIds: deduped, count: deduped.length, label: `${deduped.length} valgte` };
}
