"use client";

// Communication tab: audience-targeted email buttons + communication history table.

import { MessageSquare } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import type { AudienceFilter } from "@/components/platform-admin/audience-selector";

type Props = {
  commHistory: Array<Record<string, unknown>>;
  workspaceId: string;
  workspaceName: string;
  // Callback to open the shared ComposeEmailSheet (lives in the shell).
  onOpenCompose: (audience: AudienceFilter) => void;
};

export function CommunicationTab({ commHistory, workspaceId, onOpenCompose }: Props) {
  return (
    <TabsContent value="communication" className="mt-4 space-y-4">
      {/* Audience shortcut buttons — each pre-fills the compose sheet with a target audience */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            onOpenCompose({
              type: "workspace",
              workspaceId,
            })
          }
        >
          <MessageSquare className="mr-1 h-3 w-3" /> All Users
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onOpenCompose({
              type: "workspace",
              workspaceId,
              role: "admin",
            } as AudienceFilter)
          }
        >
          All Admins
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onOpenCompose({
              type: "workspace",
              workspaceId,
              role: "manager",
            } as AudienceFilter)
          }
        >
          Managers+
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onOpenCompose({
              type: "workspace",
              workspaceId,
              role: "owner",
            } as AudienceFilter)
          }
        >
          Owners Only
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Communication History</CardTitle>
        </CardHeader>
        <CardContent>
          {commHistory.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No communications sent to this workspace yet.
            </p>
          ) : (
            <div className="space-y-3">
              {commHistory.map((c) => (
                <div
                  key={c.communication_id as string}
                  className="border-border flex items-center justify-between rounded border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{c.subject as string}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(c.created_at as string).toLocaleDateString("no-NO")} &mdash;{" "}
                      {c.template as string}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">
                      {c.sent_count as number}/{c.recipient_count as number} sent
                    </span>
                    <StatusBadge status={c.status as string} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
