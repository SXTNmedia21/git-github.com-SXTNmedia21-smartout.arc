"use server";

/**
 * create-day-info-action.ts — Server Action: Create a schedule day info entry.
 *
 * WHY: `useCreateDayInfo` was an ADR-0114 violation — direct client-side
 * `useMutation` calling `supabase.from("schedule_day_info").insert(...)` without
 * authority gate + with fire-and-forget (void) emit. This action replaces
 * that path with:
 *   1. Server-side profile re-derivation per ADR-0151 (never trust body IDs).
 *   2. gate_action() RPC (ADR-0099) on capability `schedule.add_day_info_manual`.
 *   3. Admin insert (service role) so RLS never blocks a gated write.
 *   4. await emit() (ADR-0134) — four destinations, all server-side, reliable.
 *
 * Channel param follows the Lovsen S5 / ADR-0078 pattern: web callers omit →
 * default "chat"; BFF mobile callers pass channel: "system".
 *
 * Authority seeded in: supabase/migrations/<TS>_seed_day_info_authority.sql
 * Closes ADR-0114 violation surface for the schedule day-info domain.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

// ── Input schema ──────────────────────────────────────────────────────────────
//
// Mirrors DayInfo (from use-day-info.ts) minus id/createdAt (server-generated),
// minus workspace_id + createdBy (derived server-side per ADR-0151).
const DayInfoScopeTypeSchema = z.enum(["workspace", "department", "team"]);
const DayInfoCategorySchema = z.enum(["note", "event", "alert", "budget_note"]);

const InputSchema = z.object({
  date: z.string().min(1, "Dato er påkrevd."),
  title: z.string().min(1, "Tittel er påkrevd.").max(500),
  content: z.string().max(2000).nullable().optional(),
  scopeType: DayInfoScopeTypeSchema,
  scopeId: z.string().uuid().nullable().optional(),
  category: DayInfoCategorySchema,
  channel: z.enum(["chat", "voice", "system"]).default("chat"),
});

export type CreateDayInfoInput = z.infer<typeof InputSchema>;
export type CreateDayInfoResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Optional pre-resolved actor — used by the mobile BFF so it does not
 * need to re-derive identity from cookie (Bearer path has no cookie).
 * When omitted, identity is resolved via cookie SSR (web path).
 */
export type ResolvedActor = {
  profileId: string;
  workspaceId: string;
  role: string | null;
};

export async function createDayInfoAction(
  input: CreateDayInfoInput,
  actor?: ResolvedActor,
): Promise<CreateDayInfoResult> {
  // 1. Validate input
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  // 2. Resolve identity — actor injected by BFF (Bearer path) or derived
  //    from SSR cookie (web path). Never accept workspace_id from body.
  const profile = actor ?? (await resolveCurrentProfile());
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  // 3. Authority gate (ADR-0099)
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "schedule.add_day_info_manual",
    channel: parsed.data.channel,
    actorProfileId: profile.profileId,
    actionType: "create",
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // 4. Insert (admin client bypasses RLS — gated above)
  const { data: inserted, error: insertError } = await admin
    .from("schedule_day_info")
    .insert({
      workspace_id: profile.workspaceId,
      date: parsed.data.date,
      title: parsed.data.title,
      content: parsed.data.content ?? null,
      scope_type: parsed.data.scopeType,
      scope_id: parsed.data.scopeId ?? null,
      category: parsed.data.category,
      // created_by references user_identity.user_id — not profile_id.
      // Leave null: the profile_id audit is covered by actor_id in emit().
      created_by: null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Kunne ikke lagre daginfo.",
    };
  }

  // 5. Emit — server-side, awaited (ADR-0134 — all four destinations)
  await emit({
    event: "day_info created",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      data: {
        date: parsed.data.date,
        category: parsed.data.category,
      },
    },
  });

  return { ok: true, id: inserted.id };
}
