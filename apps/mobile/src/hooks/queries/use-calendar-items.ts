/**
 * useCalendarItems — Unified calendar data hook.
 *
 * Wraps useOperationsFeed (shifts + tasks + bookings + deviations + notes) and
 * maps FeedItem → CalendarItem for calendar screen consumption. Applies
 * date-range + filter + scope logic. Returns { data, isLoading, error }.
 *
 * All times use workspace.timezone from profile (ADR-0134 / Lovsen F-09/F-11).
 * Timezone is read from the profile row; device tz is NOT used.
 *
 * Scope filtering is enforced per-role in Phase 3d. For Phase 3c (read-only
 * calendar views), only scope='me' is hydrated — 'all' / 'dept' / 'person'
 * are gated by ADR-0133 RBAC (deferred to Phase 3d lovsen-check).
 */

import { useMemo } from "react";
import { toZonedTime } from "date-fns-tz";
import { useOperationsFeed } from "./use-operations-feed";
import { useMyProfile } from "./use-my-profile";
import type { CalendarItem, Department } from "@/components/calendar/types";
import type { FilterValue } from "@/components/calendar/FilterChips";

/** Fallback per Lovsen rapport — workspace table DEFAULT 'Europe/Oslo'. */
const FALLBACK_TZ = "Europe/Oslo";

export type CalendarScope =
  | { kind: "me" }
  | { kind: "all" }
  | { kind: "dept"; value: Department }
  | { kind: "person"; value: string };

type UseCalendarItemsParams = {
  /** Selected date to load items for. */
  date: Date;
  /** Active filter chip selection. */
  filter?: FilterValue;
  /** Scope: who's data to show. Defaults to 'me'. */
  scope?: CalendarScope;
};

type UseCalendarItemsResult = {
  data: CalendarItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  /** Pre-computed counts per FilterValue key for chip badges. */
  counts: Record<FilterValue, number>;
};

/** Dept constant list for mapping from FeedItem subtitle strings. */
const DEPT_LIST: Department[] = ["kjokken", "sal", "bar", "event"];

/**
 * Attempt to extract a dept from FeedItem.subtitle text.
 * FeedItem.subtitle for shifts contains strings like "Kjøkkenskift · Sone B"
 * or the role substring. We default to "kjokken" when no match is found.
 */
function extractDept(subtitle: string | undefined): Department {
  if (!subtitle) return "kjokken";
  const lower = subtitle.toLowerCase();
  if (lower.includes("sal") || lower.includes("floor")) return "sal";
  if (lower.includes("bar")) return "bar";
  if (lower.includes("event")) return "event";
  if (lower.includes("kjøkken") || lower.includes("kjokken") || lower.includes("kitchen"))
    return "kjokken";
  return "kjokken";
}

/**
 * Map a FeedItemType → CalendarItem type.
 * "overdue" and "team" FeedItem types don't map 1:1; overdue → deviation,
 * team → shift (colleague summary row).
 */
function mapType(
  feedType: string,
): "shift" | "task" | "booking" | "deviation" | "note" {
  switch (feedType) {
    case "shift":
    case "team":
      return "shift";
    case "task":
      return "task";
    case "overdue":
      return "deviation";
    case "booking":
      return "booking";
    case "note":
      return "note";
    default:
      return "note";
  }
}

/**
 * Map FeedItem status-like fields to CalendarItem status.
 */
function mapStatus(
  feedType: string,
  done?: boolean,
): CalendarItem["status"] {
  if (feedType === "overdue") return "overdue";
  if (done) return "done";
  if (feedType === "shift") return "upcoming";
  if (feedType === "booking") return "confirmed";
  return "todo";
}

/**
 * Filter CalendarItem[] by active FilterValue chip.
 */
function applyFilter(items: CalendarItem[], filter: FilterValue): CalendarItem[] {
  switch (filter) {
    case "oppgaver":
      return items.filter((i) => i.type === "task" || i.type === "deviation");
    case "vakter":
      return items.filter((i) => i.type === "shift");
    case "bookinger":
      return items.filter((i) => i.type === "booking");
    case "avvik":
      return items.filter((i) => i.type === "deviation" || i.status === "overdue");
    case "alt":
    default:
      return items;
  }
}

