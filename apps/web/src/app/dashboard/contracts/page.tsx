// Permanent redirect — /dashboard/contracts → /dashboard/people/contracts
// Installed as part of SM-2-followup-contracts route migration.
// DO NOT REMOVE until all notification action_urls and external links are confirmed updated.
import { redirect } from "next/navigation";

export default function ContractsRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((s) => [k, s]) : v != null ? [[k, v]] : [],
    ),
  ).toString();
  redirect(qs ? `/dashboard/people/contracts?${qs}` : "/dashboard/people/contracts");
}
