// Permanent redirect — /dashboard/contracts/awaiting-my-signature
// → /dashboard/people/contracts/awaiting-my-signature
// Installed as part of SM-2-followup-contracts route migration.
// DO NOT REMOVE until all notification action_urls and external links are confirmed updated.
import { redirect } from "next/navigation";

export default function AwaitingSignatureRedirect() {
  redirect("/dashboard/people/contracts/awaiting-my-signature");
}
