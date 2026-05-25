/**
 * accountant.ts — accountant identity + grant resolution
 *
 * Full implementation per blueprint §4.
 * - getAccountantUserId(): returns authenticated user_id, throws if no session.
 * - getGrantedCompanyIds(userId): resolves active company grants from
 *   billing.accountant_company_grant via @smartout/billing/accountant.
 * - requireAccountant(): server-side gate; redirects/404s if no grants.
 *   Godmode short-circuit per ADR-0410: is_godmode=true bypasses grant check
 *   and receives all company IDs. Every godmode access is audit-emitted.
 *
 * M4 migration live: @smartout/billing/accountant is now wired.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAccountantCompanyGrants } from "@smartout/billing/accountant";
import { redirect, notFound } from "next/navigation";
import { cache } from "react";
import { emit, nonEmpty } from "@/lib/telemetry";
import { headers } from "next/headers";

export const getAccountantUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});

/**
 * Checks whether the current authenticated user has is_godmode=true
 * on their user_identity row.
 *
 * Uses the JWT-scoped client so the user can only read their own row.
 * Returns false (not null) on any error — fail closed.
 */
export const isGodmodeUser = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    console.error("[accountant] isGodmodeUser check failed:", error);
    return false;
  }
  return data.is_godmode === true;
});

/**
 * Returns ALL company IDs in the platform. Used exclusively for godmode users.
 * Requires service-role client to bypass RLS on company table.
 */
async function getAllCompanyIds(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("company").select("company_id");

  if (error) {
    console.error("[accountant] getAllCompanyIds failed:", error);
    return [];
  }
  return (data ?? []).map((c) => c.company_id);
}

/**
 * Returns the list of company IDs this accountant has active grants for.
 *
 * Uses the user-scoped client (JWT) so RLS enforces accountant_company_grant
 * access — a user can only read their own rows (accountant_company_grant_self_select).
 *
 * Returns [] when no active grants exist (or when the billing migration has
 * not yet run — the query returns an empty result rather than throwing in that
 * case if the table doesn't exist yet, though M4 ensures it does).
 */
export const getGrantedCompanyIds = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createClient();
  try {
    const grants = await fetchAccountantCompanyGrants(supabase, userId);
    return grants.map((g) => g.company_id);
  } catch (err) {
    // Log but degrade gracefully — if billing schema migration is missing,
    // surface empty grants rather than crashing the shell layout.
    console.error("[accountant] fetchAccountantCompanyGrants failed:", err);
    return [];
  }
});

/**
 * Gate function for the (admin) route group layout.
 *
 * - No session → redirect("/auth/login")
 * - is_godmode=true → returns { userId, companyIds: all, isGodmode: true }
 *   and emits godmode.admin_access to activity_trail (ADR-0410).
 * - Session but no grants → notFound() (404: "you have no tenancy here")
 * - Session + grants → returns { userId, companyIds, isGodmode: false }
 */
export async function requireAccountant(): Promise<{
  userId: string;
  companyIds: string[];
  isGodmode: boolean;
}> {
  const userId = await getAccountantUserId();
  if (!userId) redirect("/auth/login");

  // Godmode short-circuit (ADR-0410). Must be checked before grant lookup
  // so godmode users never hit the grant table at all.
  const godmode = await isGodmodeUser(userId);
  if (godmode) {
    const allCompanyIds = await getAllCompanyIds();

    // Audit-emit every godmode access (ADR-0410 mandate).
    const reqHeaders = await headers();
    const route = reqHeaders.get("x-invoke-path") ?? reqHeaders.get("x-pathname") ?? "unknown";
    await emit({
      event: "godmode.admin_access",
      actor_id: nonEmpty(userId, "actor_id"),
      workspace_id: null,
      properties: {
        entity: {
          entity_type: "user_identity",
          entity_id: userId,
        },
        data: {
          route,
        },
      },
    }).catch((err) => {
      // Never block godmode access because telemetry fails.
      console.error("[accountant] godmode audit emit failed:", err);
    });

    return { userId, companyIds: allCompanyIds, isGodmode: true };
  }

  const companyIds = await getGrantedCompanyIds(userId);

  // No active grants → 404. Using notFound() rather than redirect to /auth/login
  // because the user IS authenticated — they just don't have a tenancy here.
  if (companyIds.length === 0) notFound();

  return { userId, companyIds, isGodmode: false };
}
