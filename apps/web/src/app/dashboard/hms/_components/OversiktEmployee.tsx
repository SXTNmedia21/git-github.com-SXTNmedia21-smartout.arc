"use client";

import { useContext } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { useReadinessScore } from "../_hooks/use-readiness-score";
import {
  useAssignedProtocols,
  type AssignedProtocol,
} from "@/app/dashboard/my-training/_hooks/use-assigned-protocols";
import { DriftFocusCard } from "./DriftFocusCard";

// TODO: move to i18n
const STRINGS = {
  readiness: "Din opplaeringsgrad",
  remaining: "ting gjenstar",
  allDone: "Alt fullfort!",
  continueLabel: "Fortsett",
  noAssignments: "Ingen opplaering tildelt enna.",
} as const;

/** SVG readiness ring — simple donut chart */
function ReadinessRing({ percent }: { percent: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color =
    percent >= 90 ? "stroke-green-500" : percent >= 60 ? "stroke-yellow-500" : "stroke-red-500";

  return (
    <div className="relative flex items-center justify-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" className="stroke-muted" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          className={`${color} transition-all duration-500`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-foreground text-3xl font-bold">{percent}%</span>
      </div>
    </div>
  );
}

/** Find the next incomplete protocol to recommend */
function getNextProtocol(protocols: AssignedProtocol[]): AssignedProtocol | null {
  return protocols.find((p) => p.assignmentStatus !== "completed") ?? null;
}

export function OversiktEmployee() {
  const { profileId } = useContext(DashboardContext);
  const { score, isLoading: scoreLoading } = useReadinessScore(profileId);
  const { data: protocols, isLoading: protocolsLoading } = useAssignedProtocols(profileId);

  const isLoading = scoreLoading || protocolsLoading;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  const remaining = score.total - score.completed;
  const nextProtocol = protocols ? getNextProtocol(protocols) : null;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8">
      {/* Readiness ring */}
      <div className="flex flex-col items-center gap-2">
        <ReadinessRing percent={score.percent} />
        <p className="text-muted-foreground text-sm font-medium">{STRINGS.readiness}</p>
        <p className="text-foreground text-lg font-bold">
          {remaining > 0 ? `${remaining} ${STRINGS.remaining}` : STRINGS.allDone}
        </p>
      </div>

      {/* Next action card */}
      {nextProtocol ? (
        <div className="border-border bg-card w-full rounded-xl border p-4">
          <p className="text-muted-foreground mb-1 text-xs font-medium">Neste</p>
          <p className="text-foreground mb-3 font-semibold">{nextProtocol.protocolName}</p>
          <div className="bg-muted mb-3 h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${nextProtocol.progress.percent}%` }}
            />
          </div>
          <p className="text-muted-foreground mb-3 text-xs">
            {nextProtocol.progress.completedSteps}/{nextProtocol.progress.totalSteps} steg fullfort
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard/hms/training">
              {STRINGS.continueLabel}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{STRINGS.noAssignments}</p>
      )}

      {/* Active session task widget */}
      <DriftFocusCard />
    </div>
  );
}
