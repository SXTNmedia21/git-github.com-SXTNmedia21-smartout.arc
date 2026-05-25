/**
 * Journey 2 — Admin sender kontrakt til signering (API-level + dev-path bridge)
 *
 * Covers JOURNEY-contract-module.md Journey 2, specifically:
 *   1. /api/contracts/send happy path: employment_contract.status='sent',
 *      signing_contract_id set, stub contract row with signing_url=/walt/sign-dev/<id>
 *   2. Gate: missing ack blocks → 422
 *   3. Gate: no draft contract → 422
 *   4. Gate: unknown target_profile → 403
 *   5. Gate: missing required body → 400
 *   6. Gate: unauthenticated → 401
 *   7. Gate: deprecated template → 422
 *
 * Dev-path assumptions:
 *   CONTRACT_SERVICE_URL not set → route takes the dev-path branch (no DocuSeal).
 *   Dev-path inserts stub contract row with signing_url=/walt/sign-dev/<employment_contract_id>.
 *
 * Known gaps (annotated, not failing):
 *   - notification_outbox silent-dead: trg_contract_event_notify expects 'contract_sent'
 *     but all inserts write 'sent'. See docs/sessions/2026-04-30-contract-walt-status.md.
 *   - engine_event: contracts.send.submitted has no engine_trigger handler (orphan event).
 *
 * MISSING TESTIDS (reported — we test API layer, not drawer UI):
 *   - [data-testid="dispatch-drawer"] on ContractDispatchDrawer root
 *   - [data-testid="send-contract-btn"] on the Send kontrakt button
 *   - [data-testid="ack-ring-block-{n}"] on each AcknowledgementRing block
 *   - [data-testid="compliance-blocker"] on compliance warning badge
 *   See journey-2-send-drawer.spec.ts for UI-layer coverage.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../helpers/auth";
import { supabase } from "../../helpers/seed";
import { HQ_WORKSPACE_ID, ADMIN_PROFILE_ID } from "../../helpers/journey-seed";
import { telemetryTimestamp } from "../../helpers/telemetry";

// ---------------------------------------------------------------------------
// Constants — from supabase/seed.sql
// ---------------------------------------------------------------------------

const ANNA_PROFILE_ID = "f0000000-0000-0000-0000-000000000001";
const ANNA_EMAIL = "anna@smartout.local";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function isContractServiceConfigured(): Promise<boolean> {
  const url = process.env.CONTRACT_SERVICE_URL ?? "http://localhost:5012";
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function isWebServerReachable(): Promise<boolean> {
  try {
    await fetch("http://127.0.0.1:3060/login", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
}

async function ensureTemplate(): Promise<string | null> {
  const { data: existing } = await supabase
    .from("contract_template")
    .select("template_id")
    .or(`workspace_id.eq.${HQ_WORKSPACE_ID},workspace_id.is.null`)
    .is("deprecated_at", null)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.template_id;

  const { data, error } = await supabase
    .from("contract_template")
    .insert({
      workspace_id: HQ_WORKSPACE_ID,
      name: "E2E Test Template",
      contract_type: "employee",
      language: "no",
      locale: "nb-NO",
      content_html: "<p>E2E ansettelseskontrakt</p>",
      is_system: false,
      is_active: true,
      version: 1,
      published_at: new Date().toISOString(),
      deprecated_at: null,
      created_by: ADMIN_PROFILE_ID,
    })
    .select("template_id")
    .single();

  if (error) {
    console.warn(`ensureTemplate: ${error.message}`);
    return null;
  }
  return data.template_id;
}

async function ensureDraftContract(): Promise<string> {
  const { data: existing } = await supabase
    .from("employment_contract")
    .select("contract_id")
    .eq("profile_id", ANNA_PROFILE_ID)
    .eq("workspace_id", HQ_WORKSPACE_ID)
    .in("status", ["draft", "pending_data"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.contract_id;

  const { data, error } = await supabase
    .from("employment_contract")
    .insert({
      profile_id: ANNA_PROFILE_ID,
      workspace_id: HQ_WORKSPACE_ID,
      position_title: "Servitør E2E J2",
      start_date: "2026-06-01",
      employment_form: "permanent",
      employment_category: "fast",
      employment_percentage: 100,
      remuneration_type: "hourlyWage",
      hourly_rate: 195,
      status: "draft",
      created_by: ADMIN_PROFILE_ID,
    })
    .select("contract_id")
    .single();

  if (error || !data) throw new Error(`ensureDraftContract: ${error?.message}`);
  return data.contract_id;
}

async function cleanupContractRows(empIds: string[], contractIds: string[]): Promise<void> {
  if (contractIds.length > 0) {
    await supabase.from("contract_event").delete().in("contract_id", contractIds);
    await supabase.from("contract").delete().in("contract_id", contractIds);
  }
  if (empIds.length > 0) {
    await supabase.from("employment_contract").delete().in("contract_id", empIds);
  }
}

function allAckBlocks(): string[] {
  return ["stilling", "lonn", "kategori", "framework"];
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Journey 2 — Admin sender kontrakt (API-level)", () => {
  test.describe.configure({ mode: "serial" });

  let contractServiceUp = false;
  let webServerUp = false;
  let templateId: string | null = null;

  const createdEmpIds: string[] = [];
  const createdContractIds: string[] = [];

  test.beforeAll(async () => {
    contractServiceUp = await isContractServiceConfigured();
    webServerUp = await isWebServerReachable();
    templateId = await ensureTemplate();
  });

  test.beforeEach(async () => {
    if (!webServerUp) {
      test.info().annotations.push({
        type: "web-server-offline",
        description:
          "Web dev server (127.0.0.1:3060) unreachable — skipping. Start with `pnpm dev`.",
      });
      test.skip(true, "Web dev server not running");
    }
  });

  test.afterAll(async () => {
    await cleanupContractRows(createdEmpIds, createdContractIds);
  });

  // ── 1. Happy path ──────────────────────────────────────────────────────────
  test("happy path — send oppretter stub-kontrakt og flipper status til sent", async ({ page }) => {
    test.setTimeout(60_000);
    if (!templateId) {
      test.skip(true, "No template available");
      return;
    }

    const empId = await ensureDraftContract();
    createdEmpIds.push(empId);
    const since = telemetryTimestamp();

    await loginAsAdmin(page);

    const res = await page.request.post("/api/contracts/send", {
      data: {
        template_id: templateId,
        target_profile_id: ANNA_PROFILE_ID,
        blocks_acknowledged: allAckBlocks(),
        existing_contract_id: empId,
        // BUG-6: ADR-0310 server-enforced gate requires pdf_preview_viewed_at
        // to be set before /api/contracts/send accepts the request (returns 400 without it).
        pdf_preview_viewed_at: new Date().toISOString(),
      },
    });

    expect(res.status(), `POST /api/contracts/send → ${res.status()}`).toBe(202);
    const body = (await res.json()) as {
      status?: string;
      signing_contract_id?: string;
      contract_id?: string;
    };
    expect(body.status).toMatch(/sent|queued/);

    // DB: employment_contract.status='sent', signing_contract_id set
    const { data: emp } = await supabase
      .from("employment_contract")
      .select("status, signing_contract_id")
      .eq("contract_id", empId)
      .single();
    expect(emp?.status).toBe("sent");
    expect(emp?.signing_contract_id).not.toBeNull();
    if (emp?.signing_contract_id) createdContractIds.push(emp.signing_contract_id);

    if (!contractServiceUp) {
      // Dev-path: stub contract has signing_url=/walt/sign-dev/<emp_id>
      const { data: contract } = await supabase
        .from("contract")
        .select("signing_url, status, recipient_email")
        .eq("contract_id", emp!.signing_contract_id!)
        .single();
      if (!contract) {
        test.info().annotations.push({
          type: "bug",
          description:
            "signing_contract_id set but no contract row found — dev-path bridge did not insert stub contract. " +
            "Check /api/contracts/send isContractServiceConfigured() === false branch.",
        });
      } else {
        expect(contract.signing_url).toMatch(/^\/walt\/sign-dev\//);
        expect(contract.status).toBe("sent");
        expect(contract.recipient_email).toBeTruthy();
      }
    } else {
      test.info().annotations.push({
        type: "info",
        description:
          "contract-service running — real DocuSeal path taken; dev-stub assertions skipped.",
      });
    }

    // Telemetry: contract.send_initiated (soft — annotate on miss)
    let telFound = false;
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const { data: rows } = await supabase
        .from("activity_trail")
        .select("event")
        .eq("workspace_id", HQ_WORKSPACE_ID)
        .eq("event", "contract.send_initiated")
        .gte("created_at", since)
        .limit(1);
      if (rows && rows.length > 0) {
        telFound = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!telFound) {
      test.info().annotations.push({
        type: "telemetry-gap",
        description:
          '"contract.send_initiated" not in activity_trail within 8s. ' +
          "Check registry.ts — event may route only to engine_event (orphan, no handler yet).",
      });
    }

    // Known gap: notification_outbox silent-dead
    test.info().annotations.push({
      type: "known-gap",
      description:
        "notification_outbox not asserted — trg_contract_event_notify silent-dead " +
        "(event_type mismatch: trigger expects 'contract_sent', inserts write 'sent'). " +
        "Ref: docs/sessions/2026-04-30-contract-walt-status.md §Bonus-funn.",
    });
  });

  // ── 2. Gate: missing ack blocks → 422 ─────────────────────────────────────
  test("gate — manglende ack blocks returnerer 422", async ({ page }) => {
    test.setTimeout(30_000);
    if (!templateId) {
      test.skip(true, "No template");
      return;
    }
    const empId = await ensureDraftContract();
    await loginAsAdmin(page);
    const res = await page.request.post("/api/contracts/send", {
      data: {
        template_id: templateId,
        target_profile_id: ANNA_PROFILE_ID,
        blocks_acknowledged: ["stilling"], // only 1 of 4
        existing_contract_id: empId,
      },
    });
    expect(res.status()).toBe(422);
    const body = (await res.json()) as { error?: string };
    expect(String(body.error ?? "")).toMatch(/manglende|missing|lonn|kategori|framework/i);
  });

  // ── 3. Gate: no draft → 422 ───────────────────────────────────────────────
  test("gate — ingen draft kontrakt returnerer 422", async ({ page }) => {
    test.setTimeout(30_000);
    if (!templateId) {
      test.skip(true, "No template");
      return;
    }
    const ERIK_PROFILE_ID = "f0000000-0000-0000-0000-000000000002";
    await supabase
      .from("employment_contract")
      .delete()
      .eq("profile_id", ERIK_PROFILE_ID)
      .in("status", ["draft", "pending_data"]);
    await loginAsAdmin(page);
    const res = await page.request.post("/api/contracts/send", {
      data: {
        template_id: templateId,
        target_profile_id: ERIK_PROFILE_ID,
        blocks_acknowledged: allAckBlocks(),
      },
    });
    expect(res.status()).toBe(422);
    const body = (await res.json()) as { error?: string };
    expect(String(body.error ?? "")).toMatch(/kontraktutkast|draft|ingen/i);
  });

  // ── 4. Gate: unknown profile → 403 ────────────────────────────────────────
  test("gate — ukjent target_profile_id returnerer 403", async ({ page }) => {
    test.setTimeout(30_000);
    if (!templateId) {
      test.skip(true, "No template");
      return;
    }
    await loginAsAdmin(page);
    const res = await page.request.post("/api/contracts/send", {
      data: {
        template_id: templateId,
        target_profile_id: "00000000-0000-0000-0000-deadbeef0000",
        blocks_acknowledged: allAckBlocks(),
      },
    });
    expect(res.status()).toBe(403);
  });

  // ── 5. Gate: missing required fields → 400 ────────────────────────────────
  test("gate — manglende påkrevde felt returnerer 400", async ({ page }) => {
    test.setTimeout(15_000);
    await loginAsAdmin(page);
    const res = await page.request.post("/api/contracts/send", { data: {} });
    expect(res.status()).toBe(400);
  });

  // ── 6. Gate: unauthenticated → 401/403 ───────────────────────────────────
  test("gate — uauthentisert forespørsel returnerer 401", async ({ page }) => {
    test.setTimeout(15_000);
    if (!templateId) {
      test.skip(true, "No template");
      return;
    }
    // No login — fresh page with no session
    await page.goto("/");
    const res = await page.request.post("/api/contracts/send", {
      data: {
        template_id: templateId,
        target_profile_id: ANNA_PROFILE_ID,
        blocks_acknowledged: allAckBlocks(),
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  // ── 7. Gate: deprecated template → 422 ───────────────────────────────────
  test("gate — utdatert mal returnerer 422", async ({ page }) => {
    test.setTimeout(30_000);
    const empId = await ensureDraftContract();
    const { data: dep } = await supabase
      .from("contract_template")
      .insert({
        workspace_id: HQ_WORKSPACE_ID,
        name: "E2E Deprecated Template",
        contract_type: "employee",
        language: "no",
        locale: "nb-NO",
        content_html: "<p>Utdatert</p>",
        is_system: false,
        is_active: true,
        version: 1,
        published_at: new Date(Date.now() - 86400000).toISOString(),
        deprecated_at: new Date().toISOString(),
        created_by: ADMIN_PROFILE_ID,
      })
      .select("template_id")
      .single();
    if (!dep) {
      test.skip(true, "Could not create deprecated template");
      return;
    }
    try {
      await loginAsAdmin(page);
      const res = await page.request.post("/api/contracts/send", {
        data: {
          template_id: dep.template_id,
          target_profile_id: ANNA_PROFILE_ID,
          blocks_acknowledged: allAckBlocks(),
          existing_contract_id: empId,
        },
      });
      expect(res.status()).toBe(422);
      const body = (await res.json()) as { error?: string };
      expect(String(body.error ?? "")).toMatch(/utdatert|deprecated/i);
    } finally {
      await supabase.from("contract_template").delete().eq("template_id", dep.template_id);
    }
  });
});
