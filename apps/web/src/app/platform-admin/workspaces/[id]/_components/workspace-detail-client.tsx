"use client";

import { useState } from "react";
import {
  Users,
  Building2,
  CreditCard,
  Calendar,
  MessageSquare,
  StickyNote,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { ComposeEmailSheet } from "@/components/platform-admin/compose-email-sheet";
import type { AudienceFilter } from "@/components/platform-admin/audience-selector";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ProfileRow = {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string | null;
};

type NoteRow = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  workspace: { workspaceId: string; name: string; slug: string; createdAt: string };
  company: {
    name: string;
    orgNumber: string;
    city: string;
    industry: string;
    email: string;
    phone: string;
    subscriptionPlan: string;
    subscriptionStatus: string;
    trialEndsAt: string | null;
  } | null;
  stats: {
    totalProfiles: number;
    activeProfiles: number;
    traineeProfiles: number;
    departmentCount: number;
  };
  profiles: ProfileRow[];
  notes: NoteRow[];
  commHistory: Array<Record<string, unknown>>;
};

export function WorkspaceDetailClient({
  workspace,
  company,
  stats,
  profiles,
  notes: initialNotes,
  commHistory,
}: Props) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeAudience, setComposeAudience] = useState<AudienceFilter | undefined>();
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState(initialNotes);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredProfiles = profiles.filter((p) => {
    if (roleFilter !== "all" && p.role !== roleFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  function openCompose(audience?: AudienceFilter) {
    setComposeAudience(audience);
    setComposeOpen(true);
  }

  async function saveNote() {
    if (!noteText.trim()) return;
    setIsSavingNote(true);
    try {
      const res = await fetch("/api/platform-admin/workspace-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.workspaceId, content: noteText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      const { note } = await res.json();
      const now = new Date().toISOString();
      setNotes([
        { id: note.note_id, text: note.content, createdAt: note.created_at ?? now, updatedAt: now },
        ...notes,
      ]);
      setNoteText("");
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function updateNote(noteId: string) {
    if (!editingText.trim()) return;
    try {
      const res = await fetch("/api/platform-admin/workspace-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, content: editingText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update note");
      setNotes(
        notes.map((n) =>
          n.id === noteId
            ? { ...n, text: editingText.trim(), updatedAt: new Date().toISOString() }
            : n,
        ),
      );
      setEditingNoteId(null);
      setEditingText("");
      toast.success("Note updated");
    } catch {
      toast.error("Failed to update note");
    }
  }

  async function deleteNote(noteId: string) {
    try {
      const res = await fetch("/api/platform-admin/workspace-notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      if (!res.ok) throw new Error("Failed to delete note");
      setNotes(notes.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  }

  const trialDaysLeft = company?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(company.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        {company && <StatusBadge status={company.subscriptionStatus} />}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-xs uppercase">Profiles</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">{stats.totalProfiles}</p>
                <p className="text-muted-foreground text-xs">
                  {stats.activeProfiles} active, {stats.traineeProfiles} trainee
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Building2 className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-xs uppercase">Departments</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">{stats.departmentCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-xs uppercase">Plan</span>
                </div>
                <p className="mt-2 text-2xl font-semibold capitalize">
                  {company?.subscriptionPlan ?? "\u2014"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-xs uppercase">Created</span>
                </div>
                <p className="mt-2 text-lg font-semibold">
                  {new Date(workspace.createdAt).toLocaleDateString("no-NO")}
                </p>
              </CardContent>
            </Card>
          </div>

          {company && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Info</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Name</dt>
                    <dd>{company.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Org Number</dt>
                    <dd className="font-mono">{company.orgNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">City</dt>
                    <dd>{company.city}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Industry</dt>
                    <dd className="capitalize">{company.industry}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd>{company.email}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{company.phone}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PEOPLE TAB */}
        <TabsContent value="people" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 w-40 text-sm">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-40 text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trainee">Trainee</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="offboarding">Offboarding</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-sm">
              {filteredProfiles.length} profiles
            </span>
          </div>
          <div className="border-border rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p) => (
                  <tr key={p.profileId} className="border-border border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="text-muted-foreground px-4 py-3">{p.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {p.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} size="sm" />
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {p.lastLogin ? new Date(p.lastLogin).toLocaleDateString("no-NO") : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          openCompose({
                            type: "user_ids",
                            userIds: [p.userId],
                          } as unknown as AudienceFilter)
                        }
                      >
                        <Send className="mr-1 h-3 w-3" /> Email
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* COMMUNICATION TAB */}
        <TabsContent value="communication" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => openCompose({ type: "workspace", workspaceId: workspace.workspaceId })}
            >
              <MessageSquare className="mr-1 h-3 w-3" /> All Users
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                openCompose({
                  type: "workspace",
                  workspaceId: workspace.workspaceId,
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
                openCompose({
                  type: "workspace",
                  workspaceId: workspace.workspaceId,
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
                openCompose({
                  type: "workspace",
                  workspaceId: workspace.workspaceId,
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

        {/* SUBSCRIPTION TAB */}
        <TabsContent value="subscription" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs uppercase">Current Plan</p>
                <p className="mt-2 text-2xl font-semibold capitalize">
                  {company?.subscriptionPlan ?? "\u2014"}
                </p>
                <div className="mt-2">
                  {company && <StatusBadge status={company.subscriptionStatus} />}
                </div>
              </CardContent>
            </Card>
            {trialDaysLeft !== null && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-muted-foreground text-xs uppercase">Trial Status</p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${trialDaysLeft <= 3 ? "text-destructive" : ""}`}
                  >
                    {trialDaysLeft} days left
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Expires {new Date(company!.trialEndsAt!).toLocaleDateString("no-NO")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          <TooltipProvider>
            <div className="flex gap-2">
              {["Extend Trial", "Change Plan", "Pause / Cancel"].map((label) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" disabled>
                      {label}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Stripe integration coming</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </TabsContent>

        {/* NOTES TAB */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add an internal note..."
                className="min-h-[80px] text-sm"
              />
              <Button size="sm" onClick={saveNote} disabled={!noteText.trim() || isSavingNote}>
                <StickyNote className="mr-1 h-3 w-3" /> Save Note
              </Button>
            </CardContent>
          </Card>
          {notes.length > 0 && (
            <div className="space-y-2">
              {notes.map((note) => (
                <Card key={note.id}>
                  <CardContent className="p-3">
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateNote(note.id)}
                            disabled={!editingText.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingText("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-muted-foreground text-xs">
                            {new Date(note.createdAt).toLocaleString("no-NO")}
                            {note.updatedAt !== note.createdAt && " (edited)"}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                setEditingNoteId(note.id);
                                setEditingText(note.text);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive h-6 px-2 text-xs"
                              onClick={() => deleteNote(note.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ComposeEmailSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAudience={composeAudience}
        workspaceId={workspace.workspaceId}
        workspaceName={workspace.name}
      />
    </div>
  );
}
