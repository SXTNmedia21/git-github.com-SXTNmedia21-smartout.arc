// Permanent redirect — /dashboard/contracts/[id] → /dashboard/people/contracts/[id]
// Installed as part of SM-2-followup-contracts route migration.
// DO NOT REMOVE until all notification action_urls and external links are confirmed updated.
import { redirect } from "next/navigation";

export default function ContractDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/people/contracts/${params.id}`);
}
