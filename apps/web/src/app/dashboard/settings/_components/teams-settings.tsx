"use client";

/**
 * Teams settings — list, create, and delete teams within the workspace.
 * Shows a card-based list with team type badges, department, and member count.
 *
 * UI Events:
 * - action: createTeam mutation (dialog submit)
 * - action: deleteTeam mutation (row delete button)
 */

import { useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Badge,
} from "@smartout/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { toast } from "sonner";

// ─── Types & Schema ────────────────────────────────────────────────────────

const TEAM_TYPES = [
  { value: "operational", label: "Operational" },
  { value: "access", label: "Access" },
  { value: "cross_department", label: "Cross-department" },
  { value: "seasonal", label: "Seasonal" },
  { value: "custom", label: "Custom" },
] as const;

type TeamType = (typeof TEAM_TYPES)[number]["value"];

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100),
  team_type: z.enum(["operational", "access", "cross_department", "seasonal", "custom"]),
});

type CreateTeamInput = z.infer<typeof createTeamSchema>;

type TeamRow = {
  team_id: string;
  name: string;
  team_type: TeamType;
  is_active: boolean;
  department: { name: string } | null;
  team_member: { count: number }[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function teamTypeLabel(type: TeamType): string {
  return TEAM_TYPES.find((t) => t.value === type)?.label ?? type;
}

function teamTypeBadgeVariant(type: TeamType): "default" | "secondary" | "outline" {
  switch (type) {
    case "operational":
      return "default";
    case "seasonal":
      return "secondary";
    default:
      return "outline";
  }
}

// ─── Loading skeleton ──────────────────────────────────────────────────────

function TeamsListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-8 w-8" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export function TeamsSettings() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const wsId = workspace.workspace_id;
  const queryKey = ["settings", "teams", wsId];

  // Fetch teams with department name and member count
  const { data: teams, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<TeamRow[]> => {
      const { data, error } = await supabase
        .from("team")
        .select(
          "team_id, name, team_type, is_active, department:department_id(name), team_member(count)",
        )
        .eq("workspace_id", wsId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TeamRow[];
    },
  });

  // Create team mutation
  const createMutation = useMutation({
    mutationFn: async (values: CreateTeamInput) => {
      // Generate slug from name
      const slug = values.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const { error } = await supabase.from("team").insert({
        workspace_id: wsId,
        name: values.name,
        slug,
        team_type: values.team_type,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "team created",
        workspace_id: nonEmpty(wsId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "team", entity_id: "", entity_label: variables.name },
          data: { team_id: "", name: variables.name },
        },
      });
      void queryClient.invalidateQueries({ queryKey });
      toast.success("Team created");
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create team: ${error.message}`);
    },
  });

  // Delete team mutation
  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from("team").delete().eq("team_id", teamId);
      if (error) throw error;
    },
    onSuccess: (_data, teamId) => {
      void emit({
        event: "team deleted",
        workspace_id: nonEmpty(wsId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "team", entity_id: teamId, entity_label: "" },
          data: { team_id: teamId, name: "" },
        },
      });
      void queryClient.invalidateQueries({ queryKey });
      toast.success("Team deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete team: ${error.message}`);
    },
  });

  const form = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: "", team_type: "operational" },
  });

  const onCreateSubmit = form.handleSubmit((values) => createMutation.mutate(values));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Teams & Departments</h2>
          <p className="text-muted-foreground text-sm">Manage teams within your workspace.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={onCreateSubmit}>
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
                <DialogDescription>Add a new team to your workspace.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="team-name">Team Name</Label>
                  <Input id="team-name" {...form.register("name")} placeholder="e.g. Bar Team" />
                  {form.formState.errors.name && (
                    <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="team-type">Team Type</Label>
                  <Select
                    value={form.watch("team_type")}
                    onValueChange={(v) =>
                      form.setValue("team_type", v as CreateTeamInput["team_type"], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="team-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team list */}
      {isLoading ? (
        <TeamsListSkeleton />
      ) : !teams?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <Users className="text-muted-foreground h-7 w-7" />
            </div>
            <h3 className="text-foreground mb-1 text-lg font-semibold">No teams yet</h3>
            <p className="text-muted-foreground text-sm">Create your first team to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => {
            const memberCount =
              team.team_member?.[0] && typeof team.team_member[0].count === "number"
                ? team.team_member[0].count
                : 0;

            return (
              <Card key={team.team_id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
                      <Users className="text-muted-foreground h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm font-semibold">{team.name}</span>
                        <Badge variant={teamTypeBadgeVariant(team.team_type)}>
                          {teamTypeLabel(team.team_type)}
                        </Badge>
                        {!team.is_active && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {team.department?.name ?? "No department"} &middot; {memberCount}{" "}
                        {memberCount === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(team.team_id)}
                    disabled={deleteMutation.isPending}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete team</span>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
