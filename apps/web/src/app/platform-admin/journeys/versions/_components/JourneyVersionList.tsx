// ============================================
// JourneyVersionList.tsx — client-side filter + table for versions list
//
// Renders each row as a compact table row and (on larger screens) a
// JourneyStoreListingCard preview in a right rail. Status filter + text
// search are client-side only — fewer than a few hundred rows at a
// workspace so no server pagination needed at M4.
// ============================================

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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
import {
  JOURNEY_VERSION_STATUS_ORDER,
  STATUS_LABEL,
  type JourneyVersionStatus,
} from "../_lib/version-status";
import { StatusBadge } from "./StatusBadge";

export type JourneyVersionRow = {
  journeyVersionId: string;
  journeyId: string;
  workspaceId: string;
  versionNumber: number;
  status: JourneyVersionStatus;
  slug: string;
  title: string;
  module: string;
  updatedAt: string;
};

export function JourneyVersionListClient({ rows }: { rows: ReadonlyArray<JourneyVersionRow> }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"all" | JourneyVersionStatus>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.slug.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q)
      );
    });
  }, [rows, statusFilter, query]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder="Search slug / title / module…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-background border-border text-foreground w-72 pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="bg-background border-border text-foreground w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {JOURNEY_VERSION_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      <div className="border-border bg-background overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Module</TableHead>
              <TableHead className="w-20">Version</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="w-40">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  No journey versions match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.journeyVersionId}
                  className={cn("hover:bg-muted/40 cursor-pointer")}
                  onClick={() =>
                    router.push(`/platform-admin/journeys/versions/${r.journeyVersionId}`)
                  }
                >
                  <TableCell className="text-foreground font-mono text-xs">{r.slug}</TableCell>
                  <TableCell className="text-foreground max-w-sm truncate">{r.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.module}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    v{r.versionNumber}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {new Date(r.updatedAt).toISOString().slice(0, 19).replace("T", " ")}Z
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
