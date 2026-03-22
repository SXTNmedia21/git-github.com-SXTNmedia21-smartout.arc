import type { PTTState } from "./call-types";

type PTTAction = "connect" | "connected" | "press" | "release" | "disconnect" | "error";

export function pttReducer(state: PTTState, action: PTTAction): PTTState {
  switch (state) {
    case "idle":
      if (action === "connect") return "connecting";
      return state;
    case "connecting":
      if (action === "connected") return "connected_muted";
      if (action === "error" || action === "disconnect") return "idle";
      return state;
    case "connected_muted":
      if (action === "press") return "talking";
      if (action === "disconnect") return "idle";
      return state;
    case "talking":
      if (action === "release") return "connected_muted";
      if (action === "disconnect") return "idle";
      return state;
    default:
      return state;
  }
}

/** Creates a debounced telemetry emitter for PTT events. Max once per interval. */
export function createPTTTelemetryDebouncer(intervalMs = 5000) {
  let lastEmitTime = 0;

  return function shouldEmit(): boolean {
    const now = Date.now();
    if (now - lastEmitTime >= intervalMs) {
      lastEmitTime = now;
      return true;
    }
    return false;
  };
}
