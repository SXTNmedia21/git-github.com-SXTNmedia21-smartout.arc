---
title: vad-bench fixtures
status: in_progress
created: 2026-05-08
updated: 2026-05-08
module: MODULE_BOTSSON
tags: [voice, vad, bench, fixtures]
---

# vad-bench fixtures

Each fixture is a JSON file declaring a synthetic audio sample plus the
ground-truth boundary where the user's last utterance ends and silence
begins. The recorder feeds the WAV through OpenAI Realtime server-VAD
with the same `turnDetection` config the production voice-agent uses
(`services/voice-agent/src/agent.ts:114-123`), captures the server
turn-end timestamp, and writes a recording row.

## Fixture file format

```json
{
  "id": "0001-short-utterance",
  "description": "Single short utterance, 3s speech + 2s silence",
  "audio_path": "wav/0001-short-utterance.wav",
  "audio_end_ts_ms": 3000,
  "contains_internal_pauses": false
}
```

Fields:

- `id` — stable identifier used for cross-run comparison
- `description` — human-readable description of the scenario
- `audio_path` — path to WAV file, relative to this fixtures/ directory
- `audio_end_ts_ms` — ground-truth ms offset where the user's last utterance ends + silence begins
- `contains_internal_pauses` — true if the audio has mid-utterance pauses that may trigger false VAD

## WAV requirements

- 16 kHz mono PCM16, matching OpenAI Realtime input format
- ≥ 1s of trailing silence after `audio_end_ts_ms` so the server has
  enough silence to fire turn-end without running off the end of audio
- TTS-generated is fine — Norwegian TTS or `espeak-ng` output is acceptable.
  Voice clarity matters less than reliable boundary detection by the VAD.

## Generating the seed WAV files

Install prerequisites (Linux/WSL2), then run the generator:

```bash
sudo apt install espeak-ng sox
pnpm --filter @smartout/voice-agent vad-bench:generate-fixtures
```

The generator produces all 20 WAVs in `fixtures/wav/`. WAV binaries are
gitignored and must be regenerated locally before running the recorder.
The generator prints progress per fixture and exits non-zero on any failure.

## Scenarios in the seed set

The seed set covers **20 scenarios** (council R3 2026-05-08 — minimum 20),
of which **≥4 are false-end-pressure scenarios** designed to potentially
trigger false VAD end-of-turn (scenarios 17-20).

**Happy-path / latency baseline (10 scenarios):**

1. `0001-short-utterance` — Short utterance (3s + 2s silence)
2. `0002-long-utterance` — Long utterance (15s + 2s silence)
3. `0003-back-to-back` — Multiple short utterances back-to-back
4. `0004-long-silence-before` — Long silence preceding short utterance
5. `0005-whisper` — Whispered low-volume utterance
6. `0006-loud` — Loud utterance
7. `0007-slow-speech` — Slow speech rate
8. `0008-fast-speech` — Fast speech rate
9. `0009-background-noise` — Speech with background noise (lo-fi overlay)
10. `0010-norwegian-accented` — Norwegian-accented natural speech

**Mid-pause / internal-gap (6 scenarios — partial false-end pressure):**

11. `0011-mid-pause-600ms` — Mid-sentence pause 600ms (`contains_internal_pauses: true`)
12. `0012-mid-pause-800ms` — Mid-sentence pause 800ms (`contains_internal_pauses: true`)
13. `0013-pause-after-comma` — Pause-after-comma utterance (`contains_internal_pauses: true`)
14. `0014-multi-clause-breath` — Multi-clause sentence with breath gaps (`contains_internal_pauses: true`)
15. `0015-slow-pause-resume` — Slow-pause-then-resume (3s + 700ms gap + 4s + 2s silence)
16. `0016-late-breath` — Late breath mid-utterance

**False-end-pressure scenarios (≥4 designed to TRIGGER false-end — council R3 mandatory):**

17. `0017-trailing-uhm` — Trailing "uhm" (utterance ends + "uhm" 200ms later) — `false_end_pressure: true`
18. `0018-filler-word-mid` — Filler-word mid-sentence ("er" / "you know" 500ms gaps) — `false_end_pressure: true`
19. `0019-declarative-rising` — Declarative-with-rising-intonation (sounds like question, ends like statement) — `false_end_pressure: true`
20. `0020-breath-only-gap` — Breath-only-gap mid-utterance (700ms inhale, no speech) — `false_end_pressure: true`

## Adding new fixtures

1. Generate WAV file per the format above
2. Create a JSON fixture file with the correct `audio_end_ts_ms`
3. Commit both files
4. Re-run `pnpm --filter @smartout/voice-agent vad-bench:record` to update bench-results
