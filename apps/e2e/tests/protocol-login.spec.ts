import { test, expect } from "@playwright/test";
import type { JourneyIR } from "@smartout/journey-ir";
import { runProtocol } from "../runners/protocol-runner";
import { generateDocsFromIR } from "../generators/docs-generator";
import { generateAuditFromIR } from "../generators/audit-generator";

/**
 * P-LOGIN: Login Journey
 *
 * Based on Journey 01 (Første arbeidsdag) — but scoped to the login flow only.
 * Tests: navigate to login → fill credentials → submit → reach authenticated page.
 *
 * This is the foundation — if login doesn't work, nothing else does.
 *
 * M3.5 (ADR-0178): authored as `JourneyIR` v2 directly. The legacy
 * `ProtocolDefinition` authoring shape and the migration adapter have
 * been retired (ADR-0174 C.11 closed at M3.5 exit).
 */
const P_LOGIN: JourneyIR = {
  version: "2.0.0",
  slug: "P-LOGIN",
  module: "JP-LOGIN",
  title: "Login Journey",
  actor: "employee",
  platform: "web",
  auth_profile: "admin",
  entry_url: "/login",
  preconditions: { db_state: [] },
  steps: [
    {
      key: "1_open_login",
      order: 1,
      title: "Åpne login-siden",
      description: "Bruker navigerer til login-siden og ser skjemaet.",
      action: "Bruker navigerer til login-siden og ser skjemaet. [navigate → settle]",
      assertion: 'Element [data-testid="login-email"] is visible',
      timeoutMs: 10_000,
      actions: [
        { type: "navigate", url: "/login" },
        { type: "settle", ms: 2000 },
      ],
      gate: {
        type: "ui_state",
        testid: "login-email",
        visible: true,
        timeout_ms: 10_000,
      },
      screenshot: true,
    },
    {
      key: "2_fill_credentials",
      order: 2,
      title: "Fylle inn påloggingsinfo",
      description: "Bruker skriver e-post og passord i skjemaet.",
      action: "Bruker skriver e-post og passord i skjemaet. [fill → fill → settle]",
      assertion: 'Element [data-testid="login-submit"] is visible',
      timeoutMs: 5_000,
      actions: [
        { type: "fill", testid: "login-email", value: "{{auth.email}}" },
        { type: "fill", testid: "login-password", value: "{{auth.password}}" },
        { type: "settle", ms: 500 },
      ],
      gate: {
        type: "ui_state",
        testid: "login-submit",
        visible: true,
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
    {
      key: "3_submit_login",
      order: 3,
      title: "Logg inn",
      description: "Bruker trykker logg inn og systemet autentiserer.",
      action: "Bruker trykker logg inn og systemet autentiserer. [click]",
      assertion: "URL matches pattern: /(dashboard|onboarding|setup|select-workspace)",
      timeoutMs: 15_000,
      actions: [{ type: "click", testid: "login-submit" }],
      gate: {
        type: "url_match",
        pattern: "/(dashboard|onboarding|setup|select-workspace)",
        timeout_ms: 15_000,
      },
      screenshot: true,
    },
    {
      key: "4_authenticated",
      order: 4,
      title: "Autentisert — ser innlogget side",
      description: "Bruker er logget inn og ser dashboard, onboarding, eller setup.",
      action: "Bruker er logget inn og ser dashboard, onboarding, eller setup. [settle]",
      assertion: "URL matches pattern: /(dashboard|onboarding|setup|select-workspace)",
      timeoutMs: 5_000,
      actions: [{ type: "settle", ms: 2000 }],
      gate: {
        type: "url_match",
        pattern: "/(dashboard|onboarding|setup|select-workspace)",
        timeout_ms: 5_000,
      },
      screenshot: true,
    },
  ],
  success_gate: {
    type: "url_match",
    pattern: "/(dashboard|onboarding|setup|select-workspace)",
    timeout_ms: 5_000,
  },
};

test.describe("Protocol: Login Journey", () => {
  test("P-LOGIN: Full login flow", async ({ page }) => {
    const result = await runProtocol(page, P_LOGIN);

    for (const step of result.output.steps) {
      console.log(
        `  [${step.status.toUpperCase()}] Step ${step.step_order}: ${step.title} (${step.duration_ms}ms)`,
      );
    }

    // Generate outputs
    const docsPath = generateDocsFromIR(P_LOGIN, result.output);
    console.log(`  [DOCS] ${docsPath}`);

    const auditPath = generateAuditFromIR(P_LOGIN, result.output);
    console.log(`  [AUDIT] ${auditPath}`);

    expect(result.success).toBe(true);
    expect(result.output.friction_data.failed_gates).toHaveLength(0);
  });
});
