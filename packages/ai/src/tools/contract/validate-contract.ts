import { z } from "zod";
import { defineTool } from "../../types";
import type { ContractToolContext } from "./types";

/**
 * validate_contract — Checks the contract for required sections, placeholders, and legal requirements.
 * Returns a validation report with issues categorized by severity.
 */
export const validateContract = defineTool({
  name: "validate_contract",
  description:
    "Validate the contract for completeness and correctness. Checks for required sections (parties, service description, payment, termination, GDPR, signatures), required placeholders, and Norwegian legal requirements (Avtaleloven, GDPR/Personopplysningsloven).",
  schema: z.object({
    contractType: z
      .enum(["client", "employee", "haccp", "training", "season", "custom"])
      .optional()
      .default("client")
      .describe("Type of contract to validate against"),
  }),
  execute: async ({ contractType }, ctx: ContractToolContext) => {
    if (!ctx.editorState) {
      return JSON.stringify({ error: "No editor state available" });
    }

    const text = ctx.editorState.text.toLowerCase();
    const html = ctx.editorState.html.toLowerCase();

    type Issue = { severity: "error" | "warning" | "info"; message: string };
    const issues: Issue[] = [];

    // Check for required sections based on contract type
    const requiredSections: Record<string, string[]> = {
      client: [
        "parter",
        "tjeneste",
        "betaling",
        "varighet",
        "oppsigelse",
        "personvern",
        "signatur",
      ],
      employee: ["parter", "stilling", "lonn", "arbeidstid", "ferie", "oppsigelse", "signatur"],
      haccp: ["formål", "prosedyre", "ansvar", "signatur"],
      training: ["formål", "innhold", "bekreftelse", "signatur"],
      season: ["parter", "sesong", "betingelser", "signatur"],
      custom: ["signatur"],
    };

    const sections = requiredSections[contractType] ?? requiredSections.custom ?? [];
    for (const section of sections) {
      if (!text.includes(section)) {
        issues.push({
          severity: "error",
          message: `Manglende seksjon: "${section}" ble ikke funnet i kontrakten.`,
        });
      }
    }

    // Check for signature fields
    if (!html.includes('data-type="signature-field"')) {
      issues.push({
        severity: "error",
        message: "Ingen signaturfelt funnet. Kontrakten trenger minst ett signaturfelt.",
      });
    }

    // Check for placeholders
    if (!html.includes('data-type="placeholder-field"') && !text.includes("{{")) {
      issues.push({
        severity: "warning",
        message: "Ingen plassholdere funnet. Vurder å legge til felt som fylles automatisk.",
      });
    }

    // Check for GDPR reference (for client and employee contracts)
    if (["client", "employee"].includes(contractType)) {
      if (
        !text.includes("personvern") &&
        !text.includes("gdpr") &&
        !text.includes("personopplysning")
      ) {
        issues.push({
          severity: "error",
          message: "Manglende GDPR/personvernreferanse. Norsk lov krever dette.",
        });
      }
    }

    // Check for governing law
    if (!text.includes("lovvalg") && !text.includes("norsk lov") && !text.includes("avtaleloven")) {
      issues.push({
        severity: "warning",
        message: "Ingen lovvalgsklausul funnet. Anbefaler å spesifisere norsk lov og verneting.",
      });
    }

    // Check document is not empty
    if (text.trim().length < 100) {
      issues.push({
        severity: "error",
        message: "Kontrakten ser ut til å være for kort. En gyldig kontrakt bør ha mer innhold.",
      });
    }

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;

    return JSON.stringify({
      valid: errorCount === 0,
      issues,
      summary: {
        errors: errorCount,
        warnings: warningCount,
        total: issues.length,
      },
      message:
        errorCount === 0
          ? `Kontrakten er gyldig. ${warningCount} advarsel(er).`
          : `Kontrakten har ${errorCount} feil og ${warningCount} advarsel(er) som bør rettes.`,
    });
  },
});
