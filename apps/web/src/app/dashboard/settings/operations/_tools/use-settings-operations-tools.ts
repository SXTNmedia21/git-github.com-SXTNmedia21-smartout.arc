"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-settings-operations-tools.ts — Botsson tools for the
 * /dashboard/settings/operations surface.
 *
 * Four tools: 3 read, 1 nav.
 *   getOperationsSettingsOverview  — workspace operating hours summary (open days / hours)
 *   getWorkingTimeRulesSummary     — active AML compliance rules (threshold values + severity)
 *   getBreakRulesSummary           — active break rules count + sample names
 *   navigateToOperationsSetting    — deep-link back to parent /settings tab
 *
 * dataRef pattern (same as use-settings-tools.ts, use-my-training-tools.ts):
 * keeps definitions stable (useMemo [], []) while reading live state on every
 * invocation — definitions never close over stale props.
 *
 * ADR-0151: workspace_id / actor_id are auth-derived from DashboardContext — never
 * body-supplied. No write tools — operational settings mutations require admin
 * intent confirmation in multi-field forms; navigation + read is the safe surface.
 *
 * ADR-0238: page does not own a domain chat surface.
 * Orb runs in interactive mode — no <DomainChatOwnership> needed.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type OperationsHoursEntry = {
  day_name: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

export type OperationsWorkingTimeRule = {
  code: string;
  name: string;
  severity: "block" | "warn";
  threshold_value: number;
  is_active: boolean;
};

export type OperationsBreakRule = {
  name: string;
  trigger_type: "after_duration" | "time_of_day";
  duration_minutes: number;
  is_active: boolean;
};

export type SettingsOperationsToolInput = {
  /** Whether the operating hours query is still loading. */
  loadingHours: boolean;
  /** Workspace base operating hours. Empty array when not yet loaded. */
  operatingHours: OperationsHoursEntry[];
  /** Whether the working time rules query is still loading. */
  loadingWorkingTime: boolean;
  /** Active AML compliance rules for the workspace. */
  workingTimeRules: OperationsWorkingTimeRule[];
  /** Whether the break rules query is still loading. */
  loadingBreakRules: boolean;
  /** Active break rules for the workspace. */
  breakRules: OperationsBreakRule[];
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useSettingsOperationsTools(input: SettingsOperationsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getOperationsSettingsOverview",
          description:
            "Get the workspace's base operating hours — which days are open and the open/close times for each. Use when the user asks 'hvilke dager er vi åpne?', 'når stenger vi?', 'hva er åpningstidene?', or wants a summary of the operational schedule settings.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getWorkingTimeRulesSummary",
          description:
            "Get the workspace's AML (arbeidsmiljøloven) compliance rules — active rules, their threshold values, and whether violations block or warn. Use when the user asks 'hvilke arbeidstidsregler har vi?', 'er vi i samsvar med AML?', 'hva skjer hvis noen jobber for lenge?', or asks about working time constraints.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getBreakRulesSummary",
          description:
            "Get the workspace's break rules — how many are active, what triggers them (duration or time of day), and their minimum shift duration thresholds. Use when the user asks 'når har ansatte krav på pause?', 'hvilke pauseregler gjelder?', or 'er pausene obligatoriske?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "navigateToOperationsSetting",
          description:
            "Navigate the user to a specific tab in the parent /dashboard/settings page. Use when the user asks to go deeper into 'åpningstider', 'pause-regler', 'arbeidstid', or 'vakttyper' — these all live in the parent settings tabs.",
          dynamicParameters: [
            {
              name: "settingsTab",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["hours", "shift-types", "break-rules", "working-time"],
                description:
                  "Which settings tab to navigate to. 'hours' = opening hours, 'shift-types' = vakttyper, 'break-rules' = pauseregler, 'working-time' = arbeidstid.",
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
      getOperationsSettingsOverview: () => {
        const d = dataRef.current;
        if (d.loadingHours) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (d.operatingHours.length === 0) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              available: false,
              reason:
                "Åpningstider er ikke satt opp ennå. Gå til Åpningstider-fanen i Innstillinger.",
            }),
          );
        }
        const openDays = d.operatingHours.filter((h) => !h.is_closed);
        const closedDays = d.operatingHours.filter((h) => h.is_closed);
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            available: true,
            openDaysCount: openDays.length,
            closedDaysCount: closedDays.length,
            openDays: openDays.map((h) => ({
              day: h.day_name,
              opens: h.open_time,
              closes: h.close_time,
            })),
            closedDays: closedDays.map((h) => h.day_name),
          }),
        );
      },

      getWorkingTimeRulesSummary: () => {
        const d = dataRef.current;
        if (d.loadingWorkingTime) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (d.workingTimeRules.length === 0) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              available: false,
              reason:
                "Ingen arbeidstidsregler er konfigurert. Gå til Arbeidstid-fanen for å aktivere standardregler.",
            }),
          );
        }
        const active = d.workingTimeRules.filter((r) => r.is_active);
        const blocking = active.filter((r) => r.severity === "block");
        const warning = active.filter((r) => r.severity === "warn");
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            available: true,
            totalRules: d.workingTimeRules.length,
            activeCount: active.length,
            blockingCount: blocking.length,
            warningCount: warning.length,
            rules: active.map((r) => ({
              code: r.code,
              name: r.name,
              severity: r.severity,
              threshold: r.threshold_value,
            })),
          }),
        );
      },

      getBreakRulesSummary: () => {
        const d = dataRef.current;
        if (d.loadingBreakRules) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (d.breakRules.length === 0) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              available: false,
              reason:
                "Ingen pauseregler er konfigurert. Gå til Pause-regler-fanen i Innstillinger for å legge til regler.",
            }),
          );
        }
        const active = d.breakRules.filter((r) => r.is_active);
        const byDuration = active.filter((r) => r.trigger_type === "after_duration");
        const byTime = active.filter((r) => r.trigger_type === "time_of_day");
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            available: true,
            totalRules: d.breakRules.length,
            activeCount: active.length,
            durationTriggeredCount: byDuration.length,
            timeTriggeredCount: byTime.length,
            rules: active.map((r) => ({
              name: r.name,
              triggerType: r.trigger_type,
              durationMinutes: r.duration_minutes,
            })),
          }),
        );
      },

      navigateToOperationsSetting: (params: Record<string, unknown>) => {
        const tab = String(params.settingsTab ?? "");
        const validTabs = ["hours", "shift-types", "break-rules", "working-time"] as const;
        type ValidTab = (typeof validTabs)[number];
        if (!validTabs.includes(tab as ValidTab)) {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: `Ugyldig tab '${tab}'. Gyldige valg: ${validTabs.join(", ")}`,
            }),
          );
        }
        const labels: Record<ValidTab, string> = {
          hours: "Åpningstider",
          "shift-types": "Vakttyper",
          "break-rules": "Pauseregler",
          "working-time": "Arbeidstid",
        };
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("botsson:navigate-settings-tab", {
              detail: { tabId: tab },
            }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "navigate-settings-tab",
            tabId: tab,
            label: labels[tab as ValidTab],
            message: `Navigerer til "${labels[tab as ValidTab]}" i Innstillinger.`,
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
