/**
 * Vaktplan hub layout — wraps all schedule/* routes with the tab strip.
 *
 * Tab strip (ScheduleTabNav) is a client component; this file is a server
 * component. Composition is safe per Next.js RSC rules — server component
 * can import client component directly.
 *
 * Routes that inherit this layout:
 *   /dashboard/schedule             → Vaktplan tab (page.tsx)
 *   /dashboard/schedule/marketplace → Vaktbørs tab (marketplace/page.tsx)
 *   /dashboard/schedule/ferieplan   → Ferieplan tab (ferieplan/page.tsx)
 *   /dashboard/schedule/pipeline    → Admin audit view (tab strip visible, harmless)
 *   /dashboard/schedule/proposed-plan → C2 agent panel target (tab strip visible, harmless)
 *
 * Known debt: pipeline/ and proposed-plan/ inherit the strip cosmetically.
 * If product review flags it, add a route group (tabs)/ in a follow-up.
 *
 * Spec: docs/design/sitemap/web/00-CANONICAL.md §3.
 */
import type { ReactNode } from "react";
import { ScheduleTabNav } from "./_components/ScheduleTabNav";

export default function ScheduleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <ScheduleTabNav />
      {children}
    </div>
  );
}
