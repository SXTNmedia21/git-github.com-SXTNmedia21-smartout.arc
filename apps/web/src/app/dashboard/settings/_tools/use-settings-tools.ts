"use client";

/**
 * use-settings-tools.ts — Botsson tools for the /dashboard/settings surface.
 *
 * Six tools: 3 read, 2 nav, 1 write-propose.
 *   getSettingsOverview      — summary of active sections + current tab
 *   listSettingsSections     — all sections with their tab ids and labels
 *   getCurrentTabInfo        — details about the active tab
 *   openSettingsSection      — navigate to a specific settings section/tab
 *   getPayrollSettingsSummary — read key payroll config (period_type, tariff, supplements)
 *   getOperatingHoursSummary  — read workspace base operating hours (days open/closed)
 *
 * dataRef pattern (same as use-notifications-tools.ts) keeps definitions stable
 * while still reading live state on every invocation.
 *
 * Write-propose tools are deliberately absent: settings mutations require admin
 * intent confirmation and multi-field forms that cannot be safely collapsed into
 * a single voice command. Navigation + read tools are the safe surface here.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type SettingsSectionId = "general" | "payroll" | "schedule" | "framework" | "organization";
export type SettingsTabId =
  | "general"
  | "hours"
  | "kpis"
  | "notifications"
  | "teams"
  | "security"
  | "financial-close"
  | "payroll-general"
  | "salary-codes"
  | "employee-groups"
  | "supplements"
  | "meal-rules"
  | "shift-types"
  | "break-rules"
  | "working-time"
  | "framework-rules"
  | "tariff-rates"
  | "change-proposals"
  | "holidays"
  | "contract-templates"
  | "contract-template-bindings";

export type PayrollSettingsSummary = {
  period_type: string | null;
  is_tariff_bound: boolean | null;
  supplement_stacking_policy: string | null;
  overtime_requires_pre_approval: boolean | null;
  shift_grouping: string | null;
} | null;

export type OperatingHoursEntry = {
  day_name: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

export type SettingsToolInput = {
  /** Currently active tab id. */
  activeTab: SettingsTabId;
  /** Setter to change active tab (client nav only). */
  setActiveTab: (tab: SettingsTabId) => void;
  /** Payroll settings summary — null if not yet loaded. */
  payrollSettings: PayrollSettingsSummary;
  /** Workspace base operating hours — null if not yet loaded. */
  operatingHours: OperatingHoursEntry[] | null;
};

/* ━━━ Section metadata ━━━━━━━━━━━━━━━━━━━━━ */

const SECTION_TABS: Record<SettingsSectionId, { tabIds: SettingsTabId[]; label: string }> = {
  general: {
    label: "General",
    tabIds: ["general", "hours", "kpis", "notifications", "teams", "security", "financial-close"],
  },
  payroll: {
    label: "Payroll",
    tabIds: ["payroll-general", "salary-codes", "employee-groups", "supplements", "meal-rules"],
  },
  schedule: {
    label: "Schedule",
    tabIds: ["shift-types", "break-rules", "working-time"],
  },
  framework: {
    label: "Framework",
    tabIds: ["framework-rules", "tariff-rates", "change-proposals"],
  },
  organization: {
    label: "Organization",
    tabIds: ["holidays", "contract-templates", "contract-template-bindings"],
  },
};

const TAB_LABELS: Record<SettingsTabId, string> = {
  general: "General",
  hours: "Opening Hours",
  kpis: "KPI Targets",
  notifications: "Notifications",
  teams: "Teams & Departments",
  security: "Security",
  "financial-close": "Financial Close",
  "payroll-general": "Payroll",
  "salary-codes": "Salary Codes",
  "employee-groups": "Employee Groups",
  supplements: "Supplements",
  "meal-rules": "Meal Rules",
  "shift-types": "Shift Types",
  "break-rules": "Break Rules",
  "working-time": "Working Time",
  "framework-rules": "Framework Rules",
  "tariff-rates": "Tariff Rates",
  "change-proposals": "Change Proposals",
  holidays: "Holiday Calendar",
  "contract-templates": "Contract Templates",
  "contract-template-bindings": "Contract Bindings",
};

const ALL_TAB_IDS = Object.keys(TAB_LABELS) as SettingsTabId[];

