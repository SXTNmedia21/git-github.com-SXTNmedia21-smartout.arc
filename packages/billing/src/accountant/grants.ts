// accountant/grants.ts — accountant cross-company grant resolution.
//
// Queries the billing.accountant_company_grant table via the
// supabase-js schema-switch API (.schema("billing")).
// Table lives in the "billing" schema (NOT public) per ADR-A.
//
// M4 confirmed: Database["billing"]["Tables"]["accountant_company_grant"]
// exists in packages/supabase/src/database.types.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { AccountantCompanyGrant } from "../types";

type BillingClient = SupabaseClient<Database>;

/**
 * Fetch all active (non-revoked) grants for a user.
 *
 * Uses `.schema("billing")` to target the billing schema — the table
 * is NOT in public. RLS policy `accountant_company_grant_self_select`
 * ensures a user can only see their own rows (user_id = auth.uid()).
 *
 * Pass a user-scoped client (anon key + JWT) for RLS enforcement.
 * Pass an admin/service-role client only from trusted server contexts
 * (e.g. platform-admin management UI — NOT accountant-facing routes).
 *
 * @param client - Supabase client.
 * @param userId - The user's UUID (from auth.getUser()).
 */
export async function fetchAccountantCompanyGrants(
  client: BillingClient,
  userId: string,
): Promise<AccountantCompanyGrant[]> {
  const { data, error } = await client
    .schema("billing")
    .from("accountant_company_grant")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AccountantCompanyGrant[];
}

/**
 * Check whether a user has an active grant for a specific company.
 *
 * Prefer this over calling `fetchAccountantCompanyGrants` + filtering
 * in JS when you only need a boolean (single-row existence check is
 * cheaper than fetching all grants).
 *
 * Uses `.schema("billing")` — see fetchAccountantCompanyGrants.
 *
 * @param client - Supabase client.
 * @param userId - The user's UUID.
 * @param companyId - The company UUID to check.
 */
export async function hasAccountantAccess(
  client: BillingClient,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const { data, error } = await client
    .schema("billing")
    .from("accountant_company_grant")
    .select("grant_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    // RLS denial returns a 406 or error — treat as no access.
    console.error("[billing/accountant/grants] hasAccountantAccess query failed:", error);
    return false;
  }
  return data !== null;
}
