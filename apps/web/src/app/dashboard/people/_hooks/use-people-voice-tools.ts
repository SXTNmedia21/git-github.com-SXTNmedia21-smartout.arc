"use client";

/**
 * use-people-voice-tools.ts
 *
 * Why: Provides read-only voice tools for /dashboard/people so Botsson
 * can answer roster, readiness, and department questions without
 * navigating away from the page.
 *
 * Tools: getPeopleState, getEmployeeInfo, getPeopleByDepartment, getReadinessSummary.
 * Write operations (role change, deactivate) are out of scope for voice — C4 gate
 * requires explicit UI confirmation, not voice command.
 */

import { useMemo } from "react";
import type { ClientToolDefinition, ClientTools } from "@/components/voice-tools-context";
import { peopleToolDefinitions } from "./people-tool-definitions";
import type { Employee, Department } from "../_components/types";

type PeopleVoiceToolsInput = {
  employees: Employee[];
  departments: Department[];
};

const TOOL_DEFINITIONS: ClientToolDefinition[] = [...peopleToolDefinitions];

export function usePeopleVoiceTools({
  employees,
  departments,
}: PeopleVoiceToolsInput): ClientTools {
  return useMemo((): ClientTools => {
    // -- getPeopleState -------------------------------------------------------
    function getPeopleState(): string {
      const activeCount = employees.filter((e) => e.status === "active").length;
      const traineeCount = employees.filter((e) => e.status === "trainee").length;
      const inactiveCount = employees.filter((e) => e.status === "inactive").length;
      const withScores = employees.filter(
        (e) => e.readinessScore !== undefined && e.status !== "invited",
      );
      const avgReadiness =
        withScores.length > 0
          ? Math.round(
              withScores.reduce((sum, e) => sum + (e.readinessScore ?? 0), 0) / withScores.length,
            )
          : 0;
      const deptCounts = new Map<string, number>();
      for (const emp of employees) {
        if (emp.department)
          deptCounts.set(emp.department, (deptCounts.get(emp.department) ?? 0) + 1);
      }
      const topDepts = Array.from(deptCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => `${name} (${count})`)
        .join(", ");

      return JSON.stringify({
        total: employees.length,
        active: activeCount,
        trainees: traineeCount,
        inactive: inactiveCount,
        departments: departments.length,
        avg_readiness_pct: avgReadiness,
        top_departments: topDepts,
      });
    }

    // -- getEmployeeInfo ------------------------------------------------------
    function getEmployeeInfo(params: Record<string, unknown>): string {
      const name =
        typeof params["employeeName"] === "string" ? params["employeeName"].toLowerCase() : "";
      const matches = employees.filter((e) => e.name && e.name.toLowerCase().includes(name));
      if (matches.length === 0) {
        return JSON.stringify({ error: `No employee found matching "${params["employeeName"]}"` });
      }
      return JSON.stringify(
        matches.slice(0, 3).map((e) => ({
          name: e.name,
          role: e.role,
          department: e.department,
          status: e.status,
          readiness_pct: e.readinessScore,
          has_contract: e.hasContract,
        })),
      );
    }

    // -- getPeopleByDepartment ------------------------------------------------
    function getPeopleByDepartment(params: Record<string, unknown>): string {
      const name =
        typeof params["departmentName"] === "string" ? params["departmentName"].toLowerCase() : "";
      const members = employees.filter(
        (e) => e.department && e.department.toLowerCase().includes(name),
      );
      if (members.length === 0) {
        return JSON.stringify({
          error: `No department found matching "${params["departmentName"]}"`,
        });
      }
      return JSON.stringify({
        department: members[0]?.department,
        count: members.length,
        members: members.map((e) => ({
          name: e.name,
          role: e.role,
          status: e.status,
          readiness_pct: e.readinessScore,
        })),
      });
    }

    // -- getReadinessSummary --------------------------------------------------
    function getReadinessSummary(): string {
      const withScores = employees.filter(
        (e) => e.readinessScore !== undefined && e.status === "active",
      );
      const sorted = [...withScores].sort(
        (a, b) => (a.readinessScore ?? 0) - (b.readinessScore ?? 0),
      );
      const lowest = sorted.slice(0, 5).map((e) => ({
        name: e.name,
        department: e.department,
        readiness_pct: e.readinessScore,
      }));
      const avg =
        withScores.length > 0
          ? Math.round(
              withScores.reduce((sum, e) => sum + (e.readinessScore ?? 0), 0) / withScores.length,
            )
          : 0;
      const belowThreshold = withScores.filter((e) => (e.readinessScore ?? 0) < 50).length;

      return JSON.stringify({
        measured: withScores.length,
        avg_readiness_pct: avg,
        below_50pct: belowThreshold,
        lowest_5: lowest,
      });
    }

    return {
      definitions: TOOL_DEFINITIONS,
      implementations: {
        getPeopleState: () => getPeopleState(),
        getEmployeeInfo: (params) => getEmployeeInfo(params),
        getPeopleByDepartment: (params) => getPeopleByDepartment(params),
        getReadinessSummary: () => getReadinessSummary(),
      },
    };
  }, [employees, departments]);
}
