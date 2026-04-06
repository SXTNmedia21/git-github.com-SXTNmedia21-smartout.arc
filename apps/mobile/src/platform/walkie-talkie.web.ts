/**
 * Web fallback for @smartout/walkie-talkie.
 * All call/PTT functionality is disabled on web for beta.
 * Metro resolves `@smartout/walkie-talkie` to this file when building for web.
 */

/* ---------- Types ---------- */

export type CallSession = {
  roomName: string;
  token: string;
  participants: string[];
};

export type CallSignalingEvent = {
  type: string;
  payload: unknown;
};

export type IncomingCall = {
  callId: string;
  callerName: string;
  channelId: string;
};

export type CallLogEntry = {
  id: string;
  type: string;
  timestamp: string;
};

export type AudioPolicy = "speaker" | "earpiece";
export type VideoPolicy = "camera" | "screen" | "off";

export type PTTState = {
  isTransmitting: boolean;
  isReceiving: boolean;
  currentSpeaker: string | null;
};

/* ---------- Functions ---------- */

export async function startCall(): Promise<null> {
  return null;
}

export async function getLiveKitToken(): Promise<null> {
  return null;
}

export function subscribeToPersonalCalls(
  _workspaceId: string,
  _profileId: string,
  _callback: (event: CallSignalingEvent) => void,
): () => void {
  return () => {};
}

export function subscribeToChannelCalls(
  _channelId: string,
  _callback: (event: CallSignalingEvent) => void,
): () => void {
  return () => {};
}

export function pttReducer(state: PTTState, _action: unknown): PTTState {
  return state;
}

export function createPTTTelemetryDebouncer() {
  return {
    track: () => {},
    flush: () => {},
  };
}
