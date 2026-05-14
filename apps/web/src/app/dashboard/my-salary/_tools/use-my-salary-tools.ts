"use client";

/**
 * use-my-salary-tools.ts — Botsson tools for the /dashboard/my-salary surface.
 *
 * Four read tools + one nav tool — no writes. The employee cannot edit their
 * own lønnsgrunnlag; the page is read-only.
 *
 *   getMyLatestSalary      — fetch the most recent settled lønnsgrunnlag period
 *   listMyLonnsgrunnlag    — list all settled periods, optionally filtered by year
 *   getLonnsgrunnlagDetail — detail for a specific period (lines + balances)
 *   getYearToDateSummary   — YTD gross + feriepenger + timebank across all settled periods
 *   openLonnsgrunnlagDetail — navigate to /dashboard/my-salary/{lonnsgrunnlagId}
 *
 * dataRef pattern (same as use-notifications-tools.ts) keeps definitions stable
 * while still reading live cache state on every invocation.
 *
 * ADR-0151: workspace_id is resolved server-side via RLS — not passed as a param.
 * ADR-0238: /my-salary does not own a domain chat surface — Orb stays interactive.
 */

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { MySalaryData, PayslipEntry } from "../_hooks/use-my-salary";
import { formatNOK, formatPeriodName, formatHours } from "../_lib/format";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type MySalaryToolInput = {
  /** All settled payslip entries (period + calculation). */
  payslips: PayslipEntry[];
  /** Full MySalaryData from useMySalary — may be undefined while loading. */
  salaryData: MySalaryData | undefined;
  /** Currently selected period id (null = most recent). */
  selectedPeriodId: string | null;
  /** Callback to switch the selected period in the UI. */
  setSelectedPeriodId: (id: string) => void;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useMySalaryTools(input: MySalaryToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const router = useRouter();

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getMyLatestSalary",
          description:
            "Get the most recently settled lønnsgrunnlag period for the current employee — total pay, period name, date range, and feriepenger percentage. Use when the employee asks 'hva fikk jeg i lønn sist?', 'hva er siste lønnsgrunnlag?', or any 'recent pay' question.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listMyLonnsgrunnlag",
          description:
            "List all settled lønnsgrunnlag periods for the current employee. Optionally filter by year. Use when the employee asks 'vis lønnsoversikten min', 'hvilke perioder er avregnet?', or 'vis lønnsgrunnlag for 2025'.",
          dynamicParameters: [
            {
              name: "year",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "number",
                description: "Calendar year to filter by (e.g. 2025). Omit to return all years.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getLonnsgrunnlagDetail",
          description:
            "Get the detail for a specific lønnsgrunnlag period by its period id — includes total pay, net working minutes, and a note on whether calculation lines are available. Use when the employee references a specific period or month by name.",
          dynamicParameters: [
            {
              name: "periodId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the payroll period (period.id from the payslips list).",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getYearToDateSummary",
          description:
            "Get year-to-date summary for the current employee: total gross pay across all settled periods this year, feriepenger percentage, timebank balance, and number of settled periods. Use when the employee asks 'hva har jeg tjent i år?', 'hva er totalen?', or 'vis oppsummering'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openLonnsgrunnlagDetail",
          description:
            "Navigate to the PDF viewer for a specific lønnsgrunnlag. Use when the employee asks to open, view, or download a lønnsgrunnlag PDF — requires the export event id (lonnsgrunnlagId).",
          dynamicParameters: [
            {
              name: "lonnsgrunnlagId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "UUID of the export_event (the lonnsgrunnlagId shown in the PDF list).",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getMyLatestSalary: () => {
        const d = dataRef.current;
        const latest = d.payslips[0] ?? null;

        if (!latest) {
          return JSON.stringify({
            ok: false,
            reason: "Ingen avregnet lønnsgrunnlag funnet for denne ansatte.",
          });
        }

        return JSON.stringify({
          ok: true,
          periodId: latest.period.id,
          periodName: formatPeriodName(latest.period.start_date),
          dateRange: `${latest.period.start_date} – ${latest.period.end_date}`,
          status: latest.period.status,
          totalPay: latest.calculation ? formatNOK(latest.calculation.total_pay) : null,
          totalPayRaw: latest.calculation?.total_pay ?? null,
          holidayAllowancePct: d.salaryData?.holidayAllowancePct ?? null,
        });
      },

      listMyLonnsgrunnlag: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const year = params.year as number | undefined;

        let payslips = d.payslips;
        if (year) {
          payslips = payslips.filter((p) => {
            const periodYear = new Date(p.period.start_date + "T00:00:00").getFullYear();
            return periodYear === year;
          });
        }

        return JSON.stringify({
          ok: true,
          year: year ?? "alle",
          total: payslips.length,
          periods: payslips.map(({ period, calculation }) => ({
            periodId: period.id,
            periodName: formatPeriodName(period.start_date),
            dateRange: `${period.start_date} – ${period.end_date}`,
            status: period.status,
            totalPay: calculation ? formatNOK(calculation.total_pay) : null,
            totalPayRaw: calculation?.total_pay ?? null,
          })),
        });
      },

      getLonnsgrunnlagDetail: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const periodId = params.periodId as string | undefined;

        if (!periodId) {
          return JSON.stringify({ ok: false, reason: "periodId er påkrevd." });
        }

        const entry = d.payslips.find((p) => p.period.id === periodId) ?? null;

        if (!entry) {
          return JSON.stringify({
            ok: false,
            reason: `Fant ikke periode med id '${periodId}' i avregnet lønnsgrunnlag.`,
          });
        }

        const { period, calculation } = entry;

        return JSON.stringify({
          ok: true,
          periodId: period.id,
          periodName: formatPeriodName(period.start_date),
          dateRange: `${period.start_date} – ${period.end_date}`,
          status: period.status,
          totalPay: calculation ? formatNOK(calculation.total_pay) : null,
          totalPayRaw: calculation?.total_pay ?? null,
          netWorkingMinutes: calculation?.net_working_minutes ?? null,
          calculationId: calculation?.id ?? null,
          hasLines: !!calculation?.id,
          note: calculation?.id
            ? "Linjespesifikasjon tilgjengelig — åpne lønnsgrunnlaget for full oversikt."
            : "Ingen beregning koblet til denne perioden ennå.",
        });
      },

      getYearToDateSummary: () => {
        const d = dataRef.current;
        const currentYear = new Date().getFullYear();

        const ytdPayslips = d.payslips.filter((p) => {
          const periodYear = new Date(p.period.start_date + "T00:00:00").getFullYear();
          return periodYear === currentYear;
        });

        const ytdGross = ytdPayslips.reduce((sum, { calculation }) => {
          return sum + (calculation?.total_pay ?? 0);
        }, 0);

        return JSON.stringify({
          ok: true,
          year: currentYear,
          settledPeriods: ytdPayslips.length,
          ytdGross: formatNOK(ytdGross),
          ytdGrossRaw: ytdGross,
          holidayAllowancePct: d.salaryData?.holidayAllowancePct ?? null,
          timebankBalance: d.salaryData ? formatHours(d.salaryData.timebankBalance) : null,
          timebankBalanceRaw: d.salaryData?.timebankBalance ?? null,
          absenceQuotasCount: d.salaryData?.absenceQuotas.length ?? 0,
        });
      },

      openLonnsgrunnlagDetail: (params: Record<string, unknown>) => {
        const lonnsgrunnlagId = params.lonnsgrunnlagId as string | undefined;

        if (!lonnsgrunnlagId) {
          return JSON.stringify({ ok: false, reason: "lonnsgrunnlagId er påkrevd." });
        }

        router.push(`/dashboard/my-salary/${lonnsgrunnlagId}`);
        return JSON.stringify({ ok: true, navigatedTo: `/dashboard/my-salary/${lonnsgrunnlagId}` });
      },
    }),
    [router],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
