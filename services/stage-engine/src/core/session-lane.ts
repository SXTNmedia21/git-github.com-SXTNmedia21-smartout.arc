// session-lane.ts — Per-session promise queue that serializes concurrent agent chat requests.
// In-memory only. On process restart, queue state is lost — crash recovery relies
// on engine_session_event replay, not on SessionLane state.

export class SessionLane {
  private queues = new Map<string, Promise<unknown>>();

  async run<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(sessionId) ?? Promise.resolve();
    // Wait for previous to settle (ignore its error), then run fn
    const next = prev.catch(() => undefined).then(() => fn());

    // Store a swallowed version so next caller chains off a resolved promise
    const swallowed = next.catch(() => {});
    this.queues.set(sessionId, swallowed);

    // Cleanup after settle: only delete if we're still the latest entry
    swallowed.finally(() => {
      if (this.queues.get(sessionId) === swallowed) this.queues.delete(sessionId);
    });

    return next;
  }
}
