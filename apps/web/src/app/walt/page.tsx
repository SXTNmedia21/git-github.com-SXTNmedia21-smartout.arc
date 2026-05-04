/**
 * /walt — Employee contract signing room.
 *
 * What: Landing page for employees who receive an email with a signing link.
 *       Fetches the employee's pending employment_contract server-side and
 *       passes state to WaltShell for rendering.
 *
 * State machine:
 *   - no_profile: auth user has no profile row in any workspace
 *   - just_signed: ?signed=<contract_id> param is present (post-sign redirect)
 *   - pending: profile has a contract in status [sent, viewed, ready_to_send, pending_signature]
 *   - no_pending: no pending contract found
 *
 * Auth: requires Supabase session. Unauthenticated → redirect /login.
 */

import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { WaltShell } from "./_components/WaltShell";
import type { WaltState, WaltContractData } from "./_components/WaltShell";

const PENDING_STATUSES = [
  "sent",
  "viewed",
  "ready_to_send",
  "pending_signature",
] as const satisfies ReadonlyArray<"sent" | "viewed" | "ready_to_send" | "pending_signature">;

export default async function WaltPage({
  searchParams,
}: {
  searchParams: Promise<{ signed?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { signed: signedContractId } = await searchParams;

  // Resolve profile for the authenticated user
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, display_name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!profile) {
    return (
      <WaltShell
        state="no_profile"
        firstName={user.user_metadata?.first_name ?? ""}
        contract={null}
      />
    );
  }

  // Extract first name from display_name (e.g. "Anna Olsen" → "Anna")
  const firstName = profile.display_name.split(" ")[0] ?? user.user_metadata?.first_name ?? "";

  // just_signed state — employee is redirected here after dev-signing
  if (signedContractId) {
    return (
      <WaltShell
        state="just_signed"
        firstName={firstName}
        contract={null}
        signedContractId={signedContractId}
      />
    );
  }

  // Look up pending contract for this profile
  const { data: pendingContract } = await supabase
    .from("employment_contract")
    .select(
      "contract_id, position_title, start_date, employment_category, employment_percentage, hourly_rate, monthly_salary, signing_contract_id",
    )
    .eq("profile_id", profile.profile_id)
    .eq("workspace_id", profile.workspace_id)
    .in("status", [...PENDING_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendingContract) {
    return <WaltShell state="no_pending" firstName={firstName} contract={null} />;
  }

  // Resolve signing_url from linked contract row
  let signingUrl: string | null = null;
  if (pendingContract.signing_contract_id) {
    const { data: signingContract } = await supabase
      .from("contract")
      .select("signing_url")
      .eq("contract_id", pendingContract.signing_contract_id)
      .single();
    signingUrl = signingContract?.signing_url ?? null;
  }

  const contractData: WaltContractData = {
    contract_id: pendingContract.contract_id,
    position_title: pendingContract.position_title,
    start_date: pendingContract.start_date,
    employment_category: pendingContract.employment_category,
    employment_percentage: pendingContract.employment_percentage,
    hourly_rate: pendingContract.hourly_rate,
    monthly_salary: pendingContract.monthly_salary,
    signing_url: signingUrl,
  };

  return <WaltShell state="pending" firstName={firstName} contract={contractData} />;
}
