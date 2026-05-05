import { Suspense } from "react";
import { Send } from "lucide-react";
import { resolveDashboardContext } from "../../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { timed } from "@/lib/perf";
import { listWorkspaceInvitations } from "../_actions/people-actions";
import { InvitationsSection } from "../_components/invitations-section";
import { PeopleInvitationsTabNav } from "./_components/tab-nav";
import PeopleLoading from "../loading";

/**
 * /dashboard/people/invitations — dedicated invitations view.
 *
 * Mirrors the People-module shell (header + PEOPLE_TAB_DEFS pill nav) so the
 * "Innkalling" tab has a real destination with proper active-state. Renders
 * only the InvitationsSection — the employee table stays on /dashboard/people.
 */
export default withPagePerf(async function PeopleInvitationsPage() {
  const { workspace } = await resolveDashboardContext();

  const invitationRows = await timed("people.invitations.list", () =>
    listWorkspaceInvitations(workspace.workspace_id),
  );

  return (
    <Suspense fallback={<PeopleLoading />}>
      <div className="relative flex flex-col gap-5">
        <header className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
              Innkalling
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Send, gjenoppta og kanseller ansattinvitasjoner.
            </p>
          </div>
          <Send className="text-muted-foreground hidden h-5 w-5 sm:block" aria-hidden />
        </header>

        <PeopleInvitationsTabNav />

        <InvitationsSection
          initialRows={invitationRows}
          workspaceId={workspace.workspace_id}
          workspaceSlug={workspace.slug}
        />
      </div>
    </Suspense>
  );
});
