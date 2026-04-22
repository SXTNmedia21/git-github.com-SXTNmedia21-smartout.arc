/**
 * prompt-builder-whispers.test.ts
 * ADR-0185 — Platform admin whisper injection into the system prompt.
 *
 * Verifies:
 *   1. Unconsumed whispers are wrapped in <admin_note> with the
 *      "do NOT quote verbatim" instruction the LLM must follow.
 *   2. Whispers are marked is_consumed=true after injection (fire-and-forget).
 *   3. No whispers = no <admin_note> block, prompt unchanged.
 *   4. Recorder is invoked with phase="prompt_built" when a singleton is set.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStagePromptWithWhispers } from "../prompt-builder.js";
import { setRecorder, type Recorder } from "../session-recorder.js";
import type { Stage } from "../../types/session.js";

const stubStage: Stage = {
  stage_id: "s1",
  stage_order: 1,
  goal: "Gather shift info",
  instructions: "Ask the user about their shift.",
  success_criteria: "Shift data collected.",
  mission_id: "m1",
  creative_freedom: 0.3,
} as unknown as Stage;

type WhisperRow = {
  id: string;
  content: string;
  is_consumed: boolean;
};

function makeSupabase(opts: {
  whispers: WhisperRow[];
  onUpdate?: (ids: string[]) => void;
}): SupabaseClient {
  const updateSpy = vi.fn((values: { is_consumed?: boolean; consumed_at?: string }) => {
    void values;
    return {
      in: vi.fn((_col: string, ids: string[]) => {
        opts.onUpdate?.(ids);
        return Promise.resolve({ error: null });
      }),
    };
  });

  const from = vi.fn((table: string) => {
    if (table === "agent_session_whisper") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: opts.whispers, error: null }),
        update: updateSpy,
      };
    }
    throw new Error(`unexpected table ${table}`);
  });

  return { from } as unknown as SupabaseClient;
}

describe("buildStagePromptWithWhispers", () => {
  beforeEach(() => {
    setRecorder(null);
  });
  afterEach(() => {
    setRecorder(null);
  });

  it("injects <admin_note> wrapper + do-not-quote instruction when whispers exist", async () => {
    const sb = makeSupabase({
      whispers: [{ id: "w1", content: "User is frustrated — be gentle.", is_consumed: false }],
    });

    const prompt = await buildStagePromptWithWhispers(stubStage, {}, {}, null, {
      supabase: sb,
      sessionId: "sess-1",
      workspaceId: "w1",
    });

    expect(prompt).toContain("<admin_note");
    expect(prompt).toContain('visibility="internal"');
    expect(prompt).toContain('from="platform_admin"');
    expect(prompt).toContain("User is frustrated");
    expect(prompt).toContain("Do NOT quote");
  });

  it("marks whispers consumed after injection", async () => {
    const updated: string[][] = [];
    const sb = makeSupabase({
      whispers: [
        { id: "w1", content: "Hint A", is_consumed: false },
        { id: "w2", content: "Hint B", is_consumed: false },
      ],
      onUpdate: (ids) => updated.push(ids),
    });

    await buildStagePromptWithWhispers(stubStage, {}, {}, null, {
      supabase: sb,
      sessionId: "sess-1",
      workspaceId: "w1",
    });

    // Fire-and-forget update — allow microtask queue to drain
    await new Promise((r) => setTimeout(r, 5));
    expect(updated[0]).toEqual(["w1", "w2"]);
  });

  it("omits <admin_note> block when no unconsumed whispers exist", async () => {
    const sb = makeSupabase({ whispers: [] });

    const prompt = await buildStagePromptWithWhispers(stubStage, {}, {}, null, {
      supabase: sb,
      sessionId: "sess-1",
      workspaceId: "w1",
    });

    expect(prompt).not.toContain("<admin_note");
  });

  it("invokes recorder with phase='prompt_built' when singleton is set", async () => {
    const sb = makeSupabase({ whispers: [] });
    const recorded: Array<{ phase: string; turnKind: string }> = [];
    const stub: Recorder = {
      recordTurn: (input) => recorded.push({ phase: input.phase, turnKind: input.turnKind }),
      getBufferSize: () => 0,
      getDropCount: () => 0,
      getErrorCount: () => 0,
      stop: () => {},
    };
    setRecorder(stub);

    await buildStagePromptWithWhispers(stubStage, {}, {}, null, {
      supabase: sb,
      sessionId: "sess-1",
      workspaceId: "w1",
    });

    expect(recorded).toContainEqual({ phase: "prompt_built", turnKind: "agent_response" });
  });
});
