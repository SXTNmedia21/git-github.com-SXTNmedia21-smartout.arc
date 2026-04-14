"use client";

/**
 * Department-level readiness summary with collapsible per-employee detail.
 * Aggregates protocol assignment data from CompetenceMatrix rows
 * and groups by department, showing avg readiness + completion counts.
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

type EmployeeSummary = {
  profileId: string;
  profileName: string;
  readinessPercent: number;
  assignedCount: number;
  completedCount: number;
};

type DepartmentSummary = {
  name: string;
  employeeCount: number;
  avgReadiness: number;
  totalAssigned: number;
  totalCompleted: number;
  employees: EmployeeSummary[];
};

type DepartmentReadinessProps = {
  rows: Array<{
    profileId: string;
    profileName: string;
    departmentName: string | null;
    protocols: Record<string, { status: string; percent: number }>;
    readinessPercent: number;
  }>;
};

function readinessColor(percent: number): string {
  if (percent >= 80) return "text-green-600";
  if (percent >= 50) return "text-yellow-600";
  return "text-red-600";
}

function readinessBg(percent: number): string {
  if (percent >= 80) return "bg-green-500";
  if (percent >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function DepartmentRow({ dept }: { dept: DepartmentSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
        >
          {open ? (
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          )}
          <Building2 className="text-muted-foreground h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-medium">{dept.name}</p>
            <p className="text-muted-foreground text-xs">{dept.employeeCount} ansatte</p>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="bg-muted h-2 w-20 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${readinessBg(dept.avgReadiness)}`}
                style={{ width: `${dept.avgReadiness}%` }}
              />
            </div>
            <span
              className={`min-w-[3ch] text-right text-sm font-bold ${readinessColor(dept.avgReadiness)}`}
            >
              {dept.avgReadiness}%
            </span>
          </div>
          <Badge variant="outline" className="text-muted-foreground text-[10px]">
            {dept.totalCompleted}/{dept.totalAssigned}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-border/50 ml-11 space-y-1 border-l pt-1 pb-2 pl-3">
          {dept.employees.map((emp) => (
            <div
              key={emp.profileId}
              className="flex items-center gap-3 rounded px-2 py-1.5 text-sm"
            >
              <span className="text-foreground min-w-0 flex-1 truncate">{emp.profileName}</span>
              <div className="flex items-center gap-2">
                <div className="bg-muted h-1.5 w-14 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${readinessBg(emp.readinessPercent)}`}
                    style={{ width: `${emp.readinessPercent}%` }}
                  />
                </div>
                <span
                  className={`min-w-[3ch] text-right text-xs font-medium ${readinessColor(emp.readinessPercent)}`}
                >
                  {emp.readinessPercent}%
                </span>
              </div>
              <span className="text-muted-foreground text-[10px]">
                {emp.completedCount}/{emp.assignedCount}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DepartmentReadiness({ rows }: DepartmentReadinessProps) {
  const departments = useMemo(() => {
    const deptMap = new Map<string, EmployeeSummary[]>();

    for (const row of rows) {
      const deptName = row.departmentName ?? "Uten avdeling";
      if (!deptMap.has(deptName)) deptMap.set(deptName, []);

      const protocols = Object.values(row.protocols);
      const assigned = protocols.filter((p) => p.status !== "not_assigned");
      const completed = protocols.filter((p) => p.status === "completed");

      deptMap.get(deptName)!.push({
        profileId: row.profileId,
        profileName: row.profileName,
        readinessPercent: row.readinessPercent,
        assignedCount: assigned.length,
        completedCount: completed.length,
      });
    }

    const summaries: DepartmentSummary[] = [];
    for (const [name, employees] of deptMap) {
      const totalAssigned = employees.reduce((s, e) => s + e.assignedCount, 0);
      const totalCompleted = employees.reduce((s, e) => s + e.completedCount, 0);
      const avgReadiness =
        employees.length > 0
          ? Math.round(employees.reduce((s, e) => s + e.readinessPercent, 0) / employees.length)
          : 0;

      summaries.push({
        name,
        employeeCount: employees.length,
        avgReadiness,
        totalAssigned,
        totalCompleted,
        employees: employees.sort((a, b) => a.readinessPercent - b.readinessPercent),
      });
    }

    return summaries.sort((a, b) => a.avgReadiness - b.avgReadiness);
  }, [rows]);

  if (departments.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="text-muted-foreground h-5 w-5" />
          Avdelingsvis beredskap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {departments.map((dept) => (
          <DepartmentRow key={dept.name} dept={dept} />
        ))}
      </CardContent>
    </Card>
  );
}
