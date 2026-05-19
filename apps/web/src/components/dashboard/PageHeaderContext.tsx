"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * PageHeaderContext — pages publish title + (optional) sub-view tab strip
 * to the dashboard action-bar breadcrumb slot. DashboardShell consumes via
 * the second breadcrumb element (replacing the URL-derived segment pill).
 *
 * Pontus 2026-05-19 annotations A + B:
 *   A: page title (e.g. "Kalender") lives in the breadcrumb pill, not in
 *      the page body and not in the top header (top header is for search).
 *   B: sub-view tab strip (PageTabNav) lives in the same breadcrumb slot —
 *      pages publish their tab JSX via usePageTabs() and skip rendering it
 *      in the page body.
 */

type PageHeader = {
  title: string;
  subtitle?: string;
};

type Ctx = {
  header: PageHeader | null;
  setHeader: (h: PageHeader | null) => void;
  tabsNode: ReactNode | null;
  setTabsNode: (node: ReactNode | null) => void;
};

const PageHeaderContext = createContext<Ctx | null>(null);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [header, setHeader] = useState<PageHeader | null>(null);
  const [tabsNode, setTabsNode] = useState<ReactNode | null>(null);
  const value = useMemo<Ctx>(
    () => ({ header, setHeader, tabsNode, setTabsNode }),
    [header, tabsNode],
  );
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

/** Read-only consumer for the shell to render the title + tabs slots. */
export function usePageHeader(): { header: PageHeader | null; tabsNode: ReactNode | null } {
  const ctx = useContext(PageHeaderContext);
  return { header: ctx?.header ?? null, tabsNode: ctx?.tabsNode ?? null };
}

/**
 * Publish a page title (+ optional subtitle) to the dashboard breadcrumb.
 * Pass `null` to clear. Used by pages without a sub-view tab strip.
 */
export function usePageTitle(header: PageHeader | null): void {
  const ctx = useContext(PageHeaderContext);
  const key = header ? `${header.title}|${header.subtitle ?? ""}` : null;
  useEffect(() => {
    if (!ctx) return;
    ctx.setHeader(header);
    return () => {
      ctx.setHeader(null);
    };
    // eslint-disable-next-line -- exhaustive-deps: header object skipped; depend on `key` (stringified content)
  }, [key, ctx?.setHeader]);
}

/**
 * Publish a page's sub-view tab strip (PageTabNav JSX) to the breadcrumb
 * slot. The shell renders the node verbatim — pages stay responsible for
 * tab state + variant (pill / route).
 *
 * Usage:
 *   usePageTabs(<PageTabNav tabs={...} variant="route" basePath="..." />);
 *
 * Pass `null` to clear (e.g. on unmount or when a page has no sub-tabs).
 */
export function usePageTabs(node: ReactNode | null): void {
  const ctx = useContext(PageHeaderContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setTabsNode(node);
    return () => {
      ctx.setTabsNode(null);
    };
    // eslint-disable-next-line -- exhaustive-deps: node identity intentionally drives updates
  }, [node, ctx?.setTabsNode]);
}
