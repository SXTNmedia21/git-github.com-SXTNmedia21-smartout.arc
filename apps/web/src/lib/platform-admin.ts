import { createAdminClient } from "@smartout/supabase/admin";
import { createClient } from "@smartout/supabase/server";
import type { Json } from "@smartout/supabase";

/**
 * Check if the current user is a super admin.
 * Use in server components and route handlers (NOT middleware).
 * Returns the user_id if super admin, null otherwise.
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
    .select("is_super_admin")
    .eq("user_id", user.id)
    .single();

  return data?.is_super_admin ? user.id : null;
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
