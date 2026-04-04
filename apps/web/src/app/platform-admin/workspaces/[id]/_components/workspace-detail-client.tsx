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
  Pencil,
  Check,
  X,
  Brain,
  FileText,
  Database,
  Star,
  MapPin,
  Globe,
  Trophy,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { DocumentDrop } from "@/components/platform-admin/document-drop";

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

type WorkspaceData = {
  workspaceId: string;
  name: string;
  slug: string;
  createdAt: string;
  description: string;
  timezone: string;
  currency: string;
  language: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  logoUrl: string;
  coverPhotoUrl: string;
  slogan: string;
  shortDescription: string;
  extendedDescription: string;
  brandColor: string;
  communicationTone: string;
  isActive: boolean;
  maxProfiles: number | null;
  onboardingCompleted: boolean;
  intelligenceData: Record<string, unknown>;
  googleRating: number | null;
  googleRatingCount: number | null;
  googleMapsUrl: string;
  googlePriceLevel: string;
  latitude: number | null;
  longitude: number | null;
};

type CompanyData = {
  companyId: string;
  name: string;
  legalName: string;
  orgNumber: string;
  city: string;
  industry: string;
  email: string;
  phone: string;
  website: string;
  billingEmail: string;
  addressLine1: string;
  postalCode: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  naceCode: string;
  naceDescription: string;
  dagligLeder: string;
};

type DocChunk = {
  id: string;
  sourceType: string;
  sourcePath: string;
  title: string;
  tokenCount: number;
  createdAt: string;
};

type MemoryRow = {
  id: string;
  memoryType: string;
  content: string;
  createdAt: string;
};

type StorageFile = {
  name: string;
  size: number | undefined;
  mimeType: string | undefined;
  createdAt: string;
};

type Props = {
  workspace: WorkspaceData;
  company: CompanyData | null;
  stats: {
    totalProfiles: number;
    activeProfiles: number;
    traineeProfiles: number;
    departmentCount: number;
  };
  profiles: ProfileRow[];
  notes: NoteRow[];
  commHistory: Array<Record<string, unknown>>;
  intelligence: {
    docChunks: DocChunk[];
    memories: MemoryRow[];
    files: StorageFile[];
  };
};

// ── Editable field helper ──────────────────────────────────────────
function Field({
  label,
  value,
  editing,
  onChange,
  type = "text",
  mono,
  readOnly,
  capitalize: cap,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (v: string) => void;
  type?: string;
  mono?: boolean;
  readOnly?: boolean;
  capitalize?: boolean;
}) {
  if (editing && !readOnly) {
    return (
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">{label}</Label>
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={`h-9 ${mono ? "font-mono" : ""}`}
        />
      </div>
    );
  }
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={`text-sm ${mono ? "font-mono" : ""} ${cap ? "capitalize" : ""}`}>
        {value || "\u2014"}
      </dd>
    </div>
  );
}

// ── Source type labels ──────────────────────────────────────────────
const sourceTypeLabels: Record<string, string> = {
  handbook_chapter: "Handbook",
  policy: "Policy",
  protocol: "Protocol",
  procedure: "Procedure",
  routine: "Routine",
  runbook: "Runbook",
  other: "Other",
};

