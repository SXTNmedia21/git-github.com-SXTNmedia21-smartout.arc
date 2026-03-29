import { test, expect } from "@playwright/test";
import { runProtocol } from "../runners/protocol-runner";
import type { ProtocolDefinition } from "../protocols/schema";

/**
 * Smoke test: Run just the login steps of P-001.
 * Verifies the protocol runner infrastructure works end-to-end.
 */
const LOGIN_ONLY: ProtocolDefinition = {
  id: "P-001-login",
  package_id: "JP-R001-ADMIN-ONBOARDING",
  name: "Admin Login (smoke test)",
  actor: "owner",
  platform: "web",
  auth_profile: "admin",
  entry_url: "/login",
  preconditions: { db_state: [] },
  steps: [
    {
      id: "1_login",
      order: 1,
      title: "Innlogging",
      description: "Admin logger inn med e-post og passord.",
      actions: [
        { type: "navigate", url: "/login" },
        { type: "settle", ms: 1500 },
        { type: "fill", testid: "login-email", value: "{{auth.email}}" },
        { type: "fill", testid: "login-password", value: "{{auth.password}}" },
        { type: "click", testid: "login-submit" },
      ],
      gate: {
        type: "url_match",
        pattern: "/(dashboard|onboarding|setup|select-workspace)",
        timeout_ms: 15_000,
      },
      screenshot: true,
    },
    {
      id: "2_authenticated",
      order: 2,
      title: "Autentisert",
      description: "Bruker er logget inn og ser en autentisert side.",
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

test.describe("Protocol Smoke: Login", () => {
  test("Login and reach authenticated page", async ({ page }) => {
    const result = await runProtocol(page, LOGIN_ONLY);

    for (const step of result.output.steps) {
      console.log(
        `  [${step.status.toUpperCase()}] Step ${step.step_order}: ${step.title} (${step.duration_ms}ms)`,
      );
    }

    expect(result.success).toBe(true);
  });
});
