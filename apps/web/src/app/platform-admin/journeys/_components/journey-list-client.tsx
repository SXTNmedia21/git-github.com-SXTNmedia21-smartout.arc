// ============================================
// journey-list-client.tsx — Journey List Client Component
// Renders the full journey list with pipeline stats header,
// multi-dimension filter bar, and sortable data table.
// All filtering and sorting runs client-side for instant feedback.
// Connected to: apps/web/src/app/platform-admin/journeys/page.tsx (server data)
// Connected to: apps/web/src/lib/journey/status-transitions.ts (STATUS_META)
// Connected to: apps/web/src/lib/journey/module-meta.ts (MODULE_META, ACTOR_META, etc.)
// ============================================

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { RunnerTab } from "./runner-tab";
import type { Journey, JourneyStatus, JourneyModule } from "@smartout/types";
import type { JourneyActor, JourneyPriority } from "@smartout/types";
import { STATUS_META } from "@/lib/journey/status-transitions";
import { MODULE_META, ACTOR_META, PRIORITY_META, PLATFORM_META } from "@/lib/journey/module-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JourneyStatusChanger } from "./journey-status-changer";
import { Button } from "@/components/ui/button";
import { Search, Smartphone, Monitor, Laptop, ArrowUpDown, Wand2 } from "lucide-react";
import Link from "next/link";

const PLATFORM_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Smartphone,
  Monitor,
  Laptop,
};

type SortField = "code" | "title" | "module" | "priority" | "status";
type SortDirection = "asc" | "desc";

type JourneyListClientProps = {
  initialJourneys: Journey[];
};

/**
 * Full-featured journey list with pipeline header, filter bar, and data table.
 *
 * Why client component: Needs interactive filtering, sorting, and row clicks.
 * The server component fetches data once; this handles all UI state.
 *
 * @param initialJourneys - All journeys from the server, ordered by code
 */