function tabToSection(tabId: SettingsTabId): SettingsSectionId | null {
  for (const [sectionId, { tabIds }] of Object.entries(SECTION_TABS) as [
    SettingsSectionId,
    { tabIds: SettingsTabId[] },
  ][]) {
    if (tabIds.includes(tabId)) return sectionId;
  }
  return null;
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useSettingsTools(input: SettingsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getSettingsOverview",
          description:
            "Get an overview of the settings page — current active tab, available sections, and a brief summary. Use as the first tool when the user asks anything about settings, configuration, or wants to know 'hva kan jeg endre her?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listSettingsSections",
          description:
            "List all settings sections (General, Payroll, Schedule, Framework, Organization) and the tabs each contains. Use when the user asks 'hva finnes i innstillinger?' or wants to know which section handles a specific topic.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getCurrentTabInfo",
          description:
            "Get details about the currently visible settings tab — its id, label, section, and neighbouring tabs. Use when the user asks 'hva vises nå?' or 'hvilken innstilling er åpen?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openSettingsSection",
          description:
            "Navigate to a specific settings tab. Use when the user says 'gå til lønn', 'åpne åpningstider', 'vis tillegg', or any directive to switch settings section. Valid tab ids: general, hours, kpis, notifications, teams, security, financial-close, payroll-general, salary-codes, employee-groups, supplements, meal-rules, shift-types, break-rules, working-time, framework-rules, tariff-rates, change-proposals, holidays, contract-templates, contract-template-bindings.",
          dynamicParameters: [
            {
              name: "tabId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ALL_TAB_IDS,
                description: "The tab id to navigate to.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getPayrollSettingsSummary",
          description:
            "Read the current payroll configuration summary — period type, tariff binding, supplement stacking policy, overtime approval requirement, and shift grouping. Use when the user asks 'er vi tariffbundet?', 'hvilken lønnsperiode bruker vi?', or 'krever vi forhåndsgodkjenning for overtid?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getOperatingHoursSummary",
          description:
            "Read the workspace base operating hours — which days are open and the open/close times for each. Use when the user asks 'hvilke dager er vi åpne?', 'når stenger vi?', or 'hva er åpningstidene våre?'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getSettingsOverview: () => {
        const d = dataRef.current;
        const activeSection = tabToSection(d.activeTab);
        const activeLabel = TAB_LABELS[d.activeTab];

        return JSON.stringify({
          activeTab: d.activeTab,
          activeTabLabel: activeLabel,
          activeSection,
          totalSections: Object.keys(SECTION_TABS).length,
          totalTabs: ALL_TAB_IDS.length,
          payrollLoaded: d.payrollSettings !== null,
          operatingHoursLoaded: d.operatingHours !== null,
          hint: "Use listSettingsSections for the full section/tab map, or openSettingsSection to navigate.",
        });
      },

      listSettingsSections: () => {
        const sections = Object.entries(SECTION_TABS).map(([id, { label, tabIds }]) => ({
          id,
          label,
          tabs: tabIds.map((tid) => ({ id: tid, label: TAB_LABELS[tid] })),
        }));
        return JSON.stringify({ sections });
      },

      getCurrentTabInfo: () => {
        const d = dataRef.current;
        const section = tabToSection(d.activeTab) ?? "unknown";
        const sectionMeta = SECTION_TABS[section as SettingsSectionId];
        const tabsInSection = sectionMeta?.tabIds ?? [];
        const currentIndex = tabsInSection.indexOf(d.activeTab);
        const prevTab = currentIndex > 0 ? tabsInSection[currentIndex - 1] : null;
        const nextTab =
          currentIndex < tabsInSection.length - 1 ? tabsInSection[currentIndex + 1] : null;

        return JSON.stringify({
          tabId: d.activeTab,
          tabLabel: TAB_LABELS[d.activeTab],
          section,
          sectionLabel: sectionMeta?.label ?? section,
          prevTab: prevTab ? { id: prevTab, label: TAB_LABELS[prevTab] } : null,
          nextTab: nextTab ? { id: nextTab, label: TAB_LABELS[nextTab] } : null,
        });
      },

      openSettingsSection: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const tabId = params.tabId as SettingsTabId | undefined;
        if (!tabId || !ALL_TAB_IDS.includes(tabId)) {
          return JSON.stringify({
            ok: false,
            reason: `Invalid tabId '${String(tabId)}'. Must be one of: ${ALL_TAB_IDS.join(", ")}`,
          });
        }
        if (d.activeTab === tabId) {
          return JSON.stringify({ ok: true, alreadyActive: true, tabId, label: TAB_LABELS[tabId] });
        }
        d.setActiveTab(tabId);
        return JSON.stringify({ ok: true, tabId, label: TAB_LABELS[tabId] });
      },

      getPayrollSettingsSummary: () => {
        const d = dataRef.current;
        if (!d.payrollSettings) {
          return JSON.stringify({
            available: false,
            reason:
              "Payroll settings not yet loaded — navigate to the Payroll section first, or try again after opening settings.",
          });
        }
        return JSON.stringify({
          available: true,
          periodType: d.payrollSettings.period_type,
          isTariffBound: d.payrollSettings.is_tariff_bound,
          supplementStackingPolicy: d.payrollSettings.supplement_stacking_policy,
          overtimeRequiresPreApproval: d.payrollSettings.overtime_requires_pre_approval,
          shiftGrouping: d.payrollSettings.shift_grouping,
        });
      },

      getOperatingHoursSummary: () => {
        const d = dataRef.current;
        if (!d.operatingHours || d.operatingHours.length === 0) {
          return JSON.stringify({
            available: false,
            reason:
              "Operating hours not yet loaded — navigate to the Opening Hours tab first, or try again.",
          });
        }
        const openDays = d.operatingHours.filter((h) => !h.is_closed);
        const closedDays = d.operatingHours.filter((h) => h.is_closed);
        return JSON.stringify({
          available: true,
          totalDays: d.operatingHours.length,
          openDays: openDays.map((h) => ({
            day: h.day_name,
            open: h.open_time,
            close: h.close_time,
          })),
          closedDays: closedDays.map((h) => h.day_name),
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
