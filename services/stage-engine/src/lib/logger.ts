/**
 * logger.ts
 * Pino logger substrate for stage-engine (ADR-0113 Runtime Telemetry Standard).
 *
 * - baseLogger: service-wide root, tagged with { service: "stage-engine" }
 * - childLogger: per-request/session/workspace child with bound context fields
 *
 * Dev emits human-readable lines via pino-pretty. Prod emits JSON.
 */
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

// NOTE: explicit `process.stdout` destination is required so tests can spy
// via vi.spyOn(process.stdout, "write"). pino v10's default sonic-boom
// bypasses process.stdout via fs.writeSync(1, ...). See pino-pretty v13
// transport docs — the worker thread also escapes standard stdout spying,
// which is why tests stub NODE_ENV=production + resetModules.
export const baseLogger = isDev
  ? pino({
      level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
      base: { service: "stage-engine" },
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss" },
      },
    })
  : pino(
      {
        level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
        base: { service: "stage-engine" },
      },
      process.stdout,
    );

export type LogContext = {
  requestId?: string;
  sessionId?: string;
  workspaceId?: string;
  profileId?: string;
};

export function childLogger(ctx: LogContext) {
  return baseLogger.child(ctx);
}
