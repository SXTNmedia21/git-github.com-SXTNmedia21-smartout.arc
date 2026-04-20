/**
 * Fetches the employee's own manual supplement claims (across all shifts).
 *
 * manual_supplement lives in the payroll schema. Each claim links to a
 * schedule_shift and optionally to a supplement_rule. This hook returns
 * the 20 most recent claims ordered by created_at descending.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type ManualSupplement = Database["payroll"]["Tables"]["manual_supplement"]["Row"];

export type MySupplementClaimsResult = {
  claims: ManualSupplement[];
};

/** How long before claims data is considered stale (2 minutes) */
const STALE_TIME_MS = 2 * 60 * 1000;

async function fetchMySupplementClaims(): Promise<MySupplementClaimsResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (profileError) throw profileError;

  // manual_supplement.added_by is the profile_id of the employee who created the claim
  const { data, error } = await supabase
    .schema("payroll")
    .from("manual_supplement")
    .select("*")
    .eq("added_by", profile.profile_id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  return { claims: data ?? [] };
}

/**
 * Hook: returns the current employee's manual supplement claims (most recent 20).
 * Shorter stale time (2 min) since claim status can change as managers review.
 */
export function useMySupplementClaims() {
  return useQuery<MySupplementClaimsResult>({
    queryKey: ["my-supplement-claims"],
    queryFn: fetchMySupplementClaims,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
