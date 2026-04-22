import { Suspense } from "react";
import { resolveDashboardContext } from "@/app/dashboard/_data/resolve-page-context";
import { SeasonPageClient, type TabKey } from "./season-page-client";
import SeasonPageLoading from "./loading";

/**
 * /dashboard/season/[seasonId] — Server Component shell.
 *
 * Resolves workspace + profile context server-side (layout is the
 * access-control boundary; this helper re-derives the same values for
 * pages that need them). Hands off to the client shell which owns the
 * submenu, data hooks, and tab content.
 *
 * Per ADR-0115 (RSC migration pattern). The season page is a shell —
 * each tab owns its own TanStack Query hooks and renders its own UI.
 */
export default async function SeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ seasonId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { seasonId } = await params;
  const { tab } = await searchParams;

  const ctx = await resolveDashboardContext();

  return (
    <Suspense fallback={<SeasonPageLoading />}>
      <SeasonPageClient
        seasonId={seasonId}
        initialTab={(tab as TabKey) ?? "budget"}
        workspaceId={ctx.workspace.workspace_id}
      />
    </Suspense>
  );
}
