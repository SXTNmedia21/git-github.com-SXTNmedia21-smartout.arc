/**
 * guardian-evaluator-recording.test.ts
 * Phase 1b Task 12 — recorder hook on guardian whispers.
 *
 * Verifies that whisperToSession() records a guardian_verdict turn with the
 * correct phase + severity. We exercise the public surface evaluateSession()
 * — the simplest path to whisperToSession() is the "missing field after 60s"
 * branch (guardian.nudge).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/supabase.js", () => {
  return {
    supabaseAdmin: {
      from: vi.fn(),
    },
  };
});

// guardian-bus pulls in pg which we do not need here.
vi.mock("../guardian-bus.js", () => ({
  emitGuardianEvent: vi.fn(),
}));

// stage-manager pulls in bigger graph; stub advanceStage so it never runs.
vi.mock("../stage-manager.js", () => ({
  advanceStage: vi.fn().mockResolvedValue(null),
}));

import { evaluateSession } from "../guardian-evaluator.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { setRecorder, type Recorder, type RecordTurnInput } from "../session-recorder.js";

type SessionRow = {
  id: string;
  workspace_id: string;
  journey_id: string;
  mission_id: string;
  current_stage_id: string;
  collected_data: Record<string, unknown>;
  created_at: string;
  stage_started_at: string;
  guardian_whisper_count: number;
  status: string;
};

type StageRow = {
  stage_id: string;
  mission_id: string;
  stage_order: number;
  journey_step_id: string;
};

type JourneyStepRow = {
  journey_step_id: string;
  title: string;
  data_writes: string[];
  min_duration_seconds: number;
  max_duration_seconds: number | null;
  required_confirmation: boolean;
};

function setupFromMock(opts: {
  session: SessionRow;
  stages: StageRow[];
  journeyStep: JourneyStepRow;
}) {
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === "engine_sessions") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: opts.session, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue(updateChain),
      };
    }
    if (table === "engine_stages") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: opts.stages, error: null }),
          }),
        }),
      };
    }
    if (table === "journey_step") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: opts.journeyStep, error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

describe("guardian-evaluator recording", () => {
  beforeEach(() => {
    setRecorder(null);
    vi.clearAllMocks();
  });
  afterEach(() => {
    setRecorder(null);
  });

  it("records guardian_verdict when whispering (missing-field nudge path)", async () => {
    const captured: RecordTurnInput[] = [];
    const stub: Recorder = {
      recordTurn: (input) => captured.push(input),
      getBufferSize: () => 0,
      getDropCount: () => 0,
      getErrorCount: () => 0,
      stop: () => {},
    };
    setRecorder(stub);

    // 61 seconds ago → triggers the "missing field after 60s" nudge.
    const stageStarted = new Date(Date.now() - 61_000).toISOString();

    setupFromMock({
      session: {
        id: "sess-1",
        workspace_id: "w-1",
        journey_id: "j-1",
        mission_id: "m-1",
        current_stage_id: "s-1",
        collected_data: {},
        created_at: stageStarted,
        stage_started_at: stageStarted,
        guardian_whisper_count: 0,
        status: "active",
      },
      stages: [
        {
          stage_id: "s-1",
          mission_id: "m-1",
          stage_order: 1,
          journey_step_id: "js-1",
        },
      ],
      journeyStep: {
        journey_step_id: "js-1",
        title: "Samle skiftinfo",
        data_writes: ["shift.start"],
        min_duration_seconds: 5,
        max_duration_seconds: null,
        required_confirmation: false,
      },
    });

    const result = await evaluateSession("sess-1");

    expect(result.action).toBe("nudge");
    const verdict = captured.find((c) => c.turnKind === "guardian_verdict");
    expect(verdict).toBeTruthy();
    expect(verdict!.phase).toBe("guardian_eval");
    const content = verdict!.content as Record<string, unknown>;
    expect(content.event_type).toBe("guardian.nudge");
    expect(content.severity).toBe("low");
  });
});