function formatBytes(bytes: number | undefined) {
  if (!bytes) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ════════════════════════════════════════════════════════════════════
export function WorkspaceDetailClient({
  workspace,
  company,
  stats,
  profiles,
  notes: initialNotes,
  commHistory,
  intelligence,
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

  // ── Edit state ─────────────────────────────────────────────────
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState(workspace);
  const [currentCompany, setCurrentCompany] = useState(company);

  const [editWs, setEditWs] = useState({
    name: workspace.name,
    description: workspace.description,
    city: workspace.city,
    addressLine1: workspace.addressLine1,
    addressLine2: workspace.addressLine2,
    postalCode: workspace.postalCode,
    phone: workspace.phone,
    email: workspace.email,
    slogan: workspace.slogan,
    shortDescription: workspace.shortDescription,
    brandColor: workspace.brandColor,
    communicationTone: workspace.communicationTone,
    timezone: workspace.timezone,
  });

  const [editCo, setEditCo] = useState({
    name: company?.name ?? "",
    legalName: company?.legalName ?? "",
    orgNumber: company?.orgNumber ?? "",
    city: company?.city ?? "",
    industry: company?.industry ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    website: company?.website ?? "",
    billingEmail: company?.billingEmail ?? "",
    addressLine1: company?.addressLine1 ?? "",
    postalCode: company?.postalCode ?? "",
    dagligLeder: company?.dagligLeder ?? "",
  });

  function startEditInfo() {
    setEditWs({
      name: currentWorkspace.name,
      description: currentWorkspace.description,
      city: currentWorkspace.city,
      addressLine1: currentWorkspace.addressLine1,
      addressLine2: currentWorkspace.addressLine2,
      postalCode: currentWorkspace.postalCode,
      phone: currentWorkspace.phone,
      email: currentWorkspace.email,
      slogan: currentWorkspace.slogan,
      shortDescription: currentWorkspace.shortDescription,
      brandColor: currentWorkspace.brandColor,
      communicationTone: currentWorkspace.communicationTone,
      timezone: currentWorkspace.timezone,
    });
    setEditCo({
      name: currentCompany?.name ?? "",
      legalName: currentCompany?.legalName ?? "",
      orgNumber: currentCompany?.orgNumber ?? "",
      city: currentCompany?.city ?? "",
      industry: currentCompany?.industry ?? "",
      email: currentCompany?.email ?? "",
      phone: currentCompany?.phone ?? "",
      website: currentCompany?.website ?? "",
      billingEmail: currentCompany?.billingEmail ?? "",
      addressLine1: currentCompany?.addressLine1 ?? "",
      postalCode: currentCompany?.postalCode ?? "",
      dagligLeder: currentCompany?.dagligLeder ?? "",
    });
    setIsEditingInfo(true);
  }

  async function saveInfo() {
    setIsSavingInfo(true);
    try {
      const res = await fetch("/api/platform-admin/workspaces/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: currentWorkspace.workspaceId,
          companyId: currentCompany?.companyId,
          workspace: {
            name: editWs.name.trim(),
            description: editWs.description.trim(),
            city: editWs.city.trim(),
            address_line_1: editWs.addressLine1.trim(),
            address_line_2: editWs.addressLine2.trim(),
            postal_code: editWs.postalCode.trim(),
            phone: editWs.phone.trim(),
            email: editWs.email.trim(),
            slogan: editWs.slogan.trim(),
            short_description: editWs.shortDescription.trim(),
            brand_color: editWs.brandColor.trim(),
            communication_tone: editWs.communicationTone.trim(),
            timezone: editWs.timezone.trim(),
          },
          company: {
            name: editCo.name.trim(),
            legal_name: editCo.legalName.trim(),
            org_number: editCo.orgNumber.trim(),
            city: editCo.city.trim(),
            industry: editCo.industry.trim(),
            email: editCo.email.trim(),
            phone: editCo.phone.trim(),
            website: editCo.website.trim(),
            billing_email: editCo.billingEmail.trim(),
            address_line_1: editCo.addressLine1.trim(),
            postal_code: editCo.postalCode.trim(),
            daglig_leder: editCo.dagligLeder.trim(),
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setCurrentWorkspace({
        ...currentWorkspace,
        name: editWs.name.trim(),
        description: editWs.description.trim(),
        city: editWs.city.trim(),
        addressLine1: editWs.addressLine1.trim(),
        addressLine2: editWs.addressLine2.trim(),
        postalCode: editWs.postalCode.trim(),
        phone: editWs.phone.trim(),
        email: editWs.email.trim(),
        slogan: editWs.slogan.trim(),
        shortDescription: editWs.shortDescription.trim(),
        brandColor: editWs.brandColor.trim(),
        communicationTone: editWs.communicationTone.trim(),
        timezone: editWs.timezone.trim(),
      });
      if (currentCompany) {
        setCurrentCompany({
          ...currentCompany,
          name: editCo.name.trim(),
          legalName: editCo.legalName.trim(),
          orgNumber: editCo.orgNumber.trim(),
          city: editCo.city.trim(),
          industry: editCo.industry.trim(),
          email: editCo.email.trim(),
          phone: editCo.phone.trim(),
          website: editCo.website.trim(),
          billingEmail: editCo.billingEmail.trim(),
          addressLine1: editCo.addressLine1.trim(),
          postalCode: editCo.postalCode.trim(),
          dagligLeder: editCo.dagligLeder.trim(),
        });
      }
      setIsEditingInfo(false);
      toast.success("Workspace updated");
    } catch {
      toast.error("Failed to update workspace");
    } finally {
      setIsSavingInfo(false);
    }
  }

  // ── Champions (profiles) ───────────────────────────────────────
  const filteredProfiles = profiles.filter((p) => {
    if (roleFilter !== "all" && p.role !== roleFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  function openCompose(audience?: AudienceFilter) {
    setComposeAudience(audience);
    setComposeOpen(true);
  }

  // ── Notes CRUD ─────────────────────────────────────────────────
  async function saveNote() {
    if (!noteText.trim()) return;
    setIsSavingNote(true);
    try {
      const res = await fetch("/api/platform-admin/workspace-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: currentWorkspace.workspaceId,
          content: noteText.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      const { note } = await res.json();
      const now = new Date().toISOString();
      setNotes([
        {
          id: note.note_id,
          text: note.content,
          createdAt: note.created_at ?? now,
          updatedAt: now,
        },
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

  const trialDaysLeft = currentCompany?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil((new Date(currentCompany.trialEndsAt).getTime() - Date.now()) / 86400000),
      )
    : null;

  // ── Intelligence stats ─────────────────────────────────────────
  const chunksByType = intelligence.docChunks.reduce(
    (acc, c) => {
      acc[c.sourceType] = (acc[c.sourceType] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const memsByType = intelligence.memories.reduce(
    (acc, m) => {
      acc[m.memoryType] = (acc[m.memoryType] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // ══════════════════════════════════════════════════════════════
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{currentWorkspace.name}</h1>
        {currentCompany && <StatusBadge status={currentCompany.subscriptionStatus} />}
        {!currentWorkspace.isActive && (
          <Badge variant="destructive" className="text-xs">
            Inactive
          </Badge>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="champions">Champions</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Stats row */}
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
                  {currentCompany?.subscriptionPlan ?? "\u2014"}
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
                  {new Date(currentWorkspace.createdAt).toLocaleDateString("no-NO")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Edit controls */}
          <div className="flex justify-end">
            {!isEditingInfo ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditInfo}>
                <Pencil className="h-3.5 w-3.5" /> Edit All
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5" onClick={saveInfo} disabled={isSavingInfo}>
                  <Check className="h-3.5 w-3.5" /> Save Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setIsEditingInfo(false)}
                  disabled={isSavingInfo}
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Workspace Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-x-8 gap-y-4">
                <Field
                  label="Name"
                  value={isEditingInfo ? editWs.name : currentWorkspace.name}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, name: v })}
                />
                <Field
                  label="Slug"
                  value={currentWorkspace.slug}
                  editing={isEditingInfo}
                  readOnly
                  mono
                />
                <Field
                  label="Description"
                  value={isEditingInfo ? editWs.description : currentWorkspace.description}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, description: v })}
                />
                <Field
                  label="Slogan"
                  value={isEditingInfo ? editWs.slogan : currentWorkspace.slogan}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, slogan: v })}
                />
                <Field
                  label="Short Description"
                  value={
                    isEditingInfo ? editWs.shortDescription : currentWorkspace.shortDescription
                  }
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, shortDescription: v })}
                />
                <Field
                  label="Brand Color"
                  value={isEditingInfo ? editWs.brandColor : currentWorkspace.brandColor}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, brandColor: v })}
                  mono
                />
                <Field
                  label="Communication Tone"
                  value={
                    isEditingInfo ? editWs.communicationTone : currentWorkspace.communicationTone
                  }
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, communicationTone: v })}
                />
                <Field
                  label="Timezone"
                  value={isEditingInfo ? editWs.timezone : currentWorkspace.timezone}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, timezone: v })}
                />
                <Field
                  label="Email"
                  value={isEditingInfo ? editWs.email : currentWorkspace.email}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, email: v })}
                  type="email"
                />
                <Field
                  label="Phone"
                  value={isEditingInfo ? editWs.phone : currentWorkspace.phone}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, phone: v })}
                />
                <Field
                  label="Address"
                  value={isEditingInfo ? editWs.addressLine1 : currentWorkspace.addressLine1}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, addressLine1: v })}
                />
                <Field
                  label="Address Line 2"
                  value={isEditingInfo ? editWs.addressLine2 : currentWorkspace.addressLine2}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, addressLine2: v })}
                />
                <Field
                  label="Postal Code"
                  value={isEditingInfo ? editWs.postalCode : currentWorkspace.postalCode}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, postalCode: v })}
                  mono
                />
                <Field
                  label="City"
                  value={isEditingInfo ? editWs.city : currentWorkspace.city}
                  editing={isEditingInfo}
                  onChange={(v) => setEditWs({ ...editWs, city: v })}
                />
                <Field
                  label="Country"
                  value={currentWorkspace.country}
                  editing={isEditingInfo}
                  readOnly
                />
                <Field
                  label="Language"
                  value={currentWorkspace.language}
                  editing={isEditingInfo}
                  readOnly
                />
                <Field
                  label="Currency"
                  value={currentWorkspace.currency}
                  editing={isEditingInfo}
                  readOnly
                />
              </dl>
            </CardContent>
          </Card>

          {/* Google / Location Info (read-only) */}
          {(currentWorkspace.googleRating || currentWorkspace.latitude) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" /> Location &amp; Google
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
                  {currentWorkspace.googleRating && (
                    <div>
                      <dt className="text-muted-foreground text-xs">Google Rating</dt>
                      <dd className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        {currentWorkspace.googleRating} ({currentWorkspace.googleRatingCount})
                      </dd>
                    </div>
                  )}
                  {currentWorkspace.googlePriceLevel && (
                    <div>
                      <dt className="text-muted-foreground text-xs">Price Level</dt>
                      <dd>{currentWorkspace.googlePriceLevel}</dd>
                    </div>
                  )}
                  {currentWorkspace.googleMapsUrl && (
                    <div>
                      <dt className="text-muted-foreground text-xs">Google Maps</dt>
                      <dd>
                        <a
                          href={currentWorkspace.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-xs underline"
                        >
                          Open in Maps
                        </a>
                      </dd>
                    </div>
                  )}
                  {currentWorkspace.latitude && currentWorkspace.longitude && (
                    <div>
                      <dt className="text-muted-foreground text-xs">Coordinates</dt>
                      <dd className="font-mono text-xs">
                        {currentWorkspace.latitude.toFixed(5)},{" "}
                        {currentWorkspace.longitude.toFixed(5)}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Company Info */}
          {currentCompany && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-x-8 gap-y-4">
                  <Field
                    label="Company Name"
                    value={isEditingInfo ? editCo.name : currentCompany.name}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, name: v })}
                  />
                  <Field
                    label="Legal Name"
                    value={isEditingInfo ? editCo.legalName : currentCompany.legalName}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, legalName: v })}
                  />
                  <Field
                    label="Org Number"
                    value={isEditingInfo ? editCo.orgNumber : currentCompany.orgNumber}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, orgNumber: v })}
                    mono
                  />
                  <Field
                    label="Industry"
                    value={isEditingInfo ? editCo.industry : currentCompany.industry}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, industry: v })}
                    capitalize
                  />
                  <Field
                    label="Daglig Leder"
                    value={isEditingInfo ? editCo.dagligLeder : currentCompany.dagligLeder}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, dagligLeder: v })}
                  />
                  <Field
                    label="NACE Code"
                    value={currentCompany.naceCode}
                    editing={isEditingInfo}
                    readOnly
                    mono
                  />
                  <Field
                    label="NACE Description"
                    value={currentCompany.naceDescription}
                    editing={isEditingInfo}
                    readOnly
                  />
                  <Field
                    label="Email"
                    value={isEditingInfo ? editCo.email : currentCompany.email}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, email: v })}
                    type="email"
                  />
                  <Field
                    label="Phone"
                    value={isEditingInfo ? editCo.phone : currentCompany.phone}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, phone: v })}
                  />
                  <Field
                    label="Website"
                    value={isEditingInfo ? editCo.website : currentCompany.website}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, website: v })}
                  />
                  <Field
                    label="Billing Email"
                    value={isEditingInfo ? editCo.billingEmail : currentCompany.billingEmail}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, billingEmail: v })}
                    type="email"
                  />
                  <Field
                    label="Address"
                    value={isEditingInfo ? editCo.addressLine1 : currentCompany.addressLine1}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, addressLine1: v })}
                  />
                  <Field
                    label="Postal Code"
                    value={isEditingInfo ? editCo.postalCode : currentCompany.postalCode}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, postalCode: v })}
                    mono
                  />
                  <Field
                    label="City"
                    value={isEditingInfo ? editCo.city : currentCompany.city}
                    editing={isEditingInfo}
                    onChange={(v) => setEditCo({ ...editCo, city: v })}
                  />
                </dl>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── CHAMPIONS TAB ───────────────────────────────────── */}
        <TabsContent value="champions" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Trophy className="text-muted-foreground h-4 w-4" />
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
              {filteredProfiles.length} champions
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
                          } as unknown as AudienceFilter) // SAFETY: Supabase join returns union type; runtime shape matches the cast
                        }
                      >
                        <Send className="mr-1 h-3 w-3" /> Email
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredProfiles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-4 py-8 text-center">
                      No champions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── INTELLIGENCE TAB ────────────────────────────────── */}
        <TabsContent value="intelligence" className="mt-4 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileText className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-xs uppercase">Knowledge Bank</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">{intelligence.docChunks.length}</p>
                <p className="text-muted-foreground text-xs">document chunks indexed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Brain className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-xs uppercase">Agent Memories</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">{intelligence.memories.length}</p>
                <p className="text-muted-foreground text-xs">stored memories</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Database className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground text-xs uppercase">Files</span>
                </div>
                <p className="mt-2 text-2xl font-semibold">{intelligence.files.length}</p>
                <p className="text-muted-foreground text-xs">uploaded documents</p>
              </CardContent>
            </Card>
          </div>

          {/* Intelligence Data (from pipeline) */}
          {Object.keys(currentWorkspace.intelligenceData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4" /> Gathered Intelligence
                </CardTitle>
                <CardDescription>
                  Data collected from Brreg, web scraping, and Google Places
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
                  {JSON.stringify(currentWorkspace.intelligenceData, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Knowledge Bank chunks by type */}
          {intelligence.docChunks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" /> Knowledge Bank
                </CardTitle>
                <CardDescription>Indexed document chunks by source type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(chunksByType).map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {sourceTypeLabels[type] ?? type}: {count}
                    </Badge>
                  ))}
                </div>
                <div className="border-border rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
                        <th className="px-4 py-2">Title</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Tokens</th>
                        <th className="px-4 py-2">Indexed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intelligence.docChunks.slice(0, 25).map((d) => (
                        <tr key={d.id} className="border-border border-b last:border-0">
                          <td className="px-4 py-2 font-medium">{d.title || d.sourcePath}</td>
                          <td className="px-4 py-2">
                            <Badge variant="outline" className="text-xs">
                              {sourceTypeLabels[d.sourceType] ?? d.sourceType}
                            </Badge>
                          </td>
                          <td className="text-muted-foreground px-4 py-2 font-mono">
                            {d.tokenCount}
                          </td>
                          <td className="text-muted-foreground px-4 py-2">
                            {new Date(d.createdAt).toLocaleDateString("no-NO")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {intelligence.docChunks.length > 25 && (
                    <p className="text-muted-foreground border-border border-t p-2 text-center text-xs">
                      Showing 25 of {intelligence.docChunks.length} chunks
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Agent Memories */}
          {intelligence.memories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-4 w-4" /> Agent Memories
                </CardTitle>
                <CardDescription>Stored by Mr. Botsson during conversations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(memsByType).map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="text-xs capitalize">
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  {intelligence.memories.slice(0, 20).map((m) => (
                    <div key={m.id} className="border-border rounded border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs capitalize">
                          {m.memoryType}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {new Date(m.createdAt).toLocaleDateString("no-NO")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{m.content}</p>
                    </div>
                  ))}
                  {intelligence.memories.length > 20 && (
                    <p className="text-muted-foreground text-center text-xs">
                      Showing 20 of {intelligence.memories.length} memories
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" /> Documents
              </CardTitle>
              <CardDescription>
                Upload workspace documents (PDF, DOCX, XLSX, images). Files are stored in the
                workspace-documents bucket.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentDrop
                bucket="workspace-documents"
                pathPrefix={currentWorkspace.workspaceId}
                workspaceId={currentWorkspace.workspaceId}
                existingFiles={intelligence.files}
                enableAnalysis
              />
            </CardContent>
          </Card>

          {/* Empty state */}
          {intelligence.docChunks.length === 0 &&
            intelligence.memories.length === 0 &&
            intelligence.files.length === 0 &&
            Object.keys(currentWorkspace.intelligenceData).length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="text-muted-foreground mx-auto h-8 w-8" />
                  <p className="text-muted-foreground mt-2 text-sm">
                    No intelligence data yet. Data will appear here after onboarding and agent
                    conversations.
                  </p>
                </CardContent>
              </Card>
            )}
        </TabsContent>

        {/* ── COMMUNICATION TAB ───────────────────────────────── */}
        <TabsContent value="communication" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                openCompose({
                  type: "workspace",
                  workspaceId: currentWorkspace.workspaceId,
                })
              }
            >
              <MessageSquare className="mr-1 h-3 w-3" /> All Users
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                openCompose({
                  type: "workspace",
                  workspaceId: currentWorkspace.workspaceId,
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
                  workspaceId: currentWorkspace.workspaceId,
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
                  workspaceId: currentWorkspace.workspaceId,
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

        {/* ── SUBSCRIPTION TAB ────────────────────────────────── */}
        <TabsContent value="subscription" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs uppercase">Current Plan</p>
                <p className="mt-2 text-2xl font-semibold capitalize">
                  {currentCompany?.subscriptionPlan ?? "\u2014"}
                </p>
                <div className="mt-2">
                  {currentCompany && <StatusBadge status={currentCompany.subscriptionStatus} />}
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
                    Expires {new Date(currentCompany!.trialEndsAt!).toLocaleDateString("no-NO")}
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

        {/* ── NOTES TAB ───────────────────────────────────────── */}
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
        workspaceId={currentWorkspace.workspaceId}
        workspaceName={currentWorkspace.name}
      />
    </div>
  );
}
