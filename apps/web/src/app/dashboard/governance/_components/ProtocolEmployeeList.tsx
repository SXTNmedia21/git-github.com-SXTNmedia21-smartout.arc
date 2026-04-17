"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  Circle,
  ChevronDown,
  MoreHorizontal,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { useProtocolAssignees } from "@/app/dashboard/_hooks/use-protocol-assignees";
import type { ProtocolAssignee } from "@/app/dashboard/_hooks/dashboard-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRevokeAssignment } from "../_hooks/use-assignment-mutations";
import { WaiveAssignmentDialog } from "./WaiveAssignmentDialog";
import { EmployeeJourneyMap } from "./EmployeeJourneyMap";

// UI Events:
// - interaction: filter tabs toggle between alle/fullført/gjenstår
// - interaction: click employee row toggles journey map accordion
// - visual: status icon per employee row

type FilterTab = "alle" | "fullfort" | "gjenstar";

interface ProtocolEmployeeListProps {
  protocolId: string;
}

function getStatusDisplay(status: ProtocolAssignee["status"]) {
  switch (status) {
    case "completed":
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
        label: "Fullført",
        className: "text-emerald-500",
      };
    case "expired":
      return {
        icon: <Clock className="h-3.5 w-3.5 text-red-500" />,
        label: "Utløpt",
        className: "text-red-500",
      };
    default:
      return {
        icon: <Circle className="text-muted-foreground h-3.5 w-3.5" />,
        label: "Ikke fullført",
        className: "text-muted-foreground",
      };
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      <div className="flex-1 space-y-1.5">
        <div className="bg-muted h-3 w-32 animate-pulse rounded" />
        <div className="bg-muted h-2.5 w-20 animate-pulse rounded" />
      </div>
    </div>
  );
}

export function ProtocolEmployeeList({ protocolId }: ProtocolEmployeeListProps) {
  const { data: assignees, isLoading } = useProtocolAssignees(protocolId);
  const [activeTab, setActiveTab] = useState<FilterTab>("alle");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const revoke = useRevokeAssignment();
  const [waiveTarget, setWaiveTarget] = useState<{
    assignmentId: string;
    displayName: string;
  } | null>(null);

  const stableAssignees = useMemo(() => assignees ?? [], [assignees]);

  const counts = useMemo(() => {
    const completed = stableAssignees.filter((a) => a.status === "completed").length;
    const remaining = stableAssignees.length - completed;
    return { alle: stableAssignees.length, fullfort: completed, gjenstar: remaining };
  }, [stableAssignees]);

  const filtered = useMemo(() => {
    if (activeTab === "fullfort") return stableAssignees.filter((a) => a.status === "completed");
    if (activeTab === "gjenstar") return stableAssignees.filter((a) => a.status !== "completed");
    return stableAssignees;
  }, [stableAssignees, activeTab]);

  if (isLoading) {
    return (
      <div className="space-y-1">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (stableAssignees.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Ingen ansatte tildelt denne protokollen.
      </p>
    );
  }

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "alle", label: "Alle", count: counts.alle },
    { key: "fullfort", label: "Fullført", count: counts.fullfort },
    { key: "gjenstar", label: "Gjenstår", count: counts.gjenstar },
  ];

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="bg-muted/50 flex gap-1 rounded-lg p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Employee list */}
      <div className="space-y-1">
        {filtered.map((assignee) => {
          const statusDisplay = getStatusDisplay(assignee.status);
          const isExpanded = expandedId === assignee.assignmentId;

          return (
            <div
              key={assignee.assignmentId}
              className="border-border/50 overflow-hidden rounded-lg border"
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : assignee.assignmentId)}
                className="hover:bg-accent/30 flex w-full items-center gap-3 p-3 text-left transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={assignee.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">
                    {getInitials(assignee.displayName)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {assignee.displayName}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {statusDisplay.icon}
                  <span className={`text-xs font-medium ${statusDisplay.className}`}>
                    {statusDisplay.label}
                  </span>
                </div>

                {/* Row actions */}
                {assignee.status !== "completed" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setWaiveTarget({
                            assignmentId: assignee.assignmentId,
                            displayName: assignee.displayName,
                          });
                        }}
                      >
                        <ShieldOff className="mr-2 h-3.5 w-3.5" />
                        Frafalle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          revoke.mutate({
                            assignmentId: assignee.assignmentId,
                            protocolId,
                          });
                        }}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Fjern tildeling
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <ChevronDown
                  className={`text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Journey map expand */}
              <div
                className={`overflow-hidden border-t transition-all duration-300 ease-out ${
                  isExpanded
                    ? "border-border/50 max-h-[400px] opacity-100"
                    : "max-h-0 border-transparent opacity-0"
                }`}
              >
                <div className="p-3">
                  {isExpanded && (
                    <EmployeeJourneyMap
                      protocolId={protocolId}
                      assignmentId={assignee.assignmentId}
                      assignmentStatus={assignee.status}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Waive dialog */}
      {waiveTarget && (
        <WaiveAssignmentDialog
          assignmentId={waiveTarget.assignmentId}
          employeeName={waiveTarget.displayName}
          open={!!waiveTarget}
          onOpenChange={(open) => {
            if (!open) setWaiveTarget(null);
          }}
        />
      )}
    </div>
  );
}
