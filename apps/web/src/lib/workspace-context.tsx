"use client";

import { createContext, useContext, type ReactNode } from "react";

export type WorkspaceData = {
  workspace_id: string;
  company_id: string | null;
  name: string;
  slug: string;
  logo_url: string | null;
  currency: string;
  language: string;
  country: string;
  timezone: string;
  contract_status: string | null;
  onboarding_completed: boolean;
};

type WorkspaceContextValue = {
  workspace: WorkspaceData;
  slug: string;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: WorkspaceData;
  children: ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={{ workspace, slug: workspace.slug }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/** Throws if used outside WorkspaceProvider */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

/** Returns null if no WorkspaceProvider — safe for shared components */
export function useWorkspaceOptional(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
