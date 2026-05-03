/**
 * accountant.ts — accountant identity + grant resolution
 *
 * Full implementation per blueprint §4.
 * - getAccountantUserId(): returns authenticated user_id, throws if no session.
 * - getGrantedCompanyIds(userId): resolves active company grants from
 *   billing.accountant_company_grant via @smartout/billing/accountant.
 * - requireAccountant(): server-side gate; redirects/404s if no grants.
 *
 * M4 migration live: @smartout/billing/accountant is now wired.
 */
import { createClient } from "@/lib/supabase/server";
import { fetchAccountantCompanyGrants } from "@smartout/billing/accountant";
import { redirect, notFound } from "next/navigation";
import { cache } from "react";

export const getAccountantUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});

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
 * - Session but no grants → notFound() (404: "you have no tenancy here")
 * - Session + grants → returns { userId, companyIds }
 */
export async function requireAccountant(): Promise<{
  userId: string;
  companyIds: string[];
}> {
  const userId = await getAccountantUserId();
  if (!userId) redirect("/auth/login");

  const companyIds = await getGrantedCompanyIds(userId);

  // No active grants → 404. Using notFound() rather than redirect to /auth/login
  // because the user IS authenticated — they just don't have a tenancy here.
  if (companyIds.length === 0) notFound();

  return { userId, companyIds };
}
