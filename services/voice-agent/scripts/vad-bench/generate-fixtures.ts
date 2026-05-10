// services/voice-agent/scripts/vad-bench/generate-fixtures.ts
//
// Generates 20 WAV fixture files for vad-bench using espeak-ng + sox.
// Each WAV is 16kHz mono PCM16 with ≥2s trailing silence, matching the
// OpenAI Realtime input format expected by the bench recorder.
//
// Prerequisites (Linux/WSL2):
//   sudo apt install espeak-ng sox
//
// Usage:
//   pnpm --filter @smartout/voice-agent vad-bench:generate-fixtures
//
// Output: services/voice-agent/scripts/vad-bench/fixtures/wav/<id>.wav

import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(SCRIPT_DIR, "fixtures");
const WAV_DIR = join(FIXTURES_DIR, "wav");

// ---------------------------------------------------------------------------
// Fixture configuration
// ---------------------------------------------------------------------------

type SimpleFixture = {
  /** Strategy: single espeak-ng invocation piped into sox */
  strategy: "simple";
  text: string;
  /** espeak-ng words-per-minute (default 160) */
  speed?: number;
  /** espeak-ng amplitude 0-200 (default 100) */
  amplitude?: number;
  /** sox pad seconds before speech (default 0) */
  padBefore?: number;
  /** sox pad seconds of trailing silence (default 2) */
  padAfter?: number;
};

type CompoundFixture = {
  /**
   * Strategy: generate each part to a temp WAV, then sox concatenate.
   * Parts are played in order; pauseAfterMs of silence is inserted after
   * each part (except the last, which uses the shared trailing padAfter).
   */
  strategy: "compound";
  parts: Array<{
    text: string;
    speed?: number;
    amplitude?: number;
    pauseAfterMs?: number;
  }>;
  /** sox pad seconds of trailing silence after the final part (default 2) */
  padAfter?: number;
};

type FixtureConfig = SimpleFixture | CompoundFixture;

