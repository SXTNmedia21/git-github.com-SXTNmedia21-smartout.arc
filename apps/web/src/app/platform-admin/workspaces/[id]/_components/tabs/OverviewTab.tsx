"use client";

// Overview tab: workspace info, company info, google/location info, edit-in-place controls.
// Exports WorkspaceData and CompanyData types so other tabs can import them.

import { useState } from "react";
import { Users, Building2, CreditCard, Calendar, MapPin, Star, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// ── Shared type definitions ─────────────────────────────────────────────────
// These are exported so ChampionsTab, CommunicationTab, and the shell can import them.

export type WorkspaceData = {
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

export type CompanyData = {
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

// ── Editable field helper ───────────────────────────────────────────────────
// Renders a read-only label+value or an editable Input depending on the editing flag.
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

// ── Props ───────────────────────────────────────────────────────────────────

type Props = {
  workspace: WorkspaceData;
  company: CompanyData | null;
  stats: {
    totalProfiles: number;
    activeProfiles: number;
    traineeProfiles: number;
    departmentCount: number;
  };
  // Callbacks so the shell can keep currentWorkspace/currentCompany in sync for
  // the header badge and other tabs that display workspace name.
  onWorkspaceChange: (ws: WorkspaceData) => void;
  onCompanyChange: (co: CompanyData) => void;
};

export function OverviewTab({ workspace, company, stats, onWorkspaceChange, onCompanyChange }: Props) {
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // Local copies for display — mutated on successful save and propagated to parent.
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

      const updatedWs: WorkspaceData = {
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
      };
      setCurrentWorkspace(updatedWs);
      onWorkspaceChange(updatedWs);

      if (currentCompany) {
        const updatedCo: CompanyData = {
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
        };
        setCurrentCompany(updatedCo);
        onCompanyChange(updatedCo);
      }

      setIsEditingInfo(false);
      toast.success("Workspace updated");
    } catch {
      toast.error("Failed to update workspace");
    } finally {
      setIsSavingInfo(false);
    }
  }

  return (
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
              value={isEditingInfo ? editWs.shortDescription : currentWorkspace.shortDescription}
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
              value={isEditingInfo ? editWs.communicationTone : currentWorkspace.communicationTone}
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
  );
}
