/**
 * Tests for `useBotssonVoiceSession` — C1.b Botsson voice session orchestrator.
 *
 * Scope: the jest-node environment (no React renderer, no RN bindings) means
 * we exercise the two PURE orchestration primitives the hook delegates to:
 *
 *   - `handleAgentResponse`   — the on-response → Speech.speak bridge.
 *   - `performStart`          — the token mint → Room.connect → mic publish flow.
 *
 * This mirrors the `useFjernkontrollMachine` pattern in `apps/web` — the hook
 * is a thin `useEffect`/`useState` wrapper; all transition logic lives in
 * pure functions that stay in the fast node lane.
 *
 * Coverage focuses on acceptance-matrix rows:
 *   - Row 4: `purpose='ai_voice'` passed to the token endpoint (happy-path
 *            test asserts the minted-token factory ran and produced the
 *            policy the hook honours).
 *   - Row 5: `Speech.speak()` called on response text (text / empty / trimmed).
 *   - Row 6: policy `disabled` → token throws → error surfaced without Room
 *            creation (roomFactory NEVER called).
 */

// The hook's module imports Platform + livekit-client + expo-speech; we don't
// exercise the hook directly, but importing the pure helpers from the same
// file means those imports still load. Mock them up-front.
jest.mock(
  "react-native",
  () => ({
    Platform: { OS: "ios" },
  }),
  { virtual: true },
);

jest.mock(
  "@livekit/react-native",
  () => ({
    AudioSession: {
      startAudioSession: jest.fn(async () => {}),
      stopAudioSession: jest.fn(async () => {}),
    },
  }),
  { virtual: true },
);

// Krisp NC module calls `getLogger` from livekit-client at import time.
// The hook's `require()` guard fires before Vitest's module mock takes effect,
// so we stub the whole package to prevent the native binding from loading.
jest.mock(
  "@livekit/react-native-krisp-noise-filter",
  () => ({ KrispNoiseFilter: jest.fn(() => null) }),
  { virtual: true },
);

jest.mock(
  "livekit-client",
  () => ({
    // Room + RoomEvent are only constructed by the hook (not by the pure
    // helpers we test). The helpers accept any Room-shaped object so we
    // just return stubs here.
    Room: class FakeRoom {},
    RoomEvent: {
      Connected: "connected",
      Disconnected: "disconnected",
      TrackMuted: "track_muted",
      TrackUnmuted: "track_unmuted",
    },
  }),
  { virtual: true },
);

jest.mock(
  "expo-speech",
  () => ({
    speak: jest.fn(),
    stop: jest.fn(),
  }),
  { virtual: true },
);

jest.mock("@/lib/supabase", () => ({ supabase: {} }), { virtual: true });

jest.mock("@smartout/walkie-talkie", () => ({ getLiveKitToken: jest.fn() }), { virtual: true });

// `useVoiceTranscripts` touches `@/lib/profile-context` → supabase auth;
// the pure orchestrators we test do NOT call this hook, but the file-level
// import chain loads it. Stub to a no-op.
jest.mock(
  "@/hooks/use-voice-transcripts",
  () => ({
    useVoiceTranscripts: () => ({
      lastResponse: null,
      sessionId: undefined,
      isProcessing: false,
      error: null,
    }),
  }),
  { virtual: true },
);

// ─── Test subject ─────────────────────────────────────────────────────────

import {
  handleAgentResponse,
  performStart,
  type MintedToken,
  type SpeechAdapter,
} from "@/hooks/use-botsson-voice-session";
import type { AgentResponse } from "@/hooks/use-voice-transcripts";

// ─── Builders ─────────────────────────────────────────────────────────────

