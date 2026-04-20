"use client";

// ============================================
// use-cockpit-date-anchor.ts
// URL-synced date anchor for the cockpit. The
// anchor drives which day Drift and Forberedelse
// show. Defaults to today in workspace timezone.
// ============================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { getWorkspaceToday, shiftIsoDate } from "@/app/dashboard/_lib/cockpit/date-anchor";

const DATE_PARAM = "date";
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type UseCockpitDateAnchorReturn = {
  anchorDate: string;
  workspaceToday: string;
  timezone: string;
  isToday: boolean;
  setAnchorDate: (date: string) => void;
  goPrev: () => void;
  goNext: () => void;
  goToday: () => void;
};

/**
 * Returns the cockpit date anchor, URL-synced via ?date=YYYY-MM-DD.
 *
 * Why: Cockpit panels (Drift, Forberedelse) all read from one anchor.
 * URL sync lets iPad/mobile bookmark a specific day and lets users share
 * "here is what I saw" via deep link. Anchor is pinned in workspace
 * timezone so 23:55 → 00:05 doesn't silently shift under the user.
 *
 * @returns Anchor state + navigation helpers.
 */
export function useCockpitDateAnchor(): UseCockpitDateAnchorReturn {
  const ctx = useWorkspaceOptional();
  const timezone = ctx?.workspace.timezone ?? "Europe/Oslo";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const workspaceToday = useMemo(() => getWorkspaceToday(timezone), [timezone]);
  const rawParam = searchParams.get(DATE_PARAM);
  const isValidParam = rawParam !== null && ISO_DATE_RE.test(rawParam);

  const [anchorDate, setAnchorDateState] = useState<string>(
    isValidParam ? rawParam! : workspaceToday,
  );

  // Reconcile local state with URL changes (e.g. browser back).
  useEffect(() => {
    if (isValidParam && rawParam !== anchorDate) {
      setAnchorDateState(rawParam!);
    } else if (!isValidParam && anchorDate !== workspaceToday) {
      setAnchorDateState(workspaceToday);
    }
  }, [isValidParam, rawParam, anchorDate, workspaceToday]);

  const writeToUrl = useCallback(
    (date: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (date === workspaceToday) {
        params.delete(DATE_PARAM);
      } else {
        params.set(DATE_PARAM, date);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, workspaceToday],
  );

  const setAnchorDate = useCallback(
    (date: string) => {
      if (!ISO_DATE_RE.test(date)) return;
      setAnchorDateState(date);
      writeToUrl(date);
    },
    [writeToUrl],
  );

  const goPrev = useCallback(
    () => setAnchorDate(shiftIsoDate(anchorDate, -1)),
    [anchorDate, setAnchorDate],
  );
  const goNext = useCallback(
    () => setAnchorDate(shiftIsoDate(anchorDate, 1)),
    [anchorDate, setAnchorDate],
  );
  const goToday = useCallback(() => setAnchorDate(workspaceToday), [setAnchorDate, workspaceToday]);

  return {
    anchorDate,
    workspaceToday,
    timezone,
    isToday: anchorDate === workspaceToday,
    setAnchorDate,
    goPrev,
    goNext,
    goToday,
  };
}
