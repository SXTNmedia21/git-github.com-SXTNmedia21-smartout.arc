"use client";

/**
 * SelectEmployeeStep — virtualized employee picker for contract composition
 * and bulk-send flows.
 *
 * Fixes the render-stall documented by council 2026-04-22 Q5 (candidate #1):
 * the prior `CompositionWizard.SelectEmployeeStep` rendered every profile row
 * in a plain overflow-y-auto div which stalls noticeably at 500+ profiles.
 *
 * Implementation:
 *  - `@tanstack/react-virtual` (v3.13.x — already in apps/web deps).
 *  - Row height 64px estimated (line 1: heading, line 2: role / department).
 *  - overscan 5.
 *  - Search input is client-side — fine for 500 profiles. A >2000-profile
 *    workspace would need server-side filtering (follow-up PR).
 *
 * Modes:
 *  - `mode="single"`  — onChange(profileId) on click.
 *  - `mode="multi"`   — onChange(profileIdSet) with checkbox; supports
 *                       "Velg alle kvalifiserte" when `onSelectAll` is given.
 *
 * Nordic Split compliance: Instrument Serif for display names, Geist Mono for
 * role · department, warm OKLCH via CSS variables only. No zinc/gray/slate.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "@smartout/i18n";
import { Input } from "@smartout/ui";

export type EmployeeProfile = {
  profile_id: string;
  display_name: string;
  role: string;
  department_name: string | null;
};

export type EmployeeStatusChip = "has_active_contract" | "missing_pii" | "ready" | null;

type BaseProps = {
  workspaceId: string;
  /** Compute optional status chip per row (bulk-send context). */
  getStatusChip?: (profile: EmployeeProfile) => EmployeeStatusChip;
  /** Initial focused profile id (reverse-flow from /people/[id]). */
  initialProfileId?: string;
};

type SingleProps = BaseProps & {
  mode: "single";
  selectedId: string | null;
  onChange: (profile: EmployeeProfile) => void;
};

type MultiProps = BaseProps & {
  mode: "multi";
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
  /** When present, renders a "Velg alle kvalifiserte" button. Receives the
   *  currently-filtered list so callers can scope bulk-select. */
  onSelectAll?: (filtered: EmployeeProfile[]) => void;
};

type Props = SingleProps | MultiProps;

const ROW_HEIGHT = 64;

export function SelectEmployeeStep(props: Props) {
  const { workspaceId, getStatusChip, initialProfileId } = props;
  const { t } = useTranslation("contracts");
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    void (async () => {
      const { createClient } = await import("@smartout/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("profile")
        .select("profile_id, display_name, role, department:department_id(name)")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("display_name");

      if (cancelled) return;
      const rows: EmployeeProfile[] = (
        (data ?? []) as unknown as {
          profile_id: string;
          display_name: string;
          role: string;
          department: { name: string } | null;
        }[]
      ).map((row) => ({
        profile_id: row.profile_id,
        display_name: row.display_name,
        role: row.role,
        department_name: row.department?.name ?? null,
      }));
      setProfiles(rows);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Client-side search — fine for 500 profiles. For larger workspaces this
  // would need server-side search (Supabase rpc with ilike) as a follow-up.
  const filtered = useMemo(() => {
    if (!search) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.display_name.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        (p.department_name?.toLowerCase().includes(q) ?? false),
    );
  }, [profiles, search]);

  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // When `initialProfileId` is provided and the list is loaded, scroll it into
  // view. This supports the /people/[id] → drawer reverse-flow.
  useEffect(() => {
    if (!initialProfileId || filtered.length === 0) return;
    const idx = filtered.findIndex((p) => p.profile_id === initialProfileId);
    if (idx >= 0) {
      rowVirtualizer.scrollToIndex(idx, { align: "center" });
    }
  }, [initialProfileId, filtered, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  function isSelected(profileId: string): boolean {
    if (props.mode === "single") return props.selectedId === profileId;
    return props.selectedIds.has(profileId);
  }

  function handleToggle(profile: EmployeeProfile) {
    if (props.mode === "single") {
      props.onChange(profile);
      return;
    }
    const next = new Set(props.selectedIds);
    if (next.has(profile.profile_id)) next.delete(profile.profile_id);
    else next.add(profile.profile_id);
    props.onChange(next);
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={t("composition.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Multi-select: bulk "Velg alle kvalifiserte" */}
      {props.mode === "multi" && props.onSelectAll && filtered.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-mono">
            {t("bulk_send.filtered_count", {
              count: String(filtered.length),
              total: String(profiles.length),
            })}
          </span>
          <button
            type="button"
            onClick={() => props.onSelectAll?.(filtered)}
            className="text-primary hover:text-primary/80 font-medium"
          >
            {t("bulk_send.select_all_eligible")}
          </button>
        </div>
      )}

      {/* Virtualized list */}
      <div
        ref={parentRef}
        className="border-border bg-muted/20 relative flex-1 overflow-y-auto rounded-xl border"
        style={{ minHeight: 240 }}
      >
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {t("composition.no_employees")}
          </p>
        ) : (
          <div style={{ height: `${totalSize}px`, width: "100%", position: "relative" }}>
            {virtualRows.map((v) => {
              const profile = filtered[v.index];
              if (!profile) return null;
              const selected = isSelected(profile.profile_id);
              const chip = getStatusChip?.(profile) ?? null;
              return (
                <button
                  key={profile.profile_id}
                  type="button"
                  data-testid={`employee-card-${profile.profile_id}`}
                  onClick={() => handleToggle(profile)}
                  className={`border-border/60 absolute top-0 left-0 flex w-full items-center gap-3 border-b px-4 text-left transition-colors duration-200 ease-out ${
                    selected ? "bg-primary/10" : "hover:bg-muted/60"
                  }`}
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    transform: `translateY(${v.start}px)`,
                  }}
                >
                  {props.mode === "multi" && (
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground/60"
                      }`}
                      aria-hidden
                    >
                      {selected && <CheckCircle2 className="text-primary-foreground h-3 w-3" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-foreground truncate text-base leading-tight">
                      {profile.display_name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">
                      {profile.role}
                      {profile.department_name ? ` · ${profile.department_name}` : ""}
                    </p>
                  </div>
                  {chip && <StatusChip kind={chip} t={t} />}
                  {props.mode === "single" && selected && (
                    <CheckCircle2 className="text-primary h-4 w-4 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({
  kind,
  t,
}: {
  kind: NonNullable<EmployeeStatusChip>;
  t: (k: string, vars?: Record<string, string | number>) => string;
}) {
  const style =
    kind === "ready"
      ? "bg-primary/10 text-primary"
      : kind === "missing_pii"
        ? "bg-warning/10 text-warning"
        : "bg-muted text-muted-foreground";
  const label =
    kind === "ready"
      ? t("bulk_send.chip_ready")
      : kind === "missing_pii"
        ? t("bulk_send.chip_missing_pii")
        : t("bulk_send.chip_has_active");
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${style}`}
    >
      {label}
    </span>
  );
}