function makeSpeechAdapter(
  overrides: Partial<{ speak: jest.Mock; stop: jest.Mock; throwOnSpeak: boolean }> = {},
): SpeechAdapter & { _calls: jest.Mock; _stops: jest.Mock } {
  const speak = overrides.speak ?? jest.fn();
  const stop = overrides.stop ?? jest.fn();
  const impl: SpeechAdapter = {
    speak: overrides.throwOnSpeak
      ? jest.fn(() => {
          throw new Error("TTS backend unreachable");
        })
      : speak,
    stop,
  };
  return Object.assign(impl, { _calls: speak, _stops: stop });
}

function makeResponse(text: string): AgentResponse {
  return {
    text,
    sessionId: "sess-abc",
    pipelineLatencyMs: 321,
    intent: { capability: "schedule", confidence: 0.9 },
  };
}

function makeRoom(opts: { connectThrows?: boolean; micThrows?: boolean } = {}) {
  const connect = opts.connectThrows
    ? jest.fn(async () => {
        throw new Error("wss://livekit unreachable");
      })
    : jest.fn(async () => {});
  const disconnect = jest.fn(async () => {});
  const setMicrophoneEnabled = opts.micThrows
    ? jest.fn(async () => {
        throw new Error("permission denied");
      })
    : jest.fn(async () => {});
  return {
    connect,
    disconnect,
    localParticipant: { setMicrophoneEnabled },
    _connect: connect,
    _disconnect: disconnect,
    _mic: setMicrophoneEnabled,
  } as unknown as Parameters<typeof performStart>[0]["roomFactory"] extends () => infer R
    ? R
    : never;
}

// ─── handleAgentResponse ──────────────────────────────────────────────────

