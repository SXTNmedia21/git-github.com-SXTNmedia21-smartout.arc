// =============================================================================
// sortie-1-mobile-shift-confirm.spec.ts
//
// Sortie 1 Phase 11 — Happy-path E2E for:
//   PATCH /api/mobile/shifts/[id]/confirm
//
// Three tests (happy + forgeable-body 422 + no-bearer 401).
//
// Auth: Bearer JWT obtained via Supabase signInWithPassword for
//       admin@smartout.local (SEED_PROFILE_ID).
//
// DB verify:
//   schedule_shift.confirmed_at IS NOT NULL + .confirmed_by = actor profile_id
//
// Telemetry verify:
//   activity_trail row with event='shift confirmed' + actor_id +
//   entity_type='schedule_shift'. Poll up to 20s (fire-and-forget emit).
//
// Seed chain:
//   schedule_shift seeded with employee_id=SEED_PROFILE_ID (actor ownership
//   check in confirmShiftAction uses employee_id). Cleaned up afterAll.
//
// ADR refs: ADR-0132, ADR-0134, ADR-0151, ADR-0298.
// =============================================================================

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import {
  SEED_PROFILE_ID,
  SEED_WORKSPACE_ID,
  assertActivityTrailEvent,
} from "../helpers/botsson-harness";
import { supabase } from "../helpers/seed";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ADMIN_EMAIL = process.env.E2E_EMAIL ?? "admin@smartout.local";
const ADMIN_PASSWORD = process.env.E2E_PASSWORD ?? "password123";
const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT) || 3060;
const BFF_BASE = `http://127.0.0.1:${E2E_WEB_PORT}`;

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAdminBearerToken(): Promise<string | null> {
  if (!SERVICE_ROLE_KEY) return null;
  try {
    const anon = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error || !data.session) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

/**
 * Seed a schedule_shift assigned to SEED_PROFILE_ID.
 * confirmShiftAction uses employee_id for ownership — must match actor.
 * Returns schedule_shift_id (the PK used in the BFF path param).
 */
async function seedShiftForConfirm(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("schedule_shift")
    .insert({
      workspace_id: SEED_WORKSPACE_ID,
      shift_date: today,
      start_time: "08:00",
      end_time: "16:00",
      employee_id: SEED_PROFILE_ID,
      day_category: "morning",
      role: "server",
      status: "published",
      is_published: true,
    })
    .select("schedule_shift_id")
    .single();
  if (error || !data) throw new Error(`seedShiftForConfirm failed: ${error?.message ?? "no data"}`);
  return data.schedule_shift_id;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Sortie 1: PATCH /api/mobile/shifts/[id]/confirm", () => {
  let bearerToken: string | null = null;
  const shiftIds: string[] = [];

  test.beforeAll(async () => {
    bearerToken = await getAdminBearerToken();
  });

  test.afterAll(async () => {
    if (shiftIds.length) {
      await supabase.from("schedule_shift").delete().in("schedule_shift_id", shiftIds);
    }
  });

  // --------------------------------------------------------------------------
  // T1: Happy path — 200 + DB mutation + telemetry
  // --------------------------------------------------------------------------

  test("happy path: valid Bearer + owned shift → 200 + confirmed_at set + activity_trail", async ({
    request,
  }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const sinceIso = new Date().toISOString();
    const shiftId = await seedShiftForConfirm();
    shiftIds.push(shiftId);

    const response = await request.patch(`${BFF_BASE}/api/mobile/shifts/${shiftId}/confirm`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      data: {},
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.shiftId).toBe(shiftId);

    // Verify DB mutation.
    const { data: row } = await supabase
      .from("schedule_shift")
      .select("confirmed_at, confirmed_by")
      .eq("schedule_shift_id", shiftId)
      .single();
    expect(row?.confirmed_at).not.toBeNull();
    expect(row?.confirmed_by).toBe(SEED_PROFILE_ID);

    // Verify telemetry — poll up to 20s.
    await assertActivityTrailEvent({
      event: "shift confirmed",
      workspaceId: SEED_WORKSPACE_ID,
      actorId: SEED_PROFILE_ID,
      sinceIso,
      poll: { timeoutMs: 20_000 },
    });
  });

  // --------------------------------------------------------------------------
  // T2: Forgeable body → 422
  // --------------------------------------------------------------------------

  test("forgeable body field → 422, confirmed_at not set", async ({ request }) => {
    if (!bearerToken) {
      test.skip(true, "Supabase local not reachable or admin fixture missing");
      return;
    }

    const shiftId = await seedShiftForConfirm();
    shiftIds.push(shiftId);

    const response = await request.patch(`${BFF_BASE}/api/mobile/shifts/${shiftId}/confirm`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      // workspace_id is a forbidden body field.
      data: { workspace_id: "00000000-0000-0000-0000-00000000DEAD" },
    });

    expect(response.status()).toBe(422);

    // Verify DB NOT mutated.
    const { data: row } = await supabase
      .from("schedule_shift")
      .select("confirmed_at")
      .eq("schedule_shift_id", shiftId)
      .single();
    expect(row?.confirmed_at).toBeNull();
  });

  // --------------------------------------------------------------------------
  // T3: Missing Bearer → 401
  // --------------------------------------------------------------------------

  test("missing Bearer → 401", async ({ request }) => {
    const fakeShiftId = "00000000-0000-0000-0000-000000000001";

    const response = await request.patch(`${BFF_BASE}/api/mobile/shifts/${fakeShiftId}/confirm`, {
      data: {},
    });

    expect(response.status()).toBe(401);
  });
});