const TEXT_MAP: Record<string, FixtureConfig> = {
  "0001-short-utterance": {
    strategy: "simple",
    text: "Hei Botsson, hva er status på dagens vakter?",
    padAfter: 2,
  },

  "0002-long-utterance": {
    strategy: "simple",
    text: "Hei Botsson, kan du gi meg en oversikt over alle vaktene denne uken og hvilke ansatte som har bekreftet sine timer i tillegg til hvem som mangler dokumentasjon?",
    padAfter: 2,
  },

  "0003-back-to-back": {
    strategy: "compound",
    parts: [
      { text: "Hei Botsson.", pauseAfterMs: 300 },
      { text: "Hva er status?", pauseAfterMs: 300 },
      { text: "Klart?", pauseAfterMs: 0 },
    ],
    padAfter: 2,
  },

  "0004-long-silence-before": {
    strategy: "simple",
    text: "Hei Botsson?",
    // 5s leading silence via sox pad 5 0, then trailing
    padBefore: 5,
    padAfter: 2,
  },

  "0005-whisper": {
    strategy: "simple",
    text: "Hei Botsson, kan du hjelpe meg?",
    amplitude: 30,
    padAfter: 2,
  },

  "0006-loud": {
    strategy: "simple",
    text: "Hei Botsson, nå må du hjelpe meg!",
    amplitude: 200,
    padAfter: 2,
  },

  "0007-slow-speech": {
    strategy: "simple",
    text: "Hei Botsson, kan du hjelpe meg i dag?",
    speed: 80,
    padAfter: 2,
  },

  "0008-fast-speech": {
    strategy: "simple",
    text: "Hei Botsson kan du hjelpe oss nå?",
    speed: 250,
    padAfter: 2,
  },

  // Background noise: best-effort clean TTS — noise overlay requires
  // an external noise source file we cannot bundle. Produces clean speech.
  "0009-background-noise": {
    strategy: "simple",
    text: "Hei Botsson, hvordan ser dagen ut med tanke på bemanningen?",
    padAfter: 2,
  },

  "0010-norwegian-accented": {
    strategy: "simple",
    text: "Hei Botsson, hvordan ser dagen ut?",
    // -v no is the default for all fixtures; here we keep explicit for clarity
    padAfter: 2,
  },

  "0011-mid-pause-600ms": {
    strategy: "compound",
    parts: [
      { text: "Kan du fortelle meg", pauseAfterMs: 600 },
      { text: "hva som skjer i dag?", pauseAfterMs: 0 },
    ],
    padAfter: 2,
  },

  "0012-mid-pause-800ms": {
    strategy: "compound",
    parts: [
      { text: "Hei Botsson, hva skjer egentlig", pauseAfterMs: 800 },
      { text: "med vaktrullene denne helgen?", pauseAfterMs: 0 },
    ],
    padAfter: 2,
  },

  "0013-pause-after-comma": {
    strategy: "simple",
    // espeak-ng naturally pauses at commas — no compound needed
    text: "Hei Botsson, hvordan går det med teamet i dag?",
    padAfter: 2,
  },

  "0014-multi-clause-breath": {
    strategy: "compound",
    parts: [
      { text: "Først skal vi sjekke vaktene,", pauseAfterMs: 300 },
      { text: "deretter må vi ringe Erik,", pauseAfterMs: 300 },
      { text: "og til slutt sjekke kassen.", pauseAfterMs: 0 },
    ],
    padAfter: 2,
  },

  "0015-slow-pause-resume": {
    strategy: "compound",
    parts: [
      { text: "Skal vi se", pauseAfterMs: 700 },
      { text: "hva som skjer i kveld?", pauseAfterMs: 0 },
    ],
    padAfter: 2,
  },

  "0016-late-breath": {
    strategy: "compound",
    parts: [
      { text: "Vi har en lang dag i dag og må gjøre", pauseAfterMs: 300 },
      { text: "ferdig alt før kvelden er omme.", pauseAfterMs: 0 },
    ],
    padAfter: 2,
  },

  "0017-trailing-uhm": {
    strategy: "compound",
    parts: [
      { text: "Hei Botsson, kan du hjelpe meg med vaktlisten?", pauseAfterMs: 200 },
      { text: "uhm", pauseAfterMs: 0 },
    ],
    padAfter: 2,
  },

  "0018-filler-word-mid": {
    strategy: "compound",
    parts: [
      { text: "Vi må,", pauseAfterMs: 500 },
      { text: "er,", pauseAfterMs: 500 },
      { text: "sjekke vaktene for helgen.", pauseAfterMs: 0 },
    ],
    padAfter: 2,
  },

  "0019-declarative-rising": {
    strategy: "simple",
    // Question mark makes espeak-ng apply rising intonation; semantically declarative
    text: "Vi må hjelpe Erik?",
    padAfter: 2,
  },

  "0020-breath-only-gap": {
    strategy: "compound",
    parts: [
      { text: "Hei Botsson,", pauseAfterMs: 700 },
      { text: "hjelp meg med dette nå.", pauseAfterMs: 0 },
    ],
    padAfter: 2,
  },
};

// ---------------------------------------------------------------------------
// Generator helpers
// ---------------------------------------------------------------------------

/**
 * Generates a single part of speech to a temp WAV file.
 * Returns the absolute path to the temp file.
 */
function generatePartToTmp(
  index: number,
  id: string,
  text: string,
  speed: number,
  amplitude: number,
): string {
  const tmpPath = join(tmpdir(), `vad-bench-${id}-part${index}.wav`);
  const safeText = text.replace(/"/g, '\\"');
  const cmd = `espeak-ng -v no -s ${speed} -a ${amplitude} "${safeText}" --stdout | sox - -r 16000 -c 1 -b 16 -e signed-integer "${tmpPath}"`;
  execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] });
  return tmpPath;
}

/**
 * Generates a silence WAV of the given duration (ms) to a temp file.
 * Returns the absolute path to the temp file.
 */
