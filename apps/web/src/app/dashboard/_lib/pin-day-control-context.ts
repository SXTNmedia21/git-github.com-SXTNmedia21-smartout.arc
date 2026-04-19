// Stub: pins the current session into engine_memory so Botsson has context
// when the leder/admin asks questions from within WebDayControl.
// Real implementation lands in PR 3 (Server Action + engine_memory insert with
// 24h TTL, source="web.day-control"). See spec §7.

// TODO(live-data): PR 3 — implement engine_memory insert.
export async function pinDayControlContext(_args: {
  sessionId: string;
  departmentName: string;
  date: string;
  profileId: string;
  workspaceId: string;
}): Promise<void> {
  // no-op until PR 3
}
