/**
 * /walt/sign-dev/[contract_id] — Dev-only contract signing stub page.
 *
 * What: Server component that gates dev-sign access (not available when
 *       contract-service is configured) and fetches contract data before
 *       rendering DevSignClient.
 *
 * Why: Enables E2E tests in dev/CI environments where DocuSeal is not
 *      running. The page is 404 in production (contract-service configured).
 *
 * Auth: requires Supabase session. Unauthenticated → redirect /login.
 * Security: notFound() when CONTRACT_SERVICE_URL is set (production guard).
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { DevSignClient } from "./dev-sign-client";

function isContractServiceConfigured(): boolean {
  const url = process.env.CONTRACT_SERVICE_URL;
  return Boolean(url && url.trim().length > 0);
}

type Props = { params: Promise<{ contract_id: string }> };

export default async function DevSignPage({ params }: Props) {
  // Production guard — sign-dev is only available in dev mode
  if (isContractServiceConfigured()) {
    notFound();
  }

  const { contract_id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch employment_contract to display position title
  const { data: contract } = await supabase
    .from("employment_contract")
    .select("contract_id, position_title, status")
    .eq("contract_id", contract_id)
    .single();

  if (!contract) {
    notFound();
  }

  return (
    <DevSignClient contractId={contract.contract_id} positionTitle={contract.position_title} />
  );
}
