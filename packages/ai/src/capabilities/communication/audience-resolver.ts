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

export type AudienceKind = "all" | "on_duty" | "on_shift" | "department" | "role" | "individuals";

export type AudienceInput =
  | { kind: "all" }
  | { kind: "on_duty" }
  | {
      kind: "on_shift";
      /** Minutes before/after NOW to include shifts. Defaults to 120 (2h window). */
      windowMinutes?: number;
    }
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
    // workspace_id scoping required here — same as all/department/role branches.
    const { data, error } = await supabase
      .schema("timesheet")
      .from("time_entry")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .is("punch_out", null)
      .limit(500);
    if (error) throw new Error(`resolveAudience(on_duty) failed: ${error.message}`);
    const ids = Array.from(
      new Set((data ?? []).map((e: { profile_id: string }) => e.profile_id).filter(Boolean)),
    );
    return { profileIds: ids, count: ids.length, label: `På vakt (${ids.length})` };
  }

  if (input.kind === "on_shift") {
    // BUG-SIM-17 fix: 'on_shift' queries schedule_shift for shifts that overlap
    // the current time window — the natural intent for pre-shift announcements
    // ("send to tonight's crew"). Distinct from 'on_duty' (currently clocked in).
    //
    // window = [NOW - windowMinutes, NOW + windowMinutes], defaulting to ±120 min
    // so managers can target the incoming shift ~2h before it starts.
    const windowMs = (input.windowMinutes ?? 120) * 60_000;
    const now = Date.now();
    const windowStart = new Date(now - windowMs).toISOString();
    const windowEnd = new Date(now + windowMs).toISOString();

    const { data, error } = await supabase
      .from("schedule_shift")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .lte("start_time", windowEnd)
      .gte("end_time", windowStart);
    if (error) throw new Error(`resolveAudience(on_shift) failed: ${error.message}`);
    const ids = Array.from(
      new Set((data ?? []).map((s: { profile_id: string }) => s.profile_id).filter(Boolean)),
    );
    return {
      profileIds: ids,
      count: ids.length,
      label: `På vakt nå/snart (${ids.length})`,
    };
  }

  if (input.kind === "department") {
    if (input.departmentIds.length === 0) {
      return { profileIds: [], count: 0, label: "Avdeling (0)" };
    }

    // WHY two queries: PostgREST returns PGRST201 (ambiguous relationship) when
    // embedding department(name) from profile — both fk_profile_department AND
    // department_manager_profile_id_fkey satisfy "profile ↔ department". Using
    // the hint syntax (department!fk_profile_department) would couple us to FK
    // naming internals. Two-query pattern avoids relationship-cache dependency
    // entirely, matching the on_duty + individuals sibling patterns.

    // Step 1: collect profile_ids for active members in the requested departments
    const { data: profiles, error: profErr } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .in("department_id", input.departmentIds);
    if (profErr)
      throw new Error(`resolveAudience(department) profile query failed: ${profErr.message}`);
    const ids = (profiles ?? []).map((p: { profile_id: string }) => p.profile_id);

    // Step 2: separate query for department names (for the human-readable label)
    const { data: depts } = await supabase
      .from("department")
      .select("name")
      .eq("workspace_id", workspaceId)
      .in("department_id", input.departmentIds);
    const deptNames = (depts ?? [])
      .map((d: { name: string }) => d.name)
      .filter((n): n is string => Boolean(n));

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