/**
 * Build count badges for each filter chip.
 */
function buildCounts(items: CalendarItem[]): Record<FilterValue, number> {
  const deviations = items.filter((i) => i.type === "deviation" || i.status === "overdue");
  return {
    alt: items.length,
    oppgaver: items.filter((i) => i.type === "task" || i.type === "deviation").length,
    vakter: items.filter((i) => i.type === "shift").length,
    bookinger: items.filter((i) => i.type === "booking").length,
    avvik: deviations.length,
  };
}

export function useCalendarItems({
  date,
  filter = "alt",
  scope = { kind: "me" },
}: UseCalendarItemsParams): UseCalendarItemsResult {
  const feed = useOperationsFeed(date);
  // ADR-0267: fetch profile.role to gate booking contact visibility.
  // Employees must not see contact details — only manager | admin | owner can.
  const { data: profile } = useMyProfile();

  const allItems = useMemo<CalendarItem[]>(() => {
    if (!feed.data) return [];

    // ADR-0267: employee role cannot see booking contact PII (GDPR art. 5(1)(f)).
    // manager / admin / owner can see. Default deny when role is unknown.
    const canSeeContact = profile?.role != null && profile.role !== "employee";

    // BLOCKING-3: resolve day boundaries in workspace timezone, not device tz.
    // Uses workspace.timezone from profile join; falls back to Europe/Oslo
    // (workspace table DEFAULT per Lovsen rapport F-09/F-11).
    const tz =
      (profile?.workspace as { timezone?: string } | null)?.timezone ?? FALLBACK_TZ;
    const zonedDate = toZonedTime(date, tz);
    const dayOfMonthInWorkspaceTz = zonedDate.getDate();

    return feed.data.map((fi, idx) => {
      const type = mapType(fi.type);
      const dept = extractDept(fi.subtitle);
      const status = mapStatus(fi.type, fi.done);

      // Day-of-month in workspace timezone (not device tz) per ADR-0134 / F-09.
      const dayOfMonth = dayOfMonthInWorkspaceTz;

      const item: CalendarItem = {
        id: fi.id ?? `feed-${idx}`,
        type,
        date: dayOfMonth,
        title: fi.title,
        sub: fi.subtitle,
        time: fi.time,
        dept,
        status,
      };

      // ADR-0267 PII gate: redact booking contact for employee role.
      if (type === "booking") {
        const rawContact = (fi as Record<string, unknown>).contact as string | undefined;
        item.contact = canSeeContact ? rawContact : undefined;
        item.contactRedacted = !canSeeContact;
      }

      // Mark shift lead when subtitle contains keyword
      if (type === "shift" && fi.subtitle?.toLowerCase().includes("skiftleder")) {
        (item as CalendarItem & { isShiftLead?: boolean }).isShiftLead = true;
      }

      return item;
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, [feed.data, date, profile?.role, (profile?.workspace as any)?.timezone]);

  // Scope filtering: Phase 3c only supports 'me' (self). Other scopes are
  // accepted in the type contract for Phase 3d — they pass through unfiltered
  // here (the BFF / useShiftColleagues will enforce RBAC in Phase 3d).
  const scopedItems = useMemo<CalendarItem[]>(() => {
    if (scope.kind === "dept") {
      return allItems.filter((i) => i.dept === scope.value || i.type !== "shift");
    }
    // 'me', 'all', 'person' — pass through; scope enforcement deferred to 3d
    return allItems;
  }, [allItems, scope]);

  const counts = useMemo(() => buildCounts(scopedItems), [scopedItems]);

  const filteredItems = useMemo(
    () => applyFilter(scopedItems, filter),
    [scopedItems, filter],
  );

  return {
    data: filteredItems,
    isLoading: feed.isLoading,
    error: feed.isError ? (feed.error as Error | null) : null,
    refetch: feed.refetch,
    counts,
  };
}
