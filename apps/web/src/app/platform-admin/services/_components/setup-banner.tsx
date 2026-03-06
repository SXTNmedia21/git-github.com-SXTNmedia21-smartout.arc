"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServiceConfigRow } from "../_hooks/use-service-configs";

type Props = {
  services: ServiceConfigRow[];
};

export function SetupBanner({ services }: Props) {
  const unconfiguredCritical = useMemo(
    () => services.filter((s) => s.status === "unconfigured" && s.is_critical),
    [services],
  );

  const unconfiguredOther = useMemo(
    () => services.filter((s) => s.status === "unconfigured" && !s.is_critical),
    [services],
  );

  const total = unconfiguredCritical.length + unconfiguredOther.length;

  if (total === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {total} service{total > 1 ? "s" : ""} need configuration
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {unconfiguredCritical.length > 0 && (
            <>
              <span className="text-red-400">{unconfiguredCritical.length} critical</span>
              {unconfiguredOther.length > 0 && " + "}
            </>
          )}
          {unconfiguredOther.length > 0 && `${unconfiguredOther.length} optional`}
          {" — "}
          {[
            ...unconfiguredCritical.map((s) => s.name),
            ...unconfiguredOther.map((s) => s.name),
          ].join(", ")}
        </p>
      </div>
      {unconfiguredCritical.length > 0 && (
        <Link href={`/platform-admin/services/${unconfiguredCritical[0]!.slug}`}>
          <Button variant="outline" size="sm">
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Configure
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </Link>
      )}
    </div>
  );
}
