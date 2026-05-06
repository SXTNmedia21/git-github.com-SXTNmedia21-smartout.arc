import { Suspense } from "react";
import { Send } from "lucide-react";
import { resolveDashboardContext } from "../../_data/resolve-page-context";
import { withPagePerf } from "@/lib/page-perf";
import { timed } from "@/lib/perf";
import {
  listStaffEvents,
  listWorkspaceEmployeesForEventPicker,
} from "./_actions/staff-event-actions";
import { PeopleInvitationsTabNav } from "./_components/tab-nav";
import { StaffEventList } from "./_components/StaffEventList";
import { NewStaffEventButton } from "./_components/NewStaffEventButton";
import PeopleLoading from "../loading";

/**
 * /dashboard/people/invitations — Staff event (innkalling) listing page.
 *
 * Server Component shell per ADR-0115 (RSC migration pattern).
 * Fetches staff_events + employee picker data in parallel, then renders
 * the static list and passes employees down to the client-island button.
 *
 * InvitationsSection (workspace invite) is removed from this route —
 * it remains accessible via /dashboard/people (the main people table).
 */
export default withPagePerf(async function PeopleInvitationsPage() {
  const { workspace } = await resolveDashboardContext();

  // Parallel fetches — events list + employee picker data
  const [events, employees] = await Promise.all([
    timed("people.staff-events.list", () => listStaffEvents(workspace.workspace_id)),
    timed("people.staff-events.employees", () =>
      listWorkspaceEmployeesForEventPicker(workspace.workspace_id),
    ),
  ]);

  const newEventButton = <NewStaffEventButton employees={employees} />;

  return (
    <Suspense fallback={<PeopleLoading />}>
      <div className="relative flex flex-col gap-5">
        <header className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
              Innkalling
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Kall inn ansatte til samtaler, møter og tilstelninger.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <NewStaffEventButton employees={employees} />
            <Send className="text-muted-foreground hidden h-5 w-5 sm:block" aria-hidden />
          </div>
        </header>

        <PeopleInvitationsTabNav />

        <StaffEventList events={events} newEventButton={newEventButton} />
      </div>
    </Suspense>
  );
});
