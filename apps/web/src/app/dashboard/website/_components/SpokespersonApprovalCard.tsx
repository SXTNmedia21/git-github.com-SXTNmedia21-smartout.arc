"use client";

/**
 * Shows the current spokesperson assignment status to the admin.
 *
 * Renders person info, status badge, assigned/responded timestamps, and
 * decline reason. Exposes "Bytt person" (change) and "Tilbakekall" (revoke)
 * actions.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserX, RefreshCw, Clock, CheckCircle, XCircle } from "lucide-react";
import type { SpokespersonRow } from "../_actions/spokesperson-actions";

type Props = {
  spokesperson: SpokespersonRow;
  onChangePerson: () => void;
  onRevoke: () => void;
  isRevoking: boolean;
};

const STATUS_CONFIG = {
  pending: {
    label: "Venter",
    variant: "warning" as const,
    icon: Clock,
    className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  },
  approved: {
    label: "Aktiv",
    variant: "success" as const,
    icon: CheckCircle,
    className: "bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400",
  },
  declined: {
    label: "Avvist",
    variant: "destructive" as const,
    icon: XCircle,
    className: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
  },
  revoked: {
    label: "Tilbakekalt",
    variant: "secondary" as const,
    icon: UserX,
    className: "bg-muted text-muted-foreground",
  },
} as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SpokespersonApprovalCard({
  spokesperson,
  onChangePerson,
  onRevoke,
  isRevoking,
}: Props) {
  const { profile, status, assigned_at, responded_at, decline_reason, role_title } = spokesperson;

  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const displayName = profile?.display_name ?? "Ukjent ansatt";
  const jobTitle = profile?.job_title ?? role_title;

  return (
    <div className="border-border bg-card space-y-4 rounded-lg border p-4">
      {/* Person row */}
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
          <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {jobTitle && <p className="text-muted-foreground truncate text-xs">{jobTitle}</p>}
        </div>

        <Badge className={config.className}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {config.label}
        </Badge>
      </div>

      <Separator />

      {/* Timeline */}
      <div className="text-muted-foreground space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 shrink-0" />
          <span>Tilordnet: {formatDate(assigned_at)}</span>
        </div>

        {responded_at && (
          <div className="flex items-center gap-2">
            <StatusIcon className="h-3 w-3 shrink-0" />
            <span>
              {status === "approved" ? "Godtatt" : "Svart"}: {formatDate(responded_at)}
            </span>
          </div>
        )}
      </div>

      {/* Decline reason */}
      {status === "declined" && decline_reason && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">
          <p className="mb-0.5 font-medium">Begrunnelse</p>
          <p>{decline_reason}</p>
        </div>
      )}

      {/* Actions — hidden when already revoked */}
      {status !== "revoked" && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onChangePerson} className="flex-1 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Bytt person
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRevoke}
            disabled={isRevoking}
            className="text-destructive hover:text-destructive flex-1 gap-1.5"
          >
            <UserX className="h-3.5 w-3.5" />
            Tilbakekall
          </Button>
        </div>
      )}
    </div>
  );
}
