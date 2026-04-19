"use client";

/**
 * AdminContext — admin/employee mode + dashboard admin view slice.
 *
 * Why: ADR-0113 isolates the admin-mode toggle and the admin-view
 * switcher from the larger DashboardContext. These fields flip less
 * frequently than theme or schedule state but were triggering
 * full-tree rerenders through the monolithic context.
 *
 * The admin-view enum doubles as the dashboard-variant switcher: the
 * first four values (`oversikt*`) swap the Cockpit experience, the rest
 * map one-to-one to dedicated admin views.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AdminViewType =
  | "oversikt"
  | "oversikt-mockup"
  | "oversikt-interactive"
  | "oversikt-pipeline"
  | "strategic"
  | "reconciliation"
  | "activity"
  | "todo";

export type AdminContextValue = {
  /** True when the viewer is in admin mode, false in employee mode. */
  isAdminMode: boolean;
  setIsAdminMode: (val: boolean) => void;
  /** Active tab on the admin dashboard. */
  adminView: AdminViewType;
  setAdminView: (val: AdminViewType) => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdminMode, setIsAdminMode] = useState(true);
  const [adminView, setAdminView] = useState<AdminViewType>("oversikt");

  const value = useMemo<AdminContextValue>(
    () => ({ isAdminMode, setIsAdminMode, adminView, setAdminView }),
    [isAdminMode, adminView],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminContext must be used within <AdminProvider>");
  }
  return ctx;
}

export function useAdminContextOptional(): AdminContextValue | null {
  return useContext(AdminContext);
}
