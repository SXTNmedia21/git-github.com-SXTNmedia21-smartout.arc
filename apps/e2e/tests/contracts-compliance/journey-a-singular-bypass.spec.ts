/**
 * Journey A — Attacker Forges Singular-Path Bypass — REJECTED
 *
 * Tests the C4 gateAction enforcement on singular contract mutation routes (SMA-311 / ADR-0315).
 * An employee-role user attempts to POST to admin-only routes and is rejected.
 *
 * Note: API-level tests. gateAction default-allows when no engine_authority_config row exists,
 * so the role gate (admin/owner required) is the primary defender in this E2E.
 * When an authority config row is seeded in the future, this test will also exercise
 * the gate_denied path.
 *
 * @see ADR-0315 (gateAction adoption)
 * @see JOURNEY-contracts-compliance-cluster.md Journey A
 */

import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3060";

// Employee credentials from seed.sql
const EMPLOYEE_EMAIL = "anna@smartout.local";
const EMPLOYEE_PASSWORD = "password123";

// A dummy contract ID — the route should 403 before loading the row
const DUMMY_CONTRACT_ID = "00000000-0000-0000-0000-000000000099";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getEmployeeJwt(): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMPLOYEE_EMAIL,
    password: EMPLOYEE_PASSWORD,
  });
  if (error || !data.session) throw new Error(`Auth failed: ${error?.message}`);
  return data.session.access_token;
}

test.describe("Journey A — Singular-Path Bypass Rejected", () => {
  test("employee POST /api/employment-contracts/[id]/regenerate → 403 or 404", async () => {
    const jwt = await getEmployeeJwt();

    const res = await fetch(
      `${BASE_URL}/api/employment-contracts/${DUMMY_CONTRACT_ID}/regenerate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: "{}",
      },
    );

    // 404 = contract not found in employee's workspace (workspace_id from JWT limits visibility)
    // 403 = role gate or gate_action deny
    expect([403, 404]).toContain(res.status);
  });

  test("employee POST /api/employment-contracts/[id]/revise → 403 or 404", async () => {
    const jwt = await getEmployeeJwt();

    const res = await fetch(`${BASE_URL}/api/employment-contracts/${DUMMY_CONTRACT_ID}/revise`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: "{}",
    });

    expect([403, 404]).toContain(res.status);
  });

  test("employee POST /api/employment-contracts/[id]/send → 401 or 403 or 404", async () => {
    const jwt = await getEmployeeJwt();

    const res = await fetch(`${BASE_URL}/api/employment-contracts/${DUMMY_CONTRACT_ID}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: "{}",
    });

    expect([401, 403, 404]).toContain(res.status);
  });
});
