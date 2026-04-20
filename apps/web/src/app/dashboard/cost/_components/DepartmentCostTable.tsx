"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DepartmentCostSummary } from "../_hooks/use-cost-overview";

/**
 * Table showing per-department cost breakdown.
 * Columns: Avdeling, Planlagt, Faktisk, Avvik, Timer, Vakter.
 * Variance is color-coded: over budget = destructive, under = success.
 */
export function DepartmentCostTable({ departments }: { departments: DepartmentCostSummary[] }) {
  if (departments.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground text-sm">Ingen kostnadsdata for valgt periode</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kostnad per avdeling</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avdeling</TableHead>
              <TableHead className="text-right">Planlagt</TableHead>
              <TableHead className="text-right">Faktisk</TableHead>
              <TableHead className="text-right">Avvik</TableHead>
              <TableHead className="text-right">Timer</TableHead>
              <TableHead className="text-right">Vakter</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((dept) => (
              <TableRow key={dept.departmentId}>
                <TableCell className="font-medium">{dept.departmentName}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatNOK(dept.plannedCost)}
                </TableCell>
                <TableCell className="text-right font-mono">{formatNOK(dept.actualCost)}</TableCell>
                <TableCell className={`text-right font-mono ${varianceColorClass(dept.variance)}`}>
                  {dept.variance > 0 ? "+" : ""}
                  {formatNOK(dept.variance)}
                  {dept.variancePercent !== 0 && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({dept.variancePercent.toFixed(1)}%)
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">{dept.totalHours.toFixed(1)}</TableCell>
                <TableCell className="text-right font-mono">{dept.shiftCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Returns CSS variable color class based on variance direction. */
function varianceColorClass(variance: number): string {
  if (variance > 0) return "text-destructive";
  if (variance < 0) return "text-success";
  return "text-muted-foreground";
}

/** Format number as NOK currency string. */
function formatNOK(value: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
