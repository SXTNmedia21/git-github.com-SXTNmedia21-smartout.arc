import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { createClient } from "@smartout/supabase/server";
import type { Json } from "@smartout/supabase";

/**
 * Check if the current user has godmode access.
 * Use in server components and route handlers (NOT middleware).
 * Returns the user_id if godmode, null otherwise.
 */
export async function getSuperAdminId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  return data?.is_godmode ? user.id : null;
}

/**
 * Validates that the current request comes from a godmode user.
 * Returns the admin user ID and a pre-configured admin Supabase client,
 * or a NextResponse error if unauthorized.
 *
 * Use in API route handlers to replace the repeated 10-line
 * getSuperAdminId() + createAdminClient() pattern.
 */
export async function requireGodmode(): Promise<
  | { adminId: string; admin: ReturnType<typeof createAdminClient>; error?: never }
  | { error: NextResponse; adminId?: never; admin?: never }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!data?.is_godmode) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { adminId: user.id, admin };
}

/**
 * Log a platform admin action to the audit log.
 */
export async function logPlatformAction(
  superAdminId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  const admin = createAdminClient();
  await admin.from("platform_audit_log").insert({
    super_admin_id: superAdminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details as unknown as Json,
  });
}
