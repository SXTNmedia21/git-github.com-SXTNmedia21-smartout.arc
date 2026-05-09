// services/voice-agent/scripts/vad-bench/false-end.ts
//
// "False end of turn" = OpenAI server VAD fired turn-end while the user
// was still speaking, i.e. before the ground-truth audio_end_ts_ms in the
// fixture. ADR-0282 R6 caps acceptable rate at 5%.

import type { Fixture, Recording } from "./types.js";

export function isFalseEnd(fixture: Fixture, recording: Recording): boolean {
  return recording.turn_end_ts_ms < fixture.audio_end_ts_ms;
}

export function falseEndRatio(recordings: readonly Recording[]): number {
  if (recordings.length === 0) return 0;
  const falseEnds = recordings.filter((r) => r.false_end).length;
  return falseEnds / recordings.length;
}
