// ============================================
// wizard-launcher-client.tsx — Wizard Launcher Client
// Interactive client component for starting new wizard sessions
// and viewing/resuming existing ones.
// Connected to: /api/platform-admin/journeys/wizard (POST create, GET list)
// ============================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Wand2, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Json } from "@smartout/supabase";

type Workspace = {
  workspace_id: string;
  name: string;
  slug: string;
};

type SessionSummary = {
  wizard_session_id: string;
  status: string;
  current_phase: string;
  draft_journey: Json;
  created_at: string;
  completed_at: string | null;
};

type WizardLauncherClientProps = {
  workspaces: Workspace[];
  sessions: SessionSummary[];
};

/**
 * Launcher page for the journey wizard.
 * Shows a workspace selector to start new sessions
 * and a list of existing sessions to resume or view.
 */
export function WizardLauncherClient({ workspaces, sessions }: WizardLauncherClientProps) {
  const router = useRouter();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Creates a new wizard session and redirects to it.
   */
  async function handleStartWizard() {
    if (!selectedWorkspace) {
      toast.error("Select a workspace first");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/platform-admin/journeys/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: selectedWorkspace }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to create session");
        return;
      }

      const session = await res.json();
      router.push(`/platform-admin/journeys/wizard/${session.wizard_session_id}`);
    } catch {
      toast.error("Network error");
    } finally {
      setIsCreating(false);
    }
  }

  /** Maps phase to a human-readable label */
  const phaseLabels: Record<string, string> = {
    discovery: "Discovery",
    classification: "Classification",
    steps: "Steps",
    testing: "Testing",
    documentation: "Documentation",
    review: "Review",
  };

  /** Maps status to badge variant styling */
  function statusBadge(status: string) {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "abandoned":
        return <Badge variant="outline">Abandoned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/platform-admin/journeys">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Journey Wizard</h1>
          <p className="text-muted-foreground text-sm">AI-guided journey definition in 6 phases</p>
        </div>
      </div>

      {/* Start new wizard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4" />
            Start New Wizard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-muted-foreground mb-1.5 block text-sm font-medium">
                Workspace
              </label>
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workspace..." />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.workspace_id} value={ws.workspace_id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleStartWizard} disabled={!selectedWorkspace || isCreating}>
              <Plus className="mr-1.5 h-4 w-4" />
              {isCreating ? "Creating..." : "Start Wizard"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No wizard sessions yet. Start one above.
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const draft = (session.draft_journey ?? {}) as Record<string, unknown>;
                const title = draft.title ? String(draft.title) : "Untitled";

                return (
                  <div
                    key={session.wizard_session_id}
                    className="hover:bg-muted/50 flex items-center justify-between rounded-md border p-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {statusBadge(session.status)}
                      <div>
                        <p className="text-foreground text-sm font-medium">{title}</p>
                        <p className="text-muted-foreground text-xs">
                          Phase: {phaseLabels[session.current_phase] ?? session.current_phase}
                          {" -- "}
                          {new Date(session.created_at).toLocaleDateString("nb-NO", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <Link href={`/platform-admin/journeys/wizard/${session.wizard_session_id}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        {session.status === "active" ? "Resume" : "View"}
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
