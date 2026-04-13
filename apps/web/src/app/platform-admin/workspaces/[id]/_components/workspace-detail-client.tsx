"use client";

// Shell for the workspace detail page.
// Owns: shared compose state, trialDaysLeft, workspace/company header, Tabs structure.
// Each tab is a self-contained component in the tabs/ directory.

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

import { ContractTab } from "./tabs/ContractTab";
import type { PricingTermsData } from "./tabs/ContractTab";

// ── Re-export types consumed upstream (e.g. the server page component) ───────
export type { WorkspaceData, CompanyData, ProfileRow, DocChunk, MemoryRow, StorageFile, NoteRow };
export type { PricingTermsData };

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
  contracts,
  pricingTerms,
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

        <ContractTab
          workspaceId={currentWorkspace.workspaceId}
          companyId={currentCompany?.companyId ?? null}
          subscriptionPlan={currentCompany?.subscriptionPlan ?? "\u2014"}
          subscriptionStatus={currentCompany?.subscriptionStatus ?? "unknown"}
          contractStatus={currentWorkspace.contractStatus}
          activeContractId={currentWorkspace.activeContractId}
          trialEndsAt={currentCompany?.trialEndsAt ?? null}
          trialDaysLeft={trialDaysLeft}
          contracts={contracts}
          pricingTerms={pricingTerms}
        />

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