function generateSilenceTmp(index: number, id: string, durationMs: number): string {
  const tmpPath = join(tmpdir(), `vad-bench-${id}-silence${index}.wav`);
  const durationSec = (durationMs / 1000).toFixed(3);
  const cmd = `sox -n -r 16000 -c 1 -b 16 -e signed-integer "${tmpPath}" trim 0.0 ${durationSec}`;
  execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] });
  return tmpPath;
}

function generateSimple(id: string, config: SimpleFixture): void {
  const wavPath = join(WAV_DIR, `${id}.wav`);
  const speed = config.speed ?? 160;
  const amplitude = config.amplitude ?? 100;
  const padBefore = config.padBefore ?? 0;
  const padAfter = config.padAfter ?? 2;
  const safeText = config.text.replace(/"/g, '\\"');

  const cmd = `espeak-ng -v no -s ${speed} -a ${amplitude} "${safeText}" --stdout | sox - -r 16000 -c 1 -b 16 -e signed-integer "${wavPath}" pad ${padBefore} ${padAfter}`;

  execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] });
}

function generateCompound(id: string, config: CompoundFixture): void {
  const wavPath = join(WAV_DIR, `${id}.wav`);
  const padAfter = config.padAfter ?? 2;

  const partFiles: string[] = [];

  for (let i = 0; i < config.parts.length; i++) {
    const part = config.parts[i];
    const speed = part.speed ?? 160;
    const amplitude = part.amplitude ?? 100;

    // Generate speech part
    const speechTmp = generatePartToTmp(i, id, part.text, speed, amplitude);
    partFiles.push(speechTmp);

    // Insert silence after part if requested
    const pauseMs = part.pauseAfterMs ?? 0;
    if (pauseMs > 0) {
      const silenceTmp = generateSilenceTmp(i, id, pauseMs);
      partFiles.push(silenceTmp);
    }
  }

  // Concatenate all parts with sox, then pad trailing silence
  const inputsArg = partFiles.map((f) => `"${f}"`).join(" ");
  const concatCmd = `sox ${inputsArg} -r 16000 -c 1 -b 16 -e signed-integer "${wavPath}" pad 0 ${padAfter}`;
  execSync(concatCmd, { stdio: ["ignore", "pipe", "inherit"] });
}

function generateFixture(id: string): void {
  const config = TEXT_MAP[id];
  if (!config) {
    throw new Error(`No text mapping for fixture id: ${id}`);
  }

  if (config.strategy === "simple") {
    generateSimple(id, config);
  } else {
    generateCompound(id, config);
  }
}

// ---------------------------------------------------------------------------
// Pre-flight check
// ---------------------------------------------------------------------------

function checkPrerequisites(): void {
  const missing: string[] = [];

  try {
    execSync("which espeak-ng", { stdio: "ignore" });
  } catch {
    missing.push("espeak-ng");
  }

  try {
    execSync("which sox", { stdio: "ignore" });
  } catch {
    missing.push("sox");
  }

  if (missing.length > 0) {
    console.error(`[generate-fixtures] FATAL: missing prerequisites: ${missing.join(", ")}`);
    console.error("[generate-fixtures] Install with: sudo apt install espeak-ng sox");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  checkPrerequisites();

  if (!existsSync(WAV_DIR)) {
    mkdirSync(WAV_DIR, { recursive: true });
    console.log(`[generate-fixtures] created ${WAV_DIR}`);
  }

  const fixtureIds = Object.keys(TEXT_MAP);
  console.log(`[generate-fixtures] generating ${fixtureIds.length} WAVs into ${WAV_DIR}`);

  for (const id of fixtureIds) {
    const config = TEXT_MAP[id];
    const preview =
      config.strategy === "simple"
        ? config.text.slice(0, 60)
        : config.parts
            .map((p) => p.text)
            .join(" | ")
            .slice(0, 60);

    process.stdout.write(`[generate-fixtures] ${id}: ${preview}...\n`);

    try {
      generateFixture(id);
    } catch (err) {
      console.error(`[generate-fixtures] FAILED ${id}:`, err);
      process.exit(2);
    }
  }

  console.log(`[generate-fixtures] DONE — ${fixtureIds.length} WAVs written to ${WAV_DIR}`);
}

main();
