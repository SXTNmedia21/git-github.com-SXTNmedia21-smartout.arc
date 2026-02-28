"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/platform-admin/sparkline";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  sparklineData?: number[];
  danger?: boolean;
};

export function KpiCard({ label, value, icon: Icon, trend, sparklineData, danger }: KpiCardProps) {
  return (
    <Card className={cn("transition-colors", danger && "border-destructive/50")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon
              className={cn("h-4 w-4", danger ? "text-destructive" : "text-muted-foreground")}
            />
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <Sparkline
              data={sparklineData}
              color={danger ? "hsl(var(--destructive))" : undefined}
            />
          )}
        </div>
        <div className="mt-2 flex items-end justify-between">
          <span
            className={cn("text-2xl font-semibold tracking-tight", danger && "text-destructive")}
          >
            {value}
          </span>
          {trend && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                trend.isPositive ? "text-emerald-500" : "text-destructive",
              )}
            >
              {trend.isPositive ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
