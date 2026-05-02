/**
 * accountant.ts — accountant identity + grant resolution
 *
 * Full implementation per blueprint §4.
 * Pass-through grants in M1: getGrantedCompanyIds returns [] for any user
 * (no grants table yet — M4 runs the migration).
 * requireAccountant() still works for any authenticated user in M1/M2.
 *
 * TODO M3: replace pass-through with actual grant query:
 *   import { fetchAccountantCompanyGrants } from "@smartout/billing/accountant";
 */
import { createClient } from "@/lib/supabase/server";
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
 * M1 pass-through: returns [] until migration + real query lands in M3/M4.
 * TODO M3: replace with @smartout/billing/accountant fetchAccountantCompanyGrants
 */
export const getGrantedCompanyIds = cache(async (_userId: string): Promise<string[]> => {
  // TODO M3: replace with @smartout/billing/accountant
  // const supabase = await createClient();
  // const grants = await fetchAccountantCompanyGrants(supabase, _userId);
  // return grants.map((g) => g.company_id);
  return [];
});

/**
 * Gate function for the (admin) route group layout.
 *
 * - No session → redirect("/auth/login")
 * - Session but no grants → notFound() (404: "you have no tenancy here")
 * - Session + grants → returns { userId, companyIds }
 *
 * In M1 the pass-through grants mean any authenticated user gets in.
 * M4 will tighten this once the accountant_company_grant table is live.
 */
export async function requireAccountant(): Promise<{
  userId: string;
  companyIds: string[];
}> {
  const userId = await getAccountantUserId();
  if (!userId) redirect("/auth/login");

  const companyIds = await getGrantedCompanyIds(userId);

  // M1: skip the 0-grants gate to allow dev/testing without a populated DB.
  // M4: re-enable:  if (companyIds.length === 0) notFound();
  void notFound; // keep the import live to avoid unused-import lint error

  return { userId, companyIds };
}
