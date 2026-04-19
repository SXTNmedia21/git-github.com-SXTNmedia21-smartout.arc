// Re-export of the Server Action so the client-side WebDayControl mount
// effect can call `pinDayControlContext(...)` from a thin wrapper.
// Real implementation lives in apps/web/src/app/dashboard/_actions/pin-day-control-context.ts.

import { pinDayControlContextAction } from "@/app/dashboard/_actions/pin-day-control-context";

export async function pinDayControlContext(args: {
  sessionId: string;
  departmentName: string;
  date: string;
  profileId: string;
  workspaceId: string;
}): Promise<void> {
  // profileId and workspaceId are re-derived server-side (ADR-0151) — the
  // args here are only used for the memory content text.
  void args.profileId;
  void args.workspaceId;
  await pinDayControlContextAction({
    sessionId: args.sessionId,
    departmentName: args.departmentName,
    date: args.date,
  });
}
