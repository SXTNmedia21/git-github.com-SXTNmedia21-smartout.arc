"use client";

/**
 * WorkspaceContext — workspace-scoped slice of the dashboard context.
 *
 * Why: ADR-0113 separates workspace identity + setup state + active
 * department filter from the monolithic DashboardContext so consumers
 * that only care about workspace data don't rerender when theme or
 * schedule state changes.
 *
 * This is not the root `useWorkspaceOptional()` from `@/lib/workspace-context` —
 * that hook is still the source of truth for workspace identity. This
 * provider mirrors the subset of workspace data the dashboard shell
 * previously exposed via DashboardContext (shape preserved for the facade).
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type WorkspaceSlice = {
  workspace_id: string;
  company_id: string | null;
  name: string;
} | null;

export type WorkspaceContextValue = {
  /** Minimal workspace tuple, mirroring the old DashboardContext field. */
  workspaceData: WorkspaceSlice;
  /** Profile id of the viewer, threaded from the server layout. */
  profileId: string | null;
  /** Active department filter (string label, not UUID). */
  activeDepartment: string;
  setActiveDepartment: (val: string) => void;
  /** True when the workspace has not yet completed the setup guide. */
  isSetupMode: boolean;
  /** Reserved for future loading state — always false today. */
  isSetupLoading: boolean;
  /** Dismiss the setup guide for the current session. */
  dismissSetup: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export type WorkspaceProviderProps = {
  children: ReactNode;
  workspaceData: WorkspaceSlice;
  profileId: string | null;
  isSetupMode: boolean;
};

export function WorkspaceProvider({
  children,
  workspaceData,
  profileId,
  isSetupMode,
}: WorkspaceProviderProps) {
  const [activeDepartment, setActiveDepartment] = useState("Alle avdelinger");
  const [setupDismissed, setSetupDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("setup_dismissed") === "1";
  });

  const dismissSetup = useCallback(() => {
    setSetupDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("setup_dismissed", "1");
    }
  }, []);

  const effectiveSetupMode = isSetupMode && !setupDismissed;

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaceData,
      profileId,
      activeDepartment,
      setActiveDepartment,
      isSetupMode: effectiveSetupMode,
      isSetupLoading: false,
      dismissSetup,
    }),
    [workspaceData, profileId, activeDepartment, effectiveSetupMode, dismissSetup],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspaceContext must be used within <WorkspaceProvider>");
  }
  return ctx;
}

export function useWorkspaceContextOptional(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
