"use client";

import { useMemo } from "react";
import type { ClientToolDefinition, ClientToolImplementation, ClientToolKit } from "@smartout/agent-sdk";
import { useSyncRef } from "@/lib/wizard-tools/shared";
import type { DocumentExtractionResult } from "../wizard-state";

/**
 * Tools Emma can use on the Document Drop step.
 *
 * Reads extraction state via refs — never captures state in closure.
 * No nav tools — this step has custom props, not WizardStepProps.
 */
export function useDocumentDropTools(
  fileCount: number,
  isAnalyzing: boolean,
  extractionResult: DocumentExtractionResult | null,
): ClientToolKit {
  const fileCountRef = useSyncRef(fileCount);
  const isAnalyzingRef = useSyncRef(isAnalyzing);
  const extractionRef = useSyncRef(extractionResult);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "get_extraction_status",
          description: "Get what was extracted from uploaded documents: file count, analysis state, and found data.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      get_extraction_status: () => {
        const count = fileCountRef.current;
        const analyzing = isAnalyzingRef.current;
        const result = extractionRef.current;

        if (count === 0) return "No documents uploaded yet. This step is optional.";
        if (analyzing) return `${count} document(s) uploaded and currently being analyzed.`;
        if (!result) return `${count} document(s) uploaded but not yet analyzed.`;

        const parts: string[] = [`${count} document(s) uploaded.`];
        if (result.policies?.length) parts.push(`${result.policies.length} policies found.`);
        if (result.employees?.length) parts.push(`${result.employees.length} employees found.`);
        if (result.shiftPatterns?.length) parts.push(`${result.shiftPatterns.length} shift patterns found.`);
        if (result.payroll) parts.push("Payroll/tariff info found.");
        if (result.employmentTerms) parts.push("Employment terms found.");
        if (result.handbookSections?.length) parts.push(`${result.handbookSections.length} handbook sections found.`);

        return parts.join(" ");
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
