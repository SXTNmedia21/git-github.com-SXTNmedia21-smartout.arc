"use client";

import { useMemo } from "react";
import type { ClientToolDefinition, ClientToolImplementation, ClientToolKit } from "@smartout/agent-sdk";
import { useSyncRef } from "@/lib/wizard-tools/shared";
import type { TariffSupplement } from "@smartout/types";

/**
 * Tools Emma can use on the Payroll setup step.
 *
 * Reads/writes via refs — never captures state in closure.
 * No nav tools — this step has custom props, not WizardStepProps.
 */
export function usePayrollTools(
  selectedTariff: string,
  supplements: TariffSupplement[],
  tariffOptions: { value: string; label: string }[],
  onSelectTariff: (value: string) => void,
  onAddCustomSupplement: (supplement: TariffSupplement) => void,
): ClientToolKit {
  const selectedTariffRef = useSyncRef(selectedTariff);
  const supplementsRef = useSyncRef(supplements);
  const tariffOptionsRef = useSyncRef(tariffOptions);
  const onSelectTariffRef = useSyncRef(onSelectTariff);
  const onAddCustomSupplementRef = useSyncRef(onAddCustomSupplement);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "select_tariff",
          description:
            "Select a tariff agreement by name or key. Call get_payroll_status first to see available options.",
          dynamicParameters: [
            {
              name: "tariffName",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Tariff name or key to select" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "add_supplement",
          description: "Add a wage supplement. Rate is numeric. Unit is 'kr/t' (hourly) or '%' (percentage).",
          dynamicParameters: [
            {
              name: "name",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Supplement name, e.g. 'Nattillegg'" },
              required: true,
            },
            {
              name: "rate",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "number", description: "Rate value" },
              required: true,
            },
            {
              name: "unit",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Unit: 'kr/t' or '%'" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_payroll_status",
          description: "Get current payroll setup: selected tariff, available tariffs, and active supplements.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      select_tariff: (params) => {
        const p = params as Record<string, string>;
        const input = p.tariffName?.trim().toLowerCase();
        if (!input) return "Error: tariffName is required.";

        const options = tariffOptionsRef.current;
        const match = options.find(
          (o) => o.value.toLowerCase() === input || o.label.toLowerCase().includes(input),
        );
        if (!match) {
          return `Tariff "${p.tariffName}" not found. Available: ${options.map((o) => o.label).join(", ")}.`;
        }
        onSelectTariffRef.current(match.value);
        return `Tariff set to "${match.label}".`;
      },
      add_supplement: (params) => {
        const p = params as Record<string, unknown>;
        const name = (p.name as string)?.trim();
        const rate = Number(p.rate) || 0;
        const unit = (p.unit as string)?.trim() as "kr/t" | "%";

        if (!name) return "Error: name is required.";
        if (!["kr/t", "%"].includes(unit)) return `Error: unit must be 'kr/t' or '%', got "${unit}".`;

        const supplement: TariffSupplement = {
          id: crypto.randomUUID(),
          name,
          rate,
          unit,
          condition_type: "always",
        };
        onAddCustomSupplementRef.current(supplement);
        return `Supplement "${name}" added: ${rate} ${unit}.`;
      },
      get_payroll_status: () => {
        const tariff = selectedTariffRef.current;
        const options = tariffOptionsRef.current;
        const supps = supplementsRef.current;
        const tariffLabel = options.find((o) => o.value === tariff)?.label ?? tariff;
        const suppSummary =
          supps.length > 0
            ? supps.map((s) => `${s.name} (${s.rate} ${s.unit})`).join(", ")
            : "none";
        const available = options.map((o) => o.label).join(", ");
        return (
          `Current tariff: "${tariffLabel}". ` +
          `Supplements: ${suppSummary}. ` +
          `Available tariffs: ${available}.`
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
