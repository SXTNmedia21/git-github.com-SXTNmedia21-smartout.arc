"use client";

// Shell for the workspace detail page.
// Owns: shared compose state, trialDaysLeft, workspace/company header, Tabs structure.
// Each tab is a self-contained component in the tabs/ directory.

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { ComposeEmailSheet } from "@/components/platform-admin/compose-email-sheet";
import type { AudienceFilter } from "@/components/platform-admin/audience-selector";

import { OverviewTab } from "./tabs/OverviewTab";
import type { WorkspaceData, CompanyData } from "./tabs/OverviewTab";

import { ChampionsTab } from "./tabs/ChampionsTab";
import type { ProfileRow } from "./tabs/ChampionsTab";

import { IntelligenceTab } from "./tabs/IntelligenceTab";
import type { DocChunk, MemoryRow, StorageFile } from "./tabs/IntelligenceTab";

import { CommunicationTab } from "./tabs/CommunicationTab";

import { NotesTab } from "./tabs/NotesTab";
import type { NoteRow } from "./tabs/NotesTab";

import type { ContractRow } from "@/components/platform-admin/contract-columns";

// ── Re-export types consumed upstream (e.g. the server page component) ───────
export type { WorkspaceData, CompanyData, ProfileRow, DocChunk, MemoryRow, StorageFile, NoteRow };

// Pricing terms as seen by the workspace detail page — camelCase mirror of the DB row.
export type PricingTermsData = {
  pricingTermsId: string;
  companyId: string;
  workspaceId: string | null;
  monthlyCost: number | null;
  pricePerEmployee: number;
  billingInterval: string;
  currency: string;
  discountPercent: number | null;
  discountLabel: string | null;
  onboardingPackage: string | null;
  onboardingCost: number | null;
  trialDays: number | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  notes: string | null;
  contractId: string | null;
  updatedAt: string;
};

// ── Props ────────────────────────────────────────────────────────────────────

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
  // Fetched at SSR time; passed to ContractTab when it is implemented (Task 10).
  contracts: ContractRow[];
  pricingTerms: PricingTermsData | null;
};

// ════════════════════════════════════════════════════════════════════
export function WorkspaceDetailClient({
  workspace,
  company,
  stats,
  profiles,
  notes,
  commHistory,
  intelligence,
  // contracts and pricingTerms are accepted here but wired up in Task 10 (ContractTab).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  contracts: _contracts,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pricingTerms: _pricingTerms,
}: Props) {
  // Shared compose state — opened by both ChampionsTab (per-user) and CommunicationTab (audience).
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeAudience, setComposeAudience] = useState<AudienceFilter | undefined>();

  // Kept in sync via OverviewTab's onWorkspaceChange/onCompanyChange so the header
  // reflects inline edits without a page reload.
  const [currentWorkspace, setCurrentWorkspace] = useState(workspace);
  const [currentCompany, setCurrentCompany] = useState(company);

  // Trial countdown shown in the Avtaler tab.
  const trialDaysLeft = currentCompany?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil((new Date(currentCompany.trialEndsAt).getTime() - Date.now()) / 86400000),
      )
    : null;

  function openCompose(audience?: AudienceFilter) {
    setComposeAudience(audience);
    setComposeOpen(true);
  }

  return (
    <div>
      {/* Page header — workspace name + status badges */}
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
          <TabsTrigger value="avtaler">Avtaler</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <OverviewTab
          workspace={workspace}
          company={company}
          stats={stats}
          onWorkspaceChange={setCurrentWorkspace}
          onCompanyChange={setCurrentCompany}
        />

        <ChampionsTab profiles={profiles} onOpenCompose={openCompose} />

        <IntelligenceTab
          intelligence={intelligence}
          workspaceId={currentWorkspace.workspaceId}
          intelligenceData={currentWorkspace.intelligenceData}
        />

        <CommunicationTab
          commHistory={commHistory}
          workspaceId={currentWorkspace.workspaceId}
          workspaceName={currentWorkspace.name}
          onOpenCompose={openCompose}
        />

        {/* Avtaler tab — Stripe-managed plan info. Actions are stubs pending Stripe integration. */}
        <TabsContent value="avtaler" className="mt-4 space-y-4">
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

        <NotesTab initialNotes={notes} workspaceId={currentWorkspace.workspaceId} />
      </Tabs>

      {/* Shared compose sheet — opened from ChampionsTab (per-user) and CommunicationTab (audience) */}
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
