"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * PageHeaderContext — pages publish title + subtitle to the dashboard top
 * header. DashboardShell consumes via <PageTitleSlot /> rendered inside the
 * top context bar (middle).
 *
 * Pattern: page calls `usePageTitle({ title, subtitle })` once at mount;
 * effect sets the value; cleanup clears it on unmount. SSR-safe — null
 * default state renders nothing in the slot.
 *
 * Started 2026-05-19 per Pontus annotation "A: move page title to top
 * header". Phase 1: title only. Phase 2 (planned): sub-tabs slot.
 */

type PageHeader = {
  title: string;
  subtitle?: string;
};

type Ctx = {
  header: PageHeader | null;
  setHeader: (h: PageHeader | null) => void;
};

const PageHeaderContext = createContext<Ctx | null>(null);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeader] = useState<PageHeader | null>(null);
  const value = useMemo<Ctx>(() => ({ header, setHeader }), [header]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

/** Read-only consumer for the shell to render the slot. */
export function usePageHeader(): PageHeader | null {
  const ctx = useContext(PageHeaderContext);
  return ctx?.header ?? null;
}

/**
 * Publish a page title (+ optional subtitle) to the dashboard top header.
 * Pass `null` or omit the call to leave the slot empty.
 *
 * Usage:
 *   usePageTitle({ title: "Kalender", subtitle: "Datoer, sesonger, eventer" });
 */
export function usePageTitle(header: PageHeader | null): void {
  const ctx = useContext(PageHeaderContext);
  // Stringify the dependency to avoid object-identity re-renders when the
  // page passes a fresh literal every render.
  const key = header ? `${header.title}|${header.subtitle ?? ""}` : null;
  useEffect(() => {
    if (!ctx) return;
    ctx.setHeader(header);
    return () => {
      ctx.setHeader(null);
    };
    // eslint-disable-next-line -- exhaustive-deps: header object skipped; we depend on `key` (stringified content) to avoid identity churn
  }, [key, ctx?.setHeader]);
}
