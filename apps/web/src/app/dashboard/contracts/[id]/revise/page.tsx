// Permanent redirect — /dashboard/contracts/[id]/revise → /dashboard/people/contracts/[id]/revise
// Installed as part of SM-2-followup-contracts route migration.
// DO NOT REMOVE until all notification action_urls and external links are confirmed updated.
import { redirect } from "next/navigation";

export default function ContractReviseRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/people/contracts/${params.id}/revise`);
}
