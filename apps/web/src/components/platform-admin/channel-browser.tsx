"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Megaphone, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

type ChannelRow = {
  channel_id: string;
  name: string | null;
  channel_type: string;
  workspace_id: string;
  workspace_name: string;
  department_id: string | null;
  member_count: number;
  is_archived: boolean;
};

type ChannelBrowserProps = {
  selectedChannelIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

const TYPE_FILTERS = ["all", "news", "department", "team", "custom"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const TYPE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  news: "default",
  department: "secondary",
  team: "outline",
  custom: "outline",
};

/**
 * Channel browser for platform admin — browse, filter, and select
 * channels across workspaces for message broadcasting.
 */
export function ChannelBrowser({ selectedChannelIds, onSelectionChange }: ChannelBrowserProps) {
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("");

  // Fetch channels from the API
  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("limit", "200");
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());

    try {
      const res = await fetch(`/api/platform-admin/communications/channels?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: ChannelRow[] };
      setChannels(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(fetchChannels, 300);
    return () => clearTimeout(timer);
  }, [fetchChannels]);

  // Derive unique workspace names for filtering
  const workspaceNames = useMemo(() => {
    const names = new Set(channels.map((c) => c.workspace_name));
    return [...names].sort();
  }, [channels]);

  // Apply client-side workspace filter
  const filteredChannels = useMemo(() => {
    if (!workspaceFilter) return channels;
    return channels.filter((c) =>
      c.workspace_name.toLowerCase().includes(workspaceFilter.toLowerCase()),
    );
  }, [channels, workspaceFilter]);

  // Selection helpers
  const selectedSet = useMemo(() => new Set(selectedChannelIds), [selectedChannelIds]);

  function toggleChannel(id: string) {
    if (selectedSet.has(id)) {
      onSelectionChange(selectedChannelIds.filter((cid) => cid !== id));
    } else {
      onSelectionChange([...selectedChannelIds, id]);
    }
  }

  function selectAllVisible() {
    const visibleIds = filteredChannels.map((c) => c.channel_id);
    const merged = new Set([...selectedChannelIds, ...visibleIds]);
    onSelectionChange([...merged]);
  }

  function deselectAllVisible() {
    const visibleIds = new Set(filteredChannels.map((c) => c.channel_id));
    onSelectionChange(selectedChannelIds.filter((id) => !visibleIds.has(id)));
  }

  function selectAllNewsChannels() {
    const newsIds = channels.filter((c) => c.channel_type === "news").map((c) => c.channel_id);
    const merged = new Set([...selectedChannelIds, ...newsIds]);
    onSelectionChange([...merged]);
  }

  const allVisibleSelected =
    filteredChannels.length > 0 && filteredChannels.every((c) => selectedSet.has(c.channel_id));

  return (
    <div className="space-y-4">
      {/* Search and workspace filter */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="channel-search" className="sr-only">
            Search channels
          </Label>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              id="channel-search"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workspace-filter" className="sr-only">
            Filter by workspace
          </Label>
          <Input
            id="workspace-filter"
            placeholder="Filter by workspace..."
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            list="workspace-names"
          />
          <datalist id="workspace-names">
            {workspaceNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            variant={typeFilter === t ? "default" : "outline"}
            onClick={() => setTypeFilter(t)}
            className="h-7 text-xs capitalize"
          >
            {t === "all" ? "All Types" : t}
          </Button>
        ))}
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
          className="h-7 text-xs"
        >
          {allVisibleSelected ? "Deselect all" : "Select all visible"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={selectAllNewsChannels}
          className="h-7 text-xs"
        >
          <Megaphone className="mr-1 size-3" />
          Select all news channels
        </Button>
        <span className="text-muted-foreground ml-auto text-xs">
          {selectedChannelIds.length} selected
        </span>
      </div>

      {/* Channel list */}
      <div className="max-h-80 overflow-y-auto rounded-lg border">
        {loading && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 text-center">
            <p className="text-destructive text-sm">{error}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={fetchChannels}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && filteredChannels.length === 0 && (
          <p className="text-muted-foreground p-4 text-center text-sm">No channels found.</p>
        )}

        {!loading &&
          !error &&
          filteredChannels.map((channel) => {
            const isSelected = selectedSet.has(channel.channel_id);
            return (
              <label
                key={channel.channel_id}
                className={`hover:bg-muted/50 flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0 ${
                  isSelected ? "bg-muted/30" : ""
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleChannel(channel.channel_id)}
                />
                <Hash className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {channel.name ?? "Unnamed"}
                    </span>
                    <Badge
                      variant={TYPE_BADGE_VARIANT[channel.channel_type] ?? "outline"}
                      className="shrink-0 px-1.5 py-0 text-[10px]"
                    >
                      {channel.channel_type}
                    </Badge>
                    {channel.is_archived && (
                      <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                        Archived
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">{channel.workspace_name}</p>
                </div>
                <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                  <Users className="size-3" />
                  {channel.member_count}
                </div>
              </label>
            );
          })}
      </div>
    </div>
  );
}
