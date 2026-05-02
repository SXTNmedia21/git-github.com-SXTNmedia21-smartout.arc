// adapter-internal.ts — Internal bridge between adapter.ts and tools-orb.ts.
//
// Exposes the Room-aware publishActivity function so that orb tools can
// publish events without importing the full adapter module (which would
// create a circular dependency: adapter → tools-orb → adapter).
//
// Usage (from tools-orb.ts):
//   import { _publishActivity } from "./adapter-internal.js";
//
// adapter.ts registers the Room via setActiveLkRoom() when the room connects.
// tools-orb.ts calls _publishActivity() when a tool executes — by that time
// the Room is always populated.

import type { Room } from "@livekit/rtc-node";

const textEncoder = new TextEncoder();
const ACTIVITY_TOPIC = "botsson-activity";

let _activeLkRoom: Room | undefined;

/**
 * Register the active LiveKit Room. Called by adapter.ts when a new room
 * context is established (and cleared when the room disconnects).
 */
export function setActiveLkRoom(room: Room | undefined): void {
  _activeLkRoom = room;
}

/**
 * Publish an activity event to all participants in the current LiveKit room
 * over the "botsson-activity" data channel (reliable delivery).
 *
 * No-op if no room is active.
 */
export function _publishActivity(event: Record<string, unknown>): void {
  if (!_activeLkRoom) return;
  try {
    const payload = textEncoder.encode(JSON.stringify({ ...event, ts: Date.now() }));
    void _activeLkRoom.localParticipant?.publishData(payload, {
      topic: ACTIVITY_TOPIC,
      reliable: true,
    });
  } catch (err) {
    console.warn("[adapter-internal] _publishActivity failed:", err);
  }
}