export function JourneyListClient({ initialJourneys }: JourneyListClientProps) {
  const router = useRouter();
  const [journeys, setJourneys] = useState<Journey[]>(initialJourneys);
  const [activeTab, setActiveTab] = useState<"pipeline" | "runner">("pipeline");

  // -- Filter state --
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // -- Sort state --
  const [sortField, setSortField] = useState<SortField>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  /**
   * Compute pipeline stats: count of journeys per status.
   * Re-computes when the journeys array changes (e.g. after status update).
   */
  const pipelineStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const status of Object.keys(STATUS_META)) {
      stats[status] = 0;
    }
    for (const j of journeys) {
      stats[j.status] = (stats[j.status] ?? 0) + 1;
    }
    return stats;
  }, [journeys]);

  /**
   * Filtered and sorted journeys based on current filter/sort state.
   * Runs on every filter or sort change.
   */
  const filteredJourneys = useMemo(() => {
    let result = journeys;

    // Apply module filter
    if (moduleFilter !== "all") {
      result = result.filter((j) => j.module === moduleFilter);
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((j) => j.status === statusFilter);
    }

    // Apply actor filter
    if (actorFilter !== "all") {
      result = result.filter((j) => j.actor === actorFilter);
    }

    // Apply priority filter
    if (priorityFilter !== "all") {
      result = result.filter((j) => j.priority === priorityFilter);
    }

    // Apply text search across code and title
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (j) => j.code.toLowerCase().includes(query) || j.title.toLowerCase().includes(query),
      );
    }

    // Apply sorting
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "code":
          comparison = a.code.localeCompare(b.code);
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "module":
          comparison = a.module.localeCompare(b.module);
          break;
        case "priority":
          comparison = a.priority.localeCompare(b.priority);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [
    journeys,
    moduleFilter,
    statusFilter,
    actorFilter,
    priorityFilter,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  /**
   * Toggle sort direction on a column, or switch to that column ascending.
   */
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  /**
   * Called by JourneyStatusChanger when a status changes.
   * Updates the local state so pipeline and table reflect the change.
   */
  function handleStatusChange(journeyId: string, newStatus: JourneyStatus) {
    setJourneys((prev) =>
      prev.map((j) => (j.journey_id === journeyId ? { ...j, status: newStatus } : j)),
    );
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Journey Portal</h1>
          <p className="text-muted-foreground text-sm">
            {journeys.length} journeys tracked across {Object.keys(MODULE_META).length} modules
          </p>
        </div>
        <Link href="/platform-admin/journeys/wizard">
          <Button>
            <Wand2 className="mr-1.5 h-4 w-4" />
            New Journey (Wizard)
          </Button>
        </Link>
      </div>

      {/* Tab switcher — Pipeline (journey tracking) or Runner (live E2E tests) */}
      <div className="bg-muted inline-flex rounded-lg p-1">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            activeTab === "pipeline"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Pipeline
        </button>
        <button
          onClick={() => setActiveTab("runner")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            activeTab === "runner"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Runner
        </button>
      </div>

      {activeTab === "runner" ? (
        <RunnerTab />
      ) : (
        <>
          {/* Pipeline stats header */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-muted-foreground text-sm font-medium">Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {(Object.keys(STATUS_META) as JourneyStatus[]).map((status) => {
                  const meta = STATUS_META[status];
                  const count = pipelineStats[status] ?? 0;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter((prev) => (prev === status ? "all" : status))}
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        statusFilter === status
                          ? "border-foreground/30 bg-muted"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-muted-foreground">{meta.label}</span>
                      <span className="text-foreground font-semibold">{count}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                placeholder="Search code or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9"
              />
            </div>

            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {(Object.keys(MODULE_META) as JourneyModule[]).map((mod) => (
                  <SelectItem key={mod} value={mod}>
                    {MODULE_META[mod].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(Object.keys(STATUS_META) as JourneyStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_META[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={actorFilter} onValueChange={setActorFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actors</SelectItem>
                {(Object.keys(ACTOR_META) as JourneyActor[]).map((actor) => (
                  <SelectItem key={actor} value={actor}>
                    {ACTOR_META[actor].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {(Object.keys(PRIORITY_META) as JourneyPriority[]).map((prio) => (
                  <SelectItem key={prio} value={prio}>
                    {PRIORITY_META[prio].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show filtered count */}
            <span className="text-muted-foreground text-sm">
              {filteredJourneys.length} of {journeys.length}
            </span>
          </div>

          {/* Journey data table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        onClick={() => handleSort("code")}
                        className="flex items-center gap-1 font-medium"
                      >
                        Code
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("title")}
                        className="flex items-center gap-1 font-medium"
                      >
                        Title
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("module")}
                        className="flex items-center gap-1 font-medium"
                      >
                        Module
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("priority")}
                        className="flex items-center gap-1 font-medium"
                      >
                        Priority
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("status")}
                        className="flex items-center gap-1 font-medium"
                      >
                        Status
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJourneys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                        No journeys match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJourneys.map((journey) => {
                      const moduleMeta = MODULE_META[journey.module];
                      const actorMeta = ACTOR_META[journey.actor];
                      const priorityMeta = PRIORITY_META[journey.priority];
                      const platformMeta = PLATFORM_META[journey.platform];
                      const PlatformIcon = PLATFORM_ICON_MAP[platformMeta.icon];

                      return (
                        <TableRow
                          key={journey.journey_id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() =>
                            router.push(`/platform-admin/journeys/${journey.journey_id}`)
                          }
                        >
                          <TableCell className="font-mono text-xs font-medium">
                            {journey.code}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{journey.title}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="gap-1 text-xs"
                              style={{
                                borderColor: moduleMeta.color,
                                color: moduleMeta.color,
                              }}
                            >
                              {moduleMeta.name}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className="text-xs"
                              style={{ color: actorMeta.color }}
                            >
                              {actorMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {PlatformIcon && (
                              <PlatformIcon className="text-muted-foreground h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor: priorityMeta.color,
                                color: priorityMeta.color,
                              }}
                            >
                              {journey.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <JourneyStatusChanger
                              journeyId={journey.journey_id}
                              currentStatus={journey.status}
                              onStatusChanged={handleStatusChange}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