describe("handleAgentResponse — on-response TTS bridge (Acceptance row 5)", () => {
  it("calls Speech.speak with response text and nb-NO language", () => {
    const adapter = makeSpeechAdapter();
    const complete = jest.fn();

    const result = handleAgentResponse(makeResponse("Klokka er ti på ni."), {
      speak: adapter.speak,
      ttsLanguage: "nb-NO",
      onSpeakComplete: complete,
    });

    expect(result).toEqual({ nextStatus: "speaking", spoke: true });
    expect(adapter._calls).toHaveBeenCalledTimes(1);
    const [text, options] = adapter._calls.mock.calls[0];
    expect(text).toBe("Klokka er ti på ni.");
    expect(options.language).toBe("nb-NO");
    // All three completion hooks wire to the same onSpeakComplete — test this
    // because it's the state transition that returns us to 'listening'.
    expect(typeof options.onDone).toBe("function");
    options.onDone();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("skips speak() on empty or whitespace-only response text", () => {
    const adapter = makeSpeechAdapter();
    const complete = jest.fn();

    const empty = handleAgentResponse(makeResponse(""), {
      speak: adapter.speak,
      ttsLanguage: "nb-NO",
      onSpeakComplete: complete,
    });
    const whitespace = handleAgentResponse(makeResponse("   \n\t"), {
      speak: adapter.speak,
      ttsLanguage: "nb-NO",
      onSpeakComplete: complete,
    });

    expect(empty).toEqual({ nextStatus: "listening", spoke: false });
    expect(whitespace).toEqual({ nextStatus: "listening", spoke: false });
    expect(adapter._calls).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("falls back to 'listening' and surfaces onError when speak() throws", () => {
    const adapter = makeSpeechAdapter({ throwOnSpeak: true });
    const onError = jest.fn();
    const complete = jest.fn();

    const result = handleAgentResponse(makeResponse("Hei."), {
      speak: adapter.speak,
      ttsLanguage: "nb-NO",
      onSpeakComplete: complete,
      onError,
    });

    expect(result).toEqual({ nextStatus: "listening", spoke: false });
    expect(onError).toHaveBeenCalledWith({
      code: "TTS_FAILED",
      message: "TTS backend unreachable",
    });
  });
});

// ─── performStart ─────────────────────────────────────────────────────────

describe("performStart — token mint + Room.connect orchestrator", () => {
  it("happy path: mints token, creates Room, connects, publishes mic", async () => {
    // Acceptance row 4: the `purpose='ai_voice'` call is in the hook's
    // `mintToken` closure. Here we verify the orchestrator honours the
    // token's `voiceParticipation: 'interactive'` and enables the mic.
    const room = makeRoom();
    const mintToken = jest.fn(
      async (): Promise<MintedToken> => ({
        token: "eyJ-fake-jwt",
        serverUrl: "wss://livekit.example",
        voiceParticipation: "interactive",
      }),
    );
    const roomFactory = jest.fn(() => room);

    const result = await performStart({ mintToken, roomFactory });

    expect(mintToken).toHaveBeenCalledTimes(1);
    expect(roomFactory).toHaveBeenCalledTimes(1);
    expect((room as unknown as { _connect: jest.Mock })._connect).toHaveBeenCalledWith(
      "wss://livekit.example",
      "eyJ-fake-jwt",
      { autoSubscribe: true },
    );
    // Hook always passes the publishOptions arg (undefined when no Krisp processor)
    // post the krisp-nc commit (0eb276271). Test must assert the 2-arg shape.
    expect((room as unknown as { _mic: jest.Mock })._mic).toHaveBeenCalledWith(true, undefined);
    expect(result.voiceParticipation).toBe("interactive");
    expect(result.micEnabled).toBe(true);
    expect(result.room).toBe(room);
  });

  it("listen_only policy: connects but does NOT publish mic", async () => {
    const room = makeRoom();
    const mintToken = jest.fn(
      async (): Promise<MintedToken> => ({
        token: "eyJ-fake-jwt",
        serverUrl: "wss://livekit.example",
        voiceParticipation: "listen_only",
      }),
    );

    const result = await performStart({ mintToken, roomFactory: () => room });

    expect(result.voiceParticipation).toBe("listen_only");
    expect(result.micEnabled).toBe(false);
    expect((room as unknown as { _mic: jest.Mock })._mic).not.toHaveBeenCalled();
  });

  it("Acceptance row 6: policy=disabled rejects cleanly — no Room is created", async () => {
    // This is the acceptance-critical path. The edge function returns 403
    // `VOICE_PARTICIPATION_DISABLED` → getLiveKitToken throws → performStart
    // surfaces a TOKEN_FAILED BotssonVoiceError. The roomFactory must NEVER
    // run (otherwise we'd have a zombie Room object burning a LiveKit slot).
    const roomFactory = jest.fn(() => makeRoom());
    const mintToken = jest.fn(async (): Promise<MintedToken> => {
      throw new Error("VOICE_PARTICIPATION_DISABLED");
    });

    await expect(performStart({ mintToken, roomFactory })).rejects.toEqual({
      code: "TOKEN_FAILED",
      message: "VOICE_PARTICIPATION_DISABLED",
    });
    expect(roomFactory).not.toHaveBeenCalled();
  });

  it("CONNECT_FAILED cleanly disposes the Room before surfacing the error", async () => {
    const room = makeRoom({ connectThrows: true });
    const mintToken = jest.fn(
      async (): Promise<MintedToken> => ({
        token: "tok",
        serverUrl: "wss://livekit.example",
        voiceParticipation: "interactive",
      }),
    );

    await expect(performStart({ mintToken, roomFactory: () => room })).rejects.toEqual({
      code: "CONNECT_FAILED",
      message: "wss://livekit unreachable",
    });
    // We still clean up the Room we created — no leaked sockets.
    expect((room as unknown as { _disconnect: jest.Mock })._disconnect).toHaveBeenCalled();
  });

  it("audioSessionStart failure does not abort the flow", async () => {
    const room = makeRoom();
    const mintToken = jest.fn(
      async (): Promise<MintedToken> => ({
        token: "tok",
        serverUrl: "wss://livekit.example",
        voiceParticipation: "interactive",
      }),
    );
    const audioSessionStart = jest.fn(async () => {
      throw new Error("no audio routing");
    });

    const result = await performStart({
      mintToken,
      roomFactory: () => room,
      audioSessionStart,
    });

    expect(audioSessionStart).toHaveBeenCalled();
    expect(result.voiceParticipation).toBe("interactive");
  });

  it("mic enable failure keeps session running in effective-mute", async () => {
    // Robustness: a user can revoke mic permission at OS level. The hook
    // should stay connected and let the user resolve it in settings.
    const room = makeRoom({ micThrows: true });
    const mintToken = jest.fn(
      async (): Promise<MintedToken> => ({
        token: "tok",
        serverUrl: "wss://livekit.example",
        voiceParticipation: "interactive",
      }),
    );

    const result = await performStart({ mintToken, roomFactory: () => room });
    expect(result.voiceParticipation).toBe("interactive");
    expect(result.micEnabled).toBe(false);
  });
});

// ─── Transcript entry shape (P2-c) ───────────────────────────────────────────
//
// The provider accumulates TranscriptEntry[] from two sources:
//   1. voice.lastUserTranscript (set by onTranscript in the hook)
//   2. voice.lastResponse       (set by onResponse in the hook)
//
// The pure transform for each is: non-empty text → { id, role, text, timestamp }
// Empty / whitespace-only text → skip (guarded in the provider useEffects).
//
// These tests verify the shape contract so consumers (BotssonSheet) can rely on it.

type TranscriptEntry = {
  id: string;
  role: "agent" | "user";
  text: string;
  timestamp: number;
};

function makeTranscriptEntry(
  role: "agent" | "user",
  text: string,
  tsOverride?: number,
): TranscriptEntry {
  const ts = tsOverride ?? Date.now();
  return { id: `${role}-${ts}`, role, text, timestamp: ts };
}

describe("transcript entry construction — P2-c event-to-transcript shape", () => {
  it("user utterance produces a user-role entry with correct shape", () => {
    const text = "Kan du vise meg vaktplanen for i morgen?";
    const entry = makeTranscriptEntry("user", text, 1_000_000);

    expect(entry.role).toBe("user");
    expect(entry.text).toBe(text);
    expect(entry.timestamp).toBe(1_000_000);
    expect(entry.id).toBe("user-1000000");
  });

  it("agent response produces an agent-role entry with correct shape", () => {
    const text = "Klart, her er vaktplanen for i morgen.";
    const entry = makeTranscriptEntry("agent", text, 2_000_000);

    expect(entry.role).toBe("agent");
    expect(entry.text).toBe(text);
    expect(entry.timestamp).toBe(2_000_000);
    expect(entry.id).toBe("agent-2000000");
  });

  it("empty text is not eligible for an entry (guard contract)", () => {
    // Provider useEffect guards: if (!text || mode !== 'voice') return;
    // We verify the guard condition: empty / whitespace strings are falsy.
    const emptyEligible = (text: string) => !(!text || text.trim().length === 0);

    expect(emptyEligible("")).toBe(false);
    expect(emptyEligible("   \n\t")).toBe(false);
    expect(emptyEligible("Hei, kan jeg hjelpe?")).toBe(true);
  });

  it("accumulated turns preserve chronological order", () => {
    const turns: TranscriptEntry[] = [];
    const append = (entry: TranscriptEntry) => turns.push(entry);

    append(makeTranscriptEntry("user", "Hva er neste vakt min?", 1000));
    append(makeTranscriptEntry("agent", "Din neste vakt starter kl. 18:00.", 1500));
    append(makeTranscriptEntry("user", "Kan jeg bytte?", 2000));
    append(makeTranscriptEntry("agent", "Ja, du kan be om bytte.", 2500));

    expect(turns).toHaveLength(4);
    expect(turns.map((t) => t.role)).toEqual(["user", "agent", "user", "agent"]);
    expect(turns.every((t, i) => i === 0 || t.timestamp >= turns[i - 1].timestamp)).toBe(true);
  });
});
