// Permanent redirect — /dashboard/contracts/new → /dashboard/people/contracts?open=compose
// Mirrors the existing in-route redirect that new/ already performed.
// Installed as part of SM-2-followup-contracts route migration.
// DO NOT REMOVE until all notification action_urls and external links are confirmed updated.
import { redirect } from "next/navigation";

export default function ContractsNewRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const profileId = typeof searchParams.profileId === "string" ? searchParams.profileId : undefined;
  const qs = profileId
    ? new URLSearchParams({ open: "compose", profileId }).toString()
    : "open=compose";
  redirect(`/dashboard/people/contracts?${qs}`);
}
