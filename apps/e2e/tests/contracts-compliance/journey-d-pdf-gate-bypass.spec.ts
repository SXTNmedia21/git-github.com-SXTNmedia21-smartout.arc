/**
 * Journey D — Missing pdf_preview_viewed_at — REJECTED
 *
 * Tests the server-enforced PDF preview gate (SMA-310 / ADR-0314).
 * Scripted client sends POST /api/contracts/send without pdf_preview_viewed_at
 * (or with a future timestamp) — server rejects with 400 or 422.
 *
 * Note: These are API-level tests. No browser UI interaction required.
 * The ContractDispatchDrawer UI path is covered by journey-2-admin-send.spec.ts.
 *
 * @see ADR-0314 (server-enforced PDF-preview gate)
 * @see JOURNEY-contracts-compliance-cluster.md Journey D
 */

import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3060";

// Admin credentials from seed.sql
const ADMIN_EMAIL = "pontus@smartout.no";
const ADMIN_PASSWORD = "testpassword123";
const HQ_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const ADMIN_PROFILE_ID = "f0000000-0000-0000-0000-000000000000";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getAdminJwt(): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error || !data.session) throw new Error(`Auth failed: ${error?.message}`);
  return data.session.access_token;
}

async function seedReadyContract(): Promise<string> {
  const { data, error } = await supabase
    .from("employment_contract")
    .insert({
      profile_id: ADMIN_PROFILE_ID, // self-contract for test isolation
      workspace_id: HQ_WORKSPACE_ID,
      position_title: "E2E PDF Gate Test",
      start_date: "2026-09-01",
      employment_form: "permanent",
      employment_category: "fast",
      employment_percentage: 100,
      hourly_rate: 200,
      agreed_weekly_hours: 37.5,
      status: "draft",
      created_by: ADMIN_PROFILE_ID,
    })
    .select("contract_id")
    .single();
  if (error || !data) throw new Error(`seedReadyContract: ${error?.message}`);
  return data.contract_id;
}

test.describe("Journey D — PDF Gate Server Enforcement", () => {
  test("missing pdf_preview_viewed_at → 400 (Zod validation)", async () => {
    const jwt = await getAdminJwt();

    const res = await fetch(`${BASE_URL}/api/contracts/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        template_id: "00000000-0000-0000-0000-000000000001", // dummy UUID
        target_profile_id: ADMIN_PROFILE_ID,
        blocks_acknowledged: ["stilling", "lonn", "kategori", "framework"],
        // pdf_preview_viewed_at intentionally omitted
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeDefined();
  });

  test("future pdf_preview_viewed_at → 422 INVALID_PDF_GATE", async () => {
    const jwt = await getAdminJwt();
    const futureTs = new Date(Date.now() + 3600_000).toISOString();

    const res = await fetch(`${BASE_URL}/api/contracts/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        template_id: "00000000-0000-0000-0000-000000000001",
        target_profile_id: ADMIN_PROFILE_ID,
        blocks_acknowledged: ["stilling", "lonn", "kategori", "framework"],
        pdf_preview_viewed_at: futureTs,
      }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { code?: string; i18n_key?: string };
    expect(body.code).toBe("INVALID_PDF_GATE");
    expect(body.i18n_key).toBe("contracts.send.errors.invalid_pdf_gate");
  });
});
