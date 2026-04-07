import type { FixtureFile } from "./_schema.js";

/**
 * Seed fixtures for the intent classifier.
 *
 * Covers the main capabilities with realistic Norwegian + English
 * messages. Goal: a baseline accuracy signal, not exhaustive coverage.
 * Add new fixtures whenever a capability's prompt changes or a real
 * misclassification is observed in production.
 */
export const intentSeed: FixtureFile = {
  suite: "intent-classifier-seed",
  fixtures: [
    {
      id: "schedule-when-work",
      note: "Direct schedule query in Norwegian",
      message: "Når jobber jeg neste uke?",
      context: "Rolle: employee. Avdeling: Kjøkken. Teamleder: Nei.",
      expected: { capability: "schedule", minConfidence: 0.8 },
      tags: ["norwegian", "schedule-query"],
    },
    {
      id: "schedule-swap-request",
      note: "Shift swap request phrased indirectly",
      message: "Kan noen ta lørdagen min? Jeg må til en begravelse.",
      context: "Rolle: employee. Avdeling: Servering.",
      expected: { capability: "schedule", minConfidence: 0.7 },
      tags: ["norwegian", "shift-swap", "indirect"],
    },
    {
      id: "training-readiness",
      note: "Training progress question",
      message: "Hvor langt har jeg kommet i opplæringen?",
      context: "Rolle: trainee. Protokoller tildelt: 4. Fullført: 2.",
      expected: { capability: "training", minConfidence: 0.8 },
      tags: ["norwegian", "training-status"],
    },
    {
      id: "training-protocol-lookup",
      message: "Show me the food safety protocol",
      context: "Role: employee. Department: Kitchen.",
      expected: { capability: "training", minConfidence: 0.7 },
      tags: ["english", "training-content"],
    },
    {
      id: "profile-contract-status",
      note: "Contract is in profile capability per intent-classifier.ts docs",
      message: "Har jeg signert kontrakten min?",
      context: "Rolle: employee. Kontraktstatus: unsigned.",
      expected: { capability: "profile", minConfidence: 0.7 },
      tags: ["norwegian", "contract"],
    },
    {
      id: "knowledge-policy-lookup",
      message: "Hva er reglene for sykefravær?",
      context: "Rolle: employee. Workspace: hospitality (restaurant).",
      expected: { capability: "knowledge", minConfidence: 0.7 },
      tags: ["norwegian", "policy"],
    },
    {
      id: "communication-send-message",
      message: "Send a message to my team lead that I'll be 10 minutes late",
      context: "Role: employee. Team: Bar.",
      expected: { capability: "communication", minConfidence: 0.7 },
      tags: ["english", "send-message"],
    },
    {
      id: "ui-navigate",
      note: "Navigation request — UI capability",
      message: "Åpne vakt-skjermen",
      context: "Rolle: employee. Device: mobile.",
      expected: { capability: "ui", minConfidence: 0.7 },
      tags: ["norwegian", "navigation"],
    },
    {
      id: "guardian-readiness-alert",
      note: "Admin asking about workspace health",
      message: "Hvor mange av teamet mitt er klare for drift?",
      context: "Rolle: admin. Workspace: hospitality.",
      expected: { capability: "guardian", minConfidence: 0.7 },
      tags: ["norwegian", "admin", "readiness"],
    },
    {
      id: "general-greeting",
      message: "Hei Botsson, hvordan går det?",
      context: "Rolle: employee.",
      expected: { capability: "general", minConfidence: 0.6 },
      tags: ["norwegian", "greeting"],
    },
    {
      id: "payroll-overtime",
      message: "Hvor mye overtid har jeg denne måneden?",
      context: "Rolle: employee. Periode: mars 2026.",
      expected: { capability: "payroll", minConfidence: 0.7 },
      tags: ["norwegian", "payroll"],
    },
  ],
};
