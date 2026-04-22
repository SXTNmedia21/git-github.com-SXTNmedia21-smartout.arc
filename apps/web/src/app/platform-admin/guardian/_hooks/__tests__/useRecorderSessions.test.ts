/**
 * Unit tests for the `aggregate` helper in useRecorderSessions.
 *
 * The helper is the ADR-0184 contract that turns a flat turn-row list into a
 * per-session summary the Platform Admin UI renders. Tests lock:
 *   1. Empty input → empty list.
 *   2. Multiple turns per session → turn_count + flagged_count + max attention.
 *   3. Multiple sessions → sorted by last_turn_at desc.
 *   4. Null attention_score is treated as 0.
 *   5. last_turn_at = latest created_at per session.
 */
import { describe, expect, it } from "vitest";
import { aggregate } from "../useRecorderSessions";

const WS = "11111111-1111-4111-8111-111111111111";
const S1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("aggregate", () => {
  it("returns empty array for no rows", () => {
    expect(aggregate([])).toEqual([]);
  });

  it("rolls up multiple turns into one session row", () => {
    const rows = [
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: 0.3,
        created_at: "2026-04-22T10:00:00Z",
      },
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: true,
        attention_score: 0.8,
        created_at: "2026-04-22T10:01:00Z",
      },
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: 0.5,
        created_at: "2026-04-22T10:02:00Z",
      },
    ];
    const result = aggregate(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      session_id: S1,
      workspace_id: WS,
      turn_count: 3,
      flagged_count: 1,
      max_attention_score: 0.8,
      last_turn_at: "2026-04-22T10:02:00Z",
    });
  });

  it("sorts multiple sessions by last_turn_at desc", () => {
    const rows = [
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: 0.1,
        created_at: "2026-04-22T10:00:00Z",
      },
      {
        session_id: S2,
        workspace_id: WS,
        is_flagged: false,
        attention_score: 0.2,
        created_at: "2026-04-22T11:00:00Z",
      },
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: 0.3,
        created_at: "2026-04-22T09:59:00Z",
      },
    ];
    const result = aggregate(rows);
    expect(result).toHaveLength(2);
    // S2 came later — should come first
    expect(result[0]!.session_id).toBe(S2);
    expect(result[1]!.session_id).toBe(S1);
  });

  it("treats null attention_score as 0", () => {
    const rows = [
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: null,
        created_at: "2026-04-22T10:00:00Z",
      },
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: null,
        created_at: "2026-04-22T10:01:00Z",
      },
    ];
    const result = aggregate(rows);
    expect(result[0]!.max_attention_score).toBe(0);
  });

  it("uses latest created_at for last_turn_at (ignores row order)", () => {
    const rows = [
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: 0.1,
        created_at: "2026-04-22T10:02:00Z",
      },
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: 0.1,
        created_at: "2026-04-22T10:00:00Z",
      },
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: 0.1,
        created_at: "2026-04-22T10:01:00Z",
      },
    ];
    const result = aggregate(rows);
    expect(result[0]!.last_turn_at).toBe("2026-04-22T10:02:00Z");
  });

  it("counts flags accurately across mixed rows", () => {
    const rows = [
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: true,
        attention_score: 0.5,
        created_at: "2026-04-22T10:00:00Z",
      },
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: true,
        attention_score: 0.5,
        created_at: "2026-04-22T10:01:00Z",
      },
      {
        session_id: S1,
        workspace_id: WS,
        is_flagged: false,
        attention_score: 0.5,
        created_at: "2026-04-22T10:02:00Z",
      },
    ];
    const result = aggregate(rows);
    expect(result[0]!.flagged_count).toBe(2);
    expect(result[0]!.turn_count).toBe(3);
  });
});
