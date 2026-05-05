// RecentActivitySection.tsx — billing_activity_log tail (last 10–20 entries)
//
// Shows the most recent billing activity events for this workspace.
// recentActivity is never null — accessible with both scopes.
//
// Each row shows: timestamp (ISO → Norwegian short datetime), event
// name, and actor user_id (abbreviated). Unknown actor = "System".
//
// Server Component. No "use client".

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { KartotekActivityRow } from "@smartout/billing/server";

type Props = {
  recentActivity: KartotekActivityRow[];
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Make raw event names human-readable. */
function eventLabel(event: string): string {
  return event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecentActivitySection({ recentActivity }: Props) {
  if (recentActivity.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktivitet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Ingen aktivitet registrert</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Aktivitet{" "}
          <span className="text-muted-foreground text-xs font-normal">
            (siste {recentActivity.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-border divide-y">
          {recentActivity.map((entry, idx) => (
            <div key={entry.id ?? idx} className="flex items-start gap-4 px-6 py-3 text-sm">
              <time
                className="text-muted-foreground pt-0.5 font-mono text-xs whitespace-nowrap"
                dateTime={entry.created_at}
              >
                {formatDateTime(entry.created_at)}
              </time>
              <div className="min-w-0 flex-1">
                <p className="leading-snug font-medium">{eventLabel(entry.event)}</p>
                {entry.actor_user_id && (
                  <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                    {entry.actor_user_id.slice(0, 8)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        {recentActivity.length >= 10 && (
          <>
            <Separator />
            <div className="px-6 py-3">
              <p className="text-muted-foreground text-xs">
                Viser siste {recentActivity.length} hendelser
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
