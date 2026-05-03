"use client";

import { useRouter, usePathname } from "next/navigation";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { PEOPLE_TAB_DEFS } from "@/app/dashboard/_lib/people-tabs";

/**
 * Client wrapper for the People-module pill tab nav. Server page can't use
 * router/pathname directly so we mount the nav as its own client island.
 */
export function PeopleInvitationsTabNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <PageTabNav
      tabs={PEOPLE_TAB_DEFS.map((tab) => ({ key: tab.key, label: tab.label, icon: tab.icon }))}
      active={pathname ?? "/dashboard/people/invitations"}
      onChange={(href) => router.push(href)}
      ariaLabel="Ansatte-seksjoner"
    />
  );
}
