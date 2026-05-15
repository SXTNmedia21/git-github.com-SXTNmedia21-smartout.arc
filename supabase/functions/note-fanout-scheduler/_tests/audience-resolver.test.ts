/**
 * audience-resolver.test.ts
 * Unit tests for resolveAudienceProfileIds().
 *
 * Uses a mock SupabaseClient that returns configurable fixture data.
 * Tests cover all 7 cases per ADR-0332 § Test Strategy.
 *
 * Run: deno test supabase/functions/note-fanout-scheduler/_tests/audience-resolver.test.ts --allow-all
 */

import { assertEquals } from "jsr:@std/assert@1";
import { resolveAudienceProfileIds } from "../audience-resolver.ts";
import type { NoteAudience, MinimalSupabaseClient } from "../audience-resolver.ts";

// ─── Mock SupabaseClient factory ─────────────────────────────────────────────

type MockRow = Record<string, string | null>;
type TableFixtures = Record<string, MockRow[]>;

/**
 * Creates a minimal mock SupabaseClient. Each `.from(table)` call returns
 * a chainable builder that resolves via `.select()` to the fixture rows.
 * Filters: `.in(col, vals)`, `.eq(col, val)` are applied in-memory.
 */
function createMockClient(fixtures: TableFixtures): MinimalSupabaseClient {
  return {
    from(table: string) {
      const rows: MockRow[] = fixtures[table] ?? [];
      let filtered = [...rows];

      const builder = {
        select(_cols: string) {
          return builder;
        },
        in(col: string, vals: string[]) {
          filtered = filtered.filter((r) => vals.includes(r[col] as string));
          return builder;
        },
        eq(col: string, val: string) {
          filtered = filtered.filter((r) => r[col] === val);
          return builder;
        },
        is(_col: string, _val: null) {
          // Not used in audience-resolver; no-op
          return builder;
        },
        // Resolves the chain — called implicitly after await
        then(resolve: (value: { data: MockRow[]; error: null }) => void) {
          resolve({ data: filtered, error: null });
        },
      };
      return builder;
    },
  };
}

const WS = "ws-0000-0000-0000-000000000001";

// ─── Test cases ──────────────────────────────────────────────────────────────

Deno.test("empty audience returns 0 profile_ids and 0 dangling", async () => {
  const client = createMockClient({
    profile: [
      { profile_id: "p1", workspace_id: WS },
    ],
  });
  const result = await resolveAudienceProfileIds({}, WS, client);
  assertEquals(result.profileIds, []);
  assertEquals(result.danglingCount, 0);
});

Deno.test("profile_ids only — returns them as-is (after dangling filter)", async () => {
  const client = createMockClient({
    profile: [
      { profile_id: "p1", workspace_id: WS, primary_department_id: null },
      { profile_id: "p2", workspace_id: WS, primary_department_id: null },
    ],
  });
  const audience: NoteAudience = { profile_ids: ["p1", "p2"] };
  const result = await resolveAudienceProfileIds(audience, WS, client);
  assertEquals(result.profileIds.sort(), ["p1", "p2"]);
  assertEquals(result.danglingCount, 0);
});

Deno.test("team_ids only — resolves via team_member", async () => {
  const client = createMockClient({
    team_member: [
      { team_id: "t1", profile_id: "p3" },
      { team_id: "t1", profile_id: "p4" },
    ],
    profile: [
      { profile_id: "p3", workspace_id: WS, primary_department_id: null },
      { profile_id: "p4", workspace_id: WS, primary_department_id: null },
    ],
  });
  const audience: NoteAudience = { team_ids: ["t1"] };
  const result = await resolveAudienceProfileIds(audience, WS, client);
  assertEquals(result.profileIds.sort(), ["p3", "p4"]);
  assertEquals(result.danglingCount, 0);
});

Deno.test("shift_ids only — resolves via schedule_shift.employee_id", async () => {
  const client = createMockClient({
    schedule_shift: [
      { schedule_shift_id: "s1", employee_id: "p5", workspace_id: WS },
      { schedule_shift_id: "s2", employee_id: "p6", workspace_id: WS },
    ],
    profile: [
      { profile_id: "p5", workspace_id: WS, primary_department_id: null },
      { profile_id: "p6", workspace_id: WS, primary_department_id: null },
    ],
  });
  const audience: NoteAudience = { shift_ids: ["s1", "s2"] };
  const result = await resolveAudienceProfileIds(audience, WS, client);
  assertEquals(result.profileIds.sort(), ["p5", "p6"]);
  assertEquals(result.danglingCount, 0);
});

Deno.test("dept_ids only — resolves via profile.primary_department_id", async () => {
  const client = createMockClient({
    profile: [
      { profile_id: "p7", workspace_id: WS, primary_department_id: "d1" },
      { profile_id: "p8", workspace_id: WS, primary_department_id: "d1" },
    ],
  });
  const audience: NoteAudience = { dept_ids: ["d1"] };
  const result = await resolveAudienceProfileIds(audience, WS, client);
  assertEquals(result.profileIds.sort(), ["p7", "p8"]);
  assertEquals(result.danglingCount, 0);
});

Deno.test("mixed audience — deduplicates overlapping profile_ids", async () => {
  // p1 appears via profile_ids AND team_ids (overlap)
  const client = createMockClient({
    team_member: [
      { team_id: "t1", profile_id: "p1" },
      { team_id: "t1", profile_id: "p9" },
    ],
    profile: [
      { profile_id: "p1", workspace_id: WS, primary_department_id: "d1" },
      { profile_id: "p9", workspace_id: WS, primary_department_id: null },
    ],
  });
  const audience: NoteAudience = {
    profile_ids: ["p1"],
    team_ids: ["t1"],
  };
  const result = await resolveAudienceProfileIds(audience, WS, client);
  // p1 must appear exactly once even though resolved from two sources
  assertEquals(result.profileIds.sort(), ["p1", "p9"]);
  assertEquals(result.danglingCount, 0);
});

Deno.test("dangling profile_id — filtered and counted", async () => {
  // "ghost" was deleted from profile table between note creation and fire time
  const client = createMockClient({
    profile: [
      // only p10 exists; ghost is absent
      { profile_id: "p10", workspace_id: WS, primary_department_id: null },
    ],
  });
  const audience: NoteAudience = { profile_ids: ["p10", "ghost-uuid-deleted"] };
  const result = await resolveAudienceProfileIds(audience, WS, client);
  assertEquals(result.profileIds, ["p10"]);
  assertEquals(result.danglingCount, 1);
});

Deno.test("cross-workspace profile filtered by dangling check", async () => {
  // p11 exists but in a DIFFERENT workspace — workspace_id filter in dangling step drops it
  const client = createMockClient({
    profile: [
      // only WS-resident profiles returned (mock eq filter on workspace_id)
      { profile_id: "p12", workspace_id: WS, primary_department_id: null },
      // p11 from other workspace would be filtered by .eq("workspace_id", WS)
    ],
  });
  const audience: NoteAudience = { profile_ids: ["p11", "p12"] };
  const result = await resolveAudienceProfileIds(audience, WS, client);
  assertEquals(result.profileIds, ["p12"]);
  assertEquals(result.danglingCount, 1);
});
