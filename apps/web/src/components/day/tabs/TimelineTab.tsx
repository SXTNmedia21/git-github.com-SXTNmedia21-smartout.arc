import type { UiPhase } from "@smartout/utils";
import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";

export function TimelineTab({
  session,
  phase: _phase,
}: {
  session: DepartmentSessionRow;
  phase: UiPhase;
}) {
  return (
    <div className="bg-card border-border rounded-[14px] border p-6">
      <h2 className="font-heading text-[22px] tracking-[-0.01em]">Dagslinjen</h2>
      <p className="text-muted-foreground mt-2 text-[13px] leading-[1.5]">
        PhaseTimeline + HookTile-liste med session_hooks og session_tasks aktiveres i{" "}
        <code className="text-foreground font-mono">PR 3</code> når{" "}
        <code className="text-foreground font-mono">use-session-hooks-with-tasks.ts</code> er
        bygget.
      </p>
      <p className="text-muted-foreground mt-4 font-mono text-[11px]">
        session={session.sessionId}
      </p>
    </div>
  );
}
