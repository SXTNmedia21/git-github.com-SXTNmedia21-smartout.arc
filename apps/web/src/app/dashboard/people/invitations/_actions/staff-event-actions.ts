"use server";

/**
 * staff-event-actions.ts — Server Actions for the Innkalling (staff_event) feature.
 *
 * Authority: admin or manager only (derived server-side from session per ADR-0151).
 * Telemetry: emits "staff_event created" to posthog + activity_trail + engine_event (ADR-0134).
 *
 * No client-supplied workspace_id or created_by — both derived from session.
 */

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import type { Database } from "@smartout/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emit, nonEmpty } from "@smartout/telemetry";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** Typed helper to get a server client with proper Database generics. */
async function getClient(): Promise<SupabaseClient<Database>> {
  return createClient();
}

/**
 * Resolve the caller's profile in the current workspace from session.
 * Returns null when the user has no authenticated session or no profile.
 * Used to derive workspace_id + created_by server-side (ADR-0151 — never trust body).
 */
async function resolveCallerProfile(
  supabase: SupabaseClient<Database>,
): Promise<{ profileId: string; workspaceId: string; role: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    profileId: data.profile_id,
    workspaceId: data.workspace_id,
    role: data.role,
  };
}

// ─── Input schema ────────────────────────────────

const staffEventTypeEnum = z.enum(["utviklingssamtale", "personalmote", "personalfest", "annet"]);

const createStaffEventInputSchema = z.object({
  event_type: staffEventTypeEnum,
  title: z.string().min(1, "Tittel er påkrevd"),
  message: z.string().optional(),
  starts_at: z.string().datetime({ message: "Ugyldig starttidspunkt" }),
  ends_at: z.string().datetime({ message: "Ugyldig sluttidspunkt" }),
  location: z.string().optional(),
  attendee_profile_ids: z.array(z.string().uuid()).min(1, "Minst én deltaker er påkrevd"),
});

export type CreateStaffEventInput = z.infer<typeof createStaffEventInputSchema>;

// ─── createStaffEvent ────────────────────────────

/**
 * Creates a staff_event + attendee rows.
 *
 * - workspace_id and created_by are NEVER taken from the request body.
 *   Both are resolved server-side from the session (ADR-0151).
 * - Authority: admin or manager only.
 * - Transaction: event insert first, then attendees. On attendee failure,
 *   rolls back by deleting the event.
 * - Emits "staff_event created" telemetry (ADR-0134: nonEmpty guards).
 * - Revalidates /dashboard/people/invitations on success.
 */
export async function createStaffEvent(
  input: CreateStaffEventInput,
): Promise<ActionResult<{ event_id: string }>> {
  // 1. Validate input shape
  const parsed = createStaffEventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Ugyldig input" };
  }
  const data = parsed.data;

  // 2. Validate time range
  if (new Date(data.ends_at) <= new Date(data.starts_at)) {
    return { ok: false, error: "Sluttid må være etter starttid" };
  }

  // 3. Resolve caller profile server-side (ADR-0151 — no trust on body)
  const supabase = await getClient();
  const caller = await resolveCallerProfile(supabase);
  if (!caller) {
    return { ok: false, error: "Ikke autentisert" };
  }

  // 4. Authority gate: admin or manager only
  if (caller.role !== "admin" && caller.role !== "manager") {
    return { ok: false, error: "Kun admin eller leder kan opprette innkallinger" };
  }

  // 5. Insert the staff_event row
  const { data: event, error: eventError } = await supabase
    .from("staff_event")
    .insert({
      workspace_id: caller.workspaceId,
      created_by: caller.profileId,
      event_type: data.event_type,
      title: data.title,
      message: data.message ?? null,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      location: data.location ?? null,
    })
    .select("event_id")
    .single();

  if (eventError || !event) {
    return {
      ok: false,
      error: eventError?.message ?? "Kunne ikke opprette innkalling",
    };
  }

  const eventId = event.event_id;

  // 6. Insert attendee rows — rollback on failure
  const attendeeRows = data.attendee_profile_ids.map((profileId) => ({
    event_id: eventId,
    profile_id: profileId,
    status: "invited" as const,
  }));

  const { error: attendeeError } = await supabase.from("staff_event_attendee").insert(attendeeRows);

  if (attendeeError) {
    // Rollback: delete the event (cascade deletes attendees if any slipped through)
    await supabase.from("staff_event").delete().eq("event_id", eventId);
    return {
      ok: false,
      error: "Kunne ikke lagre deltakere — prøv igjen",
    };
  }

  // 7. Emit telemetry (ADR-0134 — nonEmpty for workspace_id + actor_id)
  void emit({
    event: "staff_event created",
    workspace_id: nonEmpty(caller.workspaceId, "workspace_id"),
    actor_id: nonEmpty(caller.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "staff_event",
        entity_id: eventId,
      },
      data: {
        event_type: data.event_type,
        attendee_count: data.attendee_profile_ids.length,
      },
    },
  });

  // 8. Revalidate the listing page
  revalidatePath("/dashboard/people/invitations");

  return { ok: true, data: { event_id: eventId } };
}

// ─── Staff event row type for listing ────────────

export type StaffEventRow = {
  event_id: string;
  event_type: "utviklingssamtale" | "personalmote" | "personalfest" | "annet";
  title: string;
  message: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  created_at: string;
  attendees: Array<{
    profile_id: string;
    status: "invited" | "accepted" | "declined" | "tentative";
    profile: {
      display_name: string;
      avatar_url: string | null;
    } | null;
  }>;
};

// ─── listStaffEvents ────────────────────────────

/**
 * Returns staff_events for the workspace, sorted starts_at DESC.
 * Includes nested attendees with profile display_name + avatar_url.
 * Capped at 100 rows.
 */
export async function listStaffEvents(workspaceId: string): Promise<StaffEventRow[]> {
  const supabase = await getClient();

  const { data, error } = await supabase
    .from("staff_event")
    .select(
      `event_id, event_type, title, message, starts_at, ends_at, location, created_at,
       attendees:staff_event_attendee(
         profile_id, status,
         profile(display_name, avatar_url)
       )`,
    )
    .eq("workspace_id", workspaceId)
    .order("starts_at", { ascending: false })
    .limit(100)
    .returns<StaffEventRow[]>();

  if (error) {
    console.warn("[staff-events] listStaffEvents failed:", error.message);
    return [];
  }

  return data ?? [];
}

// ─── Employee picker type ────────────────────────

export type EmployeePickerRow = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  department_name: string | null;
};

// ─── listWorkspaceEmployeesForEventPicker ────────

/**
 * Returns active + trainee profiles for the employee multi-select in
 * StaffEventDialog. Joins department name for display.
 */
export async function listWorkspaceEmployeesForEventPicker(
  workspaceId: string,
): Promise<EmployeePickerRow[]> {
  const supabase = await getClient();

  const { data, error } = await supabase
    .from("profile")
    .select("profile_id, display_name, avatar_url, department:department_id(name)")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "trainee"])
    .order("display_name")
    .limit(500);

  if (error) {
    console.warn("[staff-events] listWorkspaceEmployeesForEventPicker failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    profile_id: row.profile_id,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    department_name: (row.department as { name: string } | null)?.name ?? null,
  }));
}
