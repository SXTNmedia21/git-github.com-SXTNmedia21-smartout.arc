"use client";

import Link from "next/link";
import { CalendarX, FileSignature, UserX, BookOpen, MailWarning, CheckCircle2 } from "lucide-react";
import { useActionItems } from "@/app/dashboard/_hooks/use-action-items";

interface ActionStripProps {
  isDark: boolean;
}

// Temporary UI toggle: keep action-strip logic intact but hide visual output.
const ACTION_STRIP_VISIBLE = false;

const CHIP_CONFIG = [
  {
    key: "shiftGaps" as const,
    icon: CalendarX,
    label: "Shift Gaps",
    href: "/dashboard/schedule",
    priorityColor: {
      dark: "bg-red-500/15 text-red-400 border-red-500/20",
      light: "bg-red-50 text-red-600 border-red-200",
    },
  },
  {
    key: "pendingContracts" as const,
    icon: FileSignature,
    label: "Contracts",
    href: "/dashboard/people",
    priorityColor: {
      dark: "bg-orange-500/15 text-orange-400 border-orange-500/20",
      light: "bg-orange-50 text-orange-600 border-orange-200",
    },
  },
  {
    key: "stuckOnboarding" as const,
    icon: UserX,
    label: "Onboarding",
    href: "/dashboard/people",
    priorityColor: {
      dark: "bg-orange-500/15 text-orange-400 border-orange-500/20",
      light: "bg-orange-50 text-orange-600 border-orange-200",
    },
  },
  {
    key: "pendingProtocols" as const,
    icon: BookOpen,
    label: "Protocols",
    href: "/dashboard/reports",
    priorityColor: {
      dark: "bg-blue-500/15 text-blue-400 border-blue-500/20",
      light: "bg-blue-50 text-blue-600 border-blue-200",
    },
  },
  {
    key: "staleInvitations" as const,
    icon: MailWarning,
    label: "Invitations",
    href: "/dashboard/people",
    priorityColor: {
      dark: "bg-muted text-muted-foreground border-border",
      light: "bg-muted text-muted-foreground border-border",
    },
  },
] as const;

export function ActionStrip({ isDark }: ActionStripProps) {
  const { data: counts, isLoading } = useActionItems();

  if (!ACTION_STRIP_VISIBLE) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className={`flex h-14 items-center gap-3 rounded-2xl border px-4 ${
          isDark ? "border-border bg-card/50" : "border-border bg-muted"
        }`}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-muted h-8 w-28 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!counts || counts.total === 0) {
    return (
      <div
        className={`flex h-14 items-center gap-2 rounded-2xl border px-4 ${
          isDark ? "border-emerald-500/10 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <CheckCircle2 className={`h-4 w-4 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
        <span
          className={`text-sm font-semibold ${isDark ? "text-emerald-400" : "text-emerald-700"}`}
        >
          All clear — no action items pending
        </span>
      </div>
    );
  }

  const theme = isDark ? "dark" : "light";

  return (
    <div
      className={`flex h-14 items-center gap-2 overflow-x-auto rounded-2xl border px-4 ${
        isDark ? "border-border bg-card/50" : "border-border bg-muted"
      }`}
    >
      {CHIP_CONFIG.map((chip) => {
        const count = counts[chip.key];
        if (count === 0) return null;

        const Icon = chip.icon;
        return (
          <Link
            key={chip.key}
            href={chip.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 ${chip.priorityColor[theme]}`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{count}</span>
            <span className="hidden sm:inline">{chip.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
